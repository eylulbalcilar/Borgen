// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract CollateralNFT is ERC721, AccessControl {
    // Three separate keys: creating collateral, repricing it, and deciding who
    // may hold it. One compromised key can no longer do all three.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VALUER_ROLE = keccak256("VALUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    struct Appraisal {
        string neuroContractId;
        uint256 valuation;
        uint64 valuedAt;
        uint16 assetClass;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => Appraisal) private _appraisals;
    mapping(bytes32 neuroContractHash => bool) private _usedNeuroContracts;
    mapping(address account => bool) private _transferAllowed;

    event AssetMinted(
        uint256 indexed tokenId, address indexed owner, string neuroContractId, uint256 valuation, uint16 assetClass
    );
    event ValuationUpdated(uint256 indexed tokenId, uint256 oldValuation, uint256 newValuation, string neuroContractId);
    event TransferAllowedSet(address indexed account, bool allowed);

    error ZeroValuation();
    error NeuroContractAlreadyUsed(string neuroContractId);
    error RecipientNotAllowed(address recipient);

    constructor(address admin) ERC721("Borgen Collateral", "BCOL") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, string calldata neuroContractId, uint256 valuation, uint16 assetClass)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (valuation == 0) revert ZeroValuation();
        _consumeNeuroContract(neuroContractId);

        tokenId = _nextTokenId++;
        _appraisals[tokenId] = Appraisal({
            neuroContractId: neuroContractId,
            valuation: valuation,
            valuedAt: uint64(block.timestamp),
            assetClass: assetClass
        });
        _mint(to, tokenId);

        emit AssetMinted(tokenId, to, neuroContractId, valuation, assetClass);
    }

    // A new value must cite a signed contract that has not been used before, so
    // every revaluation leaves the same kind of evidence as the original one.
    function updateValuation(uint256 tokenId, uint256 newValuation, string calldata neuroContractId)
        external
        onlyRole(VALUER_ROLE)
    {
        _requireOwned(tokenId);
        if (newValuation == 0) revert ZeroValuation();
        _consumeNeuroContract(neuroContractId);

        Appraisal storage appraisal = _appraisals[tokenId];
        uint256 oldValuation = appraisal.valuation;
        appraisal.valuation = newValuation;
        appraisal.valuedAt = uint64(block.timestamp);
        appraisal.neuroContractId = neuroContractId;

        emit ValuationUpdated(tokenId, oldValuation, newValuation, neuroContractId);
    }

    function setTransferAllowed(address account, bool allowed) external onlyRole(COMPLIANCE_ROLE) {
        _transferAllowed[account] = allowed;
        emit TransferAllowedSet(account, allowed);
    }

    function isTransferAllowed(address account) external view returns (bool) {
        return _transferAllowed[account];
    }

    function getAppraisal(uint256 tokenId) external view returns (Appraisal memory) {
        _requireOwned(tokenId);
        return _appraisals[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Collateral only ever lands on a verified address, whether it is minted,
    // escrowed, returned or bought in a liquidation.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (to != address(0) && !_transferAllowed[to]) revert RecipientNotAllowed(to);
        return super._update(to, tokenId, auth);
    }

    function _consumeNeuroContract(string calldata neuroContractId) private {
        bytes32 key = keccak256(bytes(neuroContractId));
        if (_usedNeuroContracts[key]) revert NeuroContractAlreadyUsed(neuroContractId);
        _usedNeuroContracts[key] = true;
    }
}
