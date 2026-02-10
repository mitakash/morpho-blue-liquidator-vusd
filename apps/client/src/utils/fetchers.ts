import type { Address, Hex } from "viem";
import type { IndexerAPIResponse } from "./types";

// 1. Define the Hemi Market ID locally
const HEMI_MARKET_ID: Hex = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca";

export function parseWithBigInt<T = unknown>(jsonText: string): T {
  return JSON.parse(jsonText, (_key, value) => {
    if (typeof value === "string" && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }) as T;
}

/**
 * BYPASSED: Returns the Hemi Market ID directly to avoid Ponder connection errors.
 */
export async function fetchMarketsForVaults(_chainId: number, _vaults: Address[]): Promise<Hex[]> {
  console.log("🛠️  Bypassing Ponder vault fetch - providing Hemi Market ID.");
  return [HEMI_MARKET_ID];
}

/**
 * BYPASSED: Returns an empty array. 
 * The Direct Listener in direct-listener.ts will catch new events instead of relying on the indexer.
 */
export async function fetchLiquidatablePositions(_chainId: number, _marketIds: Hex[]) {
  // Since we are using direct-listener.ts to watch live events, 
  // we don't need the indexer to tell us who is liquidatable at startup.
  return [] as IndexerAPIResponse[];
}
