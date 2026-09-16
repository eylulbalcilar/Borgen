// Manual end-to-end check of the two-party appraisal contract.
// Run from the backend folder: npx tsx src/scripts/appraisal-flow.ts
import "dotenv/config";
import {
  createContract,
  credentials,
  getContract,
  signContract,
  waitForState,
} from "../services/neuro.js";

const templateId = process.env.NEURO_APPRAISAL_TEMPLATE_ID;
if (!templateId) throw new Error("NEURO_APPRAISAL_TEMPLATE_ID is not set");

const appraiser = credentials("appraiser");
const owner = credentials("borrower");

// Test values only. The wallet is the deployer address used on Base Sepolia.
const contract = await createContract(
  "appraiser",
  templateId,
  [
    { role: "Appraiser", legalId: appraiser.legalId },
    { role: "Owner", legalId: owner.legalId },
  ],
  [
    { name: "AssetTitle", value: "Test chronograph watch" },
    { name: "SerialNumber", value: "TEST-0001" },
    { name: "Valuation", value: "10000000000" },
    { name: "Currency", value: "mUSD" },
    { name: "OwnerWallet", value: "0x1572e983a3db16bea25429bc013b0a4c9e2b1817" },
  ],
);
console.log("Created:", contract.id, contract.status.state);

// 1) Appraiser signs first.
await signContract("appraiser", contract.id, "Appraiser");
await new Promise((r) => setTimeout(r, 5000));
const afterAppraiser = await getContract("appraiser", contract.id);
console.log("After appraiser signature:", afterAppraiser.status.state);

// 2) The owner reads the contract with their own session, then signs.
const seenByOwner = await getContract("borrower", contract.id);
console.log("Owner can read contract:", seenByOwner.id === contract.id);

await signContract("borrower", contract.id, "Owner");

// Wait until the state changes from the one observed after the first signature.
const final = await waitForState("borrower", contract.id, ["Signed"]);
console.log("Final state:", final.status.state);
console.log(`\nContract id: ${contract.id}`);
