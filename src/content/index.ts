// Archetype content registry — build-time 同梱の全 archetype content template（RC4 Phase 1）。
// runtime fetch しない（no-network posture）。JSON は data であり logic を持たない。
// build-time に検証済み catalog を構築する（malformed は ScenarioValidationError で明示 error）。
import internalApiWorkflow from "./archetypes/internal-api-workflow.json";
import documentSearch from "./archetypes/document-search.json";
import eventDrivenProcessing from "./archetypes/event-driven-processing.json";
import customerFacingApp from "./archetypes/customer-facing-app.json";
import {
  buildArchetypeContentCatalog,
  type ArchetypeContentCatalog,
  type RawArchetypeSource,
} from "./content-loader.ts";

/** build-time 同梱の raw source（ref は判別用ラベル）。 */
export const archetypeContentSources: readonly RawArchetypeSource[] = [
  { ref: "internal-api-workflow.json", raw: internalApiWorkflow },
  { ref: "document-search.json", raw: documentSearch },
  { ref: "event-driven-processing.json", raw: eventDrivenProcessing },
  { ref: "customer-facing-app.json", raw: customerFacingApp },
];

let cached: ArchetypeContentCatalog | undefined;

/**
 * 検証済み archetype content catalog を返す（メモ化）。
 * 検証失敗（malformed / dangling / 欠落 step）は ScenarioValidationError を throw（silent fallback しない）。
 */
export function loadArchetypeContentCatalog(): ArchetypeContentCatalog {
  if (cached === undefined) {
    cached = buildArchetypeContentCatalog(archetypeContentSources);
  }
  return cached;
}
