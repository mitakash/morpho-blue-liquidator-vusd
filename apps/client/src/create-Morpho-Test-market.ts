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
    account, 
    chain: mainnet, 
    transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  // Constants from your provided JSON and previous scripts
  const TEST_VUSD = getAddress("0xB94724aa74A0296447D13a63A35B050b7F137C6d");
  const HEMI_BTC = getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00");
  const MY_ORACLE = getAddress("0x2b816cecb2ccf258426d8d5699db697fd9279bc5");
  const ADAPTIVE_IRM = getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC");

  const marketParams = {
    loanToken: TEST_VUSD,
    collateralToken: HEMI_BTC,
    oracle: MY_ORACLE,
    irm: ADAPTIVE_IRM,
    lltv: 945000000000000000n, // 94.5%
  };

  console.log("🛠️ Deploying Morpho Market for Front-End Team...");
  console.log(`- Loan: TESTVUSD (${TEST_VUSD})`);
  console.log(`- Collateral: HemiBTC (${HEMI_BTC})`);
  
  try {
    const hash = await client.writeContract({
      address: MORPHO_BLUE,
      abi: morphoBlueAbi,
      functionName: "createMarket",
      args: [marketParams],
    });

    console.log(`⏳ Transaction Sent: ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash });
    
    // Morpho CreateMarket Event Topic
    const CREATE_MARKET_TOPIC = "0xac4b2400f169220b0c0afdde7a0b32e775ba727ea1cb30b35f935cdaab8683ac";
    const event = receipt.logs.find(log => log.topics[0] === CREATE_MARKET_TOPIC);
    const marketId = event?.topics[1];

    console.log(`\n🎯 SUCCESS! Test Market ID: ${marketId}`);
    console.log(`--------------------------------------------------`);
    console.log(`Share this ID with the front-end team for testing.`);
  } catch (error) {
    console.error("❌ Failed to create market:", error);
  }
}

run().catch(console.error);
