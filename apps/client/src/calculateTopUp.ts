// =============================================================================
// FILE: apps/client/src/calculateTopUp.ts
// RUN:  pnpm vusd:check-dilution
//
// WHAT THIS SCRIPT DOES
// It reads the sVUSD staking vault and the VUSD YieldDistributor. It tells you
// how much VUSD you must send to distribute() so that sVUSD pays the target
// APR over the next 7 day window.
//
// HOW THE PIECES CONNECT
//   1. You call distribute(amount) on the YieldDistributor.
//   2. The distributor holds a "pot". It releases the pot to the vault at
//      rewardRate tokens per second until periodFinish.
//   3. The pot that is still left at any moment is:
//          remaining = rewardRate * (periodFinish - now)
//   4. On every distribute() the contract computes:
//          new pot = remaining + amount
//      It then spreads the new pot over a fresh 7 day window.
//   So the top up you need is:  target pot for 7 days  minus  remaining.
//
// PROBLEM THIS VERSION FIXES (found on 2026-11-22)
// The old version took "now" from the local computer clock (Date.now()).
// The contract takes "now" from the block timestamp. On 2026-11-22 the local
// clock was about 3.9 days behind, because the machine was restored from an
// old VM clone. The script then believed that much more time was left in the
// window. It printed a "remaining" number that was far too high and a top up
// that was far too low. Three drips were needed in place of one.
//
// SOLUTION
//   A. "now" comes from the latest block timestamp. This is the same clock
//      that the contract uses, so the two can no longer disagree.
//   B. All contract reads are pinned to that same block number. A load
//      balanced RPC cannot mix values from two different blocks.
//   C. The script compares the local clock with the block time. It prints a
//      warning when they differ by more than CLOCK_DRIFT_WARN_SECONDS. The
//      math does not use the local clock. The warning only tells you that the
//      machine clock needs attention.
//   D. A shortfall smaller than TOLERANCE_BPS of the target counts as healthy.
//      This stops advice such as "drip 0.00".
//   E. The suggested amount is rounded up to the printed decimals. One drip
//      then reaches the target and does not stop a tiny amount below it.
//
// NOTE ON THE CONTRACT VERSION
// Since about 2026-11-16 the deployed distribute() settles accrued yield to
// the vault before it reschedules. The manual sync deposit is not needed any
// more. This script prints pendingYield() so you can still see that amount.
// =============================================================================

import dotenv from "dotenv";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

dotenv.config();

// Contract addresses from the vetro-contracts deployment (issue 111).
const S_VUSD_VAULT = "0x476310E34D2810f7d79C43A74E4D79405bd7a925";
const YIELD_DISTRIBUTOR = "0x55745265Ba172378cf45d224F09F0673cB470cef";

// Settings you may want to change.
const TOKEN_SYMBOL = "VUSD";
const TOKEN_DECIMALS = 18;
const TVL_DECIMALS = 2; // decimals printed for the pool TVL
const AMOUNT_DECIMALS = 4; // decimals printed for yield amounts
const DRIP_DECIMALS = 2; // decimals used in the suggested drip command
const TARGET_APR_PERCENT = 10n; // 10% target for sVUSD
const TOLERANCE_BPS = 50n; // 50 basis points = 0.5% of the target pot
const CLOCK_DRIFT_WARN_SECONDS = 120n;
const DRIP_COMMAND = "pnpm vusd:drip";

const SECONDS_PER_YEAR = 31536000n;
const RATE_PRECISION = 10n ** 18n; // rewardRate is scaled by 1e18 in the contract

const minimalAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
  "function yieldDuration() view returns (uint256)",
  "function pendingYield() view returns (uint256)",
]);

// Format a token amount in wei as a string with a fixed number of decimals.
function fmt(amountWei: bigint, decimals: number): string {
  return Number(formatUnits(amountWei, TOKEN_DECIMALS)).toFixed(decimals);
}

// Round a wei amount UP to the decimals used in the drip command.
// Example with 2 decimals: 165.2412 becomes 165.25.
function roundUpToDripDecimals(amountWei: bigint): bigint {
  const unit = 10n ** BigInt(TOKEN_DECIMALS - DRIP_DECIMALS);
  return ((amountWei + unit - 1n) / unit) * unit;
}

async function main() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(process.env.RPC_URL_1 ?? process.env.RPC_URL_1_BACKUP),
  });

  console.log(`ANALYZING s${TOKEN_SYMBOL} YIELD STATE`);

  // ---------------------------------------------------------------------------
  // STEP 1: Take one block as the single source of truth.
  // block.timestamp is the clock the contract uses. block.number pins all
  // reads below to the same state.
  // ---------------------------------------------------------------------------
  const block = await client.getBlock({ blockTag: "latest" });
  const now = block.timestamp;
  const blockNumber = block.number;

  console.log(
    `- Block: ${blockNumber} (block time ${new Date(Number(now) * 1000).toISOString()})`
  );

  // ---------------------------------------------------------------------------
  // STEP 2: Clock check. The local clock is NOT used in any formula below.
  // A normal difference is a few seconds, because blocks arrive every 12
  // seconds. A large difference means the machine clock is wrong.
  // ---------------------------------------------------------------------------
  const localNow = BigInt(Math.floor(Date.now() / 1000));
  const drift = localNow - now;
  const absDrift = drift < 0n ? -drift : drift;
  if (absDrift > CLOCK_DRIFT_WARN_SECONDS) {
    console.log(
      `WARNING: local clock differs from block time by ${drift} seconds ` +
        `(${(Number(drift) / 86400).toFixed(2)} days).`
    );
    console.log(
      "         The numbers below use block time, so they are still correct."
    );
    console.log(
      "         Fix the machine clock (check with: timedatectl) or the RPC node is stale."
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Read all values at the same block.
  // ---------------------------------------------------------------------------
  const [totalAssets, rewardRate, periodFinish, yieldDuration, pendingYield] =
    await Promise.all([
      client.readContract({
        address: S_VUSD_VAULT,
        abi: minimalAbi,
        functionName: "totalAssets",
        blockNumber,
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "rewardRate",
        blockNumber,
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "periodFinish",
        blockNumber,
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "yieldDuration",
        blockNumber,
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "pendingYield",
        blockNumber,
      }),
    ]);

  // ---------------------------------------------------------------------------
  // STEP 4: Remaining pot, measured from block time.
  // This is the same value the contract adds your amount to in distribute().
  // ---------------------------------------------------------------------------
  const secondsLeft = periodFinish > now ? periodFinish - now : 0n;
  const remainingYieldWei = (secondsLeft * rewardRate) / RATE_PRECISION;

  console.log(
    `- Current s${TOKEN_SYMBOL} Pool TVL: ${fmt(totalAssets, TVL_DECIMALS)} ${TOKEN_SYMBOL}`
  );
  console.log(
    `- Remaining un-dripped yield: ${fmt(remainingYieldWei, AMOUNT_DECIMALS)} ${TOKEN_SYMBOL}`
  );
  console.log(
    `- Time left in current window: ${(Number(secondsLeft) / 86400).toFixed(2)} days ` +
      `(${secondsLeft} seconds)`
  );
  console.log(
    `- Accrued, not yet settled to vault: ${fmt(pendingYield, AMOUNT_DECIMALS)} ${TOKEN_SYMBOL} ` +
      "(the next distribute() settles it)"
  );
  if (secondsLeft === 0n) {
    console.log(
      "- NOTE: the window has ended. The vault earns nothing until the next drip."
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Target pot for a fresh 7 day window, and the top up needed.
  //   target pot = TVL * APR * yieldDuration / one year
  //   top up     = target pot - remaining
  // ---------------------------------------------------------------------------
  const requiredPotWei =
    (totalAssets * TARGET_APR_PERCENT * yieldDuration) /
    (100n * SECONDS_PER_YEAR);

  const shortfallWei =
    requiredPotWei > remainingYieldWei
      ? requiredPotWei - remainingYieldWei
      : 0n;

  const toleranceWei = (requiredPotWei * TOLERANCE_BPS) / 10000n;

  // APR over the next full window if you drip nothing more. A drip of any
  // size restarts the window with pot = remaining + amount.
  const projectedApr =
    totalAssets > 0n && yieldDuration > 0n
      ? (Number(remainingYieldWei) * Number(SECONDS_PER_YEAR) * 100) /
        (Number(yieldDuration) * Number(totalAssets))
      : 0;

  console.log("\nRESULT:");
  console.log(
    `- Target: ${TARGET_APR_PERCENT}% APR needs a pot of ${fmt(requiredPotWei, AMOUNT_DECIMALS)} ${TOKEN_SYMBOL} per window`
  );
  console.log(
    `- Projected APR from the remaining pot alone: ${projectedApr.toFixed(2)}%`
  );

  if (shortfallWei <= toleranceWei) {
    console.log(
      `- HEALTHY: the remaining pot is within ${Number(TOLERANCE_BPS) / 100}% of the target. No top up needed.`
    );
  } else {
    const suggestedWei = roundUpToDripDecimals(shortfallWei);
    console.log(
      `- TOP UP NEEDED: ${fmt(shortfallWei, AMOUNT_DECIMALS)} ${TOKEN_SYMBOL} to reach ${TARGET_APR_PERCENT}% APR`
    );
    console.log("\nRun this command:");
    console.log(
      "\x1b[36m%s\x1b[0m",
      `${DRIP_COMMAND} ${fmt(suggestedWei, DRIP_DECIMALS)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
