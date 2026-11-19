// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";

contract CollateralNFTTest is Test {
    CollateralNFT internal nft;

    address internal admin = makeAddr("admin");
    address internal minter = makeAddr("minter");
    address internal valuer = makeAddr("valuer");
    address internal compliance = makeAddr("compliance");
    address internal owner = makeAddr("owner");
    address internal other = makeAddr("other");
    address internal stranger = makeAddr("stranger");

    string internal constant NEURO_ID = "test-contract@legal.example";
    string internal constant REVALUATION_ID = "revaluation@legal.example";
    uint256 internal constant VALUATION = 10_000e6;
    uint16 internal constant ASSET_CLASS = 2;

    function setUp() public {
        nft = new CollateralNFT(admin);

        vm.startPrank(admin);
        nft.grantRole(nft.MINTER_ROLE(), minter);
        nft.grantRole(nft.VALUER_ROLE(), valuer);
        nft.grantRole(nft.COMPLIANCE_ROLE(), compliance);
        vm.stopPrank();

        vm.prank(compliance);
        nft.setTransferAllowed(owner, true);
    }

    function _mint() internal returns (uint256 tokenId) {
        vm.prank(minter);
        tokenId = nft.mint(owner, NEURO_ID, VALUATION, ASSET_CLASS);
    }

    function _expectMissingRole(address account, bytes32 role) internal {
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, account, role));
    }

    // ---------- Minting ----------

    function test_MintStoresAppraisal() public {
        vm.warp(1_000);
        uint256 tokenId = _mint();

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), owner);

        CollateralNFT.Appraisal memory a = nft.getAppraisal(tokenId);
        assertEq(a.neuroContractId, NEURO_ID);
        assertEq(a.valuation, VALUATION);
        assertEq(a.valuedAt, 1_000);
        assertEq(a.assetClass, ASSET_CLASS);
    }

    function test_RevertWhen_CallerIsNotMinter() public {
        bytes32 minterRole = nft.MINTER_ROLE();

        _expectMissingRole(stranger, minterRole);
        vm.prank(stranger);
        nft.mint(owner, NEURO_ID, VALUATION, ASSET_CLASS);
    }

    function test_RevertWhen_NeuroContractReused() public {
        _mint();

        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.NeuroContractAlreadyUsed.selector, NEURO_ID));
        vm.prank(minter);
        nft.mint(owner, NEURO_ID, VALUATION, ASSET_CLASS);
    }

    function test_RevertWhen_ValuationIsZero() public {
        vm.expectRevert(CollateralNFT.ZeroValuation.selector);
        vm.prank(minter);
        nft.mint(owner, NEURO_ID, 0, ASSET_CLASS);
    }

    // ---------- Valuation ----------

    function test_UpdateValuation() public {
        uint256 tokenId = _mint();

        vm.warp(5_000);
        vm.prank(valuer);
        nft.updateValuation(tokenId, 8_000e6, REVALUATION_ID);

        CollateralNFT.Appraisal memory a = nft.getAppraisal(tokenId);
        assertEq(a.valuation, 8_000e6);
        assertEq(a.valuedAt, 5_000);
        assertEq(a.neuroContractId, REVALUATION_ID);
        assertEq(a.assetClass, ASSET_CLASS);
    }

    // A new value has to come with its own signed contract, not the old one.
    function test_RevertWhen_RevaluationReusesNeuroContract() public {
        uint256 tokenId = _mint();

        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.NeuroContractAlreadyUsed.selector, NEURO_ID));
        vm.prank(valuer);
        nft.updateValuation(tokenId, 8_000e6, NEURO_ID);
    }

    function test_RevertWhen_RevaluationIsZero() public {
        uint256 tokenId = _mint();

        vm.expectRevert(CollateralNFT.ZeroValuation.selector);
        vm.prank(valuer);
        nft.updateValuation(tokenId, 0, REVALUATION_ID);
    }

    // ---------- Role separation ----------

    function test_RevertWhen_MinterUpdatesValuation() public {
        uint256 tokenId = _mint();
        bytes32 valuerRole = nft.VALUER_ROLE();

        _expectMissingRole(minter, valuerRole);
        vm.prank(minter);
        nft.updateValuation(tokenId, 20_000e6, REVALUATION_ID);
    }

    function test_RevertWhen_ValuerMints() public {
        bytes32 minterRole = nft.MINTER_ROLE();

        _expectMissingRole(valuer, minterRole);
        vm.prank(valuer);
        nft.mint(owner, NEURO_ID, VALUATION, ASSET_CLASS);
    }

    function test_RevertWhen_MinterVerifiesAnAddress() public {
        bytes32 complianceRole = nft.COMPLIANCE_ROLE();

        _expectMissingRole(minter, complianceRole);
        vm.prank(minter);
        nft.setTransferAllowed(stranger, true);
    }

    // ---------- Transfer restriction ----------

    function test_RevertWhen_MintToUnverifiedAddress() public {
        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.RecipientNotAllowed.selector, stranger));
        vm.prank(minter);
        nft.mint(stranger, NEURO_ID, VALUATION, ASSET_CLASS);
    }

    function test_RevertWhen_TransferToUnverifiedAddress() public {
        uint256 tokenId = _mint();

        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.RecipientNotAllowed.selector, other));
        vm.prank(owner);
        nft.transferFrom(owner, other, tokenId);
    }

    function test_TransferToVerifiedAddress() public {
        uint256 tokenId = _mint();

        vm.prank(compliance);
        nft.setTransferAllowed(other, true);

        vm.prank(owner);
        nft.transferFrom(owner, other, tokenId);
        assertEq(nft.ownerOf(tokenId), other);
    }

    function test_RevokedAddressCannotReceive() public {
        uint256 tokenId = _mint();

        vm.startPrank(compliance);
        nft.setTransferAllowed(other, true);
        nft.setTransferAllowed(other, false);
        vm.stopPrank();
        assertFalse(nft.isTransferAllowed(other));

        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.RecipientNotAllowed.selector, other));
        vm.prank(owner);
        nft.transferFrom(owner, other, tokenId);
    }
}
