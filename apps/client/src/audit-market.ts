import { createPublicClient, http, getAddress, type Hex, formatUnits, parseUnits } from "viem";
import { mainnet } from "viem/chains";
import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue.js";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
const MARKET_ID = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca" as Hex;
const USER = getAddress("0x7b6027ba861A99FFbFAFb19B44934cE9B042fBeF");

async function audit() {
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });

  const [loanToken, collateralToken, oracle, irm, lltv] = await client.readContract({
    address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "idToMarketParams", args: [MARKET_ID],
  });

  const [supplyShares, borrowShares, collateral] = await client.readContract({
    address: MORPHO_BLUE, abi: morphoBlueAbi, functionName: "position", args: [MARKET_ID, USER],
  });

  const price = await client.readContract({
    address: oracle,
    abi: [{ name: "price", type: "function", outputs: [{ type: "uint256" }], stateMutability: "view" }],
    functionName: "price",
  });

  // NATIVE MATH
  const collateralValueInLoan = (collateral * price) / (10n ** 36n);
  const maxBorrow = (collateralValueInLoan * lltv) / (10n ** 18n);

  console.log(`\n🕵️ AUDIT REPORT (NATIVE UNITS)`);
  console.log(`--------------------------------------------------`);
  console.log(`💎 Native Collateral:  ${collateral.toString()} (8 decimals)`);
  console.log(`🏦 Native Debt:        ${borrowShares.toString()} (18 decimals)`);
  console.log(`💵 Value in VUSD:      ${formatUnits(collateralValueInLoan, 18)} VUSD`);
  console.log(`🛡️ Max Borrow:         ${formatUnits(maxBorrow, 18)} VUSD`);
  console.log(`--------------------------------------------------`);
}

audit().catch(console.error);
