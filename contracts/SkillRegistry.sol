// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24 <0.9.0;

/// @title SkillRegistry
/// @notice On-chain catalog of AI skills for the Ritual Skill Hub marketplace.
///         Skill creation and mutation are admin-only in v1; a permissionless
///         / whitelisted provider model is deferred to v2 (see docs/architecture.md).
contract SkillRegistry {
    // ---------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------

    struct Skill {
        uint256 id;
        address provider;
        string name;
        string metadataCID;
        bytes32 systemPromptHash;
        uint256 pricePerRun;
        bool active;
        uint64 createdAt;
    }

    // ---------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------

    /// @notice Contract owner. Only address permitted to create/update/toggle skills in v1.
    address public owner;

    uint256 private _nextSkillId = 1;

    mapping(uint256 => Skill) private _skills;
    mapping(address => uint256[]) private _skillsByProvider;

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    event SkillCreated(
        uint256 indexed id,
        address indexed provider,
        string name,
        string metadataCID,
        bytes32 systemPromptHash,
        uint256 pricePerRun
    );

    event SkillUpdated(
        uint256 indexed id,
        string metadataCID,
        bytes32 systemPromptHash,
        uint256 pricePerRun
    );

    event SkillActiveToggled(uint256 indexed id, bool active);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    error NotOwner();
    error SkillNotFound(uint256 id);
    error EmptyName();
    error EmptyMetadataCID();
    error ZeroAddress();

    // ---------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier skillExists(uint256 id) {
        if (_skills[id].provider == address(0)) revert SkillNotFound(id);
        _;
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ---------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------

    /// @notice Transfer registry ownership. Owner-only.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    // ---------------------------------------------------------------
    // Skill lifecycle
    // ---------------------------------------------------------------

    /// @notice Register a new skill. Owner-only in v1.
    /// @param name Human-readable skill name.
    /// @param metadataCID IPFS CID pointing to description/banner/examples/full prompt.
    /// @param systemPromptHash keccak256 of the full system prompt (integrity check).
    /// @param pricePerRun Price in wei charged per execution by SkillExecution.
    /// @return id Newly assigned skill id (1-indexed, monotonically increasing).
    function createSkill(
        string calldata name,
        string calldata metadataCID,
        bytes32 systemPromptHash,
        uint256 pricePerRun
    ) external onlyOwner returns (uint256 id) {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(metadataCID).length == 0) revert EmptyMetadataCID();

        id = _nextSkillId++;

        _skills[id] = Skill({
            id: id,
            provider: msg.sender,
            name: name,
            metadataCID: metadataCID,
            systemPromptHash: systemPromptHash,
            pricePerRun: pricePerRun,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        _skillsByProvider[msg.sender].push(id);

        emit SkillCreated(id, msg.sender, name, metadataCID, systemPromptHash, pricePerRun);
    }

    /// @notice Update mutable metadata of an existing skill. Owner-only in v1.
    function updateSkill(
        uint256 id,
        string calldata metadataCID,
        bytes32 systemPromptHash,
        uint256 pricePerRun
    ) external onlyOwner skillExists(id) {
        if (bytes(metadataCID).length == 0) revert EmptyMetadataCID();

        Skill storage skill = _skills[id];
        skill.metadataCID = metadataCID;
        skill.systemPromptHash = systemPromptHash;
        skill.pricePerRun = pricePerRun;

        emit SkillUpdated(id, metadataCID, systemPromptHash, pricePerRun);
    }

    /// @notice Flip a skill's active flag (soft enable/disable). Owner-only in v1.
    function toggleActive(uint256 id) external onlyOwner skillExists(id) {
        Skill storage skill = _skills[id];
        skill.active = !skill.active;
        emit SkillActiveToggled(id, skill.active);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function getSkill(uint256 id) external view skillExists(id) returns (Skill memory) {
        return _skills[id];
    }

    function totalSkills() external view returns (uint256) {
        return _nextSkillId - 1;
    }

    function skillsByProvider(address provider) external view returns (uint256[] memory) {
        return _skillsByProvider[provider];
    }
}
