import { createWalletClient, http, publicActions, getAddress, parseUnits, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { waitForTransactionReceipt } from "viem/actions"; // Add this
import dotenv from "dotenv";

dotenv.config();

const CRV_USD = getAddress("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E");
const VUSD = getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619");
const POOL = getAddress("0xb1c189dfde178fe9f90e72727837cc9289fb944f");

const ABI = [{
  name: "exchange",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "i", type: "int128" },
    { name: "j", type: "int128" },
    { name: "_dx", type: "uint256" },
    { name: "_min_dy", type: "uint256" }
  ],
  outputs: [{ name: "", type: "uint256" }]
}] as const;

async function verify() {
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as any);
  const client = createWalletClient({ 
    account, chain: mainnet, transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  console.log(`🚀 SWAP VERIFICATION STARTING...`);

  // --- TEST 1: VUSD -> crvUSD ---
  console.log("\n🧪 Step 1: Swapping 1 VUSD to crvUSD...");
  const amountVUSD = parseUnits("1", 18);
  
  console.log("⏳ Approving VUSD...");
  const app1 = await client.writeContract({
    address: VUSD, abi: erc20Abi, functionName: "approve", args: [POOL, amountVUSD]
  });
  await client.waitForTransactionReceipt({ hash: app1 }); // CRITICAL FIX
  
  const hash1 = await client.writeContract({
    address: POOL, abi: ABI, functionName: "exchange",
    args: [1n, 0n, amountVUSD, 0n], 
  });
  console.log(`✅ VUSD -> crvUSD sent: ${hash1}`);
  await client.waitForTransactionReceipt({ hash: hash1 });

  // --- TEST 2: crvUSD -> VUSD ---
  console.log("\n🧪 Step 2: Swapping 1 crvUSD to VUSD...");
  const amountCrv = parseUnits("1", 18);

  console.log("⏳ Approving crvUSD...");
  const app2 = await client.writeContract({
    address: CRV_USD, abi: erc20Abi, functionName: "approve", args: [POOL, amountCrv]
  });
  await client.waitForTransactionReceipt({ hash: app2 }); // CRITICAL FIX

  const hash2 = await client.writeContract({
    address: POOL, abi: ABI, functionName: "exchange",
    args: [0n, 1n, amountCrv, 0n],
  });
  console.log(`✅ crvUSD -> VUSD sent: ${hash2}`);
  await client.waitForTransactionReceipt({ hash: hash2 });
  
  console.log("\n🎉 ALL SWAPS COMPLETED SUCCESSFULLY.");
}

verify().catch(console.error);
