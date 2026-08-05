# Deploy Guide

Steps to deploy Ritual Skill Hub v2 to Ritual Testnet (chainId 1979).

## Prerequisites

- Node 20+ (see `engines` in package.json)
- A deployer EOA funded with RITUAL on chain 1979
- `.env` populated from `.env.example`

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `RITUAL_RPC_URL` / `RITUAL_CHAIN_ID` / `RITUAL_EXPLORER_URL` — chain endpoints (defaults target Ritual Testnet 1979)
- `DEPLOYER_PRIVATE_KEY` — testnet key for the deployer/owner EOA (never a mainnet key)
- `SKILL_REGISTRY_ADDRESS` / `SKILL_EXECUTION_ADDRESS` — written automatically by `npm run deploy`
- `NEXT_PUBLIC_*` — frontend copies of the RPC/chain/explorer/address values
- `NEXT_PUBLIC_WEB3_STORAGE_TOKEN` — IPFS token for skill metadata (optional; dev fallback if blank)

## Order

1. `npm install`
2. `npm run compile` — compiles contracts via solc-js into `out/`
3. `npm test` — runs the EVM contract test suite
4. `npm run typecheck` — type-checks the TypeScript deploy scripts (`tsc --noEmit`)
5. `npm run deploy` — deploys `SkillRegistry` then `SkillExecution`, writing both server and `NEXT_PUBLIC_` addresses back to `.env`
6. `npm run fund` — tops up the `SkillExecution` contract's TEE fee balance via the Ritual system wallet (`depositFor`). Optional args: `npm run fund -- <amountEther> [payerAddress]` (default 0.1 RITUAL, payer defaults to `SKILL_EXECUTION_ADDRESS`)
7. `npm run seed` — creates the initial skill catalog via owner-only `createSkill(...)`
8. Copy `NEXT_PUBLIC_*` addresses into the frontend env

## What each script does

- `scripts/deploy.ts` — deploys `SkillRegistry(deployer)` and `SkillExecution(deployer, registry)`, asserts chain id, and upserts addresses into `.env`.
- `scripts/fund_wallet.ts` — calls `RitualWallet.depositFor(payer)` so the executing contract can pay TEE/LLM-precompile fees.
- `scripts/seed_skills.ts` — registers the initial v1 skills; requires the deployer to be the registry owner. Metadata CIDs are placeholders until IPFS pinning is wired up.

## Notes

- Skill creation is owner-only in v1; the seed script fails fast if the caller is not the registry owner.
- On-chain deploy/fund/seed steps require a live RPC and a funded deployer, so they are not covered by the automated test suite.
