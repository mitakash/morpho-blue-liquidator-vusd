// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19; // Changed to ^ to allow 0.8.33

/**
 * @title ManipulatableOracle
 * @notice Standard-compliant oracle for Morpho Blue markets.
 */
interface IOracle {
    /// @notice Returns the price of 1 unit of collateral in loan tokens, scaled by 1e36.
    function price() external view returns (uint256);
}

contract ManipulatableOracle is IOracle {
    address public owner;
    uint256 public currentPrice; // Must be scaled by 1e36

    event PriceUpdated(uint256 newPrice);

    constructor(uint256 _initialPrice) {
        owner = msg.sender;
        currentPrice = _initialPrice;
    }

    /**
     * @notice Returns the price expected by Morpho Blue.
     * @return The price of 1 unit of collateral in loan tokens (scaled by 1e36).
     */
    function price() external view override returns (uint256) {
        return currentPrice;
    }

    /**
     * @notice Allows owner to update price for testing/arbitrage purposes.
     * @param _newPrice The new price scaled by 1e36.
     */
    function setPrice(uint256 _newPrice) external {
        require(msg.sender == owner, "Not authorized");
        currentPrice = _newPrice;
        emit PriceUpdated(_newPrice);
    }
}
