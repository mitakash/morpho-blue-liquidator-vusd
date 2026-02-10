import { createWalletClient, http, publicActions, type Hex, getAddress, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import { erc20Abi } from "viem";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
const MARKET_ID = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca" as Hex;

async function setup() {
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createWalletClient({ 
    account, chain: mainnet, transport: http(process.env.RPC_URL_1) 
  }).extend(publicActions);

  const marketParams = {
    loanToken: getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619"),
    collateralToken: getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00"),
    oracle: getAddress("0x2b816cecb2ccf258426d8d5699db697fd9279bc5"),
    irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
    lltv: 945000000000000000n,
  };

  console.log("🚀 Starting Full Position Setup...");

  // 1. Supply Collateral (0.00144737 HemiBTC)
  const collateralAmount = 144737n; 
  await client.writeContract({
    address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "supplyCollateral",
    args: [marketParams, collateralAmount, account.address, "0x"],
  });
  console.log("✅ Collateral Supplied.");

  // 2. Supply Loan Liquidity (99.9 VUSD)
  const supplyAmount = parseUnits("99.9", 18);
  await client.writeContract({
    address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "supply",
    args: [marketParams, supplyAmount, 0n, account.address, "0x"],
  });
  console.log("✅ VUSD Liquidity Supplied.");

  // 3. Borrow (90 VUSD)
  const borrowAmount = parseUnits("90", 18);
  const borrowHash = await client.writeContract({
    address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "borrow",
    args: [marketParams, borrowAmount, 0n, account.address, account.address],
  });
  
  console.log(`⏳ Borrow Transaction Sent: ${borrowHash}`);
  await client.waitForTransactionReceipt({ hash: borrowHash });
  console.log("🎉 SUCCESS: Position is live and 90 VUSD has been borrowed.");
}

setup().catch(console.error);
