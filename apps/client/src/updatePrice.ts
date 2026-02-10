import { createWalletClient, http, type Hex, encodeFunctionData, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

async function update(oracleAddress: string, newPriceInVusd: number) {
  const chainId = 1;
  const rpcUrl = process.env[`RPC_URL_${chainId}`]!;
  const privateKey = process.env[`LIQUIDATION_PRIVATE_KEY_${chainId}`] as Hex;
  
  if (!rpcUrl || !privateKey) throw new Error("Missing RPC_URL_1 or private key in .env");

  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  }).extend(publicActions); // Extension allows us to wait for receipt

  // Scale: price * 10^36 for Morpho Blue compatibility
  const scaledPrice = BigInt(newPriceInVusd) * 10n ** 36n;

  console.log(`\n🔍 Wallet: ${account.address}`);
  console.log(`🛠️ Updating Oracle ${oracleAddress} to ${newPriceInVusd} VUSD...`);

  try {
    const hash = await client.sendTransaction({
      to: oracleAddress as Hex,
      data: encodeFunctionData({
        abi: [{ name: "setPrice", type: "function", inputs: [{ name: "newPrice", type: "uint256" }] }],
        functionName: "setPrice",
        args: [scaledPrice],
      }),
    });

    console.log(`⏳ Transaction sent: ${hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await client.waitForTransactionReceipt({ hash });
    
    if (receipt.status === "success") {
      console.log(`\n✅ Success! Oracle price updated in block ${receipt.blockNumber}`);
    } else {
      console.error("\n❌ Transaction reverted on-chain.");
    }
  } catch (error: any) {
    console.error("\n🛑 Failed to update price:");
    console.error(error.shortMessage || error.message);
  }
}

// Command line arguments logic
const [,, addr, price] = process.argv;
if (addr && price) {
    update(addr, Number(price)).catch(console.error);
} else {
    console.log("\nUsage: npx tsx apps/client/src/updatePrice.ts <ORACLE_ADDRESS> <PRICE_IN_VUSD>");
    console.log("Example: npx tsx apps/client/src/updatePrice.ts 0x9f7...543 100000");
}
