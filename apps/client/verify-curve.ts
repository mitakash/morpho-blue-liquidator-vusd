// apps/client/verify-curve.ts
import { createPublicClient, http, getAddress } from "viem";
import { mainnet } from "viem/chains";

const RPC_URL = "https://mainnet.infura.io/v3/b083152332f946cd9dde6e5d2b6c03b2"; 
const CURVE_POOL = "0x66039342C66760874047c36943B1e2d8300363BB";
const HEMI_BTC = "0x06ea695B91700071B161A434fED42D1DcbAD9f00";
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
const CBBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";

const curveAbi = [{
    name: "coins",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "arg0", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
}] as const;

async function verify() {
  const client = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });
  console.log(`🔍 Querying Curve Pool: ${CURVE_POOL}\n`);

  for (let i = 0; i < 3; i++) {
    try {
      const addr = await client.readContract({
        address: CURVE_POOL as `0x${string}`,
        abi: curveAbi,
        functionName: "coins",
        args: [BigInt(i)],
      });
      const checksumAddr = getAddress(addr);
      let name = "Unknown";
      if (checksumAddr === getAddress(HEMI_BTC)) name = "HemiBTC";
      else if (checksumAddr === getAddress(WBTC)) name = "WBTC";
      else if (checksumAddr === getAddress(CBBTC)) name = "cbBTC";
      
      console.log(`Index ${i}: ${name} (${checksumAddr})`);
    } catch (e) {
      console.log(`Index ${i}: Error or no token.`);
    }
  }
}
verify().catch(console.error);
