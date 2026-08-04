// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

import {SkillRegistry} from "./SkillRegistry.sol";
import {RitualAddresses} from "./libraries/RitualAddresses.sol";
import {ILLMPrecompile} from "./interfaces/ILLMPrecompile.sol";
import {IAsyncDelivery} from "./interfaces/IAsyncDelivery.sol";

/// @title SkillExecution
/// @notice Payments + async LLM (0x0802) runs for registered skills.
/// @dev v1: no fee split, output emitted via event only, single default model.
contract SkillExecution is IAsyncDelivery {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct ExecutionRecord {
        bytes32 jobId;
        address user;
        uint256 skillId;
        uint256 pricePaid;
        uint64 requestedAt;
        bool delivered;
    }

    // ---------------------------------------------------------------------
    // Constants (v1 defaults)
    // ---------------------------------------------------------------------

    string internal constant DEFAULT_MODEL = "zai-org/GLM-4.7-FP8";
    uint32 internal constant DEFAULT_MAX_TOKENS = 512;
    uint16 internal constant DEFAULT_TEMPERATURE_BPS = 2000;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public owner;
    SkillRegistry public immutable registry;
    mapping(bytes32 => ExecutionRecord) private _records;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event SkillRunRequested(
        bytes32 indexed jobId,
        address indexed user,
        uint256 indexed skillId,
        uint256 pricePaid
    );
    event SkillRunCompleted(
        bytes32 indexed jobId,
        address indexed user,
        uint256 indexed skillId,
        bytes result
    );
    event Withdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error ZeroAddress();
    error SkillInactive(uint256 skillId);
    error InsufficientPayment(uint256 required, uint256 provided);
    error UnknownJob(bytes32 jobId);
    error AlreadyDelivered(bytes32 jobId);
    error Unauthorized();
    error EmptyString();
    error WithdrawFailed();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(address initialOwner, SkillRegistry registry_) {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (address(registry_) == address(0)) revert ZeroAddress();
        owner = initialOwner;
        registry = registry_;
        emit OwnerTransferred(address(0), initialOwner);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Withdraw accumulated native balance to `to`.
    function withdraw(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(to, amount);
    }

    // ---------------------------------------------------------------------
    // Run flow
    // ---------------------------------------------------------------------

    /// @notice Pay for and enqueue an async LLM run of `skillId` with `prompt`.
    /// @dev Reverts if skill inactive or payment below pricePerRun.
    function runSkill(uint256 skillId, string calldata prompt)
        external
        payable
        returns (bytes32 jobId)
    {
        if (bytes(prompt).length == 0) revert EmptyString();

        SkillRegistry.Skill memory s = registry.getSkill(skillId);
        if (!s.active) revert SkillInactive(skillId);
        if (msg.value < s.pricePerRun) revert InsufficientPayment(s.pricePerRun, msg.value);

        ILLMPrecompile.LLMRequest memory req = ILLMPrecompile.LLMRequest({
            model: DEFAULT_MODEL,
            prompt: prompt,
            maxTokens: DEFAULT_MAX_TOKENS,
            temperatureBps: DEFAULT_TEMPERATURE_BPS
        });
        jobId = ILLMPrecompile(RitualAddresses.LLM_INFERENCE).requestInference(req);

        _records[jobId] = ExecutionRecord({
            jobId: jobId,
            user: msg.sender,
            skillId: skillId,
            pricePaid: msg.value,
            requestedAt: uint64(block.timestamp),
            delivered: false
        });
        emit SkillRunRequested(jobId, msg.sender, skillId, msg.value);
    }

    /// @notice AsyncDelivery callback with the LLM result for `jobId`.
    /// @dev Only callable by the AsyncDelivery system contract.
    function onLLMResult(bytes32 jobId, bytes calldata result) external {
        if (msg.sender != RitualAddresses.ASYNC_DELIVERY) revert Unauthorized();
        ExecutionRecord storage r = _records[jobId];
        if (r.jobId == bytes32(0)) revert UnknownJob(jobId);
        if (r.delivered) revert AlreadyDelivered(jobId);
        r.delivered = true;
        emit SkillRunCompleted(jobId, r.user, r.skillId, result);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getRecord(bytes32 jobId) external view returns (ExecutionRecord memory) {
        ExecutionRecord storage r = _records[jobId];
        if (r.jobId == bytes32(0)) revert UnknownJob(jobId);
        return r;
    }
}
