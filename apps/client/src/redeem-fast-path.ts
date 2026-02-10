import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { gatewayAbi } from "./abis/GatewayAbi.js";
import dotenv from "dotenv";

dotenv.config();

const USDC = getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const GATEWAY = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");
const TESTUSD = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const amount = parseUnits("10", 18); // Testing with 10 TESTUSD

    console.log(`🚀 WHITELISTED FLOW: Executing Instant Redeem for ${account.address}`);

    // Approval is always required first
    await client.writeContract({ address: TESTUSD, abi: erc20Abi, functionName: 'approve', args: [GATEWAY, amount] });

    const minOut = await client.readContract({ address: GATEWAY, abi: gatewayAbi, functionName: 'previewRedeem', args: [USDC, amount] });

    const hash = await client.writeContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'redeem',
        args: [USDC, amount, minOut, account.address]
    });
    
    console.log(`✅ Success! Fast-path redemption complete: ${hash}`);
}
run().catch(console.error);
