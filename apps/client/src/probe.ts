import { createPublicClient, http, type Hex, encodeDeployData } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

const ORACLE_BYTECODE: Hex = "0x608060405234801561001057600080fd5b506040516101ec3803806101ec8339818101604052602081101561003357600080fd5b81019080519060200150336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508060018190555050610175806100a76000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80633fb5c1cb116100305780633fb5c1cb1461008c57806385a8af43146100a9575b806391b7f51e14610046575b600080fd5b604051806020016040528060015481525090f35b61008a6004803603602081101561005c57600080fd5b81019080519060200150336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508160018190555050565b005b604051806020016040528060005473ffffffffffffffffffffffffffffffffffffffff1681525090f3fea264697066735822122046c43493488210344d27196025219456729571329c011e03c149090b8f04193564736f6c63430008130033";

const ORACLE_ABI = [{ inputs: [{ type: "uint256" }], stateMutability: "nonpayable", type: "constructor" }] as const;

async function probe() {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const initialPrice = 100000n * 10n ** 36n;

  const deployData = encodeDeployData({
    abi: ORACLE_ABI,
    bytecode: ORACLE_BYTECODE,
    args: [initialPrice],
  });

  console.log("🔍 Probing deployment with eth_call...");
  try {
    // This is a direct EVM call to the 'null' address which simulates contract creation
    await client.call({ account, data: deployData });
    console.log("✅ Simulation Passed!");
  } catch (err: any) {
    console.error("❌ PROBE FAILED");
    console.log("Error Message:", err.message);
    if (err.data) {
        console.log("Raw Revert Data:", err.data);
        // If data contains "0x5f", it's a PUSH0 opcode error.
    }
  }
}
probe();
