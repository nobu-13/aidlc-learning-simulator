// Scenario registry — build-time 同梱の全 Scenario module（raw JSON + locale bundles）。
// runtime fetch しない（A3 / NFR6）。JSON は data であり logic を持たない。
import type { ScenarioModule } from "../app/application-orchestrator.ts";
import coreE2e from "./core-e2e.json";
import focusEvidence from "./focus-evidence.json";
import focusCheckpointReview from "./focus-checkpoint-review.json";
import focusRefusalRecovery from "./focus-refusal-recovery.json";
import { coreE2eLocales } from "./core-e2e.locale.ts";
import { focusEvidenceLocales } from "./focus-evidence.locale.ts";
import { focusCheckpointReviewLocales } from "./focus-checkpoint-review.locale.ts";
import { focusRefusalRecoveryLocales } from "./focus-refusal-recovery.locale.ts";

export const scenarioModules: readonly ScenarioModule[] = [
  { ref: "core-e2e.json", raw: coreE2e, localeBundles: coreE2eLocales },
  { ref: "focus-evidence.json", raw: focusEvidence, localeBundles: focusEvidenceLocales },
  { ref: "focus-checkpoint-review.json", raw: focusCheckpointReview, localeBundles: focusCheckpointReviewLocales },
  { ref: "focus-refusal-recovery.json", raw: focusRefusalRecovery, localeBundles: focusRefusalRecoveryLocales },
];
