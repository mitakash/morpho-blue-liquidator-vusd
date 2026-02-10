import { createWalletClient, http, publicActions, type Hex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");

async function run() {
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createWalletClient({ 
    account, chain: mainnet, transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  // YOUR BRAND NEW ORACLE ADDRESS
  const NEW_ORACLE = getAddress("0x2b816cecb2ccf258426d8d5699db697fd9279bc5");

  const marketParams = {
    loanToken: getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619"),
    collateralToken: getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00"),
    oracle: NEW_ORACLE,
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n, // 94.5%
  };

  console.log("🛠️ Creating New Hemi-Corrected Market...");
  
  const hash = await client.writeContract({
    address: MORPHO_BLUE,
    abi: morphoBlueAbi,
    functionName: "createMarket",
    args: [marketParams],
  });

  console.log(`⏳ Broadcasted: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash });
  
  // Find the Market ID from the CreateMarket event logs
  const event = receipt.logs.find(log => log.topics[0] === "0xac4b2400f169220b0c0afdde7a0b32e775ba727ea1cb30b35f935cdaab8683ac");
  const marketId = event?.topics[1];

  console.log(`\n🎯 SUCCESS! Your New Market ID is: ${marketId}`);
  console.log(`📝 Use this ID in your config.ts and supply scripts.`);
}

run().catch(console.error);
