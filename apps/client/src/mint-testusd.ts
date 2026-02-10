import { 
    createWalletClient, 
    http, 
    publicActions, 
    parseUnits, 
    getAddress, 
    erc20Abi, 
    type Hex 
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { gatewayAbi } from "./abis/GatewayAbi.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * PEDANTIC MINTING SCRIPT
 * -----------------------
 * Target: Mint TESTUSD (Vetro Pegged Token)
 * Source: 100 USDC
 */

// Official addresses from ethereum-1.0.0-beta.1.json
const USDC_ADDR = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const GATEWAY_ADDR = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");
const TESTUSD_ADDR = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function mint() {
    // 0. Setup Environment
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    if (!pk) throw new Error("Missing LIQUIDATION_PRIVATE_KEY_1 in .env");

    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ 
        account, 
        chain: mainnet, 
        transport: http(process.env.RPC_URL_1) 
    }).extend(publicActions);

    console.log(`\n🏦 OPERATING WALLET: ${account.address}`);
    const amountIn = parseUnits("100", 6); // 100 USDC

    // 1. Check current USDC Balance
    const usdcBalance = await client.readContract({
        address: USDC_ADDR,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address]
    });

    if (usdcBalance < amountIn) {
        throw new Error(`Insufficient USDC. Have: ${usdcBalance.toString()}, Need: ${amountIn.toString()}`);
    }

    // 2. APPROVE Gateway
    // Before the Gateway can pull USDC to the Treasury, you must approve it 
    console.log("🛠️ Step 1: Approving Gateway to spend 100 USDC...");
    const approveHash = await client.writeContract({
        address: USDC_ADDR,
        abi: erc20Abi,
        functionName: 'approve',
        args: [GATEWAY_ADDR, amountIn]
    });
    console.log(`⏳ Approval Sent: ${approveHash}`);
    await client.waitForTransactionReceipt({ hash: approveHash });
    console.log("✅ USDC Approved.");

    // 3. PREVIEW MINT (Simulation)
    // Query the protocol to see exactly how much TESTUSD we will receive [cite: 1606]
    const expectedOutput = await client.readContract({
        address: GATEWAY_ADDR,
        abi: gatewayAbi,
        functionName: 'previewDeposit',
        args: [USDC_ADDR, amountIn]
    });
    console.log(`📊 Expected TESTUSD Output: ${expectedOutput.toString()} (18 decimals)`);

    // 4. EXECUTE DEPOSIT
    // This call mints TESTUSD to your wallet [cite: 1572, 1633]
    console.log("🛠️ Step 2: Depositing USDC to Gateway...");
    const depositHash = await client.writeContract({
        address: GATEWAY_ADDR,
        abi: gatewayAbi,
        functionName: 'deposit',
        args: [
            USDC_ADDR, 
            amountIn, 
            expectedOutput, // minPeggedTokenOut (Slippage protection)
            account.address  // receiver
        ]
    });

    console.log(`⏳ Minting Transaction Sent: ${depositHash}`);
    const receipt = await client.waitForTransactionReceipt({ hash: depositHash });
    
    if (receipt.status === 'success') {
        const finalBalance = await client.readContract({
            address: TESTUSD_ADDR,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account.address]
        });
        console.log(`\n🎉 SUCCESS! Final TESTUSD Balance: ${finalBalance.toString()}`);
    } else {
        console.error("❌ Transaction failed.");
    }
}

mint().catch(console.error);
