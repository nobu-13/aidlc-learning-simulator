// FeedbackViewModel — Feedback / Result で使う human-readable な view model を決定的に構築する
// （RC3 Final Stabilization P1-1 H2/H4 / P1-6）。
//
// 目的: Caught / Missed / False Positive のいずれも、Artifact item と 1:1 で追跡でき、
// internal ID（itemId/defectId/artifactId/journeyStepId）や locale key を UI へ露出しない。
// すべて locale key（title/body/why/origin/affected）として供給し、UI は resolve するだけ。
// pure・決定的（time/random/locale/mode 非参照）。
import type {
  DefectDefinition,
  GeneratedArtifact,
  JourneyStepId,
  Severity,
} from "./journey-entities.ts";
import type { FindingOutcome, ReviewEvaluation } from "./review-evaluator.ts";

export type FeedbackResultType = "caught" | "missed" | "false";

/**
 * 1 finding 分の human-readable view model。すべて locale key（`*Key`）または列挙値で、
 * UI が t() で解決する。internal ID は一切含めない（H2/H4）。
 */
export interface FeedbackItemViewModel {
  readonly resultType: FeedbackResultType;
  /** Artifact item のタイトル locale key（source item と 1:1）。 */
  readonly itemTitleKey: string;
  /** Artifact item の本文 locale key。 */
  readonly itemBodyKey: string;
  /** defect のとき severity（caught/missed）= 基準上（Ground Truth）の severity。false のときは undefined。 */
  readonly severity?: Severity | undefined;
  /**
   * RC4 Final: Ground Truth（基準）上の severity（= severity と同じ）。
   * severity と分離した明示 field。UI で「基準上の severity」を出すために使う。
   */
  readonly groundTruthSeverity?: Severity | undefined;
  /**
   * RC4 Final: ユーザーが選択した severity（reviewerSeverity）。caught のときのみ（指摘した項目）。
   * これを Ground Truth と混同しない（Blind Audit: High 選択が Medium に上書きされて見える問題の解消）。
   */
  readonly reviewerSeverity?: Severity | undefined;
  /**
   * RC4 Final: reviewerSeverity が groundTruthSeverity と一致したか（caught のときのみ）。
   * UI で「あなたの判定は基準と一致/相違」を示す。
   */
  readonly severityMatches?: boolean | undefined;
  /** なぜ重要か（defect rationale）。 */
  readonly whyItMattersKey?: string | undefined;
  /** この問題の由来工程（defect の journeyStepId）。 */
  readonly originStepId?: JourneyStepId | undefined;
  /** 見逃した場合に影響する後工程（downstreamManifestation.atStepId）。 */
  readonly affectedLaterStepId?: JourneyStepId | undefined;
  /** 実際に後工程で何が起きるか（downstreamManifestation.manifestItemKey）。F5。 */
  readonly consequenceKey?: string | undefined;
  /** どこへ戻ると直せるか（origin step。F4）。 */
  readonly revisitStepId?: JourneyStepId | undefined;
}

/** artifact の item を itemId で引く。 */
function itemMap(artifact: GeneratedArtifact): ReadonlyMap<string, GeneratedArtifact["items"][number]> {
  const m = new Map<string, GeneratedArtifact["items"][number]>();
  for (const it of artifact.items) m.set(it.itemId, it);
  return m;
}

/** step の defect を itemId で引く。 */
function defectMap(
  defects: readonly DefectDefinition[],
  stepId: JourneyStepId,
): ReadonlyMap<string, DefectDefinition> {
  const m = new Map<string, DefectDefinition>();
  for (const d of defects) if (d.journeyStepId === stepId) m.set(d.itemId, d);
  return m;
}

/**
 * 1 finding outcome を view model へ変換する。artifact item は必ず存在する前提
 * （evaluation は同じ artifact から作られる）。item が見つからない防御ケースでも
 * internal ID は出さず、汎用の human-readable key にフォールバックする。
 */
function toViewModel(
  outcome: FindingOutcome,
  items: ReadonlyMap<string, GeneratedArtifact["items"][number]>,
  defects: ReadonlyMap<string, DefectDefinition>,
): FeedbackItemViewModel {
  const item = items.get(outcome.itemId);
  const defect = defects.get(outcome.itemId);

  const resultType: FeedbackResultType =
    outcome.kind === "caught" ? "caught" : outcome.kind === "missed" ? "missed" : "false";

  return {
    resultType,
    // item があればその title/body、無ければ汎用 human-readable key（ID は出さない）。
    itemTitleKey: item?.labelKey ?? "rc3.fb.unknownItem.title",
    itemBodyKey: item?.bodyKey ?? "rc3.fb.unknownItem.body",
    ...(outcome.expectedSeverity !== undefined ? { severity: outcome.expectedSeverity } : {}),
    // RC4 Final: Ground Truth severity と reviewer severity を明示分離（混同させない）。
    ...(outcome.expectedSeverity !== undefined ? { groundTruthSeverity: outcome.expectedSeverity } : {}),
    ...(outcome.userSeverity !== undefined ? { reviewerSeverity: outcome.userSeverity } : {}),
    ...(outcome.severityCorrect !== undefined ? { severityMatches: outcome.severityCorrect } : {}),
    ...(defect?.rationaleKey !== undefined ? { whyItMattersKey: defect.rationaleKey } : {}),
    ...(defect?.journeyStepId !== undefined ? { originStepId: defect.journeyStepId } : {}),
    ...(defect?.downstreamManifestation?.atStepId !== undefined
      ? { affectedLaterStepId: defect.downstreamManifestation.atStepId }
      : {}),
    // F5: 実際に後工程で何が起きるか（manifest 本文）。
    ...(defect?.downstreamManifestation?.manifestItemKey !== undefined
      ? { consequenceKey: defect.downstreamManifestation.manifestItemKey }
      : {}),
    // F4: どこへ戻ると直せるか（origin = その工程）。
    ...(defect?.journeyStepId !== undefined ? { revisitStepId: defect.journeyStepId } : {}),
  };
}

/** Feedback view の caught / missed / false を human-readable view model 群として返す。 */
export interface FeedbackViewModel {
  readonly caught: readonly FeedbackItemViewModel[];
  readonly missed: readonly FeedbackItemViewModel[];
  readonly falsePositives: readonly FeedbackItemViewModel[];
}

export function buildFeedbackViewModel(
  artifact: GeneratedArtifact,
  defects: readonly DefectDefinition[],
  evaluation: ReviewEvaluation,
): FeedbackViewModel {
  const items = itemMap(artifact);
  const dm = defectMap(defects, artifact.journeyStepId);
  const caught: FeedbackItemViewModel[] = [];
  const missed: FeedbackItemViewModel[] = [];
  const falsePositives: FeedbackItemViewModel[] = [];
  for (const o of evaluation.findingOutcomes) {
    if (o.kind === "caught") caught.push(toViewModel(o, items, dm));
    else if (o.kind === "missed") missed.push(toViewModel(o, items, dm));
    else if (o.kind === "false") falsePositives.push(toViewModel(o, items, dm));
  }
  return { caught, missed, falsePositives };
}
