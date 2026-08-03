// Optional Hardhat config — primary toolchain uses solc-js + @ethereumjs/vm
// (see scripts/compile_solc.js and scripts/test_evm.js).
// This config exists so `hardhat compile` / `hardhat run` still work off-Termux.

import type { HardhatUserConfig } from 'hardhat/config';
import * as dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.RITUAL_RPC_URL || 'https://rpc.ritualfoundation.org';
const CHAIN_ID = Number(process.env.RITUAL_CHAIN_ID || 1979);
const PK = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
    },
  },
  networks: {
    ritualTestnet: {
      url: RPC_URL,
      chainId: CHAIN_ID,
      accounts: PK ? [PK] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './tests',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
