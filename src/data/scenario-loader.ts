// ScenarioLoader — 唯一の raw external JSON validation boundary（ADR-003 / C5）。
//
// raw JSON → schema 検証（BR1.1/1.2/1.7）→ 追加の意味検証（stable-ID uniqueness BR1.3 /
// dangling reference BR1.4 / cardinality BR1.5 / provenance invariant BR1.6）→ ValidatedScenario。
// 失敗は ScenarioValidationError（Loader 所有）。silent fallback しない・不正 Scenario を開始しない（FR12）。
// 一部 invalid でも valid を全滅させず、読めなかったものを明示する（BR1.8）。
import { scenarioSetSchema } from "./schema.ts";
import { ScenarioValidationError } from "../domain/errors.ts";
import type {
  DecisionOption,
  DecisionPoint,
  EffectRule,
  LearningPoint,
  ProvenanceEntry,
  Scenario,
  ScenarioCatalog,
  Stage,
  UnavailableScenario,
  ValidatedScenario,
} from "../domain/entities.ts";

/** build-time に読み込んだ 1 ファイル分の raw 入力（ref は判別用ラベル）。 */
export interface RawScenarioSource {
  /** どのファイル/Scenario かを判別する識別子（FR12 の可読性）。 */
  readonly ref: string;
  readonly raw: unknown;
}

/** 単一 ScenarioSet を検証して ValidatedScenario を返す。失敗は ScenarioValidationError。 */
export function validateScenarioSet(source: RawScenarioSource): ValidatedScenario {
  const parsed = scenarioSetSchema.safeParse(source.raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".")}: ${first.message}` : "schema 検証に失敗しました";
    throw new ScenarioValidationError(`schema 検証エラー: ${detail}`, source.ref);
  }
  const set = parsed.data;
  const ref = set.scenario.scenarioId || source.ref;

  // --- stable-ID uniqueness（BR1.3） ---
  assertUnique(set.stages, (s) => s.stageId, "Stage.stageId", ref);
  assertUnique(set.decisionPoints, (d) => d.decisionPointId, "DecisionPoint.decisionPointId", ref);
  assertUnique(set.decisionOptions, (o) => o.optionId, "DecisionOption.optionId", ref);
  assertUnique(set.learningPoints, (l) => l.learningPointId, "LearningPoint.learningPointId", ref);
  assertUnique(set.effectRules, (e) => e.effectRuleId, "EffectRule.effectRuleId", ref);
  assertUnique(set.provenanceEntries, (p) => p.provenanceId, "ProvenanceEntry.provenanceId", ref);

  const stages = indexBy(set.stages, (s) => s.stageId);
  const decisionPoints = indexBy(set.decisionPoints, (d) => d.decisionPointId);
  const decisionOptions = indexBy(set.decisionOptions, (o) => o.optionId);
  const learningPoints = indexBy(set.learningPoints, (l) => l.learningPointId);
  const effectRules = indexBy(set.effectRules, (e) => e.effectRuleId);
  const provenanceEntries = indexBy(set.provenanceEntries, (p) => p.provenanceId);

  // --- dangling reference（BR1.4） ---
  const has = (m: ReadonlyMap<string, unknown>, id: string): boolean => m.has(id);
  for (const stageId of set.scenario.stageIds) {
    if (!has(stages, stageId)) {
      throw new ScenarioValidationError(`Scenario.stageIds が未定義 Stage を参照: ${stageId}`, ref);
    }
  }
  for (const lpId of set.scenario.learningPointIds) {
    if (!has(learningPoints, lpId)) {
      throw new ScenarioValidationError(`Scenario.learningPointIds が未定義 LearningPoint を参照: ${lpId}`, ref);
    }
  }
  for (const stage of set.stages) {
    for (const dpId of stage.decisionPointIds) {
      if (!has(decisionPoints, dpId)) {
        throw new ScenarioValidationError(`Stage ${stage.stageId} が未定義 DecisionPoint を参照: ${dpId}`, ref);
      }
    }
  }
  for (const dp of set.decisionPoints) {
    for (const oId of dp.optionIds) {
      if (!has(decisionOptions, oId)) {
        throw new ScenarioValidationError(`DecisionPoint ${dp.decisionPointId} が未定義 DecisionOption を参照: ${oId}`, ref);
      }
    }
    for (const lpId of dp.learningPointRefs) {
      if (!has(learningPoints, lpId)) {
        throw new ScenarioValidationError(`DecisionPoint ${dp.decisionPointId} が未定義 LearningPoint を参照: ${lpId}`, ref);
      }
    }
    for (const pv of dp.provenanceRefs) {
      if (!has(provenanceEntries, pv)) {
        throw new ScenarioValidationError(`DecisionPoint ${dp.decisionPointId} が未定義 ProvenanceEntry を参照: ${pv}`, ref);
      }
    }
    // --- provenance invariant: important DecisionPoint は provenance 必須（BR1.6/BR4.3） ---
    if (dp.important && dp.provenanceRefs.length < 1) {
      throw new ScenarioValidationError(`important DecisionPoint ${dp.decisionPointId} に provenanceRefs がありません`, ref);
    }
  }
  for (const opt of set.decisionOptions) {
    for (const er of opt.effectRuleRefs) {
      if (!has(effectRules, er)) {
        throw new ScenarioValidationError(`DecisionOption ${opt.optionId} が未定義 EffectRule を参照: ${er}`, ref);
      }
    }
    for (const pv of opt.provenanceRefs) {
      if (!has(provenanceEntries, pv)) {
        throw new ScenarioValidationError(`DecisionOption ${opt.optionId} が未定義 ProvenanceEntry を参照: ${pv}`, ref);
      }
    }
    // nextRef の dangling 検証（"terminal" と Stage/DecisionPoint への参照のみ許可）。
    if (opt.nextRef !== undefined && opt.nextRef !== "terminal") {
      if (!has(stages, opt.nextRef) && !has(decisionPoints, opt.nextRef)) {
        throw new ScenarioValidationError(`DecisionOption ${opt.optionId}.nextRef が未定義参照: ${opt.nextRef}`, ref);
      }
    }
  }
  for (const lp of set.learningPoints) {
    for (const pv of lp.provenanceRefs) {
      if (!has(provenanceEntries, pv)) {
        throw new ScenarioValidationError(`LearningPoint ${lp.learningPointId} が未定義 ProvenanceEntry を参照: ${pv}`, ref);
      }
    }
    if (lp.betterAlternativeRef !== undefined) {
      if (!has(decisionOptions, lp.betterAlternativeRef) && !has(learningPoints, lp.betterAlternativeRef)) {
        throw new ScenarioValidationError(`LearningPoint ${lp.learningPointId}.betterAlternativeRef が未定義参照: ${lp.betterAlternativeRef}`, ref);
      }
    }
  }
  for (const er of set.effectRules) {
    if (er.learningPointRef !== undefined && !has(learningPoints, er.learningPointRef)) {
      throw new ScenarioValidationError(`EffectRule ${er.effectRuleId} が未定義 LearningPoint を参照: ${er.learningPointRef}`, ref);
    }
    // condition が参照する optionId の dangling 検証（決定性の前提）。
    if (er.condition) {
      const ids =
        er.condition.kind === "requires-decision" ? er.condition.anyOfOptionIds : er.condition.noneOfOptionIds;
      for (const oId of ids) {
        if (!has(decisionOptions, oId)) {
          throw new ScenarioValidationError(`EffectRule ${er.effectRuleId}.condition が未定義 DecisionOption を参照: ${oId}`, ref);
        }
      }
    }
  }

  return {
    scenario: set.scenario as Scenario,
    stages: stages as ReadonlyMap<string, Stage>,
    decisionPoints: decisionPoints as ReadonlyMap<string, DecisionPoint>,
    decisionOptions: decisionOptions as ReadonlyMap<string, DecisionOption>,
    learningPoints: learningPoints as ReadonlyMap<string, LearningPoint>,
    effectRules: effectRules as ReadonlyMap<string, EffectRule>,
    provenanceEntries: provenanceEntries as ReadonlyMap<string, ProvenanceEntry>,
    orderedStageIds: [...set.scenario.stageIds],
  };
}

/**
 * 複数 source を読み込み Catalog を構築する。一部 invalid は unavailable に退避し
 * valid を全滅させない（BR1.8）。全 invalid でも throw せず、空 catalog + unavailable を返す
 * （Application shell は起動し unavailable state を表示する）。
 */
export function buildScenarioCatalog(sources: readonly RawScenarioSource[]): ScenarioCatalog {
  const scenarios = new Map<string, ValidatedScenario>();
  const orderedScenarioIds: string[] = [];
  const unavailable: UnavailableScenario[] = [];

  for (const source of sources) {
    try {
      const validated = validateScenarioSet(source);
      const id = validated.scenario.scenarioId;
      if (scenarios.has(id)) {
        unavailable.push({
          ref: id,
          reasonKey: "error.scenario.duplicateId",
          detail: `scenarioId が重複しています: ${id}`,
        });
        continue;
      }
      scenarios.set(id, validated);
      orderedScenarioIds.push(id);
    } catch (e) {
      const detail = e instanceof ScenarioValidationError ? e.message : String(e);
      const ref = e instanceof ScenarioValidationError ? e.ref : source.ref;
      unavailable.push({ ref, reasonKey: "error.scenario.invalid", detail });
    }
  }

  return { scenarios, orderedScenarioIds, unavailable };
}

// ---------- helpers ----------

function assertUnique<T>(items: readonly T[], key: (t: T) => string, label: string, ref: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) {
      throw new ScenarioValidationError(`${label} が重複しています: ${k}`, ref);
    }
    seen.add(k);
  }
}

function indexBy<T>(items: readonly T[], key: (t: T) => string): ReadonlyMap<string, T> {
  const m = new Map<string, T>();
  for (const item of items) m.set(key(item), item);
  return m;
}
