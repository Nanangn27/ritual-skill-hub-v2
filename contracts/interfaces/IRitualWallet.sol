// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

/// @title IRitualWallet
/// @notice Minimal interface for Ritual system wallet (0x532F...3948) used to
///         fund TEE execution fees on behalf of a contract.
///         Full method set added as needed in Phase 2.
interface IRitualWallet {
    /// @notice Deposit RITUAL to fund `payer`'s TEE fee balance.
    /// @param payer  The contract (or EOA) whose balance is being topped up.
    function depositFor(address payer) external payable;

    /// @notice Query available balance for `payer`.
    function balanceOf(address payer) external view returns (uint256);
}
