import { createWalletClient, http, publicActions, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { gatewayAbi } from "./abis/GatewayAbi.js";
import dotenv from "dotenv";

dotenv.config();

const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const GATEWAY = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");

async function run() {
    // Ensure we use the correct PK for the non-whitelisted wallet
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_2 as Hex;
    if (!pk) throw new Error("Missing LIQUIDATION_PRIVATE_KEY_2 in .env");

    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ 
        account, 
        chain: mainnet, 
        transport: http(process.env.RPC_URL_1) 
    }).extend(publicActions);

    console.log(`\n🔍 CHECKING REDEMPTION STATUS FOR: ${account.address}`);

    // 1. Fetch current request details
    const [locked, claimableAt] = await client.readContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'getRedeemRequest',
        args: [account.address]
    });

    if (locked === 0n) {
        throw new Error("No active redemption request found for this wallet.");
    }

    // 2. Validate maturity time
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < claimableAt) {
        const remaining = claimableAt - now;
        throw new Error(`Cooldown not over. Please wait another ${remaining.toString()} seconds.`);
    }

    // 3. Preview output
    const minOut = await client.readContract({ 
        address: GATEWAY, 
        abi: gatewayAbi, 
        functionName: 'previewRedeem', 
        args: [USDC, locked] 
    });

    console.log(`🚀 Cooldown matured! Redeeming ${locked.toString()} units for approx ${minOut.toString()} USDC...`);

    // 4. Execute final redeem
    const hash = await client.writeContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'redeem',
        args: [
            USDC, 
            locked, 
            minOut,          // minAmountOut
            account.address  // receiver
        ]
    });
    
    console.log(`⏳ Pending: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
    console.log(`\n🎉 SUCCESS! USDC has been sent to ${account.address}.`);
}

run().catch(console.error);
