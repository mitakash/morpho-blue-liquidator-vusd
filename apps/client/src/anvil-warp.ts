import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

async function warpTime() {
    const rpcUrl = process.env.RPC_URL_1 || "http://127.0.0.1:8545";
    const client = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl),
    });

    console.log("⏳ Current Block Timestamp:", (await client.getBlock()).timestamp);

    // 7 Days in seconds (60s * 60m * 24h * 7d)
    const SEVEN_DAYS = 604800;

    console.log(`\n⏩ Warping time forward by 7 days (${SEVEN_DAYS} seconds)...`);
    
    // 1. Increase the clock
    await client.request({
        // @ts-ignore - anvil custom method
        method: "anvil_increaseTime",
        params: [SEVEN_DAYS],
    });

    // 2. Mine a block to solidify the new time
    await client.request({
        // @ts-ignore - anvil custom method
        method: "anvil_mine",
        params: [1],
    });

    const newBlock = await client.getBlock();
    console.log("✅ Warp Complete.");
    console.log("🆕 New Block Timestamp:", newBlock.timestamp);
    console.log("📅 Date:", new Date(Number(newBlock.timestamp) * 1000).toLocaleString());
}

warpTime().catch(console.error);
