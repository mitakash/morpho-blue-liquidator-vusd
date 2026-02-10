import { createPublicClient, http, type Hex, formatUnits } from "viem";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const ORACLE_ABI = [
  {
    name: "price",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

async function verify(oracleAddress: string) {
  const rpcUrl = process.env.RPC_URL_1!;
  
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });

  console.log(`\n🔍 Querying Oracle: ${oracleAddress}`);

  try {
    const rawPrice = await client.readContract({
      address: oracleAddress as Hex,
      abi: ORACLE_ABI,
      functionName: "price",
    });

    console.log(`🔢 Raw value: ${rawPrice.toString()}`);
    
    // Morpho Blue expects scale 1e36
    const humanReadable = Number(rawPrice) / 1e36;
    console.log(`💎 Scaled value (1e36): ${humanReadable}`);
    
    if (humanReadable === 100000) {
      console.log("✅ Match! The oracle is correctly set to 100,000 VUSD/HemiBTC.");
    } else {
      console.warn("⚠️ Mismatch. Please double check your last updatePrice run.");
    }
  } catch (error: any) {
    console.error("🛑 Failed to read oracle:");
    console.error(error.message);
  }
}

const [,, addr] = process.argv;
if (addr) {
  verify(addr).catch(console.error);
} else {
  console.log("Usage: npx tsx apps/client/src/verifyPrice.ts <ORACLE_ADDRESS>");
  // Default to your deployed oracle for convenience
  verify("0x9f7c53ae6efa70251ff6f6dd5401076f33fd4543").catch(console.error);
}
