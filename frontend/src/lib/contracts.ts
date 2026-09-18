import { parseAbi, type Address } from "viem";

// Deployed on Base Sepolia (see contracts/deployments.json).
export const ADDRESSES = {
  stablecoin: "0x7936Fca300Cb1Cd11260E010f484655893af38fb",
  collateralNft: "0x1723AFC405269744e750bEd61544963506A06f9C",
  lendingPool: "0x95ffF8cC64aE1411B4D29238d35a908d02A2F802",
} as const satisfies Record<string, Address>;

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
  "function sharesOf(address lender) view returns (uint256)",
  "function deposit(uint256 amount) returns (uint256)",
  "function withdraw(uint256 shares) returns (uint256)",
  "error ZeroAmount()",
  "error InsufficientShares()",
  "error InsufficientLiquidity()",
]);
