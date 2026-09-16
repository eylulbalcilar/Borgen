// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";

contract CollateralNFTTest is Test {
    CollateralNFT internal nft;

    address internal admin = makeAddr("admin");
    address internal minter = makeAddr("minter");
    address internal owner = makeAddr("owner");
    address internal stranger = makeAddr("stranger");

    string internal constant NEURO_ID = "test-contract@legal.example";
    uint256 internal constant VALUATION = 10_000e6;

    function setUp() public {
        nft = new CollateralNFT(admin);

        bytes32 minterRole = nft.MINTER_ROLE();
        vm.prank(admin);
        nft.grantRole(minterRole, minter);
    }

    function test_MintStoresAppraisal() public {
        vm.warp(1_000);
        vm.prank(minter);
        uint256 tokenId = nft.mint(owner, NEURO_ID, VALUATION);

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), owner);

        CollateralNFT.Appraisal memory a = nft.getAppraisal(tokenId);
        assertEq(a.neuroContractId, NEURO_ID);
        assertEq(a.valuation, VALUATION);
        assertEq(a.valuedAt, 1_000);
    }

    function test_RevertWhen_CallerIsNotMinter() public {
        bytes32 minterRole = nft.MINTER_ROLE();

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, minterRole)
        );
        vm.prank(stranger);
        nft.mint(owner, NEURO_ID, VALUATION);
    }

    function test_RevertWhen_NeuroContractReused() public {
        vm.startPrank(minter);
        nft.mint(owner, NEURO_ID, VALUATION);

        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.NeuroContractAlreadyUsed.selector, NEURO_ID));
        nft.mint(owner, NEURO_ID, VALUATION);
        vm.stopPrank();
    }

    function test_RevertWhen_ValuationIsZero() public {
        vm.expectRevert(CollateralNFT.ZeroValuation.selector);
        vm.prank(minter);
        nft.mint(owner, NEURO_ID, 0);
    }

    function test_UpdateValuation() public {
        vm.startPrank(minter);
        uint256 tokenId = nft.mint(owner, NEURO_ID, VALUATION);

        vm.warp(5_000);
        nft.updateValuation(tokenId, 8_000e6);
        vm.stopPrank();

        CollateralNFT.Appraisal memory a = nft.getAppraisal(tokenId);
        assertEq(a.valuation, 8_000e6);
        assertEq(a.valuedAt, 5_000);
    }
}
