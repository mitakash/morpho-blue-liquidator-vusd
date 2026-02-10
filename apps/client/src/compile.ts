import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct path relative to apps/client/src/
// PEDANTIC FIX: We only need to go up 3 levels from apps/client/src to reach the root.
// 1. src -> client
// 2. client -> apps
// 3. apps -> project-root
const contractPath = path.resolve(__dirname, '../../../contracts/ManipulatableOracle.sol');


if (!fs.existsSync(contractPath)) {
    console.error(`🛑 Contract not found at: ${contractPath}`);
    process.exit(1);
}

const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'ManipulatableOracle.sol': { content: source } },
  settings: {
    evmVersion: 'paris', // MANDATORY: Strips PUSH0 for Mainnet compatibility
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

console.log("🛠️ Compiling ManipulatableOracle.sol using solc...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach((err: any) => {
        if (err.severity === 'error') console.error(`❌ ${err.formattedMessage}`);
        else console.warn(`⚠️ ${err.formattedMessage}`);
    });
    if (output.errors.some((err: any) => err.severity === 'error')) process.exit(1);
}

const contract = output.contracts['ManipulatableOracle.sol']['ManipulatableOracle'];

fs.writeFileSync(path.resolve(__dirname, './oracle.json'), JSON.stringify({
  abi: contract.abi,
  bytecode: contract.evm.bytecode.object
}, null, 2));

console.log("✅ Compiled successfully! Artifact saved to apps/client/src/oracle.json");
