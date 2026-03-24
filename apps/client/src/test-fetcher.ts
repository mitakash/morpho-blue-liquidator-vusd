import "dotenv/config";
import { fetchLiquidatablePositions, fetchMarketsForVaults } from "./utils/fetchers.js";
import type { Address } from "viem";

async function main() {
  console.log("=== Fetcher Test ===\n");
  console.log("RPC URL configured:", process.env.PONDER_RPC_URL_1 ? "yes" : "NO — set PONDER_RPC_URL_1");

  // Step 1: Get market IDs
  const marketIds = await fetchMarketsForVaults(1, [] as Address[]);
  console.log("\nMarket IDs:", marketIds);

  // Step 2: Fetch liquidatable positions (first call — should hit API)
  console.log("\n--- Call 1 (fresh fetch) ---");
  const t1 = Date.now();
  const results1 = await fetchLiquidatablePositions(1, marketIds);
  console.log(`Took ${Date.now() - t1}ms`);

  for (const r of results1) {
    console.log(`\nMarket: ${r.market.params.loanToken} / ${r.market.params.collateralToken}`);
    console.log(`  totalSupplyAssets: ${r.market.totalSupplyAssets}`);
    console.log(`  totalBorrowAssets: ${r.market.totalBorrowAssets}`);
    console.log(`  oracle price: ${r.market.price}`);
    console.log(`  LLTV: ${r.market.params.lltv}`);
    console.log(`  Liquidatable positions: ${r.positionsLiq.length}`);
    for (const p of r.positionsLiq) {
      console.log(`    - user: ${p.user}`);
      console.log(`      borrowShares: ${p.borrowShares}`);
      console.log(`      collateral: ${p.collateral}`);
      console.log(`      seizableCollateral: ${p.seizableCollateral}`);
    }
  }

  if (results1.length === 0) {
    console.log("\nNo liquidatable positions found. Position may be healthy at current oracle price.");
  }

  // Step 3: Call again immediately — should use cache
  console.log("\n--- Call 2 (should use cache) ---");
  const t2 = Date.now();
  const results2 = await fetchLiquidatablePositions(1, marketIds);
  console.log(`Took ${Date.now() - t2}ms`);
  console.log(`Liquidatable positions: ${results2.reduce((sum, r) => sum + r.positionsLiq.length, 0)}`);

  console.log("\n=== Done ===");
}

main().catch(console.error);
