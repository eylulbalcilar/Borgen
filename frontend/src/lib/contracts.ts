import { parseAbi, type Address } from "viem";

// Deployed on Base Sepolia (see contracts/deployments.json).
export const ADDRESSES = {
  stablecoin: "0xBBF64835f946A336d121b802316cc1eEB7821157",
  collateralNft: "0x5d2977Ba605dbd76398A83e24f75C249af880428",
  lendingPool: "0x939339d690ec00E94B11d96a4912879589931aA3",
} as const satisfies Record<string, Address>;

// The app does not sort assets into kinds yet, so every token uses this class.
export const GENERAL_ASSET_CLASS = 0;
export const BPS = 10_000n;

// mUSD uses 6 decimals, like USDC.
export const ASSET_DECIMALS = 6;
export const ASSET_SYMBOL = "mUSD";

export const stablecoinAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
]);

export const lendingPoolAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function totalBorrowed() view returns (uint256)",
  "function cash() view returns (uint256)",
  "function sharesOf(address lender) view returns (uint256)",
  "function claimable(address account) view returns (uint256)",
  "function assetClasses(uint16 classId) view returns (bool enabled, uint16 ltvBps, uint16 liquidationThresholdBps, uint16 interestRateBps, uint16 auctionStartBps, uint16 auctionFloorBps, uint32 loanDuration, uint32 maxValuationAge, uint32 auctionDuration)",
  "function deposit(uint256 amount) returns (uint256)",
  "function withdraw(uint256 shares) returns (uint256)",
  "function claim() returns (uint256)",
  "error ZeroAmount()",
  "error InsufficientShares()",
  "error InsufficientLiquidity()",
  "error NothingToClaim()",
  "error EnforcedPause()",
]);

// Loan side of the pool, used by the borrower panel and the liquidations page.
export const loanAbi = parseAbi([
  "function loans(uint256 tokenId) view returns (address borrower, uint256 principal, uint64 startedAt, uint64 dueAt, uint64 accruedAt, uint16 rateBps, uint16 assetClass, uint256 interest)",
  "function auctions(uint256 tokenId) view returns (address keeper, uint64 startedAt, uint32 duration, uint256 startPrice, uint256 floorPrice)",
  "function debtOf(uint256 tokenId) view returns (uint256)",
  "function maxBorrow(uint256 tokenId) view returns (uint256)",
  "function isLiquidatable(uint256 tokenId) view returns (bool)",
  "function auctionPrice(uint256 tokenId) view returns (uint256)",
  "function borrow(uint256 tokenId, uint256 amount)",
  "function repay(uint256 tokenId)",
  "function repayPartial(uint256 tokenId, uint256 amount)",
  "function renew(uint256 tokenId)",
  "function startAuction(uint256 tokenId)",
  "function buy(uint256 tokenId, uint256 maxPrice)",
  "error ZeroAmount()",
  "error NotLiquidatable()",
  "error ExceedsLtv(uint256 maxBorrow)",
  "error ExceedsDebt(uint256 debt)",
  "error InsufficientLiquidity()",
  "error LoanNotFound()",
  "error NotBorrower()",
  "error AssetClassDisabled(uint16 classId)",
  "error StaleValuation(uint64 valuedAt, uint32 maxAge)",
  "error AuctionActive()",
  "error NoAuction()",
  "error PriceAboveMax(uint256 price)",
  "error EnforcedPause()",
  // Raised by the collateral token when the receiving wallet is not approved.
  "error RecipientNotAllowed(address recipient)",
]);

export const collateralNftAbi = parseAbi([
  "function getAppraisal(uint256 tokenId) view returns ((string neuroContractId, uint256 valuation, uint64 valuedAt, uint16 assetClass))",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isTransferAllowed(address account) view returns (bool)",
  "function approve(address to, uint256 tokenId)",
]);
