import { createPublicClient, createWalletClient, http, erc20Abi, maxUint256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const MORPHO_BLUE = "0xBBBBBbbBBb9cCEd5733235281ee42EEa11981972";
const VUSD = "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3";

// Market Params from your logs
const MARKETS = [
  { 
    name: "HemiBTC/VUSD", 
    id: "0x55609be688a4d96e715bfe39969133bd4e7f83db4f77bb06216109189a11f2e5",
    collateral: "0x06ea695B91700071B161A434fED42D1DcbAD9f00",
    oracle: "0xda360F40ECe64F63B87E214297734e57Fb281e8C",
    irm: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
    lltv: 770000000000000000n
  },
  { 
    name: "WETH/VUSD", 
    id: "0x7d1306d23f9f1e419697b8275001db9ea74b3c75190a7db8f5d81fed2fb94561",
    collateral: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    oracle: "0x4F90106502F3560a8e1Cc7A6801C706fa8DABA27",
    irm: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
    lltv: 860000000000000000n
  }
];

async function seed() {
  const account = privateKeyToAccount(process.env.LIQUIDATION_PRIVATE_KEY_1 as Hex);
  const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL_1) });
  const wallet = createWalletClient({ account, chain: mainnet, transport: http(process.env.RPC_URL_1) });

  // 1. Global Approval for Morpho Blue
  const allowance = await client.readContract({
    address: VUSD, abi: erc20Abi, functionName: 'allowance', args: [account.address, MORPHO_BLUE]
  });

  if (allowance < 10n**18n) {
    console.log("🔓 Approving Morpho Blue...");
    await wallet.writeContract({ address: VUSD, abi: erc20Abi, functionName: 'approve', args: [MORPHO_BLUE, maxUint256] });
  }

  for (const m of MARKETS) {
    console.log(`\n🌱 Seeding ${m.name}...`);
    const marketParams = {
      loanToken: VUSD,
      collateralToken: m.collateral,
      oracle: m.oracle,
      irm: m.irm,
      lltv: m.lltv
    };

    // Supply $1 (assuming 18 decimals)
    const supplyTx = await wallet.writeContract({
      address: MORPHO_BLUE,
      abi: [{ name: 'supply', type: 'function', inputs: [{name:'marketParams', type:'tuple', components:[{name:'loanToken', type:'address'},{name:'collateralToken', type:'address'},{name:'oracle', type:'address'},{name:'irm', type:'address'},{name:'lltv', type:'uint256'}]},{name:'assets', type:'uint256'},{name:'shares', type:'uint256'},{name:'onBehalf', type:'address'},{name:'data', type:'bytes'}], outputs: [] }],
      functionName: 'supply',
      args: [marketParams, 10n**18n, 0n, account.address, "0x"]
    });
    console.log(`✅ Supplied $1: ${supplyTx}`);

    // Borrow $0.90 to hit 90% utilization
    const borrowTx = await wallet.writeContract({
      address: MORPHO_BLUE,
      abi: [{ name: 'borrow', type: 'function', inputs: [{name:'marketParams', type:'tuple', components:[{name:'loanToken', type:'address'},{name:'collateralToken', type:'address'},{name:'oracle', type:'address'},{name:'irm', type:'address'},{name:'lltv', type:'uint256'}]},{name:'assets', type:'uint256'},{name:'shares', type:'uint256'},{name:'onBehalf', type:'address'},{name:'receiver', type:'address'}], outputs: [] }],
      functionName: 'borrow',
      args: [marketParams, 9n * 10n**17n, 0n, account.address, account.address]
    });
    console.log(`✅ Borrowed $0.90: ${borrowTx}`);
  }
}

seed().catch(console.error);
