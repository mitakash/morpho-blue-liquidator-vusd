import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";
import { stakingVaultAbi } from "./abis/StakingVaultAbi.js";


dotenv.config();

const STAKING_VAULT = getAddress("0x4a16B99f23c5511f0A23EF9770Bf4ab28f37D830");
const TESTUSD = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_2 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const amount = parseUnits("5", 18); // 5 TESTUSD

    console.log(`\n🛠️ Step 1: Approving StakingVault...`);
    const appHash = await client.writeContract({ address: TESTUSD, abi: erc20Abi, functionName: 'approve', args: [STAKING_VAULT, amount] });
    await client.waitForTransactionReceipt({ hash: appHash });

    console.log(`⏳ Step 2: Depositing TESTUSD for sTESTUSD...`);
    const hash = await client.writeContract({
        address: STAKING_VAULT,
        abi: stakingVaultAbi, 
        functionName: 'deposit',
        args: [amount, account.address]
    });
    
    await client.waitForTransactionReceipt({ hash });
    console.log(`✅ SUCCESS! Shares minted to ${account.address}`);
}
run().catch(console.error);
