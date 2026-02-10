import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { gatewayAbi } from "./abis/GatewayAbi.js";
import dotenv from "dotenv";

dotenv.config();

const GATEWAY = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");
const TESTUSD = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function run() {
    const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const amount = parseUnits("100", 18); 

    console.log("🛠️ Step 1: Approving TESTUSD...");
    const appHash = await client.writeContract({ address: TESTUSD, abi: erc20Abi, functionName: 'approve', args: [GATEWAY, amount] });
    await client.waitForTransactionReceipt({ hash: appHash });

    console.log("⏳ Step 2: Requesting Redemption (Starting 6-block wait)...");
    const hash = await client.writeContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'requestRedeem',
        args: [amount]
    });
    await client.waitForTransactionReceipt({ hash });

    const [locked, claimableAt] = await client.readContract({
        address: GATEWAY,
        abi: gatewayAbi,
        functionName: 'getRedeemRequest',
        args: [account.address]
    });

    console.log(`\n✅ REQUEST SUBMITTED!`);
    console.log(`- Amount Locked: ${locked.toString()}`);
    console.log(`- Claimable At (Timestamp): ${claimableAt.toString()}`);
    console.log(`\n⚠️ Wait approximately 6 blocks (~90 seconds). Then run redeem-step2-claim.ts.`);
}

run().catch(console.error);
