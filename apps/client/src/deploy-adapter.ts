import { createWalletClient, http, publicActions, type Hex, encodeDeployData, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";
import adapterData from "./adapter-artifacts.json"; 

dotenv.config();

const SVUSD_PROXY = getAddress("0x476310E34D2810f7d79C43A74E4D79405bd7a925");

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

  const deployData = encodeDeployData({
    abi: adapterData.abi,
    bytecode: `0x${adapterData.bytecode}` as Hex,
    args: [SVUSD_PROXY],
  });

  console.log(`\n🔍 PROBING DEPLOYMENT FOR ADAPTER...`);
  
  try {
    // Stage 1: Simulation
    await client.call({ account, data: deployData });
    console.log("✅ Stage 1: Simulation Passed!");

    // Stage 2: Gas Estimation
    const gasEstimate = await client.estimateGas({ account, data: deployData });
    console.log(`✅ Stage 2: Estimation Passed (${gasEstimate.toString()} gas)`);

    // Stage 3: Broadcast
    console.log("🚀 Stage 3: Broadcasting to Mainnet...");
    const hash = await client.sendTransaction({
      to: null, 
      data: deployData,
      gas: (gasEstimate * 120n) / 100n,
    });

    console.log(`⏳ Hash: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`\n🎉 SUCCESS! Adapter deployed at: ${receipt.contractAddress}`);
  } catch (error: any) {
    console.error("\n🛑 DEPLOYMENT ABORTED");
    console.error(`Reason: ${error.shortMessage || error.message}`);
    process.exit(1);
  }
}

run();
