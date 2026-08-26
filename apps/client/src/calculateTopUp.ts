import dotenv from "dotenv";
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

dotenv.config();

// Contract configurations from deployment specifications
const S_VUSD_VAULT = "0x476310E34D2810f7d79C43A74E4D79405bd7a925";
const YIELD_DISTRIBUTOR = "0x55745265Ba172378cf45d224F09F0673cB470cef";

const minimalAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
  "function yieldDuration() view returns (uint256)",
]);

async function main() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(process.env.RPC_URL_1 ?? process.env.RPC_URL_1_BACKUP),
  });

  console.log("🔍 ANALYZING PROTOCOL DILUTION STATES...");

  // 1. Fetch live metrics across the system
  const [totalAssets, rewardRate, periodFinish, yieldDuration] =
    await Promise.all([
      client.readContract({
        address: S_VUSD_VAULT,
        abi: minimalAbi,
        functionName: "totalAssets",
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "rewardRate",
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "periodFinish",
      }),
      client.readContract({
        address: YIELD_DISTRIBUTOR,
        abi: minimalAbi,
        functionName: "yieldDuration",
      }),
    ]);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const SECONDS_PER_YEAR = 31536000n;

  // 2. Compute remaining un-dripped yield in Wei
  let remainingYieldWei = 0n;
  if (periodFinish > now) {
    remainingYieldWei = ((periodFinish - now) * rewardRate) / 10n ** 18n;
  }

  const currentTVL = Number(formatUnits(totalAssets, 18));
  const currentRemaining = Number(formatUnits(remainingYieldWei, 18));

  console.log(`- Current sVUSD Pool TVL: ${currentTVL.toFixed(2)} VUSD`);
  console.log(
    `- Remaining Un-dripped Yield: ${currentRemaining.toFixed(4)} VUSD`
  );

  // 3. Compute Required Top-Up for a Fresh 7-Day Window
  const TARGET_APR_BASIS = 10n; // 10% Target for VUSD

  // Total yield required over a full 7-day window (yieldDuration) to achieve 10% APY on totalAssets
  const required7DayYieldWei =
    (totalAssets * TARGET_APR_BASIS * yieldDuration) /
    (100n * SECONDS_PER_YEAR);

  // Top-up needed is the difference between target 7-day yield and what's already queued
  const topUpRequiredWei =
    required7DayYieldWei > remainingYieldWei
      ? required7DayYieldWei - remainingYieldWei
      : 0n;

  const topUpRequired = Number(formatUnits(topUpRequiredWei, 18));

  // Calculate effective APR if we do NOT top up over the next full 7 days
  const projectedAnnualizedYield =
    (remainingYieldWei * SECONDS_PER_YEAR) / yieldDuration;
  const projectedApr =
    totalAssets > 0n
      ? (Number(projectedAnnualizedYield) / Number(totalAssets)) * 100
      : 0;

  console.log("\n📊 DILUTION COMPENSATOR RESULT:");
  if (topUpRequiredWei <= 0n) {
    console.log(
      "✅ The current drip rate is healthy over the next 7-day window!"
    );
  } else {
    console.log(
      "❌ Dilution Detected! To maintain 10% APR for the upcoming 7-day window:"
    );
    console.log(
      `👉 You need to inject an additional: **${topUpRequired.toFixed(2)} VUSD**`
    );
    console.log(
      "\nRun this exact command to extend the 7-day window to 10% APR immediately:"
    );
    console.log(
      "\x1b[36m%s\x1b[0m",
      `pnpm vusd:drip ${topUpRequired.toFixed(2)}`
    );
  }

  console.log(
    `\n📈 Projected 7-Day Active Yield APR: ${projectedApr.toFixed(2)}%`
  );
}

main().catch(console.error);
