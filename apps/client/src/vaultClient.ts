import { 
  type Address, type PublicClient, type WalletClient, type Transport, type Chain, type Account,
  erc20Abi, erc4626Abi, maxUint256, getAddress 
} from "viem";

export class VusdMetaVaultClient {
  public readonly vaultAddress: Address;
  public readonly vusdAddress: Address;

  constructor(
    public readonly publicClient: PublicClient,
    public readonly walletClient: WalletClient<Transport, Chain, Account>,
    vaultAddress: string,
    vusdAddress: string
  ) {
    this.vaultAddress = getAddress(vaultAddress);
    this.vusdAddress = getAddress(vusdAddress);
  }

  async getStatus() {
    const address = this.walletClient.account.address;
    const [vusdBal, sharesBal, decimals, totalAssets] = await Promise.all([
      this.publicClient.readContract({ address: this.vusdAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
      this.publicClient.readContract({ address: this.vaultAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
      this.publicClient.readContract({ address: this.vusdAddress, abi: erc20Abi, functionName: 'decimals' }),
      this.publicClient.readContract({ address: this.vaultAddress, abi: erc4626Abi, functionName: 'totalAssets' }),
    ]);

    return { vusdBal, sharesBal, decimals, totalAssets };
  }

  async deposit(assets: bigint) {
    const owner = this.walletClient.account.address;
    const allowance = await this.publicClient.readContract({
      address: this.vusdAddress, abi: erc20Abi, functionName: 'allowance', args: [owner, this.vaultAddress],
    });

    if (allowance < assets) {
      console.log("🔓 Approving VUSD...");
      const tx = await this.walletClient.writeContract({
        address: this.vusdAddress, abi: erc20Abi, functionName: 'approve', args: [this.vaultAddress, maxUint256],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: tx });
    }

    console.log(`📥 Depositing ${assets.toString()} VUSD to MetaVault...`);
    return await this.walletClient.writeContract({
      address: this.vaultAddress,
      abi: erc4626Abi,
      functionName: 'deposit',
      args: [assets, owner],
    });
  }

  // ADDED MISSING REDEEM METHOD
  async redeem(shares: bigint) {
    const owner = this.walletClient.account.address;
    console.log(`📤 Redeeming ${shares.toString()} shares...`);
    return await this.walletClient.writeContract({
      address: this.vaultAddress,
      abi: erc4626Abi,
      functionName: 'redeem',
      args: [shares, owner, owner], // shares, receiver, owner
    });
  }
}
