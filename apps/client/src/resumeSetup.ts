import { createWalletClient, http, publicActions, type Hex, parseUnits, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const VUSD = getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619");
const HEMI_BTC = getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00");
const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");

async function resume() {
  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ 
    account, 
    chain: mainnet, 
    transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  // Settings to prevent timeout errors
  const txSettings = { timeout: 180_000, pollingInterval: 4_000 };

  const marketParams = {
    loanToken: VUSD,
    collateralToken: HEMI_BTC,
    oracle: getAddress("0x9f7c53ae6efa70251ff6f6dd5401076f33fd4543"),
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n,
  };

  console.log(`\n🔍 Resuming for Wallet: ${account.address}`);
  console.log("✅ Step 1 (Approvals) confirmed on-chain. Skipping...");

  // 2. SUPPLY LENDING LIQUIDITY (99.9 VUSD)
  console.log("🛠️ Step 2: Supplying VUSD...");
  const supplyHash = await client.writeContract({
    address: MORPHO_BLUE, 
    abi: morphoBlueAbi, 
    functionName: "supply",
    args: [marketParams, parseUnits("99.9", 18), 0n, account.address, "0x"],
  });
  console.log(`⏳ Supply hash: ${supplyHash}`);
  await client.waitForTransactionReceipt({ hash: supplyHash, ...txSettings });

  // 3. SUPPLY COLLATERAL
  const collateralAmount = parseUnits("0.00144737", 8); 
  console.log(`🛠️ Step 3: Supplying HemiBTC Collateral...`);
  const collateralHash = await client.writeContract({
    address: MORPHO_BLUE, 
    abi: morphoBlueAbi, 
    functionName: "supplyCollateral",
    args: [marketParams, collateralAmount, account.address, "0x"],
  });
  console.log(`⏳ Collateral hash: ${collateralHash}`);
  await client.waitForTransactionReceipt({ hash: collateralHash, ...txSettings });

  // 4. BORROW (90 VUSD)
  console.log("🛠️ Step 4: Borrowing VUSD...");
  const borrowHash = await client.writeContract({
    address: MORPHO_BLUE, 
    abi: morphoBlueAbi, 
    functionName: "borrow",
    args: [marketParams, parseUnits("90", 18), 0n, account.address, account.address],
  });
  console.log(`⏳ Borrow hash: ${borrowHash}`);
  await client.waitForTransactionReceipt({ hash: borrowHash, ...txSettings });

  console.log("\n🎉 ALL STEPS COMPLETED! Position is now live.");
}

resume().catch(console.error);
