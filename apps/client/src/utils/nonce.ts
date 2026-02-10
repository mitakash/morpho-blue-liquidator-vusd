import { type WalletClient } from "viem";
import { getTransactionCount } from "viem/actions"; // Correct subpath
// Note: Remove 'ethers' imports and replace with viem equivalents

export class NonceTracker {
  private nonces: Map<string, number> = new Map();
  private static instance: NonceTracker;
  
  // Keep your aggressive RPC caching logic
  private static readonly RPC_CACHE_REFRESH_DELAY = 1000; 

  constructor() {
    if (!NonceTracker.instance) {
      NonceTracker.instance = this;
    }
    return NonceTracker.instance;
  }

  // Updated to use viem's WalletClient
  public async getNonce(client: WalletClient): Promise<number> {
    const address = client.account!.address;
  
    if (this.nonces.get(address) === undefined) {
      await this.resetNonce(client);
    }
  
    const currentNonce = this.nonces.get(address)!;
    this.nonces.set(address, currentNonce + 1);
  
    return currentNonce;
  }
  
  public async resetNonce(client: WalletClient) {
    const address = client.account!.address;
    // Viem equivalent of getTransactionCount('pending')
    const latestNonce = await getTransactionCount(client, {
      address,
      blockTag: 'pending'
    });
    this.nonces.set(address, latestNonce);
    return latestNonce;
  }  
  
  public async queueTransaction<T>(
    client: WalletClient,
    txFunction: (nonce: number) => Promise<T>
  ): Promise<T> {
    const address = client.account!.address;
    
    try {
      const nonce = await this.getNonce(client);
      
      try {
        const result = await txFunction(nonce);
        
        // Preserve your critical cache refresh delay
        await new Promise(resolve => setTimeout(resolve, NonceTracker.RPC_CACHE_REFRESH_DELAY));
        
        return result;
      } catch (txError) {
        // Reset on failure just like in Ajna
        await this.resetNonce(client);
        throw txError;
      }
    } catch (error) {
      throw error;
    }
  }
}

// Export a singleton for the whole bot to use
export const nonceTracker = new NonceTracker();
