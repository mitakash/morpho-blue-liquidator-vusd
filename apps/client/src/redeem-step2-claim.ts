import { createWalletClient, http, publicActions, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { gatewayAbi } from "./abis/GatewayAbi.js";
import dotenv from "dotenv";

dotenv.config();

const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const GATEWAY = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");

async function run() {
    const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    // Check request status
    const [locked, claimableAt] = await client.readContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'getRedeemRequest',
        args: [account.address]
    });

    if (locked === 0n) throw new Error("No active redemption request found.");

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < claimableAt) {
        const remaining = claimableAt - now;
        throw new Error(`Wait period not over. Please wait another ${remaining.toString()} seconds.`);
    }

    const minOut = await client.readContract({ 
        address: GATEWAY, 
        abi: gatewayAbi, 
        functionName: 'previewRedeem', 
        args: [USDC, locked] 
    });

    console.log("🚀 Wait period over. Executing Final Redemption...");
    const hash = await client.writeContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'redeem',
        args: [USDC, locked, minOut, account.address]
    });
    
    console.log(`✅ Success! USDC withdrawn. Hash: ${hash}`);
}

run().catch(console.error);
