import { createWalletClient, http, publicActions, parseUnits, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { stakingVaultAbi } from "./abis/StakingVaultAbi.js";
import dotenv from "dotenv";

dotenv.config();

const VAULT = getAddress("0x4a16B99f23c5511f0A23EF9770Bf4ab28f37D830");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const assetsToWithdraw = parseUnits("5", 18); // Request exactly 5 TESTUSD back

    console.log("🚀 Executing Whitelisted Instant Withdraw (Assets -> Shares burned)...");
    const hash = await client.writeContract({
        address: VAULT,
        abi: stakingVaultAbi,
        functionName: 'withdraw',
        args: [assetsToWithdraw, account.address, account.address]
    });

    await client.waitForTransactionReceipt({ hash });
    console.log(`✅ Instant Withdrawal complete: ${hash}`);
}

run().catch(console.error);
