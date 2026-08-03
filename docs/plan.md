# Development Plan

7 phases, small commits, approval gate between each phase.

| # | Phase | Deliverable | Done when |
|---|-------|-------------|-----------|
| 0 | Bootstrap | Folder tree, config, RitualAddresses, interface stubs, docs skeleton | Tree matches plan, 1 commit |
| 1 | SkillRegistry | Full impl + NatSpec + events + tests | Compile plus tests green |
| 2 | SkillExecution | Full impl, guards, LLM 0x0802 encode, tests | Compile plus tests green |
| 3 | Local tooling | compile_solc.js, test_evm.js, npm test | compile and test pass |
| 4 | Deploy scripts | deploy.ts, fund_wallet.ts, seed_skills.ts, deploy-guide | Dry-run OK |
| 5 | Frontend scaffold | Next 15 + TS + Tailwind v3 + Wagmi v2/viem, layout | next dev, wallet connects to 1979 |
| 6 | Skill browse+create | /skills, /skills/[id], /create, IPFS upload | Browse, view, create tx |
| 7 | Run flow + history | RunForm, StatusPanel, AIOutput, /history, event watch | End-to-end run confirmed |

## v1 locked decisions

- No fee split (full payment to SkillExecution, owner withdraws). v2 adds split.
- No on-chain AI output. ExecutionRecord = metadata only; output via event.
- Single default model zai-org/GLM-4.7-FP8, hardcoded.
- IPFS (web3.storage) for skill metadata.
- Skill creation admin-only in v1.

## Approval gate

After each phase: commit, show diff summary, wait for approval before next.
