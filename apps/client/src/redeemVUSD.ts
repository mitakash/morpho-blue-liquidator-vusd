import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { VusdMetaVaultClient } from "./vaultClient.js";

const VUSD = "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3";
const VAULT = "0x6283C40558521515595cbCc573f8A0489Ab4d1E7";

async function run() {
  const arg = process.argv[2];
  if (!arg) throw "Usage: npx tsx --env-file=.env apps/client/src/redeemVUSD.ts <amount|all>";

  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const rpc = process.env.RPC_URL_1;
  const account = privateKeyToAccount(pk);
  const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

  const vault = new VusdMetaVaultClient(client, wallet, VAULT, VUSD);
  const { sharesBal } = await vault.getStatus();
  
  const amount = arg.toLowerCase() === "all" ? sharesBal : parseUnits(arg, 18);
  
  if (amount === 0n) {
    console.log("⚠️ No shares to redeem.");
    return;
  }

  const hash = await vault.redeem(amount);
  console.log(`✅ Redemption submitted: ${hash}`);
}
run().catch(console.error);
