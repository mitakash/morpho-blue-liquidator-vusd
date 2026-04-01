import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractPath = path.resolve(__dirname, '../../../contracts/OracleAdapter.sol');

if (!fs.existsSync(contractPath)) {
    console.error(`🛑 Contract not found at: ${contractPath}`);
    process.exit(1);
}

const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'OracleAdapter.sol': { content: source } },
  settings: {
    evmVersion: 'paris', // Essential for Mainnet/Infura compatibility
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

console.log("🛠️ Compiling OracleAdapter.sol...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach((err: any) => {
        if (err.severity === 'error') console.error(`❌ ${err.formattedMessage}`);
    });
    if (output.errors.some((err: any) => err.severity === 'error')) process.exit(1);
}

const contract = output.contracts['OracleAdapter.sol']['OracleAdapter'];

fs.writeFileSync(path.resolve(__dirname, './adapter-artifacts.json'), JSON.stringify({
  abi: contract.abi,
  bytecode: contract.evm.bytecode.object
}, null, 2));

console.log("✅ Compiled successfully! Artifact saved to adapter-artifacts.json");
