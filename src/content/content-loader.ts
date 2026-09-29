// ContentLoader — Archetype content template JSON の validation boundary（RC4 Phase 1）。
//
// raw JSON → schema 検証 → 追加の意味検証（slot uniqueness / defect slot の variant 完全性 /
// step 完全性）→ ValidatedArchetypeContent（ID から O(1) で引ける index）。
// 失敗は ScenarioValidationError（既存の load 境界 error を流用）。silent fallback しない・
// malformed JSON を握り潰さない（Engineering Constraints）。
import { archetypeContentSchema, type SlotInput } from "./content-schema.ts";
import { ScenarioValidationError } from "../domain/errors.ts";
import {
  JOURNEY_STEP_IDS,
  type JourneyStepId,
  type ProjectArchetypeId,
} from "../domain/journey/journey-entities.ts";

/** build-time に読み込んだ 1 archetype 分の raw 入力。 */
export interface RawArchetypeSource {
  readonly ref: string;
  readonly raw: unknown;
}

/** step 単位の検証済み content（slot を slotId で引ける）。 */
export interface ValidatedStepContent {
  readonly journeyStepId: JourneyStepId;
  readonly titleKey: string;
  readonly summaryKey: string;
  readonly provenanceKey?: string | undefined;
  readonly slots: readonly SlotInput[];
}

/** archetype 単位の検証済み content。 */
export interface ValidatedArchetypeContent {
  readonly archetypeId: ProjectArchetypeId;
  readonly titleKey: string;
  readonly summaryKey: string;
  /** journeyStepId → step content（O(1) 参照）。 */
  readonly steps: ReadonlyMap<JourneyStepId, ValidatedStepContent>;
}

/** 全 archetype の catalog（archetypeId → content）。 */
export interface ArchetypeContentCatalog {
  readonly byArchetype: ReadonlyMap<ProjectArchetypeId, ValidatedArchetypeContent>;
}

/** review 対象 step（J1..J6）。J7/J8 は approval で slot content を持たない。 */
const CONTENT_STEP_IDS: readonly JourneyStepId[] = JOURNEY_STEP_IDS.filter(
  (s) => s !== "j7-completion-approval" && s !== "j8-release-approval",
);

/**
 * 単一 archetype content を検証する。失敗は ScenarioValidationError。
 * 検証項目:
 *  - schema（zod・unknown reject / version / enum / cardinality）
 *  - step 重複なし・review 対象 step（J1..J6）を漏れなく含む
 *  - slot id は archetype 内で一意
 *  - defectId を持つ slot は defectiveBodyKey / correctedBodyKey の両方を持つ（本文可変の前提）
 *  - defectId を持たない slot は defective/corrected を持たない（密結合の混入防止）
 */
export function validateArchetypeContent(source: RawArchetypeSource): ValidatedArchetypeContent {
  const parsed = archetypeContentSchema.safeParse(source.raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".")}: ${first.message}` : "schema 検証に失敗しました";
    throw new ScenarioValidationError(`content schema 検証エラー: ${detail}`, source.ref);
  }
  const set = parsed.data;
  const ref = `${set.archetypeId} (${source.ref})`;

  // step uniqueness。
  const stepSeen = new Set<string>();
  for (const st of set.steps) {
    if (stepSeen.has(st.journeyStepId)) {
      throw new ScenarioValidationError(`journey step が重複しています: ${st.journeyStepId}`, ref);
    }
    stepSeen.add(st.journeyStepId);
  }

  // review 対象 step（J1..J6）を漏れなく含むこと（silent に欠落した step を許さない）。
  for (const required of CONTENT_STEP_IDS) {
    if (!stepSeen.has(required)) {
      throw new ScenarioValidationError(`必須の journey step が欠落しています: ${required}`, ref);
    }
  }

  // slot id は archetype 全体で一意（step をまたいで衝突させない = artifact item id 衝突防止）。
  const slotSeen = new Set<string>();
  const steps = new Map<JourneyStepId, ValidatedStepContent>();
  for (const st of set.steps) {
    for (const slot of st.slots) {
      if (slotSeen.has(slot.slotId)) {
        throw new ScenarioValidationError(`slotId が重複しています: ${slot.slotId}`, ref);
      }
      slotSeen.add(slot.slotId);

      // defect slot は defective/corrected の両方が必須（RC4 の本文可変の前提）。
      if (slot.defectId !== undefined) {
        if (slot.defectiveBodyKey === undefined || slot.correctedBodyKey === undefined) {
          throw new ScenarioValidationError(
            `defect slot ${slot.slotId} は defectiveBodyKey と correctedBodyKey の両方が必要です`,
            ref,
          );
        }
      } else {
        // defect を持たない slot が defective/corrected を持つのは矛盾（密結合の混入）。
        if (slot.defectiveBodyKey !== undefined || slot.correctedBodyKey !== undefined) {
          throw new ScenarioValidationError(
            `slot ${slot.slotId} は defectId が無いのに defective/corrected 本文を持っています`,
            ref,
          );
        }
      }
    }
    steps.set(st.journeyStepId as JourneyStepId, {
      journeyStepId: st.journeyStepId as JourneyStepId,
      titleKey: st.titleKey,
      summaryKey: st.summaryKey,
      provenanceKey: st.provenanceKey,
      slots: st.slots,
    });
  }

  return {
    archetypeId: set.archetypeId as ProjectArchetypeId,
    titleKey: set.titleKey,
    summaryKey: set.summaryKey,
    steps,
  };
}

/**
 * 複数 archetype source から catalog を構築する。
 * scenario-loader と異なり、archetype content は「4 種すべて揃うこと」が Generator の前提なので、
 * 1 つでも invalid なら throw する（silent に欠けた archetype で起動させない）。
 */
export function buildArchetypeContentCatalog(
  sources: readonly RawArchetypeSource[],
): ArchetypeContentCatalog {
  const byArchetype = new Map<ProjectArchetypeId, ValidatedArchetypeContent>();
  for (const source of sources) {
    const validated = validateArchetypeContent(source);
    if (byArchetype.has(validated.archetypeId)) {
      throw new ScenarioValidationError(
        `archetypeId が重複しています: ${validated.archetypeId}`,
        source.ref,
      );
    }
    byArchetype.set(validated.archetypeId, validated);
  }
  return { byArchetype };
}
