import { createPublicClient, http, keccak256, encodeAbiParameters, getAddress, type Hex } from "viem";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const marketParams = {
  loanToken: getAddress("0x677ddbd918637E5F2c79e164D402454dE7dA8619"),
  collateralToken: getAddress("0x06ea695B91700071B161A434fED42D1DcbAD9f00"),
  oracle: getAddress("0x9F7c53ae6eFa70251fF6F6dD5401076F33fd4543"),
  irm: getAddress("0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC"),
  lltv: 945000000000000000n,
};

// PEDANTIC FIX: Added 'tuple' keyword and explicit internal names to match Solidity's abi.encode
const marketId = keccak256(
  encodeAbiParameters(
    [{ 
      type: "tuple", 
      components: [
        { name: "loanToken", type: "address" },
        { name: "collateralToken", type: "address" },
        { name: "oracle", type: "address" },
        { name: "irm", type: "address" },
        { name: "lltv", type: "uint256" }
      ] 
    }],
    [Object.values(marketParams)]
  )
);


console.log(`\n🎯 YOUR CALCULATED MARKET ID: ${marketId}`);
