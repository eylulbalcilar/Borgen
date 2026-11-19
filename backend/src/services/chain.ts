import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

/**
 * Blockchain access for the relayer.
 * The relayer wallet mints collateral, updates valuations and approves the
 * wallets that may hold collateral, and pays the gas for all three. On a
 * production deployment these would be three separate keys.
 */

// Only the functions, events and custom errors the backend uses.
// A minimal ABI keeps the backend independent of Foundry build output.
export const collateralNftAbi = parseAbi([
  "function mint(address to, string neuroContractId, uint256 valuation, uint16 assetClass) returns (uint256)",
  "function updateValuation(uint256 tokenId, uint256 newValuation, string neuroContractId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isTransferAllowed(address account) view returns (bool)",
  "function setTransferAllowed(address account, bool allowed)",
  "event AssetMinted(uint256 indexed tokenId, address indexed owner, string neuroContractId, uint256 valuation, uint16 assetClass)",
  "error NeuroContractAlreadyUsed(string neuroContractId)",
  "error RecipientNotAllowed(address recipient)",
  "error ZeroValuation()",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error ERC721NonexistentToken(uint256 tokenId)",
]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Clients are created lazily so that dotenv has loaded the env values first.
let clients: ReturnType<typeof createClients> | undefined;

function createClients() {
  const transport = http(requireEnv("BASE_SEPOLIA_RPC_URL"));
  const account = privateKeyToAccount(requireEnv("RELAYER_PRIVATE_KEY") as Hex);

  return {
    account,
    // Reads chain data and simulates transactions (no signature).
    publicClient: createPublicClient({ chain: baseSepolia, transport }),
    // Signs and sends transactions with the relayer key.
    walletClient: createWalletClient({ chain: baseSepolia, transport, account }),
    nftAddress: requireEnv("COLLATERAL_NFT_ADDRESS") as Address,
  };
}

function getClients() {
  clients ??= createClients();
  return clients;
}

export type MintResult = { tokenId: bigint; txHash: Hash };

// The app does not sort assets into kinds yet, so every token uses the one
// class the pool has terms for.
const GENERAL_ASSET_CLASS = 0;

// Lets a wallet hold collateral tokens. Does nothing if it already can.
export async function allowCollateralHolder(wallet: Address): Promise<void> {
  const { account, publicClient, walletClient, nftAddress } = getClients();

  const allowed = await publicClient.readContract({
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "isTransferAllowed",
    args: [wallet],
  });
  if (allowed) return;

  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "setTransferAllowed",
    args: [wallet, true],
  });
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`setTransferAllowed reverted: ${txHash}`);
  }
}

export async function mintCollateral(
  to: Address,
  neuroContractId: string,
  valuation: bigint,
): Promise<MintResult> {
  const { account, publicClient, walletClient, nftAddress } = getClients();

  // The token refuses to land on a wallet that has not been approved.
  await allowCollateralHolder(to);

  // Simulate first: if the contract would revert (missing role, reused
  // Neuro contract, zero valuation), we fail here without spending gas.
  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "mint",
    args: [to, neuroContractId, valuation, GENERAL_ASSET_CLASS],
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`Mint transaction reverted: ${txHash}`);
  }

  // The token id is read from the AssetMinted event emitted by the contract.
  const [event] = parseEventLogs({
    abi: collateralNftAbi,
    eventName: "AssetMinted",
    logs: receipt.logs,
  });
  if (!event) throw new Error(`AssetMinted event not found in ${txHash}`);

  return { tokenId: event.args.tokenId, txHash };
}

// ---------- LendingPool events ----------

export const lendingPoolEvents = parseAbi([
  "event Deposited(address indexed lender, uint256 amount, uint256 shares)",
  "event Withdrawn(address indexed lender, uint256 amount, uint256 shares)",
  "event Borrowed(uint256 indexed tokenId, address indexed borrower, uint256 amount, uint64 dueAt)",
  "event Repaid(uint256 indexed tokenId, address indexed borrower, uint256 debt)",
  "event PartiallyRepaid(uint256 indexed tokenId, address indexed borrower, uint256 amount, uint256 remainingDebt)",
  "event Renewed(uint256 indexed tokenId, address indexed borrower, uint256 interestPaid, uint64 dueAt)",
  "event AuctionStarted(uint256 indexed tokenId, address indexed keeper, uint256 startPrice, uint256 floorPrice, uint64 endsAt)",
  "event AuctionSettled(uint256 indexed tokenId, address indexed buyer, uint256 price, uint256 debtRepaid, uint256 borrowerSurplus, uint256 reserveUsed, uint256 lenderLoss)",
]);

// Current holder of a collateral token.
export async function ownerOfCollateral(tokenId: bigint): Promise<Address> {
  const { publicClient, nftAddress } = getClients();
  return publicClient.readContract({
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "ownerOf",
    args: [tokenId],
  });
}

// Wallet a token was originally minted to, read from its mint transaction.
// Needed because ownerOf reports the pool while a loan holds the token.
export async function mintRecipient(txHash: Hash): Promise<Address | undefined> {
  const { publicClient } = getClients();
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const [event] = parseEventLogs({
    abi: collateralNftAbi,
    eventName: "AssetMinted",
    logs: receipt.logs,
  });
  return event?.args.owner;
}

export async function getLatestBlock(): Promise<bigint> {
  return getClients().publicClient.getBlockNumber();
}

export async function getBlockTime(blockNumber: bigint): Promise<Date> {
  const block = await getClients().publicClient.getBlock({ blockNumber });
  return new Date(Number(block.timestamp) * 1000);
}

// Returns decoded LendingPool events in an inclusive block range.
export async function getPoolLogs(fromBlock: bigint, toBlock: bigint) {
  const { publicClient } = getClients();
  return publicClient.getLogs({
    address: requireEnv("LENDING_POOL_ADDRESS") as Address,
    events: lendingPoolEvents,
    // Drops logs that do not match the ABI, so every returned arg is defined.
    strict: true,
    fromBlock,
    toBlock,
  });
}

export type PoolLog = Awaited<ReturnType<typeof getPoolLogs>>[number];

// Updates the appraised value of an existing collateral token. The contract
// only accepts a new value together with a signed contract it has not seen.
export async function updateCollateralValuation(
  tokenId: bigint,
  valuation: bigint,
  neuroContractId: string,
): Promise<Hash> {
  const { account, publicClient, walletClient, nftAddress } = getClients();

  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "updateValuation",
    args: [tokenId, valuation, neuroContractId],
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`updateValuation reverted: ${txHash}`);
  }
  return txHash;
}
