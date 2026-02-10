import { ponder } from "ponder:registry";
import { market } from "ponder:schema";

const TARGET_MARKET_ID = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca";

ponder.on("AdaptiveCurveIRM:BorrowRateUpdate", async ({ event, context }) => {
  // 1. Pedantic Guard
  if (event.args.id.toLowerCase() !== TARGET_MARKET_ID.toLowerCase()) return;

  // 2. Self-Healing Upsert
  await context.db.insert(market)
    .values({
      id: event.args.id,
      chainId: context.chain.id,
      // You can add other default fields if necessary
    })
    .onConflictDoUpdate(() => ({
      // This is primarily to ensure the row exists so Ponder doesn't crash
      id: event.args.id 
    }));
});
