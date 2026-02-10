import { type ExecutorEncoder } from "executooor-viem";
import { type Address, encodeFunctionData, getAddress, maxUint256 } from "viem";
import type { ToConvert } from "../utils/types";
import type { LiquidityVenue } from "./liquidityVenue";

// HemiBTC/WBTC Pool Constants
const HEMI_BTC = getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00");
const WBTC = getAddress("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599");
const HEMI_BTC_POOL = getAddress("0x66039342C66760874047c36943B1e2d8300363BB");

// crvUSD/VUSD Pool Constants
const CRV_USD = getAddress("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E");
const VUSD = getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619");
const VUSD_POOL = getAddress("0xb1c189dfde178fe9f90e72727837cc9289fb944f");

const curvePoolAbi = [{
  name: "exchange",
  type: "function",
  stateMutability: "payable",
  inputs: [
    { name: "i", type: "int128" },
    { name: "j", type: "int128" },
    { name: "_dx", type: "uint256" },
    { name: "_min_dy", type: "uint256" }
  ],
  outputs: [{ name: "", type: "uint256" }]
}] as const;

export class CurveVenue implements LiquidityVenue {
  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    const s = getAddress(src);
    const d = getAddress(dst);

    // Support HemiBTC -> WBTC OR crvUSD -> VUSD
    const isHemiRoute = s === HEMI_BTC && d === WBTC;
    const isVusdRoute = s === CRV_USD && d === VUSD;

    return encoder.client.chain.id === 1 && (isHemiRoute || isVusdRoute);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;
    const s = getAddress(src);

    if (s === CRV_USD) {
      // 1. Swap crvUSD (0) -> VUSD (1)
      encoder.erc20Approve(src, VUSD_POOL, maxUint256);
      encoder.pushCall(
        VUSD_POOL,
        0n,
        encodeFunctionData({
          abi: curvePoolAbi,
          functionName: "exchange",
          args: [0n, 1n, srcAmount, 0n], 
        })
      );
    } else {
      // 2. Swap HemiBTC (2) -> WBTC (0)
      encoder.erc20Approve(src, HEMI_BTC_POOL, maxUint256);
      encoder.pushCall(
        HEMI_BTC_POOL,
        0n,
        encodeFunctionData({
          abi: curvePoolAbi,
          functionName: "exchange",
          args: [2n, 0n, srcAmount, 0n], 
        })
      );
    }

    return { src: dst, dst: dst, srcAmount: 0n };
  }
}
