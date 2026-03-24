# Morpho Blue Liquidation Bot - Plan and Challenges

## 1. Problem Statement

The primary goal is to develop an event-driven liquidation bot for Morpho Blue markets. The previous approach relied on Ponder for indexing blockchain events and maintaining a state of user positions. With Ponder removed, the bot needs to:

1.  Listen for oracle price updates (specifically from the `ManipulatableOracle` contract).
2.  Upon an oracle price update, identify potentially undercollateralized borrower positions across all active Morpho Blue markets.
3.  Execute liquidation transactions for these undercollateralized positions.

A crucial aspect is rebuilding the ability to track all active borrower positions (their collateral and debt) without relying on a dedicated indexing solution like Ponder, and without having to replay the entire blockchain history for every run.

## 2. Progress So Far

*   **Oracle Event Listener:** An `oracleListener.ts` script has been created in `apps/client/src/` to listen for `PriceUpdated` events from the specified `ManipulatableOracle` contract (`0x2b816cecb2ccf258426d8d5699db697fd9279bc5`).
*   **Morpho Blue SDK Integration Attempt:** The `@morpho-org/blue-sdk-viem` package has been installed. Initial attempts were made to integrate this SDK into `oracleListener.ts` to fetch market data.
*   **Morpho Blue Event Listeners:** `oracleListener.ts` has been updated to include `watchContractEvent` calls for all relevant Morpho Blue events (`Borrow`, `Repay`, `Supply`, `Withdraw`, `SupplyCollateral`, `WithdrawCollateral`, `Liquidate`, `CreateMarket`) on the main Morpho Blue contract (`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`).
*   **In-Memory State Management:** Basic in-memory data structures (`userPositions`, `marketParamsMap`) and a helper function (`updateUserPosition`) have been implemented in `oracleListener.ts` to track user positions and market parameters based on these real-time events.

## 3. Challenges Encountered

### a. `blue-sdk-viem` Augmentation Pattern

*   **Issue:** Initial attempts to import and instantiate `BlueSdkViem` directly failed (`TS2305: Module '"@morpho-org/blue-sdk-viem"' has no exported member 'BlueSdkViem'.`).
*   **Resolution (Partial):** Discovered from documentation that `blue-sdk-viem` works by augmenting `viem`'s client with methods from `@morpho-org/blue-sdk`. The import statement and instantiation method in `oracleListener.ts` have been adjusted accordingly (`import "@morpho-org/blue-sdk-viem/lib/augment";` and direct calls on `publicClient`).

### b. Persistent `BigInt` Literal Errors (TS2737)

*   **Issue:** Despite the root `tsconfig.json` and `apps/client/tsconfig.json` explicitly setting `"target": "ES2022"` (which supports `BigInt` literals like `0n`), the TypeScript compiler (`tsc`) continues to report errors like `TS2737: BigInt literals are not available when targeting lower than ES2020.` These errors appear in `oracleListener.ts` and various `.d.ts` files within `node_modules` (specifically from `@morpho-org/blue-sdk`).
*   **Attempts:**
    *   Confirmed `target: ES2022` in `tsconfig.json`.
    *   Confirmed `tsc` version (`5.8.2`) supports `BigInt` with `ES2022`.
    *   Forced `pnpm install` to clear potential `node_modules` issues.
*   **Current Status:** Unresolved. This is blocking successful compilation.

### c. Misleading `apps/client/src/health.ts`

*   **Issue:** Initially assumed `apps/client/src/health.ts` would contain logic for calculating lending protocol health factors.
*   **Discovery:** The file actually implements a Fastify-based health check server, unrelated to loan health factor calculation.
*   **Implication:** We need to either find an existing health factor calculation utility within the codebase (unlikely based on `grep_search` and file inspection), or rely on `blue-sdk-viem` for this, or implement it from scratch based on Morpho Blue's mechanics.

## 4. Revised Plan for Moving Forward

### a. Immediate Next Steps: Resolve BigInt Literal Errors

1.  **Re-verify `tsconfig.json` usage:** Ensure `tsc` is definitely using the correct `tsconfig.json` for `apps/client`.
    *   **Research Question (for Perplexity/user):** "Given `tsconfig.json` has `target: ES2022` and TypeScript version is `5.8.2`, why are `BigInt` literal errors (`TS2737`) still occurring, especially for `.d.ts` files in `node_modules`, and what common `tsconfig.json` or build tool misconfigurations could cause this in a pnpm monorepo setup?"
2.  **Explore `tsconfig.json` `moduleResolution` and `module`:** Investigate if interactions between `moduleResolution` (`bundler`) and `module` (`ESNext`) or other `compilerOptions` could implicitly downgrade the target for declaration files or create unexpected behavior.
3.  **Check `package.json` `type` field:** Confirm if `package.json` in `apps/client` (or root) has `"type": "module"` set, as this impacts module resolution and potentially how `BigInt`s are handled.

### b. Core Logic Development: Health Factor Calculation and Liquidation Trigger

1.  **Leverage `blue-sdk-viem` for Health Factor:**
    *   Once `tsc` issues are resolved, thoroughly examine the `@morpho-org/blue-sdk` and `@morpho-org/blue-sdk-viem` types and methods (via intellisense or direct inspection in `node_modules`) to identify functions that calculate health factors or provide the necessary data (loan value, collateral value, oracle prices, LTVs).
    *   **Research Question (for Perplexity/user):** "Does `@morpho-org/blue-sdk` or `@morpho-org/blue-sdk-viem` provide direct functions to calculate the health factor of a user's position in a Morpho Blue market, given market parameters and user balances (supply shares, borrow shares, collateral)?"
2.  **Integrate Health Factor Calculation:** Modify the `onLogs` callbacks in `oracleListener.ts` (especially after oracle price updates and position-modifying Morpho Blue events) to:
    *   Retrieve relevant `UserPosition` data from `userPositions` map.
    *   Fetch current market prices using the oracle (this will be from the `PriceUpdated` event or by calling the oracle contract).
    *   Calculate the health factor.
    *   Identify positions below a liquidation threshold.
3.  **Liquidation Trigger:**
    *   If a position is identified as liquidatable, call the appropriate function in `apps/client/src/liquidator.ts` (after investigating and understanding its API).
    *   **Research Question (for Perplexity/user):** "What are the common patterns for implementing liquidation logic in `viem` given a `liquidator.ts` file, specifically how to interact with the Morpho Blue `liquidate` function with required `seizedAssets` and `repaidShares` parameters?"

### c. Long-Term State Management: Historical Data Sync

1.  **Initial State Population:** After the above issues are resolved, implement the historical event fetching mechanism (`publicClient.getLogs()`) to populate `userPositions` and `marketParamsMap` from a historical block. This will be a one-time operation on bot startup.
2.  **Persistent Storage (Future Consideration):** For production-grade bots, explore options for persisting the `userPositions` and `marketParamsMap` to a lightweight database (e.g., SQLite, Redis) instead of purely in-memory, to allow for quicker restarts and to avoid full historical syncs every time.

---
This document provides a clear overview of our situation and a structured approach to resolve the remaining challenges.