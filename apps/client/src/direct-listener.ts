import { createPublicClient, fallback, http, parseAbiItem, type Hex, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 0. Import local bot logic and configurations
import { HemiLiquidator, TARGET_MARKET_ID } from "./liquidator";
import { chainConfig } from "@morpho-blue-liquidation-bot/config";
import { launchBot } from "."; // This launches the existing SDK logic

// 1. Manually define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Programmatic environment loading from the root .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// --- RPC VERIFICATION LOGS ---
console.log("---------------------------------------");
console.log(" STARTING DIRECT RPC LISTENER (PONDER BYPASSED)");
console.log(`- PRIMARY: ${new URL(process.env.PONDER_RPC_URL_1!).hostname}`);
console.log(`- BACKUP:  ${new URL(process.env.RPC_URL_1_BACKUP!).hostname}`);
console.log(`- TARGET:  Hemi Market ${TARGET_MARKET_ID}`);
console.log("---------------------------------------");

// 3. Setup Secured Multi-RPC Transport (Wipes out Merkle defaults)
// Updated Transport logic in direct-listener.ts
const transport = fallback([
  http(process.env.PONDER_RPC_URL_1, { 
    name: "Infura-Primary",
    timeout: 30_000, // Increase timeout to 30s
    retryCount: 5,
    retryDelay: 1000,
    batch: false // DISABLE batching to avoid Cloudflare 1015
  }),
  http(process.env.RPC_URL_1_BACKUP, { 
    name: "Alchemy-Backup",
    timeout: 30_000,
    retryCount: 5,
    batch: false
  }),
], { rank: false });

const client = createPublicClient({ 
  chain: mainnet, 
  transport,
  pollingInterval: 6_000 // Poll every 4 seconds (roughly 1/3 of a block time)
});


// 4. Morpho Constants
const MORPHO_ADDR = getAddress('0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb');
const LIQUIDATE_ABI = parseAbiItem(
  'event Liquidate(bytes32 indexed id, address indexed borrower, uint256 collateralAssets, uint256 debtAssets, uint256 seizedAssets, uint256 badDebtAssets)'
);

/**
 * MAIN EXECUTION LOOP
 */
async function startBot() {
  // Load standard Hemi config (Chain ID 1)
  const config = chainConfig(1);
  
  // Initialize the existing bot logic (Signers, Flashbots, SDK listeners)
  console.log("🛠️  Initializing bot execution logic (Flashbots/Signers)...");
  await launchBot(config);

  // 5. One-time Catch-up (Fetch missed events from the last 100 blocks)
  try {
    const currentBlock = await client.getBlockNumber();
    console.log(`- Current Block: ${currentBlock}. Performing catch-up...`);
    
    const pastLogs = await client.getLogs({
      address: MORPHO_ADDR,
      event: LIQUIDATE_ABI,
      args: { id: TARGET_MARKET_ID as Hex },
      fromBlock: currentBlock - 100n
    });
    
    if (pastLogs.length > 0) {
      console.log(`- Found ${pastLogs.length} recent liquidations during catch-up.`);
      // Process past logs here if necessary
    }
  } catch (error) {
    console.warn("Catch-up failed. Checking for live events instead.");
  }

  // 6. Persistent Real-time Watcher (The "Self-Healing" Loop)
  function initWatcher() {
    console.log(" Monitoring Hemi market for live liquidation events...");
    
    const unwatch = client.watchEvent({
      address: MORPHO_ADDR,
      event: LIQUIDATE_ABI,
      args: { id: TARGET_MARKET_ID as Hex },
      poll: true, // FORCE polling mode to avoid Infura filter timeouts
      onLogs: (logs) => {
        logs.forEach(async (log) => {
          const { borrower, seizedAssets, debtAssets } = log.args;
          console.log(`\n[${new Date().toLocaleTimeString()}] EVENT DETECTED!`);
          console.log(`   Block: ${log.blockNumber} | Borrower: ${borrower}`);
          console.log(`   Debt: ${debtAssets} | Seized: ${seizedAssets}`);

          // TRIGGER: The launchBot() logic already contains listeners to handle 
          // these events. This direct listener acts as your redundant "fast path" 
          // to confirm the RPC is seeing events Ponder missed.
        });
      },
      onError: (err) => {
        console.error("❌ RPC Watcher Error - Reconnecting in 5s...", err);
        unwatch(); // Clean up broken listener
        setTimeout(initWatcher, 5000); // Persistent loop restart
      }
    });
  }

  initWatcher();
}

startBot().catch((err) => {
  console.error("FATAL ERROR IN STARTUP:", err);
  process.exit(1);
});
