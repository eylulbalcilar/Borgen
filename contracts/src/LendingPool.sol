// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CollateralNFT} from "./CollateralNFT.sol";

contract LendingPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant LTV_BPS = 5_000;
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8_000;
    uint256 public constant INTEREST_RATE_BPS = 1_000;
    uint256 public constant LOAN_DURATION = 30 days;
    uint256 public constant YEAR = 365 days;

    IERC20 public immutable asset;
    CollateralNFT public immutable collateral;

    struct Loan {
        address borrower;
        uint256 principal;
        uint64 startedAt;
        uint64 dueAt;
    }

    mapping(uint256 tokenId => Loan) public loans;
    mapping(address lender => uint256) public sharesOf;
    uint256 public totalShares;
    uint256 public totalBorrowed;

    event Deposited(address indexed lender, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
    event Borrowed(uint256 indexed tokenId, address indexed borrower, uint256 amount, uint64 dueAt);
    event Repaid(uint256 indexed tokenId, address indexed borrower, uint256 debt);
    event Liquidated(uint256 indexed tokenId, address indexed liquidator, uint256 debt);

    error ZeroAmount();
    error InsufficientShares();
    error InsufficientLiquidity();
    error ExceedsLtv(uint256 maxBorrow);
    error LoanNotFound();
    error NotBorrower();
    error NotLiquidatable();

    constructor(IERC20 asset_, CollateralNFT collateral_) {
        asset = asset_;
        collateral = collateral_;
    }

    // ---------- Lender ----------

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + totalBorrowed;
    }

    function deposit(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        shares = totalShares == 0 ? amount : (amount * totalShares) / totalAssets();
        if (shares == 0) revert ZeroAmount();

        sharesOf[msg.sender] += shares;
        totalShares += shares;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, shares);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        if (sharesOf[msg.sender] < shares) revert InsufficientShares();

        amount = (shares * totalAssets()) / totalShares;
        if (amount > asset.balanceOf(address(this))) revert InsufficientLiquidity();

        sharesOf[msg.sender] -= shares;
        totalShares -= shares;

        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, shares);
    }

    // ---------- Borrower ----------

    function borrow(uint256 tokenId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 maxBorrow = (collateral.getAppraisal(tokenId).valuation * LTV_BPS) / BPS;
        if (amount > maxBorrow) revert ExceedsLtv(maxBorrow);
        if (amount > asset.balanceOf(address(this))) revert InsufficientLiquidity();

        // Safe: uint64 timestamps do not overflow for billions of years.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 dueAt = uint64(block.timestamp + LOAN_DURATION);
        loans[tokenId] = Loan({borrower: msg.sender, principal: amount, startedAt: uint64(block.timestamp), dueAt: dueAt});
        totalBorrowed += amount;

        collateral.transferFrom(msg.sender, address(this), tokenId);
        asset.safeTransfer(msg.sender, amount);

        emit Borrowed(tokenId, msg.sender, amount, dueAt);
    }

    function repay(uint256 tokenId) external nonReentrant {
        Loan memory loan = _getLoan(tokenId);
        if (msg.sender != loan.borrower) revert NotBorrower();

        uint256 debt = debtOf(tokenId);
        _closeLoan(tokenId, loan.principal);

        asset.safeTransferFrom(msg.sender, address(this), debt);
        collateral.transferFrom(address(this), loan.borrower, tokenId);

        emit Repaid(tokenId, loan.borrower, debt);
    }

    // ---------- Liquidation ----------

    function liquidate(uint256 tokenId) external nonReentrant {
        Loan memory loan = _getLoan(tokenId);
        if (!isLiquidatable(tokenId)) revert NotLiquidatable();

        uint256 debt = debtOf(tokenId);
        _closeLoan(tokenId, loan.principal);

        asset.safeTransferFrom(msg.sender, address(this), debt);
        collateral.transferFrom(address(this), msg.sender, tokenId);

        emit Liquidated(tokenId, msg.sender, debt);
    }

    // ---------- Views ----------

    function debtOf(uint256 tokenId) public view returns (uint256) {
        Loan memory loan = _getLoan(tokenId);
        uint256 elapsed = block.timestamp - loan.startedAt;
        uint256 interest = (loan.principal * INTEREST_RATE_BPS * elapsed) / (BPS * YEAR);
        return loan.principal + interest;
    }

    function isLiquidatable(uint256 tokenId) public view returns (bool) {
        Loan memory loan = _getLoan(tokenId);
        if (block.timestamp > loan.dueAt) return true;

        uint256 valuation = collateral.getAppraisal(tokenId).valuation;
        return debtOf(tokenId) * BPS > valuation * LIQUIDATION_THRESHOLD_BPS;
    }

    // ---------- Internal ----------

    function _getLoan(uint256 tokenId) internal view returns (Loan memory loan) {
        loan = loans[tokenId];
        if (loan.borrower == address(0)) revert LoanNotFound();
    }

    function _closeLoan(uint256 tokenId, uint256 principal) internal {
        totalBorrowed -= principal;
        delete loans[tokenId];
    }
}
