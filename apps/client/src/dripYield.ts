import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

// Addresses verified from issue documentation and contract specifications
const VUSD_ADDR = getAddress("0xCa83DDE9c22254f58e771bE5E157773212ACBAc3");
const YIELD_DISTRIBUTOR_ADDR = getAddress("0x55745265Ba172378cf45d224F09F0673cB470cef");

// Minimal inline ABI for YieldDistributor spec compliance
const yieldDistributorAbi = [
    {
        inputs: [{ name: "amount_", type: "uint256" }],
        name: "distribute",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;

async function main() {
    // Read CLI args similar to redeemVUSD pattern
    const arg = process.argv[2];
    if (!arg) {
        throw new Error("Usage: npx tsx apps/client/src/dripYield.ts <amount> (e.g., 76)");
    }
    const amountToDrip = parseUnits(arg, 18);

    // Initialize environment variables mapping to PK 1
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    if (!pk) throw new Error("Missing LIQUIDATION_PRIVATE_KEY_1 in your .env file.");

    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ 
        account, 
        chain: mainnet, 
        transport: http(process.env.RPC_URL_1)
    }).extend(publicActions);

    console.log(`\n💧 INITIATING YIELD DRIP CYCLE`);
    console.log(`- Operating Wallet (EOA): ${account.address}`);
    console.log(`- Yield Target Amount: ${arg} VUSD`);

    // 1. Balance Pre-flight Check
    const currentBalance = await client.readContract({
        address: VUSD_ADDR,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address]
    });

    if (currentBalance < amountToDrip) {
        throw new Error(`Insufficient funds. Your wallet has ${Number(currentBalance) / 1e18} VUSD, but you requested to drip ${arg} VUSD.`);
    }

    // 2. Step 1: Max ERC20 Allowance Approval
    console.log("\n🛠️ Step 1: Granting VUSD allowance to YieldDistributor Proxy...");
    const approveHash = await client.writeContract({
        address: VUSD_ADDR,
        abi: erc20Abi,
        functionName: 'approve',
        args: [YIELD_DISTRIBUTOR_ADDR, amountToDrip]
    });
    
    console.log(`⏳ Waiting for approval confirmation: ${approveHash}`);
    await client.waitForTransactionReceipt({ hash: approveHash });
    console.log("✅ Spend allowance successfully approved.");

    // 3. Step 2: Push Yield to Linear Drip System
    console.log("\n🚀 Step 2: Routing assets to distribute()...");
    const distributeHash = await client.writeContract({
        address: YIELD_DISTRIBUTOR_ADDR,
        abi: yieldDistributorAbi,
        functionName: 'distribute',
        args: [amountToDrip]
    });

    console.log(`⏳ Waiting for linear drip activation: ${distributeHash}`);
    const receipt = await client.waitForTransactionReceipt({ hash: distributeHash });

    if (receipt.status === 'success') {
        console.log(`\n🎉 SUCCESS! Linear drip window extended.`);
        console.log(`- Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`- Your tokens are now dripping linearly to sVUSD over the protocol window.`);
    } else {
        console.error("❌ Transaction execution reverted on-chain.");
    }
}

main().catch(console.error);
