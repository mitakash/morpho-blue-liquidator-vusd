import { createWalletClient, http, publicActions, type Hex, parseUnits, erc20Abi, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const VUSD = getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619");
const HEMI_BTC = getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00");
const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");

async function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function setup() {
  const pk = process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex;
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) }).extend(publicActions);

  const marketParams = {
    loanToken: VUSD,
    collateralToken: HEMI_BTC,
    oracle: getAddress("0x9f7c53ae6efa70251ff6f6dd5401076f33fd4543"),
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n,
  };

  console.log(`\n🔍 Operating Wallet: ${account.address}`);

  // 1. APPROVE with Max Allowance to be safe
  console.log("🛠️ Step 1: Approving Tokens...");
  const vusdHash = await client.writeContract({ address: VUSD, abi: erc20Abi, functionName: 'approve', args: [MORPHO_BLUE, parseUnits("1000000", 18)] });
  const btcHash = await client.writeContract({ address: HEMI_BTC, abi: erc20Abi, functionName: 'approve', args: [MORPHO_BLUE, parseUnits("10", 8)] });
  
  console.log("⏳ Waiting for approvals to finalize...");
  await client.waitForTransactionReceipt({ hash: vusdHash });
  await client.waitForTransactionReceipt({ hash: btcHash });
  
  // CRITICAL: Wait an extra 15 seconds for RPC nodes to sync state
  console.log("⏳ Waiting 15s for state synchronization...");
  await sleep(15000);

  // 2. SUPPLY (Supplying 99.9 VUSD instead of 100 to avoid rounding reverts)
  console.log("🛠️ Step 2: Supplying VUSD...");
  const supplyHash = await client.writeContract({
    address: MORPHO_BLUE, 
    abi: morphoBlueAbi, 
    functionName: "supply",
    args: [marketParams, parseUnits("99.9", 18), 0n, account.address, "0x"],
    gas: 500_000n, // Explicit gas to avoid estimation issues
  });
  await client.waitForTransactionReceipt({ hash: supplyHash });

  // 3. SUPPLY COLLATERAL
  const collateralAmount = parseUnits("0.00144737", 8); 
  console.log(`🛠️ Step 3: Supplying HemiBTC...`);
  const collateralHash = await client.writeContract({
    address: MORPHO_BLUE, 
    abi: morphoBlueAbi, 
    functionName: "supplyCollateral",
    args: [marketParams, collateralAmount, account.address, "0x"],
    gas: 400_000n,
  });
  await client.waitForTransactionReceipt({ hash: collateralHash });

  // 4. BORROW
  console.log("🛠️ Step 4: Borrowing VUSD...");
  const borrowHash = await client.writeContract({
    address: MORPHO_BLUE, 
    abi: morphoBlueAbi, 
    functionName: "borrow",
    args: [marketParams, parseUnits("90", 18), 0n, account.address, account.address],
    gas: 600_000n,
  });
  await client.waitForTransactionReceipt({ hash: borrowHash });

  console.log("\n✅ ALL STEPS COMPLETED SUCCESSFULLY!");
}

setup().catch(console.error);
