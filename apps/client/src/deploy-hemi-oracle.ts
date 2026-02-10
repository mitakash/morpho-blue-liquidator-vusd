import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";
import oracleData from "./oracle.json"; 

dotenv.config();

async function deploy() {
  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ 
    account, 
    chain: mainnet, 
    transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  console.log("🚀 Deploying Hemi-Corrected Oracle...");

  /**
   * PEDANTIC SCALING MATH:
   * Target Price: $100,000
   * Protocol Base Scale: 10^36
   * Decimal Offset (18 - 8): 10^10
   * Total Scaling: 10^36 * 10^10 = 10^46
   * Raw Constructor Value: 100,000 * 10^46 = 10^51
   */
  const initialPrice = 100_000n * (10n ** 46n);

  console.log(`📊 Initial Price: ${initialPrice.toString()}`);
  console.log(`🔢 Precision: 46 digits of scaling`);

  const hash = await client.deployContract({
    abi: oracleData.abi,
    bytecode: `0x${oracleData.bytecode.replace(/^0x/, '')}` as Hex, // Ensure even length & 0x prefix
    args: [initialPrice],
  });

  console.log(`⏳ Broadcasted: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash });
  
  console.log(`\n🎉 SUCCESS! Oracle deployed at: ${receipt.contractAddress}`);
  console.log(`📝 Save this address for your new createMarket call.`);
}

deploy().catch(console.error);
