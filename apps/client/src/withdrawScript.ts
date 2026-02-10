import { createWalletClient, http, publicActions, type Hex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
const MARKET_ID = "0xd3b93e2f5f0ba017121d1ba896efe800d097962f6bc43c6786f7393c6a12c58a" as Hex;

async function recover() {
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

  const marketParams = {
    loanToken: getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619"),
    collateralToken: getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00"),
    oracle: getAddress("0x9F7c53ae6eFa70251fF6F6dD5401076F33fd4543"),
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n,
  };

  // 1. Fetch exact balances
  const [supplyShares, , collateral] = await client.readContract({
    address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "position", args: [MARKET_ID, account.address],
  });

  console.log(`💰 Recovering ${collateral} HemiBTC and ${supplyShares} VUSD shares...`);

  // 2. Withdraw Collateral (HemiBTC)
  if (collateral > 0n) {
    const hash = await client.writeContract({
      address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "withdrawCollateral",
      args: [marketParams, collateral, account.address, account.address],
    });
    console.log(`⏳ Collateral withdrawal sent: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
  }

  // 3. Withdraw Loan Asset (VUSD) - Using SHARES for full withdrawal
  if (supplyShares > 0n) {
    const hash = await client.writeContract({
      address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "withdraw",
      args: [marketParams, 0n, supplyShares, account.address, account.address],
    });
    console.log(`⏳ VUSD withdrawal sent: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
  }

  console.log("\n✅ Recovery Complete!");
}

recover().catch(console.error);
