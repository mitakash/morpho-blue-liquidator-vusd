import { createWalletClient, http, publicActions, parseUnits, getAddress, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { stakingVaultAbi } from "./abis/StakingVaultAbi.js";
import dotenv from "dotenv";

dotenv.config();

const VAULT = getAddress("0x4a16B99f23c5511f0A23EF9770Bf4ab28f37D830");
const TESTUSD = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const amount = parseUnits("10", 18); // Depositing 10 TESTUSD

    console.log("🛠️ Step 1: Approving Asset...");
    const appHash = await client.writeContract({ 
        address: TESTUSD, 
        abi: erc20Abi, 
        functionName: 'approve', 
        args: [VAULT, amount] 
    });
    await client.waitForTransactionReceipt({ hash: appHash });

    console.log("🚀 Step 2: Depositing to Vault...");
    const hash = await client.writeContract({
        address: VAULT,
        abi: stakingVaultAbi,
        functionName: 'deposit',
        args: [amount, account.address]
    });
    
    await client.waitForTransactionReceipt({ hash });
    console.log(`✅ Success! Deposit Hash: ${hash}`);
}

run().catch(console.error);
