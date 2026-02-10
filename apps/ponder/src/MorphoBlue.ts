import { ponder } from "ponder:registry";
import { market, position, authorization } from "ponder:schema";
import { zeroFloorSub } from "./utils";

const TARGET_MARKET_ID = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca";

const isTargetMarket = (marketId: string) => {
  return marketId.toLowerCase() === TARGET_MARKET_ID.toLowerCase();
};

ponder.on("Morpho:CreateMarket", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await context.db.insert(market).values({
    chainId: context.chain.id,
    id: event.args.id,
    loanToken: event.args.marketParams.loanToken,
    collateralToken: event.args.marketParams.collateralToken,
    oracle: event.args.marketParams.oracle,
    irm: event.args.marketParams.irm,
    lltv: event.args.marketParams.lltv,
    lastUpdate: event.block.timestamp,
  }).onConflictDoNothing();
});

ponder.on("Morpho:SetFee", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await context.db.insert(market)
    .values({ id: event.args.id, chainId: context.chain.id, fee: event.args.newFee })
    .onConflictDoUpdate(() => ({ fee: event.args.newFee }));
});

ponder.on("Morpho:AccrueInterest", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await context.db.insert(market)
    .values({
      id: event.args.id,
      chainId: context.chain.id,
      totalSupplyAssets: event.args.interest,
      totalSupplyShares: event.args.feeShares,
      totalBorrowAssets: event.args.interest,
      lastUpdate: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      totalSupplyAssets: row.totalSupplyAssets + event.args.interest,
      totalSupplyShares: row.totalSupplyShares + event.args.feeShares,
      totalBorrowAssets: row.totalBorrowAssets + event.args.interest,
      lastUpdate: event.block.timestamp,
    }));
});

ponder.on("Morpho:Supply", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await Promise.all([
    context.db.insert(market)
      .values({ 
        id: event.args.id, 
        chainId: context.chain.id, 
        totalSupplyAssets: event.args.assets, 
        totalSupplyShares: event.args.shares 
      })
      .onConflictDoUpdate((row) => ({
        totalSupplyAssets: row.totalSupplyAssets + event.args.assets,
        totalSupplyShares: row.totalSupplyShares + event.args.shares,
      })),
    context.db.insert(position)
      .values({ 
        chainId: context.chain.id, 
        marketId: event.args.id, 
        user: event.args.onBehalf, 
        supplyShares: event.args.shares 
      })
      .onConflictDoUpdate((row) => ({
        supplyShares: row.supplyShares + event.args.shares,
      })),
  ]);
});

ponder.on("Morpho:Withdraw", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await Promise.all([
    context.db.insert(market)
      .values({ id: event.args.id, chainId: context.chain.id })
      .onConflictDoUpdate((row) => ({
        totalSupplyAssets: row.totalSupplyAssets - event.args.assets,
        totalSupplyShares: row.totalSupplyShares - event.args.shares,
      })),
    context.db.insert(position)
      .values({ chainId: context.chain.id, marketId: event.args.id, user: event.args.onBehalf })
      .onConflictDoUpdate((row) => ({
        supplyShares: row.supplyShares - event.args.shares,
      })),
  ]);
});

ponder.on("Morpho:SupplyCollateral", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await context.db.insert(position)
    .values({
      chainId: context.chain.id,
      marketId: event.args.id,
      user: event.args.onBehalf,
      collateral: event.args.assets,
    })
    .onConflictDoUpdate((row) => ({
      collateral: row.collateral + event.args.assets,
    }));
});

ponder.on("Morpho:WithdrawCollateral", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await context.db.insert(position)
    .values({ chainId: context.chain.id, marketId: event.args.id, user: event.args.onBehalf })
    .onConflictDoUpdate((row) => ({
      collateral: row.collateral - event.args.assets,
    }));
});

ponder.on("Morpho:Borrow", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await Promise.all([
    context.db.insert(market)
      .values({
        id: event.args.id,
        chainId: context.chain.id,
        totalBorrowAssets: event.args.assets,
        totalBorrowShares: event.args.shares,
        lastUpdate: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        totalBorrowAssets: row.totalBorrowAssets + event.args.assets,
        totalBorrowShares: row.totalBorrowShares + event.args.shares,
        lastUpdate: event.block.timestamp,
      })),
    context.db.insert(position)
      .values({
        chainId: context.chain.id,
        marketId: event.args.id,
        user: event.args.onBehalf,
        borrowShares: event.args.shares,
      })
      .onConflictDoUpdate((row) => ({
        borrowShares: row.borrowShares + event.args.shares,
      })),
  ]);
});

ponder.on("Morpho:Repay", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await Promise.all([
    context.db.insert(market)
      .values({ id: event.args.id, chainId: context.chain.id })
      .onConflictDoUpdate((row) => ({
        totalBorrowAssets: row.totalBorrowAssets - event.args.assets,
        totalBorrowShares: row.totalBorrowShares - event.args.shares,
      })),
    context.db.insert(position)
      .values({ chainId: context.chain.id, marketId: event.args.id, user: event.args.onBehalf })
      .onConflictDoUpdate((row) => ({
        borrowShares: row.borrowShares - event.args.shares,
      })),
  ]);
});

ponder.on("Morpho:Liquidate", async ({ event, context }) => {
  if (!isTargetMarket(event.args.id)) return;

  await Promise.all([
    context.db.insert(market)
      .values({ id: event.args.id, chainId: context.chain.id })
      .onConflictDoUpdate((row) => ({
        totalSupplyAssets: row.totalSupplyAssets - event.args.badDebtAssets,
        totalSupplyShares: row.totalSupplyShares - event.args.badDebtShares,
        totalBorrowAssets: zeroFloorSub(
          row.totalBorrowAssets,
          event.args.repaidAssets + event.args.badDebtAssets,
        ),
        totalBorrowShares: row.totalBorrowShares - event.args.repaidShares - event.args.badDebtShares,
      })),
    context.db.insert(position)
      .values({ chainId: context.chain.id, marketId: event.args.id, user: event.args.borrower })
      .onConflictDoUpdate((row) => ({
        collateral: row.collateral - event.args.seizedAssets,
        borrowShares: row.borrowShares - event.args.repaidShares - event.args.badDebtShares,
      })),
  ]);
});

ponder.on("Morpho:SetAuthorization", async ({ event, context }) => {
  await context.db.insert(authorization)
    .values({
      chainId: context.chain.id,
      authorizer: event.args.authorizer,
      authorizee: event.args.authorized,
      isAuthorized: event.args.newIsAuthorized,
    })
    .onConflictDoUpdate(() => ({
      isAuthorized: event.args.newIsAuthorized,
    }));
});
