# Deploy Guide (filled in Phase 4)

Steps to deploy Ritual Skill Hub v2 to Ritual Testnet (chainId 1979).

## Prerequisites

- Node 20+
- Deployer EOA funded on 1979 (see scripts/fund_wallet.ts)
- .env populated from .env.example

## Order

1. npm install
2. npm run compile
3. npm test
4. npm run deploy      (writes addresses to .env)
5. npm run seed        (creates initial skills)
6. Copy NEXT_PUBLIC_* addresses into frontend env

Details added in Phase 4.
