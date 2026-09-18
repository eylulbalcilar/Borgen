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
 * The relayer wallet holds MINTER_ROLE on CollateralNFT and pays gas for mints.
 */

// Only the functions, events and custom errors the backend uses.
// A minimal ABI keeps the backend independent of Foundry build output.
export const collateralNftAbi = parseAbi([
  "function mint(address to, string neuroContractId, uint256 valuation) returns (uint256)",
  "function updateValuation(uint256 tokenId, uint256 newValuation)",
  "event AssetMinted(uint256 indexed tokenId, address indexed owner, string neuroContractId, uint256 valuation)",
  "error NeuroContractAlreadyUsed(string neuroContractId)",
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

export async function mintCollateral(
  to: Address,
  neuroContractId: string,
  valuation: bigint,
): Promise<MintResult> {
  const { account, publicClient, walletClient, nftAddress } = getClients();

  // Simulate first: if the contract would revert (missing role, reused
  // Neuro contract, zero valuation), we fail here without spending gas.
  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "mint",
    args: [to, neuroContractId, valuation],
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
  "event Liquidated(uint256 indexed tokenId, address indexed liquidator, uint256 debt)",
]);

export async function getLatestBlock(): Promise<bigint> {
  return getClients().publicClient.getBlockNumber();
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

// Updates the appraised value of an existing collateral token.
export async function updateCollateralValuation(
  tokenId: bigint,
  valuation: bigint,
): Promise<Hash> {
  const { account, publicClient, walletClient, nftAddress } = getClients();

  const { request } = await publicClient.simulateContract({
    account,
    address: nftAddress,
    abi: collateralNftAbi,
    functionName: "updateValuation",
    args: [tokenId, valuation],
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error(`updateValuation reverted: ${txHash}`);
  }
  return txHash;
}
