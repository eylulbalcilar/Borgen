// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {PoolFixture} from "./utils/PoolFixture.sol";

contract LendingPoolTest is PoolFixture {
    address internal lender = makeAddr("lender");
    address internal secondLender = makeAddr("secondLender");
    address internal borrower = makeAddr("borrower");
    address internal keeper = makeAddr("keeper");
    address internal buyer = makeAddr("buyer");
    address internal stranger = makeAddr("stranger");
    address internal treasury = makeAddr("treasury");

    uint256 internal constant VALUATION = 10_000e6;
    uint256 internal constant LIQUIDITY = 20_000e6;
    uint256 internal constant LOAN = 5_000e6;
    uint256 internal constant BORROWER_FUNDS = 1_000e6;
    uint256 internal constant RATE = 1_000;

    uint256 internal tokenId;

    function setUp() public {
        _deploy();

        tokenId = _mintTo(borrower, VALUATION, GENERAL);
        _verify(buyer);

        _fund(lender, LIQUIDITY);
        _fund(secondLender, LIQUIDITY);
        _fund(borrower, BORROWER_FUNDS);
        _fund(buyer, LIQUIDITY);
        _fund(stranger, LIQUIDITY);

        vm.prank(lender);
        pool.deposit(LIQUIDITY);
    }

    // ---------- Helpers ----------

    function _borrow() internal {
        vm.prank(borrower);
        pool.borrow(tokenId, LOAN);
    }

    function _borrowAndDefault() internal {
        _borrow();
        vm.warp(block.timestamp + 30 days + 1);
    }

    function _startAuction() internal {
        vm.prank(keeper);
        pool.startAuction(tokenId);
    }

    function _expectMissingRole(address account, bytes32 role) internal {
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, account, role));
    }

    // ---------- Lender ----------

    function test_DepositAndWithdraw() public {
        assertEq(pool.sharesOf(lender), LIQUIDITY);
        assertEq(pool.totalAssets(), LIQUIDITY);

        vm.prank(lender);
        pool.withdraw(LIQUIDITY);

        assertEq(token.balanceOf(lender), LIQUIDITY);
        assertEq(pool.totalShares(), 0);
        _assertBooksMatchBalance();
    }

    function test_LenderEarnsInterest() public {
        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 interest = _interest(LOAN, RATE, 30 days);
        vm.prank(borrower);
        pool.repay(tokenId);

        vm.prank(lender);
        pool.withdraw(LIQUIDITY);

        // One unit stays behind with the virtual share.
        assertApproxEqAbs(token.balanceOf(lender), LIQUIDITY + interest, 1);
    }

    function test_InterestCountsBeforeItIsPaid() public {
        _borrow();
        vm.warp(block.timestamp + 15 days);

        assertEq(pool.totalAssets(), LIQUIDITY + _interest(LOAN, RATE, 15 days));
    }

    // A lender who leaves while the loan is still running takes their part of
    // the interest earned so far instead of leaving it to whoever stays.
    function test_EarlyLeaverKeepsAccruedInterest() public {
        vm.prank(secondLender);
        pool.deposit(LIQUIDITY);

        _borrow();
        vm.warp(block.timestamp + 15 days);

        uint256 interest = _interest(LOAN, RATE, 15 days);
        vm.prank(secondLender);
        uint256 received = pool.withdraw(LIQUIDITY);

        assertApproxEqAbs(received, LIQUIDITY + interest / 2, 1);
    }

    function test_RevertWhen_WithdrawExceedsLiquidity() public {
        _borrow();

        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        vm.prank(lender);
        pool.withdraw(LIQUIDITY);
    }

    function test_RevertWhen_WithdrawMoreSharesThanOwned() public {
        vm.expectRevert(LendingPool.InsufficientShares.selector);
        vm.prank(stranger);
        pool.withdraw(1);
    }

    // The classic first-depositor attack: take one unit of shares, send a
    // large amount straight to the pool, and let the next deposit round to
    // zero shares. Direct transfers are not counted, so nothing moves.
    function test_DirectTransferDoesNotMoveSharePrice() public {
        vm.prank(lender);
        pool.withdraw(LIQUIDITY);

        vm.startPrank(stranger);
        pool.deposit(1);
        assertTrue(token.transfer(address(pool), 10_000e6));
        vm.stopPrank();

        assertEq(pool.totalAssets(), 1);

        vm.prank(lender);
        uint256 shares = pool.deposit(1_000e6);
        assertEq(shares, 1_000e6);

        vm.prank(lender);
        assertEq(pool.withdraw(shares), 1_000e6);

        vm.prank(stranger);
        assertEq(pool.withdraw(1), 1);
    }

    // ---------- Borrower ----------

    function test_Borrow() public {
        _borrow();

        (address loanBorrower, uint256 principal, uint64 startedAt, uint64 dueAt,, uint16 rateBps,,) =
            pool.loans(tokenId);
        assertEq(loanBorrower, borrower);
        assertEq(principal, LOAN);
        assertEq(dueAt, startedAt + 30 days);
        assertEq(rateBps, RATE);
        assertEq(nft.ownerOf(tokenId), address(pool));
        assertEq(token.balanceOf(borrower), BORROWER_FUNDS + LOAN);
        assertEq(pool.totalBorrowed(), LOAN);
        assertEq(pool.cash(), LIQUIDITY - LOAN);
        _assertBooksMatchBalance();
    }

    function test_RevertWhen_BorrowExceedsLtv() public {
        assertEq(pool.maxBorrow(tokenId), LOAN);

        vm.expectRevert(abi.encodeWithSelector(LendingPool.ExceedsLtv.selector, LOAN));
        vm.prank(borrower);
        pool.borrow(tokenId, LOAN + 1);
    }

    function test_RevertWhen_ValuationIsStale() public {
        uint64 valuedAt = uint64(block.timestamp);
        vm.warp(block.timestamp + 90 days + 1);

        vm.expectRevert(abi.encodeWithSelector(LendingPool.StaleValuation.selector, valuedAt, uint32(90 days)));
        vm.prank(borrower);
        pool.borrow(tokenId, LOAN);

        // A fresh appraisal makes the asset lendable again.
        _revalue(tokenId, VALUATION);
        _borrow();
        assertEq(pool.totalBorrowed(), LOAN);
    }

    function test_RevertWhen_AssetClassIsNotEnabled() public {
        uint256 other = _mintTo(borrower, VALUATION, 7);

        vm.expectRevert(abi.encodeWithSelector(LendingPool.AssetClassDisabled.selector, uint16(7)));
        vm.prank(borrower);
        pool.borrow(other, 1_000e6);
    }

    function test_AssetClassesHaveTheirOwnTerms() public {
        LendingPool.AssetClass memory art = _generalClass();
        art.ltvBps = 3_000;
        art.interestRateBps = 2_000;
        art.loanDuration = 60 days;
        pool.setAssetClass(1, art);

        uint256 painting = _mintTo(borrower, VALUATION, 1);
        assertEq(pool.maxBorrow(painting), 3_000e6);

        vm.expectRevert(abi.encodeWithSelector(LendingPool.ExceedsLtv.selector, 3_000e6));
        vm.prank(borrower);
        pool.borrow(painting, 3_000e6 + 1);

        vm.prank(borrower);
        pool.borrow(painting, 3_000e6);

        (,, uint64 startedAt, uint64 dueAt,,,,) = pool.loans(painting);
        assertEq(dueAt, startedAt + 60 days);

        vm.warp(block.timestamp + 60 days);
        assertEq(pool.debtOf(painting), 3_000e6 + _interest(3_000e6, 2_000, 60 days));
    }

    // Changing a class later does not rewrite the rate of a loan already made.
    function test_RunningLoanKeepsItsRate() public {
        _borrow();

        LendingPool.AssetClass memory changed = _generalClass();
        changed.interestRateBps = 5_000;
        pool.setAssetClass(GENERAL, changed);

        vm.warp(block.timestamp + 30 days);
        assertEq(pool.debtOf(tokenId), LOAN + _interest(LOAN, RATE, 30 days));
    }

    function test_RepayWithInterest() public {
        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 debt = pool.debtOf(tokenId);
        assertEq(debt, LOAN + _interest(LOAN, RATE, 30 days));

        vm.prank(borrower);
        pool.repay(tokenId);

        assertEq(nft.ownerOf(tokenId), borrower);
        assertEq(token.balanceOf(borrower), BORROWER_FUNDS + LOAN - debt);
        assertEq(pool.totalBorrowed(), 0);
        assertEq(pool.totalAssets(), pool.cash());
        _assertBooksMatchBalance();
    }

    function test_RevertWhen_RepayByStranger() public {
        _borrow();

        vm.expectRevert(LendingPool.NotBorrower.selector);
        vm.prank(stranger);
        pool.repay(tokenId);
    }

    function test_RepayPartial() public {
        _borrow();
        vm.warp(block.timestamp + 10 days);

        uint256 firstInterest = _interest(LOAN, RATE, 10 days);
        uint256 payment = 2_000e6;
        vm.prank(borrower);
        pool.repayPartial(tokenId, payment);

        // Interest is cleared first, the rest comes off the principal.
        uint256 remaining = LOAN - (payment - firstInterest);
        (, uint256 principal,,,,,, uint256 interest) = pool.loans(tokenId);
        assertEq(principal, remaining);
        assertEq(interest, 0);
        assertEq(pool.totalBorrowed(), remaining);
        assertEq(nft.ownerOf(tokenId), address(pool));

        // From here interest runs on the smaller principal only.
        vm.warp(block.timestamp + 10 days);
        assertEq(pool.debtOf(tokenId), remaining + _interest(remaining, RATE, 10 days));
        assertEq(pool.totalAssets(), LIQUIDITY + firstInterest + _interest(remaining, RATE, 10 days));
        _assertBooksMatchBalance();
    }

    function test_RepayPartialSmallerThanInterest() public {
        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 accrued = _interest(LOAN, RATE, 30 days);
        vm.prank(borrower);
        pool.repayPartial(tokenId, 1e6);

        (, uint256 principal,,,,,, uint256 interest) = pool.loans(tokenId);
        assertEq(principal, LOAN);
        assertEq(interest, accrued - 1e6);
        assertEq(pool.debtOf(tokenId), LOAN + accrued - 1e6);
    }

    function test_RevertWhen_RepayPartialCoversWholeDebt() public {
        _borrow();

        vm.expectRevert(abi.encodeWithSelector(LendingPool.ExceedsDebt.selector, LOAN));
        vm.prank(borrower);
        pool.repayPartial(tokenId, LOAN);
    }

    function test_Renew() public {
        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 interest = _interest(LOAN, RATE, 30 days);
        vm.prank(borrower);
        pool.renew(tokenId);

        (, uint256 principal,, uint64 dueAt,,,, uint256 owed) = pool.loans(tokenId);
        assertEq(principal, LOAN);
        assertEq(owed, 0);
        assertEq(dueAt, block.timestamp + 30 days);
        assertEq(token.balanceOf(borrower), BORROWER_FUNDS + LOAN - interest);

        // Past the original due date, and still not in default.
        vm.warp(block.timestamp + 10 days);
        assertFalse(pool.isLiquidatable(tokenId));
    }

    function test_RevertWhen_RenewAboveLtv() public {
        _borrow();
        _revalue(tokenId, 8_000e6);

        vm.expectRevert(abi.encodeWithSelector(LendingPool.ExceedsLtv.selector, 4_000e6));
        vm.prank(borrower);
        pool.renew(tokenId);
    }

    function test_RevertWhen_RenewWithStaleValuation() public {
        LendingPool.AssetClass memory class = _generalClass();
        class.maxValuationAge = 20 days;
        pool.setAssetClass(GENERAL, class);

        _borrow();
        uint64 valuedAt = uint64(block.timestamp);
        vm.warp(block.timestamp + 25 days);

        vm.expectRevert(abi.encodeWithSelector(LendingPool.StaleValuation.selector, valuedAt, uint32(20 days)));
        vm.prank(borrower);
        pool.renew(tokenId);
    }

    // ---------- Interest split ----------

    function test_InterestIsSharedWithProtocolAndReserve() public {
        pool.setInterestSplit(1_000, 1_500);

        _borrow();
        vm.warp(block.timestamp + 30 days);

        uint256 interest = _interest(LOAN, RATE, 30 days);
        uint256 fee = interest / 10;
        uint256 reserve = (interest * 1_500) / 10_000;

        // Lenders are only ever credited with their own part.
        assertEq(pool.totalAssets(), LIQUIDITY + (interest * 7_500) / 10_000);

        vm.prank(borrower);
        pool.repay(tokenId);

        assertEq(pool.protocolFees(), fee);
        assertEq(pool.reserveFund(), reserve);
        assertEq(pool.totalAssets(), LIQUIDITY + interest - fee - reserve);
        _assertBooksMatchBalance();
    }

    function test_CollectProtocolFees() public {
        pool.setInterestSplit(1_000, 0);
        _borrow();
        vm.warp(block.timestamp + 30 days);
        vm.prank(borrower);
        pool.repay(tokenId);

        uint256 fees = pool.protocolFees();
        pool.collectProtocolFees(treasury, fees);

        assertEq(token.balanceOf(treasury), fees);
        assertEq(pool.protocolFees(), 0);
        _assertBooksMatchBalance();
    }

    function test_RevertWhen_CollectingMoreThanFeesEarned() public {
        vm.expectRevert(LendingPool.InsufficientLiquidity.selector);
        pool.collectProtocolFees(treasury, 1);
    }

    function test_RevertWhen_StrangerCollectsFees() public {
        bytes32 treasuryRole = pool.TREASURY_ROLE();

        _expectMissingRole(stranger, treasuryRole);
        vm.prank(stranger);
        pool.collectProtocolFees(stranger, 1);
    }

    // ---------- Liquidation ----------

    function test_RevertWhen_NotLiquidatable() public {
        _borrow();

        vm.expectRevert(LendingPool.NotLiquidatable.selector);
        vm.prank(keeper);
        pool.startAuction(tokenId);
    }

    function test_AuctionPriceFallsFromValuationToFloor() public {
        _borrowAndDefault();
        _startAuction();

        assertEq(pool.auctionPrice(tokenId), 10_000e6);

        vm.warp(block.timestamp + 3.5 days);
        assertEq(pool.auctionPrice(tokenId), 7_500e6);

        vm.warp(block.timestamp + 3.5 days);
        assertEq(pool.auctionPrice(tokenId), 5_000e6);

        vm.warp(block.timestamp + 30 days);
        assertEq(pool.auctionPrice(tokenId), 5_000e6);
    }

    // An overdue loan on healthy collateral: the sale covers the debt and the
    // rest goes back to the owner, not to whoever liquidated.
    function test_AuctionReturnsSurplusToBorrower() public {
        pool.setKeeperFeeBps(50);
        _borrowAndDefault();

        uint256 debt = pool.debtOf(tokenId);
        _startAuction();
        vm.warp(block.timestamp + 3.5 days);

        vm.prank(buyer);
        pool.buy(tokenId, 7_500e6);

        uint256 keeperFee = 37_500_000;
        uint256 surplus = 7_500e6 - keeperFee - debt;

        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(token.balanceOf(buyer), LIQUIDITY - 7_500e6);
        assertEq(pool.claimable(borrower), surplus);
        assertEq(pool.claimable(keeper), keeperFee);
        assertEq(pool.totalBorrowed(), 0);
        assertEq(pool.totalAssets(), LIQUIDITY + (debt - LOAN));
        _assertBooksMatchBalance();

        vm.prank(borrower);
        assertEq(pool.claim(), surplus);
        vm.prank(keeper);
        assertEq(pool.claim(), keeperFee);

        assertEq(token.balanceOf(borrower), BORROWER_FUNDS + LOAN + surplus);
        assertEq(token.balanceOf(keeper), keeperFee);
        assertEq(pool.totalClaimable(), 0);
        _assertBooksMatchBalance();
    }

    function test_AuctionAfterValuationDrop() public {
        _borrow();

        _revalue(tokenId, 7_000e6);
        assertFalse(pool.isLiquidatable(tokenId));

        _revalue(tokenId, 6_000e6);
        assertTrue(pool.isLiquidatable(tokenId));

        _startAuction();
        assertEq(pool.auctionPrice(tokenId), 6_000e6);

        vm.prank(buyer);
        pool.buy(tokenId, 6_000e6);

        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(pool.claimable(borrower), 1_000e6);
    }

    function test_InterestStopsWhenAuctionStarts() public {
        _borrowAndDefault();
        uint256 debt = pool.debtOf(tokenId);
        _startAuction();

        vm.warp(block.timestamp + 5 days);
        assertEq(pool.debtOf(tokenId), debt);
        assertEq(pool.totalAssets(), LIQUIDITY + (debt - LOAN));
    }

    function test_BorrowerCanRepayDuringAuction() public {
        _borrowAndDefault();
        uint256 debt = pool.debtOf(tokenId);
        _startAuction();
        vm.warp(block.timestamp + 2 days);

        vm.prank(borrower);
        pool.repay(tokenId);

        assertEq(nft.ownerOf(tokenId), borrower);
        assertEq(token.balanceOf(borrower), BORROWER_FUNDS + LOAN - debt);

        // The auction is gone together with the debt.
        vm.expectRevert(LendingPool.NoAuction.selector);
        pool.auctionPrice(tokenId);
        _assertBooksMatchBalance();
    }

    function test_RevertWhen_PartialRepayOrRenewDuringAuction() public {
        _borrowAndDefault();
        _startAuction();

        vm.startPrank(borrower);
        vm.expectRevert(LendingPool.AuctionActive.selector);
        pool.repayPartial(tokenId, 1e6);

        vm.expectRevert(LendingPool.AuctionActive.selector);
        pool.renew(tokenId);
        vm.stopPrank();
    }

    // Collateral worth less than the debt still sells, because the buyer pays
    // the auction price and not the debt. The reserve fund takes the first
    // loss and lenders only carry what it cannot cover.
    function test_ShortfallHitsReserveBeforeLenders() public {
        vm.prank(stranger);
        pool.fundReserve(600e6);

        _borrow();
        _revalue(tokenId, 4_000e6);
        _startAuction();

        vm.prank(buyer);
        pool.buy(tokenId, 4_000e6);

        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(pool.reserveFund(), 0);
        assertEq(pool.claimable(borrower), 0);
        assertEq(pool.totalAssets(), LIQUIDITY - 400e6);
        _assertBooksMatchBalance();
    }

    function test_ReserveAbsorbsWholeShortfall() public {
        vm.prank(stranger);
        pool.fundReserve(2_000e6);

        _borrow();
        _revalue(tokenId, 4_000e6);
        _startAuction();

        vm.prank(buyer);
        pool.buy(tokenId, 4_000e6);

        assertEq(pool.reserveFund(), 1_000e6);
        assertEq(pool.totalAssets(), LIQUIDITY);
        _assertBooksMatchBalance();
    }

    // If the price reaches its floor unsold, the auction only reopens against
    // an appraisal made after it began. Otherwise anyone could push the price
    // back up to stall a sale.
    function test_RestartAuctionNeedsFreshAppraisal() public {
        _borrowAndDefault();
        _startAuction();

        vm.warp(block.timestamp + 3 days);
        vm.expectRevert(LendingPool.AuctionActive.selector);
        pool.startAuction(tokenId);

        vm.warp(block.timestamp + 5 days);
        vm.expectRevert(LendingPool.AuctionActive.selector);
        pool.startAuction(tokenId);

        _revalue(tokenId, 6_000e6);
        pool.startAuction(tokenId);
        assertEq(pool.auctionPrice(tokenId), 6_000e6);
    }

    function test_RevertWhen_BuyerIsNotVerified() public {
        _borrowAndDefault();
        _startAuction();

        vm.expectRevert(abi.encodeWithSelector(CollateralNFT.RecipientNotAllowed.selector, stranger));
        vm.prank(stranger);
        pool.buy(tokenId, type(uint256).max);
    }

    function test_RevertWhen_PriceAboveMax() public {
        _borrowAndDefault();
        _startAuction();

        vm.expectRevert(abi.encodeWithSelector(LendingPool.PriceAboveMax.selector, 10_000e6));
        vm.prank(buyer);
        pool.buy(tokenId, 9_999e6);
    }

    function test_RevertWhen_BuyWithoutAuction() public {
        _borrowAndDefault();

        vm.expectRevert(LendingPool.NoAuction.selector);
        vm.prank(buyer);
        pool.buy(tokenId, type(uint256).max);
    }

    function test_RevertWhen_NothingToClaim() public {
        vm.expectRevert(LendingPool.NothingToClaim.selector);
        vm.prank(stranger);
        pool.claim();
    }

    // ---------- Pause ----------

    function test_PauseStopsNewExposure() public {
        _borrowAndDefault();
        pool.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(secondLender);
        pool.deposit(1e6);

        uint256 other = _mintTo(borrower, VALUATION, GENERAL);
        vm.startPrank(borrower);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        pool.borrow(other, 1e6);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        pool.renew(tokenId);
        vm.stopPrank();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(keeper);
        pool.startAuction(tokenId);
    }

    function test_PauseLeavesExitsOpen() public {
        _borrow();
        vm.warp(block.timestamp + 10 days);
        pool.pause();

        vm.prank(borrower);
        pool.repay(tokenId);
        assertEq(nft.ownerOf(tokenId), borrower);

        vm.prank(lender);
        pool.withdraw(LIQUIDITY);
        assertGt(token.balanceOf(lender), LIQUIDITY);
    }

    function test_RunningAuctionSettlesWhilePaused() public {
        _borrowAndDefault();
        _startAuction();
        pool.pause();

        vm.prank(buyer);
        pool.buy(tokenId, 10_000e6);
        assertEq(nft.ownerOf(tokenId), buyer);
    }

    function test_OnlyGuardianPausesAndOnlyAdminResumes() public {
        address guardian = makeAddr("guardian");
        bytes32 pauserRole = pool.PAUSER_ROLE();
        bytes32 adminRole = pool.DEFAULT_ADMIN_ROLE();
        pool.grantRole(pauserRole, guardian);

        _expectMissingRole(stranger, pauserRole);
        vm.prank(stranger);
        pool.pause();

        vm.prank(guardian);
        pool.pause();

        // The guardian key can stop the pool but cannot switch it back on.
        _expectMissingRole(guardian, adminRole);
        vm.prank(guardian);
        pool.unpause();

        pool.unpause();
        assertFalse(pool.paused());
    }

    // ---------- Configuration ----------

    function test_RevertWhen_StrangerSetsRiskParameters() public {
        bytes32 riskRole = pool.RISK_ROLE();
        LendingPool.AssetClass memory class = _generalClass();

        vm.startPrank(stranger);
        _expectMissingRole(stranger, riskRole);
        pool.setAssetClass(GENERAL, class);

        _expectMissingRole(stranger, riskRole);
        pool.setInterestSplit(0, 0);

        _expectMissingRole(stranger, riskRole);
        pool.setKeeperFeeBps(0);
        vm.stopPrank();
    }

    function test_RevertWhen_AssetClassIsInconsistent() public {
        LendingPool.AssetClass memory class = _generalClass();
        class.ltvBps = 8_000;
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setAssetClass(GENERAL, class);

        class = _generalClass();
        class.liquidationThresholdBps = 10_001;
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setAssetClass(GENERAL, class);

        class = _generalClass();
        class.auctionFloorBps = 10_001;
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setAssetClass(GENERAL, class);

        class = _generalClass();
        class.auctionDuration = 0;
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setAssetClass(GENERAL, class);
    }

    function test_RevertWhen_FeesExceedTheirCaps() public {
        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setInterestSplit(3_000, 2_001);

        vm.expectRevert(LendingPool.InvalidConfig.selector);
        pool.setKeeperFeeBps(501);
    }
}
