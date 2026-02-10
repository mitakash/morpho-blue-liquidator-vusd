import { createPublicClient, http, getAddress, type Hex, formatUnits } from "viem";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
const REAL_MARKET_ID = "0xd3b93e2f5f0ba017121d1ba896efe800d097962f6bc43c6786f7393c6a12c58a" as Hex;
const MY_WALLET = getAddress("0x7b6027ba861A99FFbFAFb19B44934cE9B042fBeF");

async function verify() {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });

  console.log(`\n🕵️ Verifying Control for: ${MY_WALLET}`);
  
  const [supplyShares, borrowShares, collateral] = await client.readContract({
    address: MORPHO_BLUE,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [REAL_MARKET_ID, MY_WALLET],
  });

  console.log("--------------------------------------------------");
  console.log(`💎 Collateral (HemiBTC): ${formatUnits(collateral, 8)} BTC`);
  console.log(`🏦 Supplied (VUSD):      ${formatUnits(supplyShares, 18)} shares`);
  console.log(`💸 Borrowed (VUSD):      ${formatUnits(borrowShares, 18)} shares`);
  console.log("--------------------------------------------------");

  if (collateral > 0n) {
    console.log("✅ VERIFIED: You have full control of these assets.");
  } else {
    console.log("❌ ALERT: No assets found. You may be checking the wrong Market ID.");
  }
}

verify().catch(console.error);
