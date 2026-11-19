// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {CollateralNFT} from "./CollateralNFT.sol";

contract LendingPool is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // The guardian can only stop new exposure. Risk parameters and fee
    // collection sit on their own keys, and only the admin can resume.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant RISK_ROLE = keccak256("RISK_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_INTEREST_RATE_BPS = 10_000;
    uint256 public constant MAX_INTEREST_CUT_BPS = 5_000;
    uint256 public constant MAX_KEEPER_FEE_BPS = 500;
    uint256 public constant MAX_AUCTION_START_BPS = 20_000;

    IERC20 public immutable asset;
    CollateralNFT public immutable collateral;

    // Risk terms per kind of asset: a watch and a painting do not have to
    // share one loan-to-value ratio, rate or term.
    struct AssetClass {
        bool enabled;
        uint16 ltvBps;
        uint16 liquidationThresholdBps;
        uint16 interestRateBps;
        uint16 auctionStartBps;
        uint16 auctionFloorBps;
        uint32 loanDuration;
        uint32 maxValuationAge;
        uint32 auctionDuration;
    }

    struct Loan {
        address borrower;
        uint256 principal;
        uint64 startedAt;
        uint64 dueAt;
        uint64 accruedAt;
        uint16 rateBps;
        uint16 assetClass;
        // Interest accrued up to accruedAt and not yet paid.
        uint256 interest;
    }

    struct Auction {
        address keeper;
        uint64 startedAt;
        uint32 duration;
        uint256 startPrice;
        uint256 floorPrice;
    }

    mapping(uint16 classId => AssetClass) public assetClasses;
    mapping(uint256 tokenId => Loan) public loans;
    mapping(uint256 tokenId => Auction) public auctions;
    mapping(address lender => uint256) public sharesOf;
    mapping(address account => uint256) public claimable;

    uint256 public totalShares;
    uint256 public totalBorrowed;

    // Lender money that is idle in the pool. Tracked here instead of read from
    // the token balance, so tokens sent straight to the contract cannot move
    // the share price.
    uint256 public cash;
    // First-loss buffer for lenders, filled from interest.
    uint256 public reserveFund;
    uint256 public protocolFees;
    uint256 public totalClaimable;

    uint16 public protocolFeeBps;
    uint16 public reserveFactorBps;
    uint16 public keeperFeeBps;

    // Interest on running loans, kept as sums so totalAssets is O(1):
    // sum(weight * (now - accruedAt)) = now * sum(weight) - sum(weight * accruedAt),
    // where weight = principal * rate.
    uint256 private _rateWeighted;
    uint256 private _rateTimeWeighted;
    uint256 private _storedInterest;

    event Deposited(address indexed lender, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
    event Borrowed(uint256 indexed tokenId, address indexed borrower, uint256 amount, uint64 dueAt);
    event Repaid(uint256 indexed tokenId, address indexed borrower, uint256 debt);
    event PartiallyRepaid(uint256 indexed tokenId, address indexed borrower, uint256 amount, uint256 remainingDebt);
    event Renewed(uint256 indexed tokenId, address indexed borrower, uint256 interestPaid, uint64 dueAt);
    event AuctionStarted(
        uint256 indexed tokenId, address indexed keeper, uint256 startPrice, uint256 floorPrice, uint64 endsAt
    );
    event AuctionSettled(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price,
        uint256 debtRepaid,
        uint256 borrowerSurplus,
        uint256 reserveUsed,
        uint256 lenderLoss
    );
    event Claimed(address indexed account, uint256 amount);
    event AssetClassSet(uint16 indexed classId, AssetClass config);
    event InterestSplitSet(uint16 protocolFeeBps, uint16 reserveFactorBps);
    event KeeperFeeSet(uint16 keeperFeeBps);
    event ProtocolFeesCollected(address indexed to, uint256 amount);
    event ReserveFunded(address indexed from, uint256 amount);

    error ZeroAmount();
    error InsufficientShares();
    error InsufficientLiquidity();
    error ExceedsLtv(uint256 maxBorrow);
    error ExceedsDebt(uint256 debt);
    error LoanNotFound();
    error NotBorrower();
    error NotLiquidatable();
    error AssetClassDisabled(uint16 classId);
    error StaleValuation(uint64 valuedAt, uint32 maxAge);
    error AuctionActive();
    error NoAuction();
    error PriceAboveMax(uint256 price);
    error NothingToClaim();
    error InvalidConfig();

    constructor(IERC20 asset_, CollateralNFT collateral_, address admin) {
        asset = asset_;
        collateral = collateral_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------- Lender ----------

    // What lenders own: idle cash, principal out on loan, and their share of
    // interest as it accrues. Counting interest only on repayment would let a
    // lender who leaves early forfeit it to the ones who stay.
    function totalAssets() public view returns (uint256) {
        uint256 unpaid = _storedInterest + (block.timestamp * _rateWeighted - _rateTimeWeighted) / (BPS * YEAR);
        return cash + totalBorrowed + (unpaid * (BPS - protocolFeeBps - reserveFactorBps)) / BPS;
    }

    // The +1 on both sides is one virtual share. Together with internal cash
    // accounting it stops the first depositor from inflating the share price
    // and rounding later deposits down to nothing.
    function deposit(uint256 amount) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        shares = (amount * (totalShares + 1)) / (totalAssets() + 1);
        if (shares == 0) revert ZeroAmount();

        sharesOf[msg.sender] += shares;
        totalShares += shares;
        cash += amount;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, shares);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        if (sharesOf[msg.sender] < shares) revert InsufficientShares();

        amount = (shares * (totalAssets() + 1)) / (totalShares + 1);
        if (amount > cash) revert InsufficientLiquidity();

        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        cash -= amount;

        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, shares);
    }

    // ---------- Borrower ----------

    function borrow(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        CollateralNFT.Appraisal memory appraisal = collateral.getAppraisal(tokenId);
        AssetClass memory class = _lendableClass(appraisal);

        uint256 maxAmount = (appraisal.valuation * class.ltvBps) / BPS;
        if (amount > maxAmount) revert ExceedsLtv(maxAmount);
        if (amount > cash) revert InsufficientLiquidity();

        // Safe: uint64 timestamps do not overflow for billions of years.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        uint64 dueAt = nowTs + class.loanDuration;

        Loan storage loan = loans[tokenId];
        loan.borrower = msg.sender;
        loan.principal = amount;
        loan.startedAt = nowTs;
        loan.dueAt = dueAt;
        loan.accruedAt = nowTs;
        loan.rateBps = class.interestRateBps;
        loan.assetClass = appraisal.assetClass;
        _track(loan);

        totalBorrowed += amount;
        cash -= amount;

        collateral.transferFrom(msg.sender, address(this), tokenId);
        asset.safeTransfer(msg.sender, amount);

        emit Borrowed(tokenId, msg.sender, amount, dueAt);
    }

    // Pays the whole debt and returns the collateral. Still open while an
    // auction runs, so the owner can rescue the asset until someone buys it.
    function repay(uint256 tokenId) external nonReentrant {
        Loan storage loan = _getLoan(tokenId);
        if (msg.sender != loan.borrower) revert NotBorrower();

        bool inAuction = auctions[tokenId].startedAt != 0;
        if (!inAuction) _accrue(loan);

        uint256 principal = loan.principal;
        uint256 interest = loan.interest;

        totalBorrowed -= principal;
        cash += principal;
        _storedInterest -= interest;
        _splitInterest(interest);

        delete loans[tokenId];
        if (inAuction) delete auctions[tokenId];

        asset.safeTransferFrom(msg.sender, address(this), principal + interest);
        collateral.transferFrom(address(this), msg.sender, tokenId);

        emit Repaid(tokenId, msg.sender, principal + interest);
    }

    // Interest is paid off first, then principal. The due date does not move.
    function repayPartial(uint256 tokenId, uint256 amount) external nonReentrant {
        Loan storage loan = _getLoan(tokenId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (auctions[tokenId].startedAt != 0) revert AuctionActive();
        if (amount == 0) revert ZeroAmount();

        _accrue(loan);
        uint256 debt = loan.principal + loan.interest;
        if (amount >= debt) revert ExceedsDebt(debt);

        uint256 interestPaid = amount < loan.interest ? amount : loan.interest;
        uint256 principalPaid = amount - interestPaid;

        loan.interest -= interestPaid;
        loan.principal -= principalPaid;
        _storedInterest -= interestPaid;
        _splitInterest(interestPaid);
        totalBorrowed -= principalPaid;
        cash += principalPaid;
        _track(loan);

        asset.safeTransferFrom(msg.sender, address(this), amount);

        emit PartiallyRepaid(tokenId, msg.sender, amount, debt - amount);
    }

    // Rolls the loan into a new term at the current rate. The borrower settles
    // the interest so far, and the loan has to pass the same checks as a new one.
    function renew(uint256 tokenId) external nonReentrant whenNotPaused {
        Loan storage loan = _getLoan(tokenId);
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (auctions[tokenId].startedAt != 0) revert AuctionActive();

        CollateralNFT.Appraisal memory appraisal = collateral.getAppraisal(tokenId);
        AssetClass memory class = _lendableClass(appraisal);

        uint256 maxAmount = (appraisal.valuation * class.ltvBps) / BPS;
        if (loan.principal > maxAmount) revert ExceedsLtv(maxAmount);

        _accrue(loan);
        uint256 interestPaid = loan.interest;
        loan.interest = 0;
        _storedInterest -= interestPaid;
        _splitInterest(interestPaid);

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 dueAt = uint64(block.timestamp) + class.loanDuration;
        loan.dueAt = dueAt;
        loan.rateBps = class.interestRateBps;
        _track(loan);

        asset.safeTransferFrom(msg.sender, address(this), interestPaid);

        emit Renewed(tokenId, msg.sender, interestPaid, dueAt);
    }

    // ---------- Liquidation ----------

    // Opens a descending-price auction on a loan that is overdue or unhealthy.
    // Interest stops here, so the debt the sale has to cover is fixed.
    //
    // If nobody buys by the time the price reaches its floor, the auction can
    // be opened again, but only against an appraisal made after it started.
    function startAuction(uint256 tokenId) external nonReentrant whenNotPaused {
        Loan storage loan = _getLoan(tokenId);
        CollateralNFT.Appraisal memory appraisal = collateral.getAppraisal(tokenId);
        Auction memory previous = auctions[tokenId];

        if (previous.startedAt != 0) {
            bool atFloor = block.timestamp >= uint256(previous.startedAt) + previous.duration;
            if (!atFloor || appraisal.valuedAt <= previous.startedAt) revert AuctionActive();
        } else {
            if (!isLiquidatable(tokenId)) revert NotLiquidatable();
            _accrue(loan);
        }

        AssetClass memory class = assetClasses[loan.assetClass];
        uint256 startPrice = (appraisal.valuation * class.auctionStartBps) / BPS;
        uint256 floorPrice = (appraisal.valuation * class.auctionFloorBps) / BPS;

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        auctions[tokenId] = Auction({
            keeper: msg.sender,
            startedAt: nowTs,
            duration: class.auctionDuration,
            startPrice: startPrice,
            floorPrice: floorPrice
        });

        emit AuctionStarted(tokenId, msg.sender, startPrice, floorPrice, nowTs + class.auctionDuration);
    }

    // Buys the collateral at the current auction price. The sale pays the
    // keeper, then the debt, and whatever is left belongs to the borrower.
    function buy(uint256 tokenId, uint256 maxPrice) external nonReentrant {
        Loan memory loan = _getLoan(tokenId);
        Auction memory auction = auctions[tokenId];
        if (auction.startedAt == 0) revert NoAuction();

        uint256 price = _priceOf(auction);
        if (price > maxPrice) revert PriceAboveMax(price);

        uint256 keeperFee = (price * keeperFeeBps) / BPS;
        uint256 proceeds = price - keeperFee;

        delete loans[tokenId];
        delete auctions[tokenId];
        totalBorrowed -= loan.principal;
        _storedInterest -= loan.interest;

        (uint256 debtRepaid, uint256 surplus, uint256 reserveUsed, uint256 lenderLoss) =
            _applyProceeds(proceeds, loan.principal, loan.interest);

        if (surplus > 0) _credit(loan.borrower, surplus);
        if (keeperFee > 0) _credit(auction.keeper, keeperFee);

        asset.safeTransferFrom(msg.sender, address(this), price);
        collateral.transferFrom(address(this), msg.sender, tokenId);

        emit AuctionSettled(tokenId, msg.sender, price, debtRepaid, surplus, reserveUsed, lenderLoss);
    }

    // Surplus and keeper fees are held for collection instead of pushed, so a
    // recipient that cannot receive tokens cannot block a sale.
    function claim() external nonReentrant returns (uint256 amount) {
        amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        totalClaimable -= amount;

        asset.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // ---------- Administration ----------

    function setAssetClass(uint16 classId, AssetClass calldata config) external onlyRole(RISK_ROLE) {
        bool valid = config.ltvBps > 0 && config.ltvBps < config.liquidationThresholdBps
            && config.liquidationThresholdBps <= BPS && config.interestRateBps <= MAX_INTEREST_RATE_BPS
            && config.auctionFloorBps > 0 && config.auctionFloorBps <= config.auctionStartBps
            && config.auctionStartBps <= MAX_AUCTION_START_BPS && config.loanDuration > 0 && config.maxValuationAge > 0
            && config.auctionDuration > 0;
        if (!valid) revert InvalidConfig();

        assetClasses[classId] = config;
        emit AssetClassSet(classId, config);
    }

    // How each unit of paid interest is shared between the platform, the
    // reserve fund and the lenders, who keep the rest.
    function setInterestSplit(uint16 protocolFeeBps_, uint16 reserveFactorBps_) external onlyRole(RISK_ROLE) {
        if (uint256(protocolFeeBps_) + reserveFactorBps_ > MAX_INTEREST_CUT_BPS) revert InvalidConfig();

        protocolFeeBps = protocolFeeBps_;
        reserveFactorBps = reserveFactorBps_;
        emit InterestSplitSet(protocolFeeBps_, reserveFactorBps_);
    }

    function setKeeperFeeBps(uint16 keeperFeeBps_) external onlyRole(RISK_ROLE) {
        if (keeperFeeBps_ > MAX_KEEPER_FEE_BPS) revert InvalidConfig();

        keeperFeeBps = keeperFeeBps_;
        emit KeeperFeeSet(keeperFeeBps_);
    }

    function collectProtocolFees(address to, uint256 amount) external nonReentrant onlyRole(TREASURY_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (amount > protocolFees) revert InsufficientLiquidity();

        protocolFees -= amount;
        asset.safeTransfer(to, amount);
        emit ProtocolFeesCollected(to, amount);
    }

    // Anyone may add to the buffer. Nothing takes money out of it except a
    // liquidation that falls short.
    function fundReserve(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        reserveFund += amount;
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    // Stops deposits, new loans, renewals and new auctions. Repaying,
    // withdrawing, claiming and buying in a running auction stay open, so
    // nobody is locked in while the pool is paused.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---------- Views ----------

    function debtOf(uint256 tokenId) public view returns (uint256) {
        Loan storage loan = _getLoan(tokenId);
        uint256 pending = auctions[tokenId].startedAt != 0 ? 0 : _pendingInterest(loan);
        return loan.principal + loan.interest + pending;
    }

    function maxBorrow(uint256 tokenId) external view returns (uint256) {
        CollateralNFT.Appraisal memory appraisal = collateral.getAppraisal(tokenId);
        return (appraisal.valuation * assetClasses[appraisal.assetClass].ltvBps) / BPS;
    }

    function isLiquidatable(uint256 tokenId) public view returns (bool) {
        Loan storage loan = _getLoan(tokenId);
        if (block.timestamp > loan.dueAt) return true;

        uint256 valuation = collateral.getAppraisal(tokenId).valuation;
        uint256 threshold = assetClasses[loan.assetClass].liquidationThresholdBps;
        return debtOf(tokenId) * BPS > valuation * threshold;
    }

    function auctionPrice(uint256 tokenId) external view returns (uint256) {
        Auction memory auction = auctions[tokenId];
        if (auction.startedAt == 0) revert NoAuction();
        return _priceOf(auction);
    }

    // ---------- Internal ----------

    function _getLoan(uint256 tokenId) internal view returns (Loan storage loan) {
        loan = loans[tokenId];
        if (loan.borrower == address(0)) revert LoanNotFound();
    }

    // The class has to be open for lending and the appraisal recent enough.
    function _lendableClass(CollateralNFT.Appraisal memory appraisal) internal view returns (AssetClass memory class) {
        class = assetClasses[appraisal.assetClass];
        if (!class.enabled) revert AssetClassDisabled(appraisal.assetClass);
        if (block.timestamp - appraisal.valuedAt > class.maxValuationAge) {
            revert StaleValuation(appraisal.valuedAt, class.maxValuationAge);
        }
    }

    function _pendingInterest(Loan storage loan) internal view returns (uint256) {
        return (loan.principal * loan.rateBps * (block.timestamp - loan.accruedAt)) / (BPS * YEAR);
    }

    // Moves interest earned since the last checkpoint onto the loan and takes
    // the loan out of the running sums. The caller puts it back with _track
    // once principal or rate is final, or leaves it out to freeze the debt.
    function _accrue(Loan storage loan) internal {
        uint256 pending = _pendingInterest(loan);
        uint256 weight = loan.principal * loan.rateBps;

        _rateWeighted -= weight;
        _rateTimeWeighted -= weight * loan.accruedAt;
        _storedInterest += pending;

        loan.interest += pending;
        // forge-lint: disable-next-line(unsafe-typecast)
        loan.accruedAt = uint64(block.timestamp);
    }

    function _track(Loan storage loan) internal {
        uint256 weight = loan.principal * loan.rateBps;
        _rateWeighted += weight;
        _rateTimeWeighted += weight * loan.accruedAt;
    }

    function _splitInterest(uint256 interest) internal {
        uint256 fee = (interest * protocolFeeBps) / BPS;
        uint256 reserve = (interest * reserveFactorBps) / BPS;

        protocolFees += fee;
        reserveFund += reserve;
        cash += interest - fee - reserve;
    }

    // Sale proceeds repay principal before interest. A shortfall on principal
    // is taken from the reserve fund first, and only the rest falls on lenders.
    function _applyProceeds(uint256 proceeds, uint256 principal, uint256 interest)
        internal
        returns (uint256 debtRepaid, uint256 surplus, uint256 reserveUsed, uint256 lenderLoss)
    {
        uint256 debt = principal + interest;
        debtRepaid = proceeds < debt ? proceeds : debt;
        surplus = proceeds - debtRepaid;

        if (debtRepaid >= principal) {
            cash += principal;
            _splitInterest(debtRepaid - principal);
        } else {
            uint256 shortfall = principal - debtRepaid;
            reserveUsed = shortfall < reserveFund ? shortfall : reserveFund;
            lenderLoss = shortfall - reserveUsed;

            reserveFund -= reserveUsed;
            cash += debtRepaid + reserveUsed;
        }
    }

    function _credit(address account, uint256 amount) internal {
        claimable[account] += amount;
        totalClaimable += amount;
    }

    function _priceOf(Auction memory auction) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - auction.startedAt;
        if (elapsed >= auction.duration) return auction.floorPrice;
        return auction.startPrice - ((auction.startPrice - auction.floorPrice) * elapsed) / auction.duration;
    }
}
