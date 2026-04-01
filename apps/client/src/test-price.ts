import { createPublicClient, http, formatUnits, getAddress } from "viem";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";
import adapterData from "./adapter-artifacts.json";

dotenv.config();

// The address you just deployed
const ADAPTER_ADDRESS = getAddress("0xc84ae189a8ffbe0d158ddb707c687829555ae8e6");

async function checkPrice() {
  const rpc = process.env.RPC_URL_1;
  if (!rpc) throw new Error("Missing RPC_URL_1 in .env");

  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpc),
  });

  console.log(`\n🔍 Querying Oracle Adapter at: ${ADAPTER_ADDRESS}`);

  try {
    // Call the price() function
    const priceRaw = await client.readContract({
      address: ADAPTER_ADDRESS,
      abi: adapterData.abi,
      functionName: "price",
    }) as bigint;

    const formattedPrice = formatUnits(priceRaw, 18);

    console.log("-----------------------------------------");
    console.log(`✅ RAW PRICE:       ${priceRaw.toString()}`);
    console.log(`✅ FORMATTED PRICE: ${formattedPrice} VUSD per sVUSD`);
    console.log("-----------------------------------------");

    if (priceRaw >= 1000000000000000000n) {
      console.log("🚀 Status: Price is valid and above floor.");
    } else {
      console.log("⚠️ Status: Price is below floor (Check Vault State)");
    }
    
  } catch (error: any) {
    console.error("\n🛑 FAILED TO GET PRICE");
    console.error(`Reason: ${error.message}`);
    console.log("\nPossible causes:");
    console.log("1. sVUSD has 0 total supply (totalSupply check fails)");
    console.log("2. The exchange rate is below 1e18 (Price Floor check fails)");
    console.log("3. The price exceeds the 5% sanity cap (1.05e18)");
  }
}

checkPrice();
