// scripts/compile_solc.js
// Compile every .sol file under contracts/ using solc-js 0.8.26, evmVersion=cancun.
// Writes artifacts (abi + bytecode) as JSON into out/<ContractName>.json.

'use strict';

const fs = require('fs');
const path = require('path');
const solc = require('solc');

const ROOT = path.join(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const OUT_DIR = path.join(ROOT, 'out');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.sol')) acc.push(full);
  }
  return acc;
}

function toSourceKey(absPath) {
  // Use path relative to contracts/ as the source key so imports like
  // "./libraries/RitualAddresses.sol" resolve naturally.
  return path.relative(CONTRACTS_DIR, absPath).split(path.sep).join('/');
}

function buildSources() {
  const files = walk(CONTRACTS_DIR);
  const sources = {};
  for (const f of files) {
    sources[toSourceKey(f)] = { content: fs.readFileSync(f, 'utf8') };
  }
  return sources;
}

function findImport(importPath) {
  // Resolver used by solc for imports that aren't in the input map.
  // We already load every contract file into `sources`, so this is a fallback.
  const candidate = path.join(CONTRACTS_DIR, importPath);
  if (fs.existsSync(candidate)) {
    return { contents: fs.readFileSync(candidate, 'utf8') };
  }
  return { error: 'File not found: ' + importPath };
}

function main() {
  const sources = buildSources();
  const sourceKeys = Object.keys(sources);
  if (sourceKeys.length === 0) {
    console.error('No .sol files found under contracts/');
    process.exit(1);
  }

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
      },
    },
  };

  const raw = solc.compile(JSON.stringify(input), { import: findImport });
  const out = JSON.parse(raw);

  let hasError = false;
  if (out.errors) {
    for (const e of out.errors) {
      const line = e.formattedMessage || e.message;
      if (e.severity === 'error') {
        hasError = true;
        process.stderr.write('\u2718 ERROR: ' + line + '\n');
      } else {
        process.stderr.write('\u26a0 ' + e.severity + ': ' + line + '\n');
      }
    }
  }
  if (hasError) process.exit(1);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const [sourceKey, group] of Object.entries(out.contracts || {})) {
    for (const [contractName, c] of Object.entries(group)) {
      const artifact = {
        contractName,
        source: sourceKey,
        abi: c.abi,
        bytecode: '0x' + (c.evm.bytecode.object || ''),
        deployedBytecode: '0x' + (c.evm.deployedBytecode ? c.evm.deployedBytecode.object || '' : ''),
      };
      // Skip pure interfaces / libraries with no bytecode? Keep them anyway — abi is useful.
      fs.writeFileSync(
        path.join(OUT_DIR, contractName + '.json'),
        JSON.stringify(artifact, null, 2),
      );
      written++;
    }
  }

  console.log('compiled ' + sourceKeys.length + ' source file(s), wrote ' + written + ' artifact(s) to out/');
}

main();
