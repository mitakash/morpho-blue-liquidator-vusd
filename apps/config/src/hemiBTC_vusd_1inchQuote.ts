import dotenv from "dotenv";
import path from "path";
import { formatUnits } from "viem";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function getQuote() {
  const apiKey = process.env.ONE_INCH_SWAP_API_KEY;

  if (!apiKey) {
    console.error("🛑 Error: ONE_INCH_SWAP_API_KEY not found.");
    return;
  }

  // HemiBTC -> VUSD
  const url = `https://api.1inch.dev/swap/v6.0/1/quote?src=0x06ea695B91700071B161A434fED42D1DcbAD9f00&dst=0x677ddbd918637E5F2c79e164D402454dE7dA8619&amount=144737`;

  try {
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    }) as any;

    const data = await response.json() as any;
    
    if (data.dstAmount) {
       console.log("✅ 1inch Quote Success!");
       console.log(`💰 Expected VUSD: ${formatUnits(data.dstAmount, 18)}`);
  
       // Safely extract the protocol names from the nested arrays
       const route = data.protocols?.flat(2).map((p: any) => p.name).join(" -> ");
       console.log(`🛣️ Route Path: ${route || "Direct"}`);
    } else {
      console.error("🛑 Quote Failed. Response:", data.description || data.message || data);
    }
  } catch (err) {
    console.error("🛑 Execution Error:", err);
  }
}

getQuote();
