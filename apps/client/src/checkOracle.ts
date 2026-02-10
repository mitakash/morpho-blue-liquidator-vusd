import { createPublicClient, http, getAddress, type Hex } from "viem";
import { mainnet } from "viem/chains";

async function check() {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });
  const ORACLE = getAddress("0x9F7c53ae6eFa70251fF6F6dD5401076F33fd4543");

  const rawPrice = await client.readContract({
    address: ORACLE,
    abi: [{ name: "price", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
    functionName: "price",
  });

  const humanPrice = Number(rawPrice) / 1e36;
  console.log(`\n🔮 Oracle Raw Price: ${rawPrice}`);
  console.log(`💎 Human Readable:  $${humanPrice} per BTC`);
  
  if (humanPrice < 70000) {
    console.warn("⚠️ Warning: Price is too low to support a 90 VUSD borrow!");
  }
}
check();
