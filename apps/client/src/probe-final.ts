import { createPublicClient, http, type Hex, encodeDeployData } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

// YOUR BYTECODE
const ORACLE_BYTECODE: Hex = "0x608060405234801561001057600080fd5b506040516101ec3803806101ec8339818101604052602081101561003357600080fd5b81019080519060200150336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508060018190555050610175806100a76000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80633fb5c1cb116100305780633fb5c1cb1461008c57806385a8af43146100a9575b806391b7f51e14610046575b600080fd5b604051806020016040528060015481525090f35b61008a6004803603602081101561005c57600080fd5b81019080519060200150336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508160018190555050565b005b604051806020016040528060005473ffffffffffffffffffffffffffffffffffffffff1681525090f3fea264697066735822122046c43493488210344d27196025219456729571329c011e03c149090b8f04193564736f6c63430008130033";
const ORACLE_ABI = [{ inputs: [{ type: "uint256" }], stateMutability: "nonpayable", type: "constructor" }] as const;

async function probe() {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const initialPrice = 100000n * 10n ** 36n;

  const deployData = encodeDeployData({ abi: ORACLE_ABI, bytecode: ORACLE_BYTECODE, args: [initialPrice] });

  console.log("🛠️ Attempting manual eth_call with strict parameters...");
  try {
    // Explicitly using raw request to avoid viem's internal parameter mapping if it fails
    const result = await client.request({
      method: 'eth_call',
      params: [
        {
          from: account.address,
          data: deployData,
          gas: '0xF4240' // 1,000,000 gas in hex
        },
        'latest' // The critical 2nd parameter
      ]
    });
    console.log("✅ Simulation Passed! Return data:", result);
  } catch (err: any) {
    console.error("🛑 Simulation Rejected by RPC");
    console.error(`Short Message: ${err.shortMessage || 'None'}`);
    console.error(`Full Message: ${err.message}`);
    
    if (err.data) {
        console.log("🔍 Revert Data found:", err.data);
    } else {
        console.log("🔍 No revert data returned. This strongly suggests an Invalid Opcode (PUSH0/0x5f).");
    }
  }
}
probe();
