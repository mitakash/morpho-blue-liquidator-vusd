import { createPublicClient, http, getAddress } from "viem";
import { mainnet } from "viem/chains";

// Configuration
const RPC_URL = "https://mainnet.infura.io/v3/b083152332f946cd9dde6e5d2b6c03b2"; // From your .env
const CURVE_POOL = "0x66039342C66760874047c36943B1e2d8300363BB";
const HEMI_BTC = "0x06ea695B91700071B161A434fED42D1DcbAD9f00";
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const CBBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

const curveAbi = [
  {
    name: "coins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "arg0", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

async function verify() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  });

  console.log(`🔍 Checking Curve Pool: ${CURVE_POOL}\n`);

  const results: Record<number, string> = {};

  for (let i = 0; i < 3; i++) {
    try {
      const tokenAddress = await client.readContract({
        address: CURVE_POOL as `0x${string}`,
        abi: curveAbi,
        functionName: "coins",
        args: [BigInt(i)],
      });

      let label = "Unknown";
      if (getAddress(tokenAddress) === getAddress(HEMI_BTC)) label = "HemiBTC";
      if (getAddress(tokenAddress) === getAddress(WBTC)) label = "WBTC";
      if (getAddress(tokenAddress) === getAddress(CBBTC)) label = "cbBTC";

      results[i] = `${label} (${tokenAddress})`;
      console.log(`Index ${i}: ${results[i]}`);
    } catch (e) {
      console.log(`Index ${i}: No token found or error.`);
    }
  }

  console.log("\n✅ Done. Use the indexes above for your 'exchange' call.");
}

verify().catch(console.error);
