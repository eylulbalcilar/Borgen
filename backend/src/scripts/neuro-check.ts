// Manual check: logs in with each sandbox account and prints identity states.
// Run with: npx tsx src/scripts/neuro-check.ts
import "dotenv/config";
import { getIdentities, type NeuroAccount } from "../services/neuro.js";

const accounts: NeuroAccount[] = ["appraiser", "borrower"];

for (const account of accounts) {
  const identities = await getIdentities(account);
  // Print only states, never personal properties.
  console.log(account, identities.map((i) => i.status.state));
}
