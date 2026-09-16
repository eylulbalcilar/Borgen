// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract CollateralNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Appraisal {
        string neuroContractId;
        uint256 valuation;
        uint64 valuedAt;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => Appraisal) private _appraisals;
    mapping(bytes32 neuroContractHash => bool) private _usedNeuroContracts;

    event AssetMinted(uint256 indexed tokenId, address indexed owner, string neuroContractId, uint256 valuation);
    event ValuationUpdated(uint256 indexed tokenId, uint256 oldValuation, uint256 newValuation);

    error ZeroValuation();
    error NeuroContractAlreadyUsed(string neuroContractId);

    constructor(address admin) ERC721("Borgen Collateral", "BCOL") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, string calldata neuroContractId, uint256 valuation)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (valuation == 0) revert ZeroValuation();

        bytes32 key = keccak256(bytes(neuroContractId));
        if (_usedNeuroContracts[key]) revert NeuroContractAlreadyUsed(neuroContractId);
        _usedNeuroContracts[key] = true;

        tokenId = _nextTokenId++;
        _appraisals[tokenId] = Appraisal({neuroContractId: neuroContractId, valuation: valuation, valuedAt: uint64(block.timestamp)});
        _mint(to, tokenId);

        emit AssetMinted(tokenId, to, neuroContractId, valuation);
    }

    function updateValuation(uint256 tokenId, uint256 newValuation) external onlyRole(MINTER_ROLE) {
        _requireOwned(tokenId);
        if (newValuation == 0) revert ZeroValuation();

        Appraisal storage appraisal = _appraisals[tokenId];
        uint256 oldValuation = appraisal.valuation;
        appraisal.valuation = newValuation;
        appraisal.valuedAt = uint64(block.timestamp);

        emit ValuationUpdated(tokenId, oldValuation, newValuation);
    }

    function getAppraisal(uint256 tokenId) external view returns (Appraisal memory) {
        _requireOwned(tokenId);
        return _appraisals[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
