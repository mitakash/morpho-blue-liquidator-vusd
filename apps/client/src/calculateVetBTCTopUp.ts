import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

// Contract configurations from vetBTC deployment specifications
const S_VETBTC_VAULT = "0x0cB9D84d4bcEc8d3D5B2d99a6F07f4605325987e";
const VETBTC_YIELD_DISTRIBUTOR = "0xd74bcf1299176E98899bA2e86dD2C9aE089F5276";

const minimalAbi = parseAbi([
    "function totalAssets() view returns (uint256)",
    "function rewardRate() view returns (uint256)",
    "function periodFinish() view returns (uint256)",
    "function yieldDuration() view returns (uint256)"
]);

async function main() {
    const client = createPublicClient({
        chain: mainnet,
        transport: http(process.env.RPC_URL_1 || process.env.RPC_URL_1_BACKUP)
    });

    console.log("🔍 ANALYZING VETBTC PROTOCOL DILUTION STATES...");

    // 1. Fetch live metrics across the system
    const [totalAssets, rewardRate, periodFinish, yieldDuration] = await Promise.all([
        client.readContract({ address: S_VETBTC_VAULT, abi: minimalAbi, functionName: "totalAssets" }),
        client.readContract({ address: VETBTC_YIELD_DISTRIBUTOR, abi: minimalAbi, functionName: "rewardRate" }),
        client.readContract({ address: VETBTC_YIELD_DISTRIBUTOR, abi: minimalAbi, functionName: "periodFinish" }),
        client.readContract({ address: VETBTC_YIELD_DISTRIBUTOR, abi: minimalAbi, functionName: "yieldDuration" })
    ]);

    const now = BigInt(Math.floor(Date.now() / 1000));
    const SECONDS_PER_YEAR = 31536000n;
    
    // 2. Compute remaining un-dripped yield in Wei
    let remainingYieldWei = 0n;
    if (periodFinish > now) {
        remainingYieldWei = ((periodFinish - now) * rewardRate) / 10n**18n;
    }

    const currentTVL = Number(formatUnits(totalAssets, 18));
    const currentRemaining = Number(formatUnits(remainingYieldWei, 18));

    // 3. Compute Live Current Yield APR
    const currentAnnualYieldWei = periodFinish > now ? (rewardRate * SECONDS_PER_YEAR) / 10n**18n : 0n;
    const currentApr = totalAssets > 0n ? (Number(currentAnnualYieldWei) / Number(totalAssets)) * 100 : 0;

    console.log(`- Current svetBTC Pool TVL: ${currentTVL.toFixed(6)} vetBTC`);
    console.log(`- Remaining Un-dripped Yield: ${currentRemaining.toFixed(8)} vetBTC`);

    // 4. Compute Rate Deficit to hit exactly 5% target APR
    const TARGET_APR_BASIS = 5n; // 5% Target for vetBTC
    const targetAnnualYieldWei = (totalAssets * TARGET_APR_BASIS) / 100n;
    
    const annualDeficitWei = targetAnnualYieldWei > currentAnnualYieldWei ? targetAnnualYieldWei - currentAnnualYieldWei : 0n;
    const topUpRequiredWei = (annualDeficitWei * yieldDuration) / SECONDS_PER_YEAR;
    const topUpRequired = Number(formatUnits(topUpRequiredWei, 18));

    console.log("\n📊 VETBTC DILUTION COMPENSATOR RESULT:");
    if (topUpRequiredWei <= 0n) {
        console.log("✅ The current vetBTC drip rate is healthy! No dilution compensation is required right now.");
    } else {
        console.log(`❌ Dilution Detected! To restore a stable 5% APR across the expanded pool:`);
        console.log(`👉 You need to inject an additional: **${topUpRequired.toFixed(8)} vetBTC**`);
        console.log(`\nRun this exact command to patch the yield variance immediately:`);
        console.log(`\x1b[36m%s\x1b[0m`, `pnpm vetbtc:drip ${topUpRequired.toFixed(8)}`);
    }

    console.log(`\n📈 Current Active Yield APR: ${currentApr.toFixed(2)}%`);
}

main().catch(console.error);
