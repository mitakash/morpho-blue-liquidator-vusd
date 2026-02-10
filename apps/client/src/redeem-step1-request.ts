import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { gatewayAbi } from "./abis/GatewayAbi.js";
import dotenv from "dotenv";

dotenv.config();

const GATEWAY = getAddress("0x3B677f95A3B340A655Cd39a13FC056F625bB9492");
const TESTUSD = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_2 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    // Using your exact balance: 9.9988 TESTUSD
    const amount = parseUnits("9.9988", 18); 

    console.log(`\n⏳ INITIATING 70-SECOND DELAY TEST FOR: ${account.address}`);

    console.log("🛠️ Step 1: Approving TESTUSD...");
    const appHash = await client.writeContract({ address: TESTUSD, abi: erc20Abi, functionName: 'approve', args: [GATEWAY, amount] });
    await client.waitForTransactionReceipt({ hash: appHash });

    console.log("⏳ Step 2: Calling requestRedeem (Manoj needs to call toggleWithdrawalDelay first)...");
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

    console.log(`\n✅ REQUEST SUCCESSFUL!`);
    console.log(`- Amount Locked: ${locked.toString()}`);
    console.log(`- Claimable At: ${new Date(Number(claimableAt) * 1000).toLocaleString()}`);
    console.log(`\n⚠️ Wait 70 seconds, then run redeem-step2-claim.ts using PK2.`);
}

run().catch(console.error);
