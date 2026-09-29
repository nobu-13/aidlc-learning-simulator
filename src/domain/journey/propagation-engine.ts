// PropagationEngine — RC4 Phase 3。upstream の defect の解決/未解決が **direct downstream step** の
// Artifact へ双方向に影響する（controlled 1-hop）。
//
// pure・決定的（time / random / locale / mode 非参照）。全 mode 共通の domain engine。
// 表示 policy（explanation の粗密）は mode-policy が別途決める。Ground Truth は mode 不変。
//
// 1-hop の定義（レビュー確定）:
//   lifecycle 上の origin step → その **直接隣接** downstream review step のみ。
//   例: J1→J2, J2→J3, J3→J4, ...（J1→J4 のような遠距離は Phase 3 の actual propagation では使わない）。
//   multi-hop chaining はしない: J1 未解決が J2 に効いても、その J2 effect を使って J3 へ自動連鎖させない。
//
// 既存 defect.downstreamManifestation（遠距離 target を含む）は「educational consequence / eventual
// manifestation / Result・feedback explanation」として保持し、この engine の actual 1-hop propagation
// には使わない（明示 PROPAGATION_RULES を別に定義する）。
import type { DimensionId } from "../entities.ts";
import type { DefectDefinition, JourneyStepId } from "./journey-entities.ts";
import { JOURNEY_STEP_IDS } from "./journey-entities.ts";

/** actual 1-hop propagation の対象になる review step（J7/J8 承認は Artifact review ではないため除外）。 */
const REVIEW_STEP_IDS: readonly JourneyStepId[] = JOURNEY_STEP_IDS.filter(
  (s) => s !== "j7-completion-approval" && s !== "j8-release-approval",
);

/**
 * 指定 step の直接隣接 downstream review step を返す（1-hop の定義）。
 * 最後の review step（J6）や承認 step には downstream が無い → undefined。
 */
export function directDownstreamStepOf(stepId: JourneyStepId): JourneyStepId | undefined {
  const idx = REVIEW_STEP_IDS.indexOf(stepId);
  if (idx < 0) return undefined;
  return REVIEW_STEP_IDS[idx + 1];
}

/**
 * 指定 step の直接隣接 upstream review step を返す（1-hop の source 側）。
 * 先頭 review step（J1）や承認 step には upstream が無い → undefined。
 * actual propagation の source は「この step の direct upstream の 1 step のみ」に限定する
 * （rule filter だけに依存せず、source collection 自体を 1-hop に閉じる）。
 */
export function directUpstreamStepOf(stepId: JourneyStepId): JourneyStepId | undefined {
  const idx = REVIEW_STEP_IDS.indexOf(stepId);
  if (idx <= 0) return undefined;
  return REVIEW_STEP_IDS[idx - 1];
}

/**
 * 明示 propagation rule（defect ごと）。origin で起きた欠陥が **direct downstream** へどう効くか。
 * targetStepId は directDownstreamStepOf(originStepId) に一致する（構造的に 1-hop を保証）。
 */
export interface PropagationRule {
  readonly defectId: string;
  readonly originStepId: JourneyStepId;
  readonly targetStepId: JourneyStepId;
  /** unresolved のとき target に注入する「悪化」item の本文 key。 */
  readonly unresolvedEffectKey: string;
  /** resolved のとき target に出す補助説明 item の本文 key（主効果は悪化 item の除去）。 */
  readonly resolvedEffectKey: string;
  /** unresolved が加算する risk dimension。 */
  readonly addsRiskDimensionIds: readonly DimensionId[];
}

/**
 * defect definition 群から明示 1-hop propagation rule を導出する。
 *
 * 各 defect について、その defect の origin step の **direct downstream step** を target にした
 * rule を 1 本作る（遠距離 downstreamManifestation.atStepId は使わない）。
 * downstream が無い step（J6 / 承認）の defect は伝播しない。
 * 悪化/改善の本文 key は defect id から決定的に導出（locale 側で対を用意）。
 */
export function derivePropagationRules(
  defects: readonly DefectDefinition[],
): readonly PropagationRule[] {
  const rules: PropagationRule[] = [];
  const sorted = defects
    .slice()
    .sort((a, b) => (a.defectId < b.defectId ? -1 : a.defectId > b.defectId ? 1 : 0));
  for (const d of sorted) {
    const target = directDownstreamStepOf(d.journeyStepId);
    if (target === undefined) continue; // downstream が無い step は伝播しない。
    // risk dimension は既存 manifestation があればそれを流用、無ければ空。
    const addsRisk = d.downstreamManifestation?.addsRiskDimensionIds ?? [];
    rules.push({
      defectId: d.defectId,
      originStepId: d.journeyStepId,
      targetStepId: target,
      // actual 1-hop 用の本文 key（遠距離 manifestItemKey とは別・rc4.prop.* で用意）。
      unresolvedEffectKey: `rc4.prop.${d.defectId}.worsened`,
      resolvedEffectKey: `rc4.prop.${d.defectId}.improved`,
      addsRiskDimensionIds: addsRisk,
    });
  }
  return rules;
}

/** target step に注入される 1 件の伝播効果（悪化 or 改善補助説明）。 */
export interface PropagatedEffect {
  readonly kind: "worsened" | "improved";
  readonly sourceDefectId: string;
  readonly originStepId: JourneyStepId;
  readonly atStepId: JourneyStepId;
  readonly manifestItemKey: string;
  /** risk 寄与（worsened のみ・improved は 0）。 */
  readonly addsRiskDimensionIds: readonly DimensionId[];
}

/**
 * 指定 target step に対する伝播効果を決定的に計算する（controlled 1-hop・双方向）。
 *
 * 挙動（rule.targetStepId === targetStepId のもののみ）:
 *  - upstream で resolved（direct upstream = origin で Rework 解決）→ improved 補助説明を出す。
 *    主効果は「worsened item が出ない（除去される）」こと。risk 寄与は 0。
 *  - upstream で missed（未解決見逃し）→ worsened item + risk 寄与。
 *  - どちらでもない → 効果なし。
 *
 * 1-hop 保証: rule.targetStepId は origin の **direct downstream** のみ。
 * 呼び出し側（journey-engine）は各 step につき 1 回だけ呼び、target 由来の再伝播は行わない。
 * したがって J1 未解決の J2 effect が J3 へ連鎖することはない。
 */
export function computePropagatedEffects(args: {
  readonly rules: readonly PropagationRule[];
  readonly targetStepId: JourneyStepId;
  readonly upstreamMissedDefectIds: ReadonlySet<string>;
  readonly upstreamResolvedDefectIds: ReadonlySet<string>;
}): readonly PropagatedEffect[] {
  const out: PropagatedEffect[] = [];
  for (const rule of args.rules) {
    if (rule.targetStepId !== args.targetStepId) continue;

    if (args.upstreamResolvedDefectIds.has(rule.defectId)) {
      // 改善: worsened を出さず、補助説明のみ（主効果は悪化の除去）。
      out.push({
        kind: "improved",
        sourceDefectId: rule.defectId,
        originStepId: rule.originStepId,
        atStepId: rule.targetStepId,
        manifestItemKey: rule.resolvedEffectKey,
        addsRiskDimensionIds: [],
      });
    } else if (args.upstreamMissedDefectIds.has(rule.defectId)) {
      out.push({
        kind: "worsened",
        sourceDefectId: rule.defectId,
        originStepId: rule.originStepId,
        atStepId: rule.targetStepId,
        manifestItemKey: rule.unresolvedEffectKey,
        addsRiskDimensionIds: rule.addsRiskDimensionIds,
      });
    }
  }
  return out.sort((a, b) =>
    a.sourceDefectId < b.sourceDefectId ? -1 : a.sourceDefectId > b.sourceDefectId ? 1 : 0,
  );
}
