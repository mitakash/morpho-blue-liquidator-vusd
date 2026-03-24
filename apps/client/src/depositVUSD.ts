import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { VusdMetaVaultClient } from "./vaultClient.js";

const VUSD = "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3";
const VAULT = "0x6283C40558521515595cbCc573f8A0489Ab4d1E7";

async function run() {
  const amountStr = process.argv[2];
  if (!amountStr) throw "Usage: npx tsx --env-file=.env apps/client/src/depositVUSD.ts <amount>";

  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) });

  const vault = new VusdMetaVaultClient(client, wallet, VAULT, VUSD);
  const { decimals } = await vault.getStatus();
  
  const hash = await vault.deposit(parseUnits(amountStr, decimals));
  console.log(`✅ Transaction submitted: ${hash}`);
}
run().catch(console.error);
