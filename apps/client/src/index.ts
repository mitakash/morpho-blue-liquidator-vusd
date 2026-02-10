import type { ChainConfig } from "@morpho-blue-liquidation-bot/config";
import { createWalletClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

// 1. Remove ALL extensions. tsx will resolve these to .ts automatically.
import { CurveVenue } from "./liquidityVenues/curve"; 
import { OneInch } from "./liquidityVenues/1inch/index"; 
import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import { Erc20Wrapper } from "./liquidityVenues/erc20Wrapper";
import { Erc4626 } from "./liquidityVenues/erc4626";
import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue";
import { UniswapV3Venue } from "./liquidityVenues/uniswapV3";
import { UniswapV4Venue } from "./liquidityVenues/uniswapV4";
import { ChainlinkPricer, DefiLlamaPricer } from "./pricers/index";
import type { Pricer } from "./pricers/pricer";

export const launchBot = (config: ChainConfig) => {
  const logTag = `[${config.chain.name} client]: `;
  console.log(`${logTag}Starting up`);


  // Use the same hardened transport logic here
  const client = createWalletClient({
    chain: config.chain,
    transport: http(config.rpcUrl, {
      timeout: 30_000,
      retryCount: 5,
      batch: false // Match the direct-listener to avoid Cloudflare 1015
    }),
    account: privateKeyToAccount(config.liquidationPrivateKey),
    pollingInterval: 6_000, // Match your 6s interval
  });

  const liquidityVenues: LiquidityVenue[] = [];
  liquidityVenues.push(new CurveVenue());
  liquidityVenues.push(new OneInch());
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());
  liquidityVenues.push(new UniswapV3Venue());
  liquidityVenues.push(new UniswapV4Venue());

  const pricers: Pricer[] = [];
  pricers.push(new DefiLlamaPricer());
  pricers.push(new ChainlinkPricer());

  let flashbotAccount = undefined;
  if (config.useFlashbots) {
    const flashbotsPrivateKey = process.env.FLASHBOTS_PRIVATE_KEY as Hex;
    if (!flashbotsPrivateKey) throw new Error(`${logTag} FLASHBOTS_PRIVATE_KEY is not set`);
    flashbotAccount = privateKeyToAccount(flashbotsPrivateKey);
  }

  const inputs: LiquidationBotInputs = {
    logTag,
    chainId: config.chainId,
    client,
    morphoAddress: config.morpho.address,
    wNative: config.wNative,
    vaultWhitelist: config.vaultWhitelist,
    additionalMarketsWhitelist: config.additionalMarketsWhitelist,
    executorAddress: config.executorAddress,
    treasuryAddress: config.treasuryAddress ?? client.account.address,
    liquidityVenues,
    pricers: config.checkProfit ? pricers : undefined,
    flashbotAccount,
  };

  const bot = new LiquidationBot(inputs);
  watchBlocks(client, { onBlock: () => void bot.run() });
};
