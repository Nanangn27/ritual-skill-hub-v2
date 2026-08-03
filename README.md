# Ritual Skill Hub v2

AI Skill Marketplace on Ritual Testnet (chainId 1979). Users pay 0.001 RIT to run AI skills; providers register skills that execute via the native LLM precompile at 0x0802.

## Status

Phase 0 (Bootstrap) complete. See docs/plan.md for the full roadmap.

## Stack

- Solidity 0.8.26 (evmVersion cancun)
- solc-js + @ethereumjs/vm for Termux-safe compile and test
- Next.js 15 + TypeScript + Tailwind v3 + Wagmi v2 / viem
- IPFS (web3.storage) for skill metadata

## Layout

- contracts/    Solidity sources (Registry, Execution, libraries, interfaces)
- scripts/      Compile, test, deploy, seed tooling
- tests/        Contract tests (@ethereumjs/vm)
- frontend/     Next.js app
- docs/         plan.md, architecture.md, contracts.md, deploy-guide.md

## Quick start (later phases)

    npm install
    npm run compile
    npm test

## Chain

- RPC:       https://rpc.ritualfoundation.org
- Chain ID:  1979
- Explorer:  https://explorer.ritualfoundation.org
