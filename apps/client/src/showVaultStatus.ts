import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { VusdMetaVaultClient } from "./vaultClient.js";

const VUSD = "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3";
const VAULT = "0x6283C40558521515595cbCc573f8A0489Ab4d1E7";

async function run() {
  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const rpc = process.env.RPC_URL_1;
  if (!pk || !rpc) throw new Error("Missing ENV variables");

  const account = privateKeyToAccount(pk);
  const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(rpc) });

  const vault = new VusdMetaVaultClient(client, wallet, VAULT, VUSD);
  const status = await vault.getStatus();

  console.log(`\n--- VUSD VAULT STATUS ---`);
  console.log(`Wallet:        ${account.address}`);
  console.log(`VUSD Balance:  ${formatUnits(status.vusdBal, status.decimals)} VUSD`);
  console.log(`Vault Shares:  ${formatUnits(status.sharesBal, 18)} shares`);
  console.log(`Vault Assets:  ${formatUnits(status.totalAssets, status.decimals)} VUSD`);
}
run().catch(console.error);
