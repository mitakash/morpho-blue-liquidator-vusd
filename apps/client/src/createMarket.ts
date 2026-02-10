import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const chainId = 1;
  const rpcUrl = process.env[`RPC_URL_${chainId}`]!;
  const privateKey = process.env[`LIQUIDATION_PRIVATE_KEY_${chainId}`] as Hex;
  
  if (!rpcUrl || !privateKey) throw new Error("Missing RPC_URL_1 or private key in .env");

  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  }).extend(publicActions);

  const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
  
  const marketParams = {
    loanToken: "0x677ddbd918637E5F2c79e164D402454dE7dA8619" as Hex, // VUSD
    collateralToken: "0x06ea695B91700071B161A434fED42D1DcbAD9f00" as Hex, // HemiBTC
    oracle: "0x9f7c53ae6efa70251ff6f6dd5401076f33fd4543" as Hex, // Your Verified Oracle
    irm: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC" as Hex, // Mainnet Adaptive Curve IRM
    lltv: 945000000000000000n, // 94.5% LLTV (Standard enabled value)
  };

  console.log(`\n🔍 Wallet: ${account.address}`);
  console.log("🛠️ Initializing Morpho Blue Market...");
  console.log(`   Loan: VUSD`);
  console.log(`   Collateral: HemiBTC`);
  console.log(`   IRM: Adaptive Curve`);

  try {
    const hash = await client.writeContract({
      address: MORPHO_BLUE,
      abi: morphoBlueAbi,
      functionName: "createMarket",
      args: [marketParams],
    });

    console.log(`⏳ Transaction sent! Hash: ${hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await client.waitForTransactionReceipt({ hash });
    
    if (receipt.status === "success") {
      console.log("\n✅ Success! Market Created.");
      console.log(`📦 Block Number: ${receipt.blockNumber}`);
    } else {
      console.error("\n❌ Transaction reverted.");
    }
  } catch (error: any) {
    console.error("\n🛑 Market creation failed:");
    console.error(error.shortMessage || error.message);
  }
}

run().catch(console.error);
