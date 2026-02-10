import { createPublicClient, http, parseAbiItem, type Hex, decodeEventLog } from "viem";
import { mainnet } from "viem/chains";

const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const TARGET_MARKET_ID = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca";
const ORACLE_TX_BLOCK = BigInt(24394967);

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL_1),
});

const LIQUIDATE_EVENT_ABI = [
  parseAbiItem("event Liquidate(bytes32 indexed id, address indexed borrower, uint256 collateralAssets, uint256 debtAssets, uint256 seizedAssets, uint256 badDebtAssets)")
];

async function findCompetingBot() {
  console.log(`🔎 Broad search: Blocks ${ORACLE_TX_BLOCK} to ${ORACLE_TX_BLOCK + 10n}...`);

  // 1. BROAD SEARCH: Remove the 'args' filter to see ALL liquidations in these blocks
  // This helps find if the Market ID was slightly different or if the event was malformed.
  const allLogs = await client.getLogs({
    address: MORPHO_BLUE,
    event: LIQUIDATE_EVENT_ABI[0],
    fromBlock: ORACLE_TX_BLOCK,
    toBlock: ORACLE_TX_BLOCK + 10n,
    strict: false, // Bypasses strict ABI matching
  });

  if (allLogs.length === 0) {
    console.log("❌ Truly no liquidation events found on Morpho Blue in this range.");
    return;
  }

  console.log(`Found ${allLogs.length} total liquidations. Checking for our Market ID...`);

  for (const log of allLogs) {
    // 2. MANUAL MATCHING: Check the ID manually from the topics
    const logMarketId = log.topics[1]; // The 'id' is the first indexed param (topic[1])
    
    if (logMarketId?.toLowerCase() === TARGET_MARKET_ID.toLowerCase()) {
      const tx = await client.getTransaction({ hash: log.transactionHash });
      
      console.log(`\n🎯 MATCH FOUND!`);
      console.log(`Tx Hash:     ${log.transactionHash}`);
      console.log(`Bot/From:    ${tx.from}`);
      console.log(`Block/Index: ${log.blockNumber} / ${tx.transactionIndex}`);
      
      // Decode for details
      const decoded = decodeEventLog({
        abi: LIQUIDATE_EVENT_ABI,
        data: log.data,
        topics: log.topics
      });
      console.log(`Seized:      ${(decoded.args as any).seizedAssets} assets`);
      return;
    }
  }
  console.log("❌ None of the liquidations in these blocks matched your Market ID.");
}

findCompetingBot().catch(console.error);
