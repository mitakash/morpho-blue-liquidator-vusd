import { AccrualPosition, Market, MarketParams } from "@morpho-org/blue-sdk";
import {
  createPublicClient,
  http,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { mainnet } from "viem/chains";

import type { IndexerAPIResponse } from "./types";

const HEMI_MARKET_ID: Hex = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca";

const MORPHO_BLUE: Address = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

// How long to cache borrower positions from GraphQL (ms)
const BORROWER_CACHE_TTL_MS = 60_000; // 60 seconds

const oracleAbi = [
  {
    type: "function",
    name: "price",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

const morphoAbi = [
  {
    inputs: [{ internalType: "Id", name: "", type: "bytes32" }],
    name: "market",
    outputs: [
      { internalType: "uint128", name: "totalSupplyAssets", type: "uint128" },
      { internalType: "uint128", name: "totalSupplyShares", type: "uint128" },
      { internalType: "uint128", name: "totalBorrowAssets", type: "uint128" },
      { internalType: "uint128", name: "totalBorrowShares", type: "uint128" },
      { internalType: "uint128", name: "lastUpdate", type: "uint128" },
      { internalType: "uint128", name: "fee", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "Id", name: "", type: "bytes32" }],
    name: "idToMarketParams",
    outputs: [
      { internalType: "address", name: "loanToken", type: "address" },
      { internalType: "address", name: "collateralToken", type: "address" },
      { internalType: "address", name: "oracle", type: "address" },
      { internalType: "address", name: "irm", type: "address" },
      { internalType: "uint256", name: "lltv", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const POSITIONS_QUERY = `
  query MarketPositions($marketIds: [String!]!) {
    marketPositions(
      first: 1000,
      where: { marketUniqueKey_in: $marketIds }
    ) {
      items {
        user {
          address
        }
        state {
          borrowShares
          collateral
          supplyShares
        }
      }
    }
  }
`;

interface GraphQLPositionItem {
  user: { address: string };
  state: {
    borrowShares: string;
    collateral: string;
    supplyShares: string;
  };
}

interface GraphQLPositionsResponse {
  data: {
    marketPositions: {
      items: GraphQLPositionItem[];
    };
  };
  errors?: { message: string }[];
}

interface CachedBorrower {
  user: Address;
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}

interface BorrowerCacheEntry {
  borrowers: CachedBorrower[];
  fetchedAt: number;
}

const borrowerCache = new Map<Hex, BorrowerCacheEntry>();

let _publicClient: PublicClient | null = null;
function getPublicClient(): PublicClient {
  _publicClient ??= createPublicClient({
    chain: mainnet,
    transport: http(process.env.PONDER_RPC_URL_1),
  }) as PublicClient;
  return _publicClient;
}

async function queryMorphoApi(
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphQLPositionsResponse> {
  const res = await fetch("https://blue-api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as GraphQLPositionsResponse;
}

async function getBorrowers(marketId: Hex): Promise<CachedBorrower[]> {
  const now = Date.now();
  const cached = borrowerCache.get(marketId);

  if (cached && now - cached.fetchedAt < BORROWER_CACHE_TTL_MS) {
    const age = ((now - cached.fetchedAt) / 1000).toFixed(0);
    console.log(
      `[fetcher] Using cached borrowers for ${marketId.slice(0, 10)}... (age: ${age}s, count: ${cached.borrowers.length})`,
    );
    return cached.borrowers;
  }

  const apiResponse = await queryMorphoApi(POSITIONS_QUERY, {
    marketIds: [marketId],
  });

  if (apiResponse.errors?.length) {
    console.warn(
      `[fetcher] GraphQL errors for ${marketId.slice(0, 10)}...:`,
      apiResponse.errors.map((e) => e.message).join(", "),
    );
    if (cached) {
      const age = ((now - cached.fetchedAt) / 1000).toFixed(0);
      console.warn(`[fetcher] Falling back to stale cache (age: ${age}s)`);
      return cached.borrowers;
    }
    return [];
  }

  const items = apiResponse.data.marketPositions.items;
  const borrowers: CachedBorrower[] = items
    .filter((item) => item.state.borrowShares !== "0" && BigInt(item.state.borrowShares) > 0n)
    .map((item) => ({
      user: getAddress(item.user.address),
      supplyShares: BigInt(item.state.supplyShares),
      borrowShares: BigInt(item.state.borrowShares),
      collateral: BigInt(item.state.collateral),
    }));

  borrowerCache.set(marketId, { borrowers, fetchedAt: now });
  console.log(
    `[fetcher] Refreshed borrower cache for ${marketId.slice(0, 10)}... (${borrowers.length} borrower(s))`,
  );

  return borrowers;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function parseWithBigInt<T = unknown>(jsonText: string): T {
  return JSON.parse(jsonText, (_key, value) => {
    if (typeof value === "string" && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  }) as T;
}

export function fetchMarketsForVaults(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _chainId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _vaults: Address[],
): Promise<Hex[]> {
  console.log("[fetcher] Providing Hemi Market ID.");
  return Promise.resolve([HEMI_MARKET_ID]);
}

export async function fetchLiquidatablePositions(
  _chainId: number,
  marketIds: Hex[],
): Promise<IndexerAPIResponse[]> {
  const results: IndexerAPIResponse[] = [];
  const publicClient = getPublicClient();

  for (const marketId of marketIds) {
    try {
      // 1. Get borrowers (cached, refreshed every BORROWER_CACHE_TTL_MS)
      const borrowers = await getBorrowers(marketId);

      if (borrowers.length === 0) {
        console.log(`[fetcher] No borrowers for market ${marketId.slice(0, 10)}...`);
        continue;
      }

      // 2. Read on-chain market state + params (fresh every block)
      const [marketStateResult, marketParamsResult] = await publicClient.multicall({
        contracts: [
          {
            address: MORPHO_BLUE,
            abi: morphoAbi,
            functionName: "market",
            args: [marketId],
          },
          {
            address: MORPHO_BLUE,
            abi: morphoAbi,
            functionName: "idToMarketParams",
            args: [marketId],
          },
        ],
        allowFailure: true,
      });

      if (marketStateResult.status !== "success" || marketParamsResult.status !== "success") {
        console.warn(`[fetcher] On-chain read failed for market ${marketId.slice(0, 10)}...`);
        continue;
      }

      const [
        totalSupplyAssets,
        totalSupplyShares,
        totalBorrowAssets,
        totalBorrowShares,
        lastUpdate,
        fee,
      ] = marketStateResult.result;
      const [loanToken, collateralToken, oracle, irm, lltv] = marketParamsResult.result;

      // 3. Read oracle price on-chain (fresh every block)
      const oraclePriceResult = await publicClient.readContract({
        address: getAddress(oracle),
        abi: oracleAbi,
        functionName: "price",
      });

      const params = new MarketParams({
        loanToken: getAddress(loanToken),
        collateralToken: getAddress(collateralToken),
        oracle: getAddress(oracle),
        irm: getAddress(irm),
        lltv: BigInt(lltv),
      });

      // 4. Build Market object and accrue interest (fresh every block)
      const now = (Date.now() / 1000).toFixed(0);
      const market = new Market({
        params,
        totalSupplyAssets: BigInt(totalSupplyAssets),
        totalBorrowAssets: BigInt(totalBorrowAssets),
        totalSupplyShares: BigInt(totalSupplyShares),
        totalBorrowShares: BigInt(totalBorrowShares),
        lastUpdate: BigInt(lastUpdate),
        fee: BigInt(fee),
        price: BigInt(oraclePriceResult),
      }).accrueInterest(now);

      // 5. Check each cached borrower against fresh market state
      const positionsLiq = borrowers
        .map((borrower) => {
          const accrualPosition = new AccrualPosition(borrower, market);
          return {
            ...borrower,
            seizableCollateral: accrualPosition.seizableCollateral ?? 0n,
          };
        })
        .filter((p) => p.seizableCollateral > 0n);

      if (positionsLiq.length > 0) {
        console.log(
          `[fetcher] Found ${positionsLiq.length} liquidatable position(s) for market ${marketId.slice(0, 10)}...`,
        );
        results.push({
          market,
          positionsLiq,
          positionsPreLiq: [],
        });
      } else {
        console.log(`[fetcher] No liquidatable positions for market ${marketId.slice(0, 10)}...`);
      }
    } catch (error) {
      console.error(`[fetcher] Error processing market ${marketId.slice(0, 10)}...:`, error);
    }
  }

  return results;
}
