import { createPublicClient, http, Address } from 'viem';
import { mainnet } from 'viem/chains';

// Import from the newly installed SDK
import "@morpho-org/blue-sdk-viem/lib/augment";
import { Market, MarketParams as MorphoMarketParams, AccrualPosition, MarketId } from "@morpho-org/blue-sdk";

// --- State Management Data Structures ---
type LocalMarketId = Address; // For Morpho Blue, MarketId is a hash of MarketParams. Using Address for now.
type UserAddress = Address;

interface UserPosition {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
  // Market parameters associated with this position
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

// Map to store positions: LocalMarketId -> UserAddress -> UserPosition
const userPositions: Map<LocalMarketId, Map<UserAddress, UserPosition>> = new Map();

// Map to store market parameters: LocalMarketId -> LocalMarketParams
interface LocalMarketParams {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}
const marketParamsMap: Map<LocalMarketId, LocalMarketParams> = new Map();

// Helper to derive market ID - this is a simplified version.
// In a real Morpho Blue context, market ID is a hash of market parameters.
// For now, we assume marketId comes directly from event logs.
function getMarketIdFromParams(params: LocalMarketParams): LocalMarketId {
    // This is a placeholder. A real implementation would hash market parameters.
    // For now, we assume marketId comes directly from event logs.
    return "0x" + Math.random().toString(16).substring(2, 34).padEnd(40, '0') as LocalMarketId; // Adjusted to be an address length
}


function updateUserPosition(
  marketId: LocalMarketId,
  userAddress: UserAddress,
  updates: Partial<UserPosition> // Partial allows updating only specific fields
) {
  if (!userPositions.has(marketId)) {
    userPositions.set(marketId, new Map());
  }
  const marketUserPositions = userPositions.get(marketId)!;

  const currentPosition: UserPosition = marketUserPositions.get(userAddress) || {
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
    // Default or retrieve market parameters if not present
    loanToken: marketParamsMap.get(marketId)?.loanToken || '0x0000000000000000000000000000000000000000',
    collateralToken: marketParamsMap.get(marketId)?.collateralToken || '0x0000000000000000000000000000000000000000',
    oracle: marketParamsMap.get(marketId)?.oracle || '0x0000000000000000000000000000000000000000',
    irm: marketParamsMap.get(marketId)?.irm || '0x0000000000000000000000000000000000000000',
    lltv: marketParamsMap.get(marketId)?.lltv || 0n,
  };

  const newPosition = { ...currentPosition, ...updates };
  marketUserPositions.set(userAddress, newPosition);
  console.log(`Updated position for ${userAddress} in market ${marketId}:`, newPosition);

  // Clean up if position becomes zero
  if (newPosition.supplyShares === 0n && newPosition.borrowShares === 0n && newPosition.collateral === 0n) {
    marketUserPositions.delete(userAddress);
    if (marketUserPositions.size === 0) {
      userPositions.delete(marketId);
    }
  }
}
// --- End State Management Data Structures ---

// ABI for the ManipulatableOracle contract
const MANIPULATABLE_ORACLE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newPrice",
        "type": "uint256"
      }
    ],
    "name": "PriceUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "currentPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_newPrice",
        "type": "uint256"
      }
    ],
    "name": "setPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "price",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ABI for the Morpho Blue contract (from apps/ponder/abis/MorphoBlue.ts)
const MORPHO_BLUE_ABI = [
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "uint256",
        name: "prevBorrowRate",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "interest",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "feeShares",
        type: "uint256",
      },
    ],
    name: "AccrueInterest",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "shares",
        type: "uint256",
      },
    ],
    name: "Borrow",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        indexed: false,
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
    ],
    name: "CreateMarket",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "address", name: "irm", type: "address" }],
    name: "EnableIrm",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "lltv",
        type: "uint256",
      },
    ],
    name: "EnableLltv",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
    ],
    name: "FlashLoan",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "authorizer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "usedNonce",
        type: "uint256",
      },
    ],
    name: "IncrementNonce",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "borrower",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "repaidAssets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "repaidShares",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "seizedAssets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "badDebtAssets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "badDebtShares",
        type: "uint256",
      },
    ],
    name: "Liquidate",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "shares",
        type: "uint256",
      },
    ],
    name: "Repay",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "authorizer",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "authorized",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "newIsAuthorized",
        type: "bool",
      },
    ],
    name: "SetAuthorization",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "uint256",
        name: "newFee",
        type: "uint256",
      },
    ],
    name: "SetFee",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "newFeeRecipient",
        type: "address",
      },
    ],
    name: "SetFeeRecipient",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "SetOwner",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: true,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "shares",
        type: "uint256",
      },
    ],
    name: "Supply",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
    ],
    name: "SupplyCollateral",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "shares",
        type: "uint256",
      },
    ],
    name: "Withdraw",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "Id", name: "id", type: "bytes32" },
      {
        indexed: false,
        internalType: "address",
        name: "caller",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "onBehalf",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "assets",
        type: "uint256",
      },
    ],
    name: "WithdrawCollateral",
    type: "event",
  },
  {
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
    ],
    name: "accrueInterest",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "uint256", name: "shares", type: "uint256" },
      { internalType: "address", name: "onBehalf", type: "address" },
      { internalType: "address", name: "receiver", type: "address" },
    ],
    name: "borrow",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
    ],
    name: "createMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "irm", type: "address" }],
    name: "enableIrm",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "lltv", type: "uint256" }],
    name: "enableLltv",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32[]", name: "slots", type: "bytes32[]" }],
    name: "extSloads",
    outputs: [{ internalType: "bytes32[]", name: "res", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeRecipient",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "flashLoan",
    outputs: [],
    stateMutability: "nonpayable",
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
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "isAuthorized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isIrmEnabled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "isLltvEnabled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "address", name: "borrower", type: "address" },
      { internalType: "uint256", name: "seizedAssets", type: "uint256" },
      { internalType: "uint256", name: "repaidShares", type: "uint256" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "liquidate",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
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
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "nonce",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "Id", name: "", type: "bytes32" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "position",
    outputs: [
      { internalType: "uint256", name: "supplyShares", type: "uint256" },
      { internalType: "uint128", name: "borrowShares", type: "uint128" },
      { internalType: "uint128", name: "collateral", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "uint256", name: "shares", type: "uint256" },
      { internalType: "address", name: "onBehalf", type: "address" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "repay",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "authorized", type: "address" },
      { internalType: "bool", name: "newIsAuthorized", type: "bool" },
    ],
    name: "setAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "authorizer", type: "address" },
          { internalType: "address", name: "authorized", type: "address" },
          { internalType: "bool", name: "isAuthorized", type: "bool" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
        ],
        internalType: "struct Authorization",
        name: "authorization",
        type: "tuple",
      },
      {
        components: [
          { internalType: "uint8", name: "v", type: "uint8" },
          { internalType: "bytes32", name: "r", type: "bytes32" },
          { internalType: "bytes32", name: "s", type: "bytes32" },
        ],
        internalType: "struct Signature",
        name: "signature",
        type: "tuple",
      },
    ],
    name: "setAuthorizationWithSig",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "newFee", type: "uint256" },
    ],
    name: "setFee",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newFeeRecipient", type: "address" }],
    name: "setFeeRecipient",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "setOwner",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "uint256", name: "shares", type: "uint256" },
      { internalType: "address", name: "onBehalf", type: "address" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "supply",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "address", name: "onBehalf", type: "address" },
      { internalType: "bytes", name: "data", type: "bytes" },
    ],
    name: "supplyCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "uint256", name: "shares", type: "uint256" },
      { internalType: "address", name: "onBehalf", type: "address" },
      { internalType: "address", name: "receiver", type: "address" },
    ],
    name: "withdraw",
    outputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "loanToken", type: "address" },
          { internalType: "address", name: "collateralToken", type: "address" },
          { internalType: "address", name: "oracle", type: "address" },
          { internalType: "address", name: "irm", type: "address" },
          { internalType: "uint256", name: "lltv", type: "uint256" },
        ],
        internalType: "struct MarketParams",
        name: "marketParams",
        type: "tuple",
      },
      { internalType: "uint256", name: "assets", type: "uint256" },
      { internalType: "address", name: "onBehalf", type: "address" },
      { internalType: "address", name: "receiver", type: "address" },
    ],
    name: "withdrawCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const; // 'as const' is important for Viem's type

const rpcUrl = process.env.RPC_URL_1 || "http://127.0.0.1:8545"; // Use RPC_URL_1 as per project convention

if (!rpcUrl) {
  throw new Error("RPC_URL_1 not set in environment variables.");
}

const publicClient = createPublicClient({
  chain: mainnet, // Assuming mainnet, change as needed
  transport: http(rpcUrl),
});

const ORACLE_CONTRACT_ADDRESS: Address = '0x2b816cecb2ccf258426d8d5699db697fd9279bc5';
const MORPHO_BLUE_CONTRACT_ADDRESS: Address = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

async function listenForOracleUpdates() {
  console.log(`Listening for PriceUpdated events on oracle ${ORACLE_CONTRACT_ADDRESS}...`);

  // Initialize the BlueSdkViem
  const blue = new BlueSdkViem({ client: publicClient });

  // Define the event filter for Oracle PriceUpdated
  const unwatchOracle = publicClient.watchContractEvent({
    address: ORACLE_CONTRACT_ADDRESS,
    abi: MANIPULATABLE_ORACLE_ABI,
    eventName: 'PriceUpdated',
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log("------------------------------------------");
        console.log("Oracle PriceUpdated Event Detected!");
        console.log(`Transaction Hash: ${log.transactionHash}`);
        console.log(`Block Number: ${log.blockNumber}`);
        console.log(`New Price: ${log.args.newPrice}`);
        console.log("------------------------------------------");

        // --- SDK Usage Demonstration (triggered by Oracle update) ---
        console.log("Fetching markets using Morpho Blue SDK (triggered by Oracle update)...");
        try {
          const allMarkets = await blue.fetchMarkets();
          console.log(`Found ${allMarkets.length} Morpho Blue markets.`);
          if (allMarkets.length > 0) {
            console.log("First market ID:", allMarkets[0].id);
            const marketId = allMarkets[0].id;
            console.log(`Fetching data for market ${marketId}...`);
            const marketData = await blue.fetchMarket({ id: marketId });
            console.log("Market Data fetched:", marketData);
            console.log("Placeholder: Need to fetch individual user positions for this market based on event history.");
          }
        } catch (sdkError) {
          console.error("Error using Morpho Blue SDK after oracle update:", sdkError);
        }
        // --- End SDK Usage Demonstration ---
      }
    },
    onError: (error) => {
      console.error("Error watching oracle events:", error);
    },
  });

  console.log(`Listening for Morpho Blue events on contract ${MORPHO_BLUE_CONTRACT_ADDRESS}...`);

  // Listen for CreateMarket events to populate marketParamsMap
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'CreateMarket',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, marketParams } = log.args;
        if (id && marketParams) {
          marketParamsMap.set(id, {
            loanToken: marketParams.loanToken,
            collateralToken: marketParams.collateralToken,
            oracle: marketParams.oracle,
            irm: marketParams.irm,
            lltv: marketParams.lltv,
          });
          console.log(`New Market Created: ${id}`, marketParams);
        }
      }
    },
    onError: (error) => {
      console.error("Error watching CreateMarket events:", error);
    },
  });


  // Listen for Borrow events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'Borrow',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, onBehalf, shares, assets } = log.args;
        if (id && onBehalf && shares && assets) {
          updateUserPosition(id, onBehalf, {
            borrowShares: (userPositions.get(id)?.get(onBehalf)?.borrowShares || 0n) + shares
          });
        }
        console.log("Morpho Blue Borrow Event:", log.args);
        // Here, update local state for the borrower's position
      }
    },
    onError: (error) => {
      console.error("Error watching Borrow events:", error);
    },
  });

  // Listen for Repay events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'Repay',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, onBehalf, shares, assets } = log.args;
        if (id && onBehalf && shares && assets) {
          updateUserPosition(id, onBehalf, {
            borrowShares: (userPositions.get(id)?.get(onBehalf)?.borrowShares || 0n) - shares
          });
        }
        console.log("Morpho Blue Repay Event:", log.args);
        // Here, update local state for the borrower's position
      }
    },
    onError: (error) => {
      console.error("Error watching Repay events:", error);
    },
  });

  // Listen for Supply events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'Supply',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, onBehalf, shares, assets } = log.args;
        if (id && onBehalf && shares && assets) {
          updateUserPosition(id, onBehalf, {
            supplyShares: (userPositions.get(id)?.get(onBehalf)?.supplyShares || 0n) + shares
          });
        }
        console.log("Morpho Blue Supply Event:", log.args);
        // Here, update local state for the supplier's position
      }
    },
    onError: (error) => {
      console.error("Error watching Supply events:", error);
    },
  });

  // Listen for Withdraw events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'Withdraw',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, onBehalf, shares, assets } = log.args;
        if (id && onBehalf && shares && assets) {
          updateUserPosition(id, onBehalf, {
            supplyShares: (userPositions.get(id)?.get(onBehalf)?.supplyShares || 0n) - shares
          });
        }
        console.log("Morpho Blue Withdraw Event:", log.args);
        // Here, update local state for the supplier's position
      }
    },
    onError: (error) => {
      console.error("Error watching Withdraw events:", error);
    },
  });

  // Listen for SupplyCollateral events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'SupplyCollateral',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, onBehalf, assets } = log.args;
        if (id && onBehalf && assets) {
          updateUserPosition(id, onBehalf, {
            collateral: (userPositions.get(id)?.get(onBehalf)?.collateral || 0n) + assets
          });
        }
        console.log("Morpho Blue SupplyCollateral Event:", log.args);
        // Here, update local state for the collateral position
      }
    },
    onError: (error) => {
      console.error("Error watching SupplyCollateral events:", error);
    },
  });

  // Listen for WithdrawCollateral events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'WithdrawCollateral',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, onBehalf, assets } = log.args;
        if (id && onBehalf && assets) {
          updateUserPosition(id, onBehalf, {
            collateral: (userPositions.get(id)?.get(onBehalf)?.collateral || 0n) - assets
          });
        }
        console.log("Morpho Blue WithdrawCollateral Event:", log.args);
        // Here, update local state for the collateral position
      }
    },
    onError: (error) => {
      console.error("Error watching WithdrawCollateral events:", error);
    },
  });

  // Listen for Liquidate events
  publicClient.watchContractEvent({
    address: MORPHO_BLUE_CONTRACT_ADDRESS,
    abi: MORPHO_BLUE_ABI,
    eventName: 'Liquidate',
    onLogs: (logs) => {
      for (const log of logs) {
        const { id, borrower } = log.args;
        if (id && borrower) {
          // A liquidation means the position is either closed or significantly changed.
          // For simplicity, we'll reset it or remove it if completely liquidated.
          // More robust would be to recalculate based on remaining assets/shares.
          updateUserPosition(id, borrower, {
            supplyShares: 0n,
            borrowShares: 0n,
            collateral: 0n,
          });
        }
        console.log("Morpho Blue Liquidate Event:", log.args);
        // Here, update local state for the liquidated position
      }
    },
    onError: (error) => {
      console.error("Error watching Liquidate events:", error);
    },
  });


  console.log("Oracle and Morpho Blue event listeners started. Press Ctrl+C to stop.");

  // Keep the script running
  // process.on('SIGINT', () => {
  //   unwatchOracle();
  //   // unwatchMorphoBlueEvents(); // need to store all unwatch functions
  //   console.log("Event listeners stopped.");
  //   process.exit();
  // });
}

listenForOracleUpdates().catch(console.error);
