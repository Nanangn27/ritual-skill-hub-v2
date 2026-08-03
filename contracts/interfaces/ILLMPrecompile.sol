// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

/// @title ILLMPrecompile
/// @notice Interface stub for Ritual LLM precompile at 0x0802 (async, two-phase).
///         Full 30-field ABI implemented via low-level abi.encode in Phase 2.
///         This interface exists for documentation and typing only. Actual
///         invocation happens via raw staticcall/call with encoded payload.
interface ILLMPrecompile {
    /// @notice Emitted internally by the precompile when a job is queued.
    /// @param requestId  Unique async job identifier (also stored in AsyncJobTracker).
    event LLMJobSubmitted(bytes32 indexed requestId);

    // Note: LLM precompile is invoked via raw abi.encode of 30 fields, not a
    // typed function selector. See docs/contracts.md for the field layout
    // (added in Phase 2 alongside SkillExecution implementation).
}
