import { createWalletClient, http, publicActions, type Hex, encodeDeployData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";
import oracleData from "./oracle.json"; 

dotenv.config();

async function run() {
  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const rpc = process.env.RPC_URL_1;
  if (!pk || !rpc) throw new Error("Check your .env for PK and RPC URL");

  const account = privateKeyToAccount(pk);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpc),
  }).extend(publicActions);

  // Initial price scaled by 1e36 for Morpho Blue compatibility
  const initialPrice = 100000n * 10n ** 36n;

  const deployData = encodeDeployData({
    abi: oracleData.abi,
    bytecode: `0x${oracleData.bytecode}` as Hex,
    args: [initialPrice],
  });

  console.log(`\n🔍 PROBING DEPLOYMENT FOR: ${account.address}`);
  
  try {
    // Stage 1: Simulation (eth_call)
    // This catches invalid opcodes (PUSH0) and logic reverts locally
    await client.call({ account, data: deployData });
    console.log("✅ Stage 1: Simulation Passed!");

    // Stage 2: Gas Estimation
    const gasEstimate = await client.estimateGas({ account, data: deployData });
    console.log(`✅ Stage 2: Estimation Passed (${gasEstimate.toString()} gas)`);

    // Stage 3: Live Broadcast
    console.log("🚀 Stage 3: Broadcasting to Mainnet...");
    const hash = await client.sendTransaction({
      to: null, 
      data: deployData,
      gas: (gasEstimate * 120n) / 100n, // 20% buffer to avoid congestion errors
    });

    console.log(`⏳ Hash: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    
    if (receipt.status === "reverted") throw new Error("On-chain revert!");

    console.log(`\n🎉 SUCCESS! Oracle deployed at: ${receipt.contractAddress}`);
  } catch (error: any) {
    console.error("\n🛑 DEPLOYMENT ABORTED");
    console.error(`Reason: ${error.shortMessage || error.message}`);
    process.exit(1);
  }
}

run();
