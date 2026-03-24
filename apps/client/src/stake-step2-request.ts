import { createWalletClient, http, publicActions, getAddress, erc20Abi, type Hex, parseAbiItem, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { stakingVaultAbi } from "./abis/StakingVaultAbi.js";
import { parseEventLogs } from "viem";
import dotenv from "dotenv";

dotenv.config();

const STAKING_VAULT = getAddress("0x4a16B99f23c5511f0A23EF9770Bf4ab28f37D830");

async function run() {
    const pk = process.env.LIQUIDATION_PRIVATE_KEY_2 as Hex;
    const account = privateKeyToAccount(pk);
    const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

    const shares = await client.readContract({ address: STAKING_VAULT, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
    if (shares === 0n) throw new Error("No sTESTUSD balance found.");

    console.log(`\n⏳ Initiating unstaking for ${shares.toString()} shares...`);
    const hash = await client.writeContract({
        address: STAKING_VAULT,
        abi: stakingVaultAbi,
        functionName: 'requestRedeem',
        args: [shares, account.address]
    });

    const receipt = await client.waitForTransactionReceipt({ hash });

    // Use parseEventLogs to specifically target the WithdrawRequested event
    const withdrawLogs = parseEventLogs({
      abi: stakingVaultAbi,
      logs: receipt.logs,
      eventName: 'WithdrawRequested',
    });

    if (withdrawLogs.length === 0) {
      throw new Error("Failed to find WithdrawRequested event in transaction logs.");
    }

    const { requestId, claimableAt } = withdrawLogs[0].args;

    console.log(`✅ REQUEST SUCCESSFUL!`);
    console.log(`- Request ID: ${requestId.toString()}`);
    console.log(`- Claimable At: ${new Date(Number(claimableAt) * 1000).toLocaleString()}`);

}
run().catch(console.error);
