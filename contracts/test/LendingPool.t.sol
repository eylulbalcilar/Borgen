// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";
import {LendingPool} from "../src/LendingPool.sol";

contract LendingPoolTest is Test {
    MockStablecoin internal token;
    CollateralNFT internal nft;
    LendingPool internal pool;

    address internal lender = makeAddr("lender");
    address internal borrower = makeAddr("borrower");
    address internal liquidator = makeAddr("liquidator");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant VALUATION = 10_000e6;
    uint256 internal constant LIQUIDITY = 20_000e6;
    uint256 internal constant LOAN = 5_000e6;

    uint256 internal tokenId;

    function setUp() public {
        token = new MockStablecoin();
        nft = new CollateralNFT(address(this));
        nft.grantRole(nft.MINTER_ROLE(), address(this));
        pool = new LendingPool(token, nft);

        tokenId = nft.mint(borrower, "test-contract@legal.example", VALUATION);

        _fund(lender, LIQUIDITY);
        _fund(borrower, 1_000e6);
        _fund(liquidator, LIQUIDITY);

        vm.prank(lender);
        pool.deposit(LIQUIDITY);

        vm.prank(borrower);
        nft.approve(address(pool), tokenId);
    }

    // ---------- Helpers ----------

    function _fund(address user, uint256 amount) internal {
        token.mint(user, amount);
        vm.prank(user);
        token.approve(address(pool), type(uint256).max);
    }

    function _borrow() internal {
        vm.prank(borrower);
        pool.borrow(tokenId, LOAN);
    }

    function _expectedDebt(uint256 elapsed) internal pure returns (uint256) {
        return LOAN + (LOAN * 1_000 * elapsed) / (10_000 * 365 days);
    }

    // ---------- Lender ----------

    function test_DepositAndWithdraw() public {
        assertEq(pool.sharesOf(lender), LIQUIDITY);
        assertEq(pool.totalAssets(), LIQUIDITY);

        vm.prank(lender);
        pool.withdraw(LIQUIDITY);

        assertEq(token.balanceOf(lender), LIQUIDITY);
        assertEq(pool.totalShares(), 0);
    }

    function test_LenderEarnsInterest() public {
        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 debt = pool.debtOf(tokenId);
        vm.prank(borrower);
        pool.repay(tokenId);

        vm.prank(lender);
        pool.withdraw(LIQUIDITY);

        assertEq(token.balanceOf(lender), LIQUIDITY + (debt - LOAN));
    }

    function test_RevertWhen_WithdrawExceedsLiquidity() public {
        _borrow();

        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        vm.prank(lender);
        pool.withdraw(LIQUIDITY);
    }

    // ---------- Borrower ----------

    function test_Borrow() public {
        _borrow();

        (address loanBorrower, uint256 principal,,) = pool.loans(tokenId);
        assertEq(loanBorrower, borrower);
        assertEq(principal, LOAN);
        assertEq(nft.ownerOf(tokenId), address(pool));
        assertEq(token.balanceOf(borrower), 1_000e6 + LOAN);
        assertEq(pool.totalBorrowed(), LOAN);
    }

    function test_RevertWhen_BorrowExceedsLtv() public {
        vm.expectRevert(abi.encodeWithSelector(LendingPool.ExceedsLtv.selector, LOAN));
        vm.prank(borrower);
        pool.borrow(tokenId, LOAN + 1);
    }

    function test_RepayWithInterest() public {
        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 debt = pool.debtOf(tokenId);
        assertEq(debt, _expectedDebt(30 days));

        vm.prank(borrower);
        pool.repay(tokenId);

        assertEq(nft.ownerOf(tokenId), borrower);
        assertEq(token.balanceOf(borrower), 1_000e6 + LOAN - debt);
        assertEq(pool.totalBorrowed(), 0);
    }

    function test_RevertWhen_RepayByStranger() public {
        _borrow();

        vm.expectRevert(LendingPool.NotBorrower.selector);
        vm.prank(stranger);
        pool.repay(tokenId);
    }

    // ---------- Liquidation ----------

    function test_LiquidateAfterDueDate() public {
        _borrow();
        vm.warp(block.timestamp + 30 days + 1);
        assertTrue(pool.isLiquidatable(tokenId));

        uint256 debt = pool.debtOf(tokenId);
        vm.prank(liquidator);
        pool.liquidate(tokenId);

        assertEq(nft.ownerOf(tokenId), liquidator);
        assertEq(token.balanceOf(liquidator), LIQUIDITY - debt);
        assertEq(pool.totalAssets(), LIQUIDITY + (debt - LOAN));
    }

    function test_LiquidateAfterValuationDrop() public {
        _borrow();

        nft.updateValuation(tokenId, 7_000e6);
        assertFalse(pool.isLiquidatable(tokenId));

        nft.updateValuation(tokenId, 6_000e6);
        assertTrue(pool.isLiquidatable(tokenId));

        vm.prank(liquidator);
        pool.liquidate(tokenId);
        assertEq(nft.ownerOf(tokenId), liquidator);
    }

    function test_RevertWhen_NotLiquidatable() public {
        _borrow();

        vm.expectRevert(LendingPool.NotLiquidatable.selector);
        vm.prank(liquidator);
        pool.liquidate(tokenId);
    }
}
