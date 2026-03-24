import { createWalletClient, http, publicActions, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { stakingVaultAbi } from "./abis/StakingVaultAbi.js";
import dotenv from "dotenv";

dotenv.config();

const STAKING_VAULT = getAddress("0x4a16B99f23c5511f0A23EF9770Bf4ab28f37D830");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_2 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const activeIds = await client.readContract({ address: STAKING_VAULT, abi: stakingVaultAbi, functionName: 'getActiveRequestIds', args: [account.address] });
    if (activeIds.length === 0) throw new Error("No active requests found.");

    const latestId = activeIds[activeIds.length - 1];
    const details = await client.readContract({ address: STAKING_VAULT, abi: stakingVaultAbi, functionName: 'getRequestDetails', args: [latestId] });

    console.log(`\n🔍 Claiming Request #${latestId.toString()} for ${details.assets.toString()} assets...`);

    const hash = await client.writeContract({
        address: STAKING_VAULT,
        abi: stakingVaultAbi,
        functionName: 'claimWithdraw',
        args: [latestId, account.address]
    });
    
    await client.waitForTransactionReceipt({ hash });
    console.log(`\n🎉 SUCCESS! TESTUSD returned to ${account.address}.`);
}
run().catch(console.error);
