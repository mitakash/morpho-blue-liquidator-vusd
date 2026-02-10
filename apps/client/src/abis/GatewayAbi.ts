export const gatewayAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn_", type: "address" },
      { name: "amountIn_", type: "uint256" },
      { name: "minPeggedTokenOut_", type: "uint256" },
      { name: "receiver_", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn_", type: "address" },
      { name: "amountIn_", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenOut_", type: "address" },
      { name: "peggedTokenIn_", type: "uint256" },
      { name: "minAmountOut_", type: "uint256" },
      { name: "receiver_", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewRedeem",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenOut_", type: "address" },
      { name: "peggedTokenIn_", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "requestRedeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "peggedTokenAmount_", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getRedeemRequest",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user_", type: "address" }],
    outputs: [
      { name: "amountLocked", type: "uint256" },
      { name: "claimableAt", type: "uint256" }
    ],
  }
] as const;
