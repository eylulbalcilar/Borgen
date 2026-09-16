// Prints the current state of a Neuro contract or template.
// Usage: npx tsx src/scripts/contract-state.ts <contractId> [params]
import "dotenv/config";
import { getContract } from "../services/neuro.js";

const [contractId, option] = process.argv.slice(2);
if (!contractId) throw new Error("Usage: contract-state.ts <contractId> [params]");

const contract = await getContract("appraiser", contractId);
console.log("state:", contract.status.state);

// Shows the raw parameter structure (test contracts only, no personal data).
if (option === "params") {
  console.log(JSON.stringify(contract.parameters, null, 2));
}
