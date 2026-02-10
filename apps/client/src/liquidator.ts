import { type Address, type Hex, encodeFunctionData, getAddress } from "viem";

/**
 * ATOMIC LIQUIDATOR LOGIC
 * -----------------------
 * Market ID: 0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca
 * * Flow:
 * 1. Flashloan crvUSD from Morpho.
 * 2. Curve Swap: crvUSD (0) -> VUSD (1) [Verified by verify-curve.ts]
 * 3. Morpho Liquidate: Pay VUSD debt, seize HemiBTC.
 * 4. 1inch Swap: HemiBTC -> crvUSD to repay flashloan.
 */

export const CRV_USD = getAddress("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E");
export const VUSD = getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619");
export const HEMI_BTC = getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00");
export const TARGET_MARKET_ID = "0xc48fbb6ac634123f64461e546a6e5bd06bbfa65adae19e9172a8bb4456b932ca";
const POOL = getAddress("0xb1c189dfde178fe9f90e72727837cc9289fb944f");

const CURVE_ABI = [{
  name: "exchange",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "i", type: "int128" },
    { name: "j", type: "int128" },
    { name: "_dx", type: "uint256" },
    { name: "_min_dy", type: "uint256" }
  ],
  outputs: [{ name: "", type: "uint256" }]
}] as const;

export class HemiLiquidator {
  /**
   * Encodes the swap using the verified indices from verify-curve.ts.
   * i=0 (crvUSD), j=1 (VUSD)
   */
  encodeCrvUsdToVusd(amount: bigint): Hex {
    return encodeFunctionData({
      abi: CURVE_ABI,
      functionName: "exchange",
      args: [0n, 1n, amount, 0n], // Explicit BigInts for int128 safety
    });
  }

  async getRepaymentSwapData(hemiAmount: bigint, executor: Address, apiKey: string) {
    const url = new URL(`https://api.1inch.dev/swap/v6.0/1/swap`);
    url.searchParams.set("src", HEMI_BTC);
    url.searchParams.set("dst", CRV_USD);
    url.searchParams.set("amount", hemiAmount.toString());
    url.searchParams.set("from", executor);
    url.searchParams.set("slippage", "1");
    url.searchParams.set("disableEstimate", "true"); // Must be true for flashloan logic

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    const json = await res.json();
    return { to: getAddress(json.tx.to), data: json.tx.data as Hex };
  }
}
