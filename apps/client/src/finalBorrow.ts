import { createWalletClient, http, publicActions, type Hex, parseUnits, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
const REAL_MARKET_ID = "0xd3b93e2f5f0ba017121d1ba896efe800d097962f6bc43c6786f7393c6a12c58a" as Hex;

async function run() {
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createWalletClient({ 
    account, chain: mainnet, transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  const marketParams = {
    loanToken: getAddress("0x677ddbd918637E5F2C79e164D402454dE7dA8619"),
    collateralToken: getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00"),
    oracle: getAddress("0x9F7c53ae6eFa70251fF6F6dD5401076F33fd4543"), // Checksummed version from logs [cite: 32]
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n,
  };

  console.log(`\n🔍 Checking Real Market ID: ${REAL_MARKET_ID}`);
  
  const [supplyShares, borrowShares, collateral] = await client.readContract({
    address: MORPHO_BLUE,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [REAL_MARKET_ID, account.address],
  });

  console.log(`✅ Current Collateral: ${collateral.toString()} raw units`);
  console.log(`✅ Current Supply: ${supplyShares.toString()} shares`);

  if (collateral === 0n) {
    console.error("🛑 ERROR: No collateral found in the real market. Double check Etherscan for address 0x7b6...fBeF.");
    process.exit(1);
  }

  console.log("🚀 Executing Borrow: 90 VUSD...");
  try {
    const hash = await client.writeContract({
      address: MORPHO_BLUE,
      abi: morphoBlueAbi,
      functionName: "borrow",
      args: [marketParams, parseUnits("90", 18), 0n, account.address, account.address],
    });
    console.log(`⏳ Borrow Transaction Sent: ${hash}`);
    await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
    console.log("\n🎉 SUCCESS: Your position is live and borrowing 90 VUSD!");
  } catch (e: any) {
    console.error("🛑 Borrow failed:");
    console.error(e.shortMessage || e.message);
  }
}

run();
