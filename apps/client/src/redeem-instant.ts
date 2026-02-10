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
 * INSTANT REDEMPTION SCRIPT
 * -----------------------
 * Note: Use this script because WithdrawalDelay is currently DISABLED on-chain.
 */

const USDC_ADDR = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const GATEWAY_ADDR = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");
const TESTUSD_ADDR = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ 
        account, 
        chain: mainnet, 
        transport: http(process.env.RPC_URL_1) 
    }).extend(publicActions);

    // Redming 100 TESTUSD (18 decimals)
    const amountToRedeem = parseUnits("100", 18); 

    console.log(`\n🚀 Executing Instant Redemption for: ${account.address}`);

    // 1. APPROVE Gateway to burn your TESTUSD
    console.log("🛠️ Step 1: Approving TESTUSD...");
    const appHash = await client.writeContract({ 
        address: TESTUSD_ADDR, 
        abi: erc20Abi, 
        functionName: 'approve', 
        args: [GATEWAY_ADDR, amountToRedeem] 
    });
    await client.waitForTransactionReceipt({ hash: appHash });
    console.log("✅ TESTUSD Approved.");

    // 2. PREVIEW Output
    const minOut = await client.readContract({ 
        address: GATEWAY_ADDR, 
        abi: gatewayAbi, 
        functionName: 'previewRedeem', 
        args: [USDC_ADDR, amountToRedeem] 
    });
    console.log(`📊 Expected USDC Output: ${minOut.toString()} (6 decimals)`);

    // 3. EXECUTE INSTANT REDEEM
    console.log("🛠️ Step 2: Redeeming TESTUSD for USDC...");
    const hash = await client.writeContract({
        address: GATEWAY_ADDR,
        abi: gatewayAbi,
        functionName: 'redeem',
        args: [
            USDC_ADDR, 
            amountToRedeem, 
            minOut,          // minAmountOut
            account.address  // receiver
        ]
    });
    
    console.log(`⏳ Transaction Sent: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
    console.log(`\n🎉 SUCCESS! You have instantly redeemed TESTUSD for USDC.`);
}

run().catch(console.error);
