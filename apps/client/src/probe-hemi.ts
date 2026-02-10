// apps/client/src/probe-hemi.ts
import { createPublicClient, http, getAddress, parseUnits, formatUnits } from "viem";
import { mainnet } from "viem/chains";
import { HemiLiquidator } from "./liquidator";
import dotenv from "dotenv";

dotenv.config();

async function probe() {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });
  const liquidator = new HemiLiquidator();
  const executor = getAddress(process.env.EXECUTOR_ADDRESS_1!);
  const apiKey = process.env.ONE_INCH_SWAP_API_KEY!;

  console.log("🔍 PROBING ATOMIC LIQUIDATION PATH...");

  // 1. Verify 1inch can route HemiBTC back to crvUSD
  const hemiAmount = 144737n; // Your test supply amount
  try {
    const { to, data } = await liquidator.getRepaymentSwapData(hemiAmount, executor, apiKey);
    console.log("✅ 1inch Repayment Route Verified.");
    console.log(`   Expected Repayment Asset: crvUSD`);
  } catch (err) {
    console.error("❌ 1inch Routing Failed. Repayment path might be dry.");
  }

  // 2. Check Curve Pool Price for the Profit Simulation
  const swapAmount = parseUnits("90", 18); // Simulate 90 crvUSD swap
  const expectedVusd = await client.readContract({
    address: "0xb1c189dfde178fe9f90e72727837cc9289fb944f",
    abi: [{ name: "get_dy", type: "function", inputs: [{type: "int128"}, {type: "int128"}, {type: "uint256"}], outputs: [{type: "uint256"}] }],
    functionName: "get_dy",
    args: [0n, 1n, swapAmount]
  });

  console.log(`📊 Curve Price Check: 90 crvUSD will buy ${formatUnits(expectedVusd, 18)} VUSD.`);
  
  if (expectedVusd >= parseUnits("90", 18)) {
    console.log("✅ Liquidity is sufficient for the debt acquisition.");
  } else {
    console.warn("⚠️ Price impact on Curve might reduce liquidation profit.");
  }
}

probe().catch(console.error);
