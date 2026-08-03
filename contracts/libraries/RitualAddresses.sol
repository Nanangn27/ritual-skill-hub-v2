// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

/// @title RitualAddresses
/// @notice Single source of truth for Ritual Chain (id 1979) precompile and
///         system contract addresses. Never hardcode 0x08xx addresses in
///         business contracts — always route through this library.
/// @dev    Verified against Ritual testnet at time of writing. If Ritual
///         publishes address changes, update ONLY this file.
library RitualAddresses {
    // ---------------------------------------------------------------
    // Precompiles (0x08xx range)
    // ---------------------------------------------------------------

    /// @notice ONNX inference precompile (synchronous).
    address internal constant ONNX = 0x0000000000000000000000000000000000000800;

    /// @notice HTTP fetch precompile (async, two-phase).
    address internal constant HTTP = 0x0000000000000000000000000000000000000801;

    /// @notice LLM inference precompile — TEE-backed (async, two-phase).
    ///         Used by SkillExecution to run AI skills.
    address internal constant LLM = 0x0000000000000000000000000000000000000802;

    /// @notice JQ JSON transform precompile (synchronous).
    address internal constant JQ = 0x0000000000000000000000000000000000000803;

    /// @notice Sovereign agent precompile (async).
    address internal constant SOVEREIGN_AGENT = 0x000000000000000000000000000000000000080C;

    /// @notice Persistent agent precompile (async).
    address internal constant PERSISTENT_AGENT = 0x0000000000000000000000000000000000000820;

    // ---------------------------------------------------------------
    // System contracts
    // ---------------------------------------------------------------

    /// @notice AsyncDelivery — sender of every Phase-2 callback.
    ///         Guard all async result callbacks with `msg.sender == ASYNC_DELIVERY`.
    address internal constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;

    /// @notice AsyncJobTracker — records job lifecycle (Submitted -> Ready/Failed).
    address internal constant ASYNC_JOB_TRACKER = 0x9F84e5C207c22C5748dEba24B215C8Fc65B99CDe;

    /// @notice RitualWallet — funds TEE execution fees on behalf of a contract.
    address internal constant RITUAL_WALLET = 0x532F5C3d15c94Ca5aBf83fEbaB0C4d9BCa243948;

    /// @notice Scheduler — deferred / periodic contract wake-ups.
    address internal constant SCHEDULER = 0x56e79e3f0B4c9BFf7bB4f823EFB77e60fbc7e58B;
}
