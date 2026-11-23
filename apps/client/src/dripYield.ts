// =============================================================================
// FILE: apps/client/src/dripYield.ts
// RUN:  pnpm vusd:drip <amount>      example: pnpm vusd:drip 165.25
//
// WHAT THIS SCRIPT DOES
// It sends VUSD to the YieldDistributor with distribute(amount). The
// distributor then releases the pot to the sVUSD vault over the next 7 days.
//
// HOW THE PIECES CONNECT
//   1. approve(distributor, amount) on VUSD.
//   2. distribute(amount) on the YieldDistributor. Inside this call the
//      contract does three things:
//        a. It settles yield that already accrued to the vault (YieldPulled).
//        b. It computes: new pot = remaining + amount.
//        c. It starts a fresh 7 day window with rewardRate = new pot / 7 days.
//      It then emits YieldDistributed(distributor, amount, newRewardRate,
//      periodFinish).
//
// PROBLEM THIS VERSION FIXES (found on 2026-11-22)
// The old version printed only "SUCCESS". To learn the result you had to run
// the check-dilution script. That script used the local computer clock, and
// the clock was wrong, so the result looked wrong and you dripped three times.
//
// SOLUTION
// After the transaction confirms, this script decodes the YieldDistributed
// event from the receipt. The event holds the exact new rewardRate that the
// contract stored. From it the script prints:
//   - the yield settled to the vault in this transaction
//   - the remaining pot that the contract used
//   - the new pot and the new window end
//   - the new projected APR, compared with the target
// These numbers come only from the chain. No local clock is involved. You do
// not need a second check to know what the drip did.
// =============================================================================

import {
  createWalletClient,
  http,
  publicActions,
  parseUnits,
  formatUnits,
  getAddress,
  erc20Abi,
  parseAbi,
  parseEventLogs,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

// Contract addresses from the vetro-contracts deployment (issue 111).
const VUSD_ADDR = getAddress("0xCa83DDE9c22254f58e771bE5E157773212ACBAc3");
const S_VUSD_VAULT_ADDR = getAddress("0x476310E34D2810f7d79C43A74E4D79405bd7a925");
const YIELD_DISTRIBUTOR_ADDR = getAddress("0x55745265Ba172378cf45d224F09F0673cB470cef");

// Settings you may want to change. Keep the target equal to calculateTopUp.ts.
const TOKEN_SYMBOL = "VUSD";
const TOKEN_DECIMALS = 18;
const DISPLAY_DECIMALS = 4;
const TARGET_APR_PERCENT = 10; // used only for the comparison line at the end
const TOLERANCE_PERCENT_OF_TARGET = 0.5; // same 0.5% tolerance as the checker

const SECONDS_PER_YEAR = 31536000n;
const RATE_PRECISION = 10n ** 18n; // rewardRate is scaled by 1e18 in the contract

const yieldDistributorAbi = parseAbi([
  "function distribute(uint256 amount_)",
  "function yieldDuration() view returns (uint256)",
  "event YieldDistributed(address indexed distributor, uint256 amount, uint256 newRewardRate, uint256 periodFinish)",
  "event YieldPulled(uint256 amount)",
]);

const vaultAbi = parseAbi(["function totalAssets() view returns (uint256)"]);

// Format a token amount in wei as a string with a fixed number of decimals.
function fmt(amountWei: bigint): string {
  return Number(formatUnits(amountWei, TOKEN_DECIMALS)).toFixed(DISPLAY_DECIMALS);
}

async function main() {
  // Read the amount from the command line.
  const arg = process.argv[2];
  if (!arg) {
    throw new Error("Usage: npx tsx apps/client/src/dripYield.ts <amount> (e.g., 76)");
  }
  const amountToDrip = parseUnits(arg, TOKEN_DECIMALS);
  if (amountToDrip === 0n) {
    throw new Error("Amount must be greater than zero. distribute(0) reverts with ZeroAmount.");
  }

  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  if (!pk) throw new Error("Missing LIQUIDATION_PRIVATE_KEY_1 in your .env file.");

  const account = privateKeyToAccount(pk);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(process.env.RPC_URL_1),
  }).extend(publicActions);

  console.log("\nINITIATING VUSD YIELD DRIP");
  console.log(`- Operating Wallet (EOA): ${account.address}`);
  console.log(`- Amount: ${arg} ${TOKEN_SYMBOL}`);

  // ---------------------------------------------------------------------------
  // STEP 0: Balance check before any transaction is sent.
  // ---------------------------------------------------------------------------
  const currentBalance = await client.readContract({
    address: VUSD_ADDR,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (currentBalance < amountToDrip) {
    throw new Error(
      `Insufficient funds. Your wallet has ${formatUnits(currentBalance, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}, ` +
        `but you requested to drip ${arg} ${TOKEN_SYMBOL}.`
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Approve the distributor to take the amount.
  // ---------------------------------------------------------------------------
  console.log("\nStep 1: Granting VUSD allowance to YieldDistributor...");
  const approveHash = await client.writeContract({
    address: VUSD_ADDR,
    abi: erc20Abi,
    functionName: "approve",
    args: [YIELD_DISTRIBUTOR_ADDR, amountToDrip],
  });

  console.log(`Waiting for approval confirmation: ${approveHash}`);
  const approveReceipt = await client.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") {
    throw new Error("Approval transaction reverted. Nothing was distributed.");
  }
  console.log("Allowance approved.");

  // ---------------------------------------------------------------------------
  // STEP 2: Call distribute().
  // ---------------------------------------------------------------------------
  console.log("\nStep 2: Calling distribute()...");
  const distributeHash = await client.writeContract({
    address: YIELD_DISTRIBUTOR_ADDR,
    abi: yieldDistributorAbi,
    functionName: "distribute",
    args: [amountToDrip],
  });

  console.log(`Waiting for distribute confirmation: ${distributeHash}`);
  const receipt = await client.waitForTransactionReceipt({ hash: distributeHash });

  if (receipt.status !== "success") {
    console.error("ERROR: distribute() reverted on chain. Nothing was distributed.");
    process.exitCode = 1;
    return;
  }

  console.log(`\nSUCCESS. Confirmed in block ${receipt.blockNumber}.`);

  // ---------------------------------------------------------------------------
  // STEP 3: Verify the result from the receipt itself.
  // The events are emitted by the distributor inside our transaction, so they
  // show exactly what the contract stored.
  // ---------------------------------------------------------------------------
  const distributorLogs = receipt.logs.filter(
    (log) => getAddress(log.address) === YIELD_DISTRIBUTOR_ADDR
  );
  const distributedEvents = parseEventLogs({
    abi: yieldDistributorAbi,
    eventName: "YieldDistributed",
    logs: distributorLogs,
  });
  const pulledEvents = parseEventLogs({
    abi: yieldDistributorAbi,
    eventName: "YieldPulled",
    logs: distributorLogs,
  });

  const distributed = distributedEvents[0];
  if (!distributed) {
    console.log(
      "WARNING: no YieldDistributed event found in the receipt. Run pnpm vusd:check-dilution to verify."
    );
    return;
  }

  // YieldPulled is missing when nothing had accrued. That is normal.
  const settledWei = pulledEvents.reduce((sum, e) => sum + e.args.amount, 0n);

  // Read the window length and the vault TVL at the block of our transaction.
  const [yieldDuration, totalAssets] = await Promise.all([
    client.readContract({
      address: YIELD_DISTRIBUTOR_ADDR,
      abi: yieldDistributorAbi,
      functionName: "yieldDuration",
      blockNumber: receipt.blockNumber,
    }),
    client.readContract({
      address: S_VUSD_VAULT_ADDR,
      abi: vaultAbi,
      functionName: "totalAssets",
      blockNumber: receipt.blockNumber,
    }),
  ]);

  // new pot = newRewardRate * yieldDuration. This inverts the contract formula
  // rewardRate = newTotal * 1e18 / yieldDuration.
  const newPotWei = (distributed.args.newRewardRate * yieldDuration) / RATE_PRECISION;
  const remainingUsedWei =
    newPotWei > distributed.args.amount ? newPotWei - distributed.args.amount : 0n;

  const newApr =
    totalAssets > 0n && yieldDuration > 0n
      ? (Number(newPotWei) * Number(SECONDS_PER_YEAR) * 100) /
        (Number(yieldDuration) * Number(totalAssets))
      : 0;

  // Print one aligned "label: value" line.
  const line = (label: string, value: string) =>
    console.log(`- ${(label + ":").padEnd(45)}${value}`);

  console.log("\nRESULT FROM CHAIN EVENTS:");
  line("Yield settled to vault in this transaction", `${fmt(settledWei)} ${TOKEN_SYMBOL}`);
  line("Remaining pot the contract used", `${fmt(remainingUsedWei)} ${TOKEN_SYMBOL}`);
  line("Amount added", `${fmt(distributed.args.amount)} ${TOKEN_SYMBOL}`);
  line("New pot for the next window", `${fmt(newPotWei)} ${TOKEN_SYMBOL}`);
  line("Window ends", new Date(Number(distributed.args.periodFinish) * 1000).toISOString());
  line(`s${TOKEN_SYMBOL} Pool TVL`, `${fmt(totalAssets)} ${TOKEN_SYMBOL}`);
  line("New projected APR", `${newApr.toFixed(2)}%`);

  // Comparison with the target. This is information only. You may drip a
  // different amount on purpose.
  const lowestOkApr = TARGET_APR_PERCENT * (1 - TOLERANCE_PERCENT_OF_TARGET / 100);
  if (newApr >= lowestOkApr) {
    console.log(`- Target ${TARGET_APR_PERCENT}% APR: REACHED`);
  } else {
    console.log(
      `- Target ${TARGET_APR_PERCENT}% APR: NOT REACHED. Run pnpm vusd:check-dilution for the exact top up.`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
