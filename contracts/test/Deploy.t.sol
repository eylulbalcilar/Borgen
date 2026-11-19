// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {Deploy} from "../script/Deploy.s.sol";

contract DeployTest is Test {
    address internal relayer = makeAddr("relayer");
    address internal admin = makeAddr("multisig");
    address internal valuer = makeAddr("valuer");
    address internal compliance = makeAddr("compliance");
    address internal borrower = makeAddr("borrower");

    function test_DeployLeavesEachKeyWithOnlyItsOwnRole() public {
        Deploy script = new Deploy();
        address deployer = address(script);
        Deploy.Roles memory roles = Deploy.Roles({
            admin: admin,
            relayer: relayer,
            valuer: valuer,
            compliance: compliance,
            risk: admin,
            guardian: admin,
            treasury: admin
        });

        (MockStablecoin token, CollateralNFT nft, LendingPool pool) = script.deploy(roles, deployer);

        // The key that deployed keeps nothing.
        assertFalse(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), deployer));
        assertFalse(nft.hasRole(nft.COMPLIANCE_ROLE(), deployer));
        assertFalse(pool.hasRole(pool.DEFAULT_ADMIN_ROLE(), deployer));
        assertFalse(pool.hasRole(pool.RISK_ROLE(), deployer));

        assertTrue(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pool.hasRole(pool.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pool.hasRole(pool.RISK_ROLE(), admin));
        assertTrue(pool.hasRole(pool.PAUSER_ROLE(), admin));
        assertTrue(pool.hasRole(pool.TREASURY_ROLE(), admin));

        assertTrue(nft.hasRole(nft.MINTER_ROLE(), relayer));
        assertFalse(nft.hasRole(nft.VALUER_ROLE(), relayer));
        assertFalse(nft.hasRole(nft.COMPLIANCE_ROLE(), relayer));
        assertTrue(nft.hasRole(nft.VALUER_ROLE(), valuer));
        assertTrue(nft.hasRole(nft.COMPLIANCE_ROLE(), compliance));

        // The deployed set works end to end without any further setup.
        vm.prank(compliance);
        nft.setTransferAllowed(borrower, true);
        vm.prank(relayer);
        uint256 tokenId = nft.mint(borrower, "deploy-check@legal.example", 10_000e6, 0);

        token.mint(address(this), 20_000e6);
        token.approve(address(pool), 20_000e6);
        pool.deposit(20_000e6);

        vm.startPrank(borrower);
        nft.approve(address(pool), tokenId);
        pool.borrow(tokenId, 5_000e6);
        vm.stopPrank();

        assertEq(token.balanceOf(borrower), 5_000e6);
        assertEq(nft.ownerOf(tokenId), address(pool));
    }
}
