import { createPublicClient, http, keccak256, toHex } from "viem";
import { mainnet } from "viem/chains";

// Address from your release JSON: PeggedToken (VUSD)
const VUSD_ADDRESS = "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3";
const RPC_URL = "https://eth-mainnet.g.alchemy.com/v2/6-VuDO-hkjg7z7jkzpBF3mODc86WiNUI";

const abi = [
  {
    name: "getRoleMemberCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "role", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getRoleMember",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const ROLES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  KEEPER_ROLE: keccak256(toHex("KEEPER_ROLE")),
  UMM_ROLE: keccak256(toHex("UMM_ROLE")),
  MAINTAINER_ROLE: keccak256(toHex("MAINTAINER_ROLE")),
};

async function main() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  });

  console.log(`Checking Roles for VETRO at: ${VUSD_ADDRESS}\n`);

  for (const [roleName, roleHash] of Object.entries(ROLES)) {
    try {
      const count = await client.readContract({
        address: VUSD_ADDRESS,
        abi,
        functionName: "getRoleMemberCount",
        args: [roleHash as `0x${string}`],
      });

      console.log(`${roleName} (Count: ${count}):`);

      for (let i = 0n; i < count; i++) {
        const member = await client.readContract({
          address: VUSD_ADDRESS,
          abi,
          functionName: "getRoleMember",
          args: [roleHash as `0x${string}`, i],
        });
        console.log(`  - ${member}`);
      }
    } catch (e) {
      console.log(`${roleName}: Error (Role likely has no members or is not enumerable)`);
    }
    console.log("");
  }
}

main().catch(console.error);
