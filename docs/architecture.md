# Architecture

Ritual Skill Hub v2 is a two-contract marketplace on Ritual Chain (id 1979).

## Contracts

- SkillRegistry: on-chain catalog of skills (name, IPFS metadata CID,
  systemPromptHash, pricePerRun, active flag). Skill creation is admin-only
  in v1; a permissionless / whitelisted provider model is deferred to v2.
- SkillExecution: accepts 0.001 RIT per run, encodes an LLM request for the
  0x0802 precompile, records execution metadata, and handles the two-phase
  async callback from AsyncDelivery.

## v1 scope decisions

- No fee splitting. Full payment stays in SkillExecution; owner withdraws.
- No on-chain AI output. ExecutionRecord holds metadata only
  (requestId, user, skillId, status, timestamps). Output is emitted in the
  ExecutionCompleted event for the frontend to read from logs.
- Single default model (zai-org/GLM-4.7-FP8), hardcoded as a constant.
- IPFS for skill metadata (description, banner, examples, full system prompt).

## Async execution flow

1. User calls runSkill(skillId, userInput) with msg.value == pricePerRun.
2. Contract validates skill.active and payment, encodes the LLM request,
   invokes the 0x0802 precompile, stores a Pending ExecutionRecord, and
   emits ExecutionRequested.
3. TEE runs inference; AsyncDelivery calls back onAsyncResult.
4. Callback (guarded by onlyAsyncDelivery) marks Success/Failed, sets
   completedAt, and emits ExecutionCompleted or ExecutionFailed.

## Anti-pitfalls

- All 0x08xx / system addresses come from RitualAddresses library only.
- Every async callback guarded by msg.sender == ASYNC_DELIVERY.
- Solidity >=0.8.24 <0.9.0 (solc 0.8.26), evmVersion cancun.
- Precompiles mocked in local @ethereumjs/vm tests; real calls only on 1979.
- One pending job per EOA enforced; UI disables Run while a job is pending.
