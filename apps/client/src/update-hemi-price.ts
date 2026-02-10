import { createWalletClient, http, publicActions, type Hex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";
import oracleData from "./oracle.json"; 

dotenv.config();

async function updatePrice() {
  // Get price from command line: npx tsx script.ts 100000
  const priceArg = process.argv[2];
  if (!priceArg) {
    console.error("🛑 Error: Please provide a price (e.g., npx tsx ... 100000)");
    process.exit(1);
  }

  const targetPriceUsd = Number(priceArg);
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createWalletClient({ 
    account, chain: mainnet, transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  const ORACLE_ADDRESS = getAddress("0x2b816cecb2ccf258426d8d5699db697fd9279bc5");

  /**
   * PEDANTIC SCALING:
   * 10^46 bridges the gap between 8-decimal HemiBTC and 18-decimal VUSD.
   */
  const scaledPrice = BigInt(targetPriceUsd) * (10n ** 46n);

  console.log(`🔮 Setting Oracle to $${targetPriceUsd}...`);
  console.log(`🔢 Sending Scaled Value: ${scaledPrice.toString()}`);

  const hash = await client.writeContract({
    address: ORACLE_ADDRESS,
    abi: oracleData.abi,
    functionName: "setPrice",
    args: [scaledPrice],
  });

  console.log(`⏳ Pending: ${hash}`);
  await client.waitForTransactionReceipt({ hash });
  console.log(`✅ SUCCESS: Price is now $${targetPriceUsd}`);
}

updatePrice().catch(console.error);
