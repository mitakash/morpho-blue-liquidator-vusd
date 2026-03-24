export const stakingVaultAbi = [
  // --- Core ERC4626 Functions ---
  {
    name: "asset",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" }
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" }
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" }
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" }
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  // --- Specialized VUSD Cooldown Functions ---
  {
    name: "requestWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets_", type: "uint256" },
      { name: "owner_", type: "address" }
    ],
    outputs: [
      { name: "requestId", type: "uint256" },
      { name: "shares", type: "uint256" }
    ],
  },
  {
    name: "requestRedeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares_", type: "uint256" },
      { name: "owner_", type: "address" }
    ],
    outputs: [
      { name: "requestId", type: "uint256" },
      { name: "assets", type: "uint256" }
    ],
  },
  {
    name: "claimWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId_", type: "uint256" },
      { name: "receiver_", type: "address" }
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "cancelWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "requestId_", type: "uint256" }],
    outputs: [{ name: "shares_", type: "uint256" }],
  },
  // --- View Functions ---
  {
    name: "cooldownEnabled",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "instantWithdrawWhitelist",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "whitelisted", type: "bool" }],
  },

  {
  name: "getRequestDetails",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "requestId_", type: "uint256" }],
  outputs: [
    {
      components: [
        { name: "owner", type: "address" },
        { name: "assets", type: "uint256" },
        { name: "claimableAt", type: "uint256" }
      ],
      internalType: "struct IStakingVault.CooldownRequest", // Added for clarity
      type: "tuple"
    }
  ],
  },

  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "assets", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "claimableAt", "type": "uint256" }
    ],
    "name": "WithdrawRequested",
    "type": "event"
  },
  {
  name: "getActiveRequestIds",
  type: "function",
  stateMutability: "view",
  inputs: [{ name: "account_", type: "address" }],
  outputs: [{ name: "", type: "uint256[]" }],
  },
  {
  name: "WithdrawClaimed",
  type: "event",
  inputs: [
    { name: "owner", type: "address", indexed: true },
    { name: "receiver", type: "address", indexed: true },
    { name: "requestId", type: "uint256", indexed: true },
    { name: "assets", type: "uint256", indexed: false }
  ],
  },
  // ... other events if needed ...
] as const;
