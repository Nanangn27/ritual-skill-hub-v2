// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

/// @title IAsyncDelivery
/// @notice Marker interface for the Ritual AsyncDelivery system contract
///         (0x5A16...39F6). Every Phase-2 callback into a user contract has
///         msg.sender == AsyncDelivery. Business contracts MUST guard their
///         callback entrypoints with this check (onlyAsyncDelivery).
/// @dev    No callable methods needed on this interface for v1. The guard
///         is a msg.sender equality check against RitualAddresses.ASYNC_DELIVERY.
interface IAsyncDelivery {
    // Intentionally empty. The contract's role is address identity, not method surface.
}
