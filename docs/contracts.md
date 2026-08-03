# Contract Reference

Detailed ABI and storage layout. Filled progressively per phase.

## SkillRegistry (Phase 1)

Struct Skill: id, provider, name, metadataCID, systemPromptHash,
pricePerRun, active, createdAt.

Functions: createSkill, updateSkill, toggleActive, getSkill, totalSkills,
skillsByProvider. Events: SkillCreated, SkillUpdated, SkillActiveToggled.
Access: createSkill is owner-only in v1.

## SkillExecution (Phase 2)

Struct ExecutionRecord (metadata only, no AI output on-chain):
requestId, user, skillId, status, submittedAt, completedAt.

Functions: runSkill (payable, msg.value == pricePerRun), onAsyncResult
(onlyAsyncDelivery), withdraw (owner), getExecution, userExecutions.
Events: ExecutionRequested, ExecutionCompleted, ExecutionFailed,
FeeWithdrawn.

## LLM precompile 0x0802 request layout (Phase 2)

30-field abi.encode payload. Full field map documented when implemented.
Model constant: zai-org/GLM-4.7-FP8.
