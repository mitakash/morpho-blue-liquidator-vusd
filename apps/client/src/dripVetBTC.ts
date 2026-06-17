import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

// VetBTC-specific configuration verified from contract specifications
const VETBTC_ADDR = getAddress("0xf196C68233464A16CFDa319a47c21f4cECa62001");
const VETBTC_YIELD_DISTRIBUTOR_ADDR = getAddress("0xd74bcf1299176E98899bA2e86dD2C9aE089F5276");

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
    // Read CLI args similar to dripYield pattern
    const arg = process.argv[2];
    if (!arg) {
        throw new Error("Usage: npx tsx apps/client/src/dripVetBTC.ts <amount> (e.g., 0.05)");
    }

    // Initialize environment variables mapping to PK 1
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    if (!pk) throw new Error("Missing LIQUIDATION_PRIVATE_KEY_1 in your .env file.");

    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ 
        account, 
        chain: mainnet, 
        transport: http(process.env.RPC_URL_1)
    }).extend(publicActions);

    console.log(`\n🧡 INITIATING VETBTC YIELD DRIP CYCLE`);
    console.log(`- Operating Wallet (EOA): ${account.address}`);
    console.log(`- Yield Target Amount: ${arg} vetBTC`);

    // 1. Dynamic Decimals Pre-flight Check
    console.log("🔍 Fetching token decimals from vetBTC contract...");
    const decimals = await client.readContract({
        address: VETBTC_ADDR,
        abi: erc20Abi,
        functionName: 'decimals'
    });
    console.log(`✅ Detected vetBTC Decimals: ${decimals}`);

    const amountToDrip = parseUnits(arg, decimals);

    // 2. Balance Pre-flight Check
    const currentBalance = await client.readContract({
        address: VETBTC_ADDR,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address]
    });

    if (currentBalance < amountToDrip) {
        throw new Error(`Insufficient funds. Your wallet has ${Number(currentBalance) / (10 ** decimals)} vetBTC, but you requested to drip ${arg} vetBTC.`);
    }

    // 3. Step 1: ERC20 Allowance Approval
    console.log("\n🛠️ Step 1: Granting vetBTC allowance to VetBTCYieldDistributor...");
    const approveHash = await client.writeContract({
        address: VETBTC_ADDR,
        abi: erc20Abi,
        functionName: 'approve',
        args: [VETBTC_YIELD_DISTRIBUTOR_ADDR, amountToDrip]
    });
    
    console.log(`⏳ Waiting for approval confirmation: ${approveHash}`);
    await client.waitForTransactionReceipt({ hash: approveHash });
    console.log("✅ Spend allowance successfully approved.");

    // 4. Step 2: Push Yield to Linear Drip System
    console.log("\n🚀 Step 2: Routing assets to distribute()...");
    const distributeHash = await client.writeContract({
        address: VETBTC_YIELD_DISTRIBUTOR_ADDR,
        abi: yieldDistributorAbi,
        functionName: 'distribute',
        args: [amountToDrip]
    });

    console.log(`⏳ Waiting for linear drip activation: ${distributeHash}`);
    const receipt = await client.waitForTransactionReceipt({ hash: distributeHash });

    if (receipt.status === 'success') {
        console.log(`\n🎉 SUCCESS! vetBTC Linear drip window extended.`);
        console.log(`- Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`- Your tokens are now dripping linearly to svetBTC over the protocol window.`);
    } else {
        console.error("❌ Transaction execution reverted on-chain.");
    }
}

main().catch(console.error);
