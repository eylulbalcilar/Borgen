// Manual check: mints a collateral token from a signed Neuro contract.
// Usage: npx tsx src/scripts/relay-check.ts <neuroContractId>
import "dotenv/config";
import { relayAppraisal } from "../services/relayer.js";

const contractId = process.argv[2];
if (!contractId) throw new Error("Usage: relay-check.ts <neuroContractId>");

const result = await relayAppraisal(contractId);
console.log("tokenId:", result.tokenId.toString());
console.log("owner:", result.owner);
console.log("valuation:", result.valuation.toString());
console.log("tx:", `https://sepolia.basescan.org/tx/${result.txHash}`);
