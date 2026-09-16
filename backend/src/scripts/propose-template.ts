// One-time setup: proposes the appraisal template to Neuro and waits for approval.
// Run from the backend folder: npx tsx src/scripts/propose-template.ts
// Then store the printed id as NEURO_APPRAISAL_TEMPLATE_ID in .env.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { proposeTemplate, waitForState } from "../services/neuro.js";

const xml = readFileSync("templates/appraisal.xml", "utf8");

const template = await proposeTemplate("appraiser", xml);
console.log("Proposed:", template.id, template.status.state);

// Sandbox review is automatic but takes a few seconds.
const reviewed = await waitForState("appraiser", template.id, ["Approved"]);
console.log("State:", reviewed.status.state);

if (reviewed.status.state === "Approved") {
  console.log(`\nNEURO_APPRAISAL_TEMPLATE_ID="${template.id}"`);
}
