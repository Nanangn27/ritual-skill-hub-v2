// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

/// @title ILLMPrecompile
/// @notice Typed interface for the Ritual LLM precompile at 0x0802 (async, two-phase).
/// @dev    v1 uses a compact 4-field request. Ritual's full 30-field ABI is
///         backwards-compatible via abi.encode; extra fields default to zero.
interface ILLMPrecompile {
    struct LLMRequest {
        string  model;
        string  prompt;
        uint32  maxTokens;
        uint16  temperatureBps;
    }

    /// @notice Emitted internally by the precompile when a job is queued.
    event LLMJobSubmitted(bytes32 indexed requestId);

    /// @notice Enqueue an async inference job. Returns the jobId used by
    ///         AsyncDelivery when calling back into the requesting contract.
    function requestInference(LLMRequest calldata req) external returns (bytes32 jobId);
}
