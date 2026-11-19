// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {MockStablecoin} from "../src/MockStablecoin.sol";
import {CollateralNFT} from "../src/CollateralNFT.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {PoolFixture} from "./utils/PoolFixture.sol";

// Drives the pool with random, valid-looking actions from a fixed cast of
// lenders, borrowers, a keeper and a buyer. Calls that the pool rejects are
// swallowed: the invariants only care about the state that results.
contract PoolHandler is Test {
    MockStablecoin internal token;
    CollateralNFT internal nft;
    LendingPool internal pool;

    address[] internal lenders;
    address[] internal borrowers;
    uint256[] public tokenIds;
    mapping(uint256 tokenId => address) internal ownerOf;

    address internal keeper = makeAddr("keeper");
    address internal buyer = makeAddr("buyer");

    // Free: no loan. Borrowed: any open loan. Running: open and not in auction.
    enum State {
        Free,
        Borrowed,
        Running,
        InAuction
    }

    // Tokens sent straight to the pool, outside its accounting.
    uint256 public donated;
    // Successful calls per action, to prove a run reached the paths it claims to.
    mapping(string action => uint256) public calls;
    uint256 private _neuroNonce = 1_000_000;

    constructor(MockStablecoin token_, CollateralNFT nft_, LendingPool pool_) {
        token = token_;
        nft = nft_;
        pool = pool_;

        for (uint256 i = 0; i < 3; i++) {
            lenders.push(makeAddr(string.concat("lender", vm.toString(i))));
            borrowers.push(makeAddr(string.concat("borrower", vm.toString(i))));
        }
    }

    // Called once by the test after the handler holds its roles.
    function mintCollateral() external {
        if (tokenIds.length != 0) return;
        nft.setTransferAllowed(buyer, true);
        for (uint256 i = 0; i < borrowers.length; i++) {
            address borrower = borrowers[i];
            nft.setTransferAllowed(borrower, true);
            vm.prank(borrower);
            nft.setApprovalForAll(address(pool), true);

            for (uint256 j = 0; j < 2; j++) {
                uint256 tokenId = nft.mint(borrower, _neuroId(), 10_000e6, 0);
                tokenIds.push(tokenId);
                ownerOf[tokenId] = borrower;
            }
        }
    }

    function tokenCount() external view returns (uint256) {
        return tokenIds.length;
    }

    function lenderShares() external view returns (uint256 total) {
        for (uint256 i = 0; i < lenders.length; i++) {
            total += pool.sharesOf(lenders[i]);
        }
    }

    // ---------- Actions ----------

    function deposit(uint256 lenderSeed, uint256 amount) external {
        address lender = lenders[lenderSeed % lenders.length];
        amount = bound(amount, 1, 50_000e6);
        _pay(lender, amount);

        vm.prank(lender);
        try pool.deposit(amount) {
            calls["deposit"]++;
        } catch {}
    }

    function withdraw(uint256 lenderSeed, uint256 shares) external {
        address lender = lenders[lenderSeed % lenders.length];
        uint256 owned = pool.sharesOf(lender);
        if (owned == 0) return;

        vm.prank(lender);
        try pool.withdraw(bound(shares, 1, owned)) {
            calls["withdraw"]++;
        } catch {}
    }

    function borrow(uint256 tokenSeed, uint256 amount) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.Free);
        if (!found) return;

        // Keep appraisals fresh so loans keep being made as time passes.
        nft.updateValuation(tokenId, nft.getAppraisal(tokenId).valuation, _neuroId());
        uint256 max = pool.maxBorrow(tokenId);

        vm.prank(ownerOf[tokenId]);
        try pool.borrow(tokenId, bound(amount, 1, max)) {
            calls["borrow"]++;
        } catch {}
    }

    function repay(uint256 tokenSeed) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.Running);
        if (found) _repay(tokenId, "repay");
    }

    // The owner pays off the debt while the asset is already up for sale.
    function cure(uint256 tokenSeed) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.InAuction);
        if (found) _repay(tokenId, "cure");
    }

    function repayPartial(uint256 tokenSeed, uint256 amount) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.Running);
        if (!found) return;

        uint256 debt = pool.debtOf(tokenId);
        if (debt < 2) return;
        amount = bound(amount, 1, debt - 1);

        address borrower = ownerOf[tokenId];
        _pay(borrower, amount);
        vm.prank(borrower);
        pool.repayPartial(tokenId, amount);
        calls["repayPartial"]++;
    }

    function renew(uint256 tokenSeed) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.Running);
        if (!found) return;

        address borrower = ownerOf[tokenId];
        _pay(borrower, pool.debtOf(tokenId));
        vm.prank(borrower);
        try pool.renew(tokenId) {
            calls["renew"]++;
        } catch {}
    }

    function revalue(uint256 tokenSeed, uint256 valuation) external {
        uint256 tokenId = tokenIds[tokenSeed % tokenIds.length];
        nft.updateValuation(tokenId, bound(valuation, 500e6, 30_000e6), _neuroId());
    }

    // Lets a loan run past its due date if it is still healthy, then puts the
    // collateral up for sale.
    function startAuction(uint256 tokenSeed) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.Running);
        if (!found) return;

        if (!pool.isLiquidatable(tokenId)) {
            (,,, uint64 dueAt,,,,) = pool.loans(tokenId);
            vm.warp(uint256(dueAt) + 1);
        }

        vm.prank(keeper);
        pool.startAuction(tokenId);
        calls["startAuction"]++;
    }

    // Reopens a sale that reached its floor, against a new appraisal.
    function restartAuction(uint256 tokenSeed, uint256 valuation) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.InAuction);
        if (!found) return;

        (, uint64 startedAt, uint32 duration,,) = pool.auctions(tokenId);
        if (block.timestamp < uint256(startedAt) + duration) vm.warp(uint256(startedAt) + duration);
        vm.warp(block.timestamp + 1);
        nft.updateValuation(tokenId, bound(valuation, 500e6, 30_000e6), _neuroId());

        vm.prank(keeper);
        pool.startAuction(tokenId);
        calls["restartAuction"]++;
    }

    function buy(uint256 tokenSeed) external {
        (bool found, uint256 tokenId) = _pick(tokenSeed, State.InAuction);
        if (!found) return;

        uint256 price = pool.auctionPrice(tokenId);
        _pay(buyer, price);
        vm.startPrank(buyer);
        pool.buy(tokenId, price);
        // Hand the asset back so the same token can be pledged again.
        nft.transferFrom(buyer, ownerOf[tokenId], tokenId);
        vm.stopPrank();
        calls["buy"]++;
    }

    function claim(uint256 seed) external {
        address account = seed % 4 == 0 ? keeper : borrowers[seed % borrowers.length];
        vm.prank(account);
        try pool.claim() {
            calls["claim"]++;
        } catch {}
    }

    function fundReserve(uint256 amount) external {
        amount = bound(amount, 1, 2_000e6);
        _pay(keeper, amount);
        vm.prank(keeper);
        pool.fundReserve(amount);
    }

    function donate(uint256 amount) external {
        amount = bound(amount, 1, 10_000e6);
        token.mint(address(pool), amount);
        donated += amount;
    }

    function warp(uint256 time) external {
        vm.warp(block.timestamp + bound(time, 1 hours, 5 days));
    }

    // ---------- Internal ----------

    // First token at or after the seed that is in the wanted state, so an
    // action is not wasted on a token it cannot apply to.
    function _pick(uint256 seed, State wanted) internal view returns (bool, uint256) {
        uint256 count = tokenIds.length;
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = tokenIds[(seed % count + i) % count];
            (address borrower,,,,,,,) = pool.loans(tokenId);
            (, uint64 auctionStartedAt,,,) = pool.auctions(tokenId);

            bool matches;
            if (wanted == State.Free) matches = borrower == address(0);
            else if (wanted == State.Borrowed) matches = borrower != address(0);
            else if (wanted == State.Running) matches = borrower != address(0) && auctionStartedAt == 0;
            else matches = auctionStartedAt != 0;

            if (matches) return (true, tokenId);
        }
        return (false, 0);
    }

    function _repay(uint256 tokenId, string memory action) internal {
        address borrower = ownerOf[tokenId];
        _pay(borrower, pool.debtOf(tokenId));
        vm.prank(borrower);
        pool.repay(tokenId);
        calls[action]++;
    }

    function _pay(address account, uint256 amount) internal {
        token.mint(account, amount);
        vm.prank(account);
        token.approve(address(pool), type(uint256).max);
    }

    function _neuroId() internal returns (string memory) {
        return string.concat("contract-", vm.toString(++_neuroNonce), "@legal.example");
    }
}

contract LendingPoolInvariantTest is PoolFixture {
    PoolHandler internal handler;

    uint256 internal constant LENDER_SHARE_BPS = 7_500;

    function setUp() public {
        _deploy();
        pool.setInterestSplit(1_000, 1_500);
        pool.setKeeperFeeBps(50);

        handler = new PoolHandler(token, nft, pool);
        nft.grantRole(nft.MINTER_ROLE(), address(handler));
        nft.grantRole(nft.VALUER_ROLE(), address(handler));
        nft.grantRole(nft.COMPLIANCE_ROLE(), address(handler));
        handler.mintCollateral();

        targetContract(address(handler));
    }

    // A run that never borrowed, defaulted or auctioned would pass the checks
    // below without testing them. Printed with -vv.
    function afterInvariant() public view {
        string[11] memory actions = [
            "deposit",
            "withdraw",
            "borrow",
            "repay",
            "repayPartial",
            "renew",
            "startAuction",
            "restartAuction",
            "cure",
            "buy",
            "claim"
        ];
        for (uint256 i = 0; i < actions.length; i++) {
            console.log(actions[i], handler.calls(actions[i]));
        }
    }

    // Every token in the pool belongs to lenders, the reserve, the protocol or
    // someone with a claim. Nothing is unaccounted for and nothing is promised
    // twice.
    function invariant_BooksMatchBalance() public view {
        assertEq(
            token.balanceOf(address(pool)),
            pool.cash() + pool.reserveFund() + pool.protocolFees() + pool.totalClaimable() + handler.donated()
        );
    }

    function invariant_SharesAddUp() public view {
        assertEq(handler.lenderShares(), pool.totalShares());
    }

    // The O(1) totals stay in step with the loans they summarise: principal
    // exactly, and interest to within one unit of rounding per open loan.
    function invariant_TotalsMatchOpenLoans() public view {
        uint256 principalSum;
        uint256 interestSum;
        uint256 count = handler.tokenCount();

        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = handler.tokenIds(i);
            (address borrower, uint256 principal,,,,,,) = pool.loans(tokenId);
            if (borrower == address(0)) continue;

            principalSum += principal;
            interestSum += pool.debtOf(tokenId) - principal;
        }

        assertEq(pool.totalBorrowed(), principalSum);

        uint256 lenderInterest = pool.totalAssets() - pool.cash() - pool.totalBorrowed();
        assertGe(lenderInterest, (interestSum * LENDER_SHARE_BPS) / 10_000);
        assertLe(lenderInterest, ((interestSum + count) * LENDER_SHARE_BPS) / 10_000 + 1);
    }

    // Collateral is in escrow exactly while a loan is open against it.
    function invariant_EscrowMatchesLoans() public view {
        uint256 count = handler.tokenCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = handler.tokenIds(i);
            (address borrower,,,,,,,) = pool.loans(tokenId);
            assertEq(nft.ownerOf(tokenId) == address(pool), borrower != address(0));
        }
    }
}
