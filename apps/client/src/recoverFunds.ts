import { createWalletClient, http, publicActions, type Hex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");

// THE "WRONG" MARKET ID WHERE FUNDS WERE SENT
const WRONG_MARKET_ID = "0x09d0c64e526279f82d96c92d53a928929e7e7211e03c149090b8f04193564736" as Hex;

async function recover() {
  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ 
    account, chain: mainnet, transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  // Note: These params must match the WRONG_MARKET_ID logic exactly
  const marketParams = {
    loanToken: getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619"),
    collateralToken: getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00"),
    oracle: getAddress("0x9f7c53ae6efa70251ff6f6dd5401076f33fd4543"), // The lowercase/wrong one
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n,
  };

  console.log(`\n🔍 Checking balances for Market: ${WRONG_MARKET_ID}`);
  
  const [supplyShares, borrowShares, collateral] = await client.readContract({
    address: MORPHO_BLUE,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [WRONG_MARKET_ID, account.address],
  });

  console.log(`💰 Stuck VUSD Shares: ${supplyShares}`);
  console.log(`💰 Stuck HemiBTC: ${collateral}`);

  if (collateral > 0n) {
    console.log("🛠️ Withdrawing HemiBTC...");
    const hash = await client.writeContract({
      address: MORPHO_BLUE,
      abi: morphoBlueAbi,
      functionName: "withdrawCollateral",
      args: [marketParams, collateral, account.address, account.address],
    });
    await client.waitForTransactionReceipt({ hash });
    console.log("✅ HemiBTC Recovered.");
  }

  if (supplyShares > 0n) {
    console.log("🛠️ Withdrawing VUSD...");
    const hash = await client.writeContract({
      address: MORPHO_BLUE,
      abi: morphoBlueAbi,
      functionName: "withdraw",
      args: [marketParams, 0n, supplyShares, account.address, account.address],
    });
    await client.waitForTransactionReceipt({ hash });
    console.log("✅ VUSD Recovered.");
  }

  console.log("\n🎉 Recovery complete! Funds are back in your wallet.");
}

recover().catch(console.error);
