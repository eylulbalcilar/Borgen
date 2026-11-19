// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LendingPool} from "../src/LendingPool.sol";
import {PoolFixture} from "./utils/PoolFixture.sol";

contract LendingPoolFuzzTest is PoolFixture {
    address internal lender = makeAddr("lender");
    address internal victim = makeAddr("victim");
    address internal attacker = makeAddr("attacker");
    address internal borrower = makeAddr("borrower");
    address internal keeper = makeAddr("keeper");
    address internal buyer = makeAddr("buyer");

    uint256 internal constant VALUATION = 10_000e6;
    uint256 internal constant LIQUIDITY = 20_000e6;
    uint256 internal constant MAX_LOAN = 5_000e6;
    uint256 internal constant RATE = 1_000;

    uint256 internal tokenId;

    function setUp() public {
        _deploy();
        tokenId = _mintTo(borrower, VALUATION, GENERAL);
        _verify(buyer);
    }

    function _seedLiquidity() internal {
        _fund(lender, LIQUIDITY);
        vm.prank(lender);
        pool.deposit(LIQUIDITY);
    }

    // ---------- Share accounting ----------

    // Whatever an attacker deposits first and however much they send straight
    // to the pool, the next depositor gets their money back and the attacker
    // does not come out ahead.
    function testFuzz_FirstDepositorCannotTakeFromTheNext(uint256 seed, uint256 donation, uint256 deposit) public {
        seed = bound(seed, 1, 1_000_000e6);
        donation = bound(donation, 0, 1_000_000_000e6);
        deposit = bound(deposit, 1, 1_000_000_000e6);

        _fund(attacker, seed + donation);
        _fund(victim, deposit);

        vm.startPrank(attacker);
        uint256 attackerShares = pool.deposit(seed);
        assertTrue(token.transfer(address(pool), donation));
        vm.stopPrank();

        vm.prank(victim);
        uint256 victimShares = pool.deposit(deposit);

        vm.prank(victim);
        assertEq(pool.withdraw(victimShares), deposit);

        vm.prank(attacker);
        assertLe(pool.withdraw(attackerShares), seed);
    }

    // Depositing and leaving straight away never returns more than went in.
    function testFuzz_RoundTripNeverProfits(uint256 amount, uint256 loan, uint256 elapsed) public {
        amount = bound(amount, 1, 1_000_000e6);
        loan = bound(loan, 1e6, MAX_LOAN);
        elapsed = bound(elapsed, 0, 30 days);

        _seedLiquidity();
        vm.prank(borrower);
        pool.borrow(tokenId, loan);
        vm.warp(block.timestamp + elapsed);

        _fund(victim, amount);
        vm.startPrank(victim);
        // A deposit worth less than one share is refused instead of taken.
        try pool.deposit(amount) returns (uint256 shares) {
            assertLe(pool.withdraw(shares), amount);
        } catch (bytes memory reason) {
            assertEq(reason, abi.encodeWithSelector(LendingPool.ZeroAmount.selector));
        }
        vm.stopPrank();
    }

    // ---------- Interest ----------

    function testFuzz_PoolValueTracksAccruedInterest(uint256 loan, uint256 elapsed, uint16 fee, uint16 reserve) public {
        loan = bound(loan, 1, MAX_LOAN);
        elapsed = bound(elapsed, 0, 30 days);
        fee = fee % 2_501;
        reserve = reserve % 2_501;
        pool.setInterestSplit(fee, reserve);

        _seedLiquidity();
        vm.prank(borrower);
        pool.borrow(tokenId, loan);
        vm.warp(block.timestamp + elapsed);

        uint256 interest = _interest(loan, RATE, elapsed);
        assertEq(pool.debtOf(tokenId), loan + interest);
        assertEq(pool.totalAssets(), LIQUIDITY + (interest * (10_000 - fee - reserve)) / 10_000);
    }

    // Any mix of partial payments ends in the same place: the loan closes
    // cleanly, every unit of interest is accounted for and nothing is left
    // behind in the running sums.
    function testFuzz_PartialRepaymentsSettleExactly(uint256 loan, uint256[4] memory payments, uint256[4] memory gaps)
        public
    {
        loan = bound(loan, 1e6, MAX_LOAN);
        pool.setInterestSplit(1_000, 1_000);

        _seedLiquidity();
        vm.prank(borrower);
        pool.borrow(tokenId, loan);
        _fund(borrower, 2 * MAX_LOAN);

        uint256 paid;
        for (uint256 i = 0; i < 4; i++) {
            vm.warp(block.timestamp + bound(gaps[i], 0, 7 days));

            uint256 debt = pool.debtOf(tokenId);
            // A partial payment has to leave something owed.
            if (debt < 2) break;
            uint256 payment = bound(payments[i], 1, debt - 1);
            vm.prank(borrower);
            pool.repayPartial(tokenId, payment);

            assertEq(pool.debtOf(tokenId), debt - payment);
            paid += payment;
        }

        uint256 rest = pool.debtOf(tokenId);
        vm.prank(borrower);
        pool.repay(tokenId);
        paid += rest;

        uint256 interest = paid - loan;
        assertEq(pool.totalBorrowed(), 0);
        assertEq(pool.totalAssets(), pool.cash());
        assertEq(pool.cash() + pool.protocolFees() + pool.reserveFund(), LIQUIDITY + interest);
        assertLe(pool.protocolFees(), interest / 10);
        assertLe(pool.reserveFund(), interest / 10);
        _assertBooksMatchBalance();
    }

    // ---------- Auction ----------

    function testFuzz_AuctionPriceOnlyFalls(uint256 earlier, uint256 later) public {
        earlier = bound(earlier, 0, 30 days);
        later = bound(later, earlier, 30 days);

        _seedLiquidity();
        vm.prank(borrower);
        pool.borrow(tokenId, MAX_LOAN);
        vm.warp(block.timestamp + 30 days + 1);
        pool.startAuction(tokenId);
        uint256 start = block.timestamp;

        vm.warp(start + earlier);
        uint256 first = pool.auctionPrice(tokenId);
        vm.warp(start + later);
        uint256 second = pool.auctionPrice(tokenId);

        assertLe(second, first);
        assertLe(first, VALUATION);
        assertGe(second, VALUATION / 2);
    }

    // Wherever the price lands and whatever the asset is now worth, the sale
    // is split without creating or losing a single unit.
    function testFuzz_AuctionSettlementConservesValue(
        uint256 loan,
        uint256 newValuation,
        uint256 wait,
        uint256 reserve,
        uint16 keeperFee
    ) public {
        loan = bound(loan, 1e6, MAX_LOAN);
        newValuation = bound(newValuation, 1e6, 3 * VALUATION);
        wait = bound(wait, 0, 10 days);
        reserve = bound(reserve, 0, MAX_LOAN);
        keeperFee = keeperFee % 501;

        pool.setKeeperFeeBps(keeperFee);
        pool.setInterestSplit(1_000, 1_000);
        _seedLiquidity();
        if (reserve > 0) {
            _fund(lender, reserve);
            vm.prank(lender);
            pool.fundReserve(reserve);
        }

        vm.prank(borrower);
        pool.borrow(tokenId, loan);
        vm.warp(block.timestamp + 30 days + 1);
        _revalue(tokenId, newValuation);

        uint256 debt = pool.debtOf(tokenId);
        uint256 assetsBefore = pool.totalAssets();
        vm.prank(keeper);
        pool.startAuction(tokenId);
        vm.warp(block.timestamp + wait);

        uint256 price = pool.auctionPrice(tokenId);
        _fund(buyer, price);
        vm.prank(buyer);
        pool.buy(tokenId, price);

        uint256 keeperCut = pool.claimable(keeper);
        uint256 surplus = pool.claimable(borrower);
        uint256 proceeds = price - keeperCut;

        assertEq(keeperCut, (price * keeperFee) / 10_000);
        assertEq(nft.ownerOf(tokenId), buyer);
        assertEq(pool.totalBorrowed(), 0);
        _assertBooksMatchBalance();

        if (proceeds >= debt) {
            // Fully covered: the owner gets the rest and lenders lose nothing.
            assertEq(surplus, proceeds - debt);
            assertEq(pool.reserveFund(), reserve + ((debt - loan) * 1_000) / 10_000);
            assertGe(pool.totalAssets() + 1, assetsBefore);
        } else {
            assertEq(surplus, 0);
            if (proceeds < loan) {
                uint256 shortfall = loan - proceeds;
                uint256 fromReserve = shortfall < reserve ? shortfall : reserve;
                assertEq(pool.reserveFund(), reserve - fromReserve);
                assertEq(pool.cash(), LIQUIDITY - (shortfall - fromReserve));
            }
        }
    }
}
