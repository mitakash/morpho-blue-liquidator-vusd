// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// Interface included directly to resolve "import callback" script errors
interface IStakingVault {
    function totalSupply() external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
}

/**
 * @title sVUSD Curve Oracle Adapter
 * @notice Immutable bridge for Curve StableSwap-NG to price yield-bearing sVUSD.
 * @dev This contract has no owner and is not upgradeable.
 */
contract OracleAdapter {
    IStakingVault public immutable sVUSD;
    uint256 public constant MAX_PRICE_DEVIATION = 1.05e18; // 5% Sanity Cap

    constructor(address sVUSD_) {
        require(sVUSD_ != address(0), "Zero address");
        sVUSD = IStakingVault(sVUSD_);
    }

    /**
     * @notice Returns the exchange rate of sVUSD/VUSD (18 decimals).
     * @dev Called by Curve StableSwap-NG pool.
     */
    function price() external view returns (uint256) {
        // Zero Check: Revert if no shares exist to avoid div-by-zero
        require(sVUSD.totalSupply() > 0, "No shares minted");

        // Exchange Rate: 1 share (1e18) in terms of underlying assets
        uint256 exchangeRate = sVUSD.previewRedeem(1e18);

        // Price Floor: sVUSD value should never decrease
        require(exchangeRate >= 1e18, "Price below floor");

        // Sanity Cap: Prevent manipulation from "tragic prices"
        require(exchangeRate <= MAX_PRICE_DEVIATION, "Price exceeds sanity cap");

        return exchangeRate;
    }
}
