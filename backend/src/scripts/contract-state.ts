// Prints the current state of a Neuro contract or template.
// Usage: npx tsx src/scripts/contract-state.ts <contractId>
import "dotenv/config";
import { getContract } from "../services/neuro.js";

const contractId = process.argv[2];
if (!contractId) throw new Error("Usage: contract-state.ts <contractId>");

const contract = await getContract("appraiser", contractId);
console.log(contract.status.state);
