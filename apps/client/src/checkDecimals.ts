import { createPublicClient, http, erc20Abi, getAddress } from "viem";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const HEMI_BTC = getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00");
const VUSD = getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619");

async function check() {
  const client = createPublicClient({ 
    chain: mainnet, 
    transport: http(process.env.RPC_URL_1) 
  });

  console.log("🔍 Checking token decimals...");

  try {
    const btcDecimals = await client.readContract({ 
      address: HEMI_BTC, 
      abi: erc20Abi, 
      functionName: 'decimals' 
    });
    
    const vusdDecimals = await client.readContract({ 
      address: VUSD, 
      abi: erc20Abi, 
      functionName: 'decimals' 
    });

    console.log(`---------------------------------`);
    console.log(`HemiBTC Decimals: ${btcDecimals}`);
    console.log(`VUSD Decimals:    ${vusdDecimals}`);
    console.log(`---------------------------------`);

    // Morpho Price Scaling Verification
    // Price should be scaled by 1e36
    console.log("\n💡 Morpho Math Check:");
    console.log("If HemiBTC is 8 decimals and VUSD is 18:");
    console.log("Collateral Value = (Amount * Price) / 10^36");
    
  } catch (error) {
    console.error("🛑 Error reading decimals. Verify the token addresses are correct on Mainnet.");
  }
}

check();
