// ReviewEvaluator — Artifact Review を Ground Truth と比較して決定的に評価する（Design §10 / Human Decision 3）。
//
// pure・決定的（time / random / locale / mode 非参照）。runtime AI を使わない。
// Diagnostic Metrics（TP/FP/FN/coverage）と 9 Dimension を混同しない。9 Dimension への反映は
// DimensionEffectAdapter（別 module）が明示的 boundary で行う。ここでは診断のみを出す。
import type {
  ArtifactReview,
  DefectDefinition,
  GateDecision,
  GeneratedArtifact,
  Severity,
} from "./journey-entities.ts";
import { DomainInvariantError } from "../errors.ts";

/** finding 1 件の照合結果。 */
export interface FindingOutcome {
  readonly itemId: string;
  /** この項目が実際に defect か（Ground Truth）。 */
  readonly isDefect: boolean;
  /** User が指摘したか。 */
  readonly flaggedByUser: boolean;
  /** caught（TP）/ missed（FN）/ false（FP）/ correct-reject（TN）。 */
  readonly kind: "caught" | "missed" | "false" | "correct-reject";
  /** defect のとき期待 severity。 */
  readonly expectedSeverity?: Severity | undefined;
  /** User が付けた severity。 */
  readonly userSeverity?: Severity | undefined;
  /** severity 判断が期待と一致したか（caught のときのみ意味を持つ）。 */
  readonly severityCorrect?: boolean | undefined;
  readonly rationaleKey?: string | undefined;
}

/** Diagnostic Metrics（9 Dimension とは別体系・Design §11）。 */
export interface DiagnosticMetrics {
  /** True Positive: defect を正しく指摘。 */
  readonly truePositives: number;
  /** False Positive: defect でない項目を指摘（over-review）。 */
  readonly falsePositives: number;
  /** False Negative: defect を見逃した。 */
  readonly falseNegatives: number;
  /** True Negative: defect でない項目を正しく見送った。 */
  readonly trueNegatives: number;
  /** 総 defect 数。 */
  readonly defectCount: number;
  /** Review Coverage = TP / defectCount（defect が無ければ 1）。 */
  readonly reviewCoverage: number;
  /** severity 判断が正しかった caught 件数。 */
  readonly severityCorrectCount: number;
}

/** Gate 判断の妥当性（未解決 defect と gate の整合）。 */
export type GateQuality = "sound" | "too-lenient" | "too-strict";

export interface ReviewEvaluation {
  readonly artifactId: string;
  readonly findingOutcomes: readonly FindingOutcome[];
  readonly caughtItemIds: readonly string[];
  readonly missedItemIds: readonly string[];
  readonly falseItemIds: readonly string[];
  readonly metrics: DiagnosticMetrics;
  readonly gateDecision: GateDecision;
  readonly gateQuality: GateQuality;
  /** この Artifact に注入されていた defect 数（clean artifact なら 0）。 */
  readonly hadDefects: boolean;
}

/** この step の defect 定義を itemId で引けるようにする。 */
function defectsByItem(
  defects: readonly DefectDefinition[],
  artifactStepId: string,
): ReadonlyMap<string, DefectDefinition> {
  const m = new Map<string, DefectDefinition>();
  for (const d of defects) {
    if (d.journeyStepId === artifactStepId) m.set(d.itemId, d);
  }
  return m;
}

/**
/** judgeGateQuality の入力（実 Ground Truth に基づく信号・FIX 2）。 */
export interface GateSignals {
  readonly gate: GateDecision;
  /** 実際の defect 総数（Ground Truth）。 */
  readonly defectCount: number;
  readonly caughtCount: number;
  readonly missedCount: number;
  /** high severity の見逃し数。 */
  readonly missedHighCount: number;
  /** false positive（defect でない finding-candidate を指摘）数。 */
  readonly falseCount: number;
}

/**
 * Gate 判断の妥当性を実 Ground Truth に基づいて決定的に判定する（FIX 2）。
 *
 * 判定の骨子:
 * - passing（approve / approve-with-conditions）:
 *   - approve で見逃しが 1 件でも残る → too-lenient。
 *   - approve-with-conditions で high severity 見逃しが残る → too-lenient。
 *   - それ以外の passing → sound。
 * - blocking（return-for-rework / block / change-scope）:
 *   - **実 defect が存在し、それに応じて止める（実 defect あり、または high 見逃しあり）→ sound**。
 *   - **実 defect が 0（clean artifact）で止める → too-strict**。false positive を根拠に止めても
 *     Ground Truth 上は問題が無いため too-strict（FIX 2 の中心：clean+FP+block/return は too-strict）。
 *
 * これにより:
 *   A. defect 0 / findings 0 / approve            → sound（passing・見逃しなし）
 *   B. defect 0 / FP>0 / block                    → too-strict（実 defect が無いのに止めた）
 *   C. defect 0 / FP>0 / return-for-rework         → too-strict（同上）
 *   D. defect あり / high 未解決 / approve          → too-lenient
 *   E. defect を catch して適切に return            → sound（実 defect あり・止めた）
 */
export function judgeGateQuality(signals: GateSignals): GateQuality {
  const { gate, defectCount, missedCount, missedHighCount } = signals;
  const passing = gate === "approve" || gate === "approve-with-conditions";

  if (passing) {
    if (gate === "approve" && missedCount > 0) return "too-lenient";
    if (gate === "approve-with-conditions" && missedHighCount > 0) return "too-lenient";
    return "sound";
  }

  // blocking（return-for-rework / block / change-scope）。
  // 実 defect が全く無い artifact を止めるのは過剰（false positive を根拠にしても too-strict）。
  if (defectCount === 0) return "too-strict";
  // 実 defect がある状況で止める（差し戻す）のは妥当。
  return "sound";
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

export function evaluateArtifactReview(
  artifact: GeneratedArtifact,
  defects: readonly DefectDefinition[],
  review: ArtifactReview,
): ReviewEvaluation {
  // FIX 3: review と artifact の identity/step 不一致は silent evaluation を禁止し reject する。
  // rework で revision が上がった Artifact に旧 revision の Review を当てると artifactId が食い違う。
  if (review.artifactId !== artifact.artifactId) {
    throw new DomainInvariantError(
      `Review の artifactId (${review.artifactId}) が Artifact (${artifact.artifactId}) と一致しません`,
    );
  }
  if (review.journeyStepId !== artifact.journeyStepId) {
    throw new DomainInvariantError(
      `Review の journeyStepId (${review.journeyStepId}) が Artifact (${artifact.journeyStepId}) と一致しません`,
    );
  }
  const defectMap = defectsByItem(defects, artifact.journeyStepId);
  const flagged = new Map<string, Severity | undefined>();
  for (const f of review.findings) flagged.set(f.itemId, f.severity);

  const findingOutcomes: FindingOutcome[] = [];
  const caught: string[] = [];
  const missed: string[] = [];
  const falseItems: string[] = [];

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  let severityCorrectCount = 0;

  // Artifact の各項目を走査（順序は items 定義順で決定的）。
  for (const item of artifact.items) {
    // finding-candidate のみ採点母集団に含める（FIX 1）。
    // informational（consequence 顕在化）と non-scored（user 引用）は TP/FP/FN/TN から除外する。
    if (item.reviewability !== "finding-candidate") continue;

    const defect = defectMap.get(item.itemId);
    const isDefect = defect !== undefined;
    const flaggedByUser = flagged.has(item.itemId);
    const userSeverity = flagged.get(item.itemId);

    let kind: FindingOutcome["kind"];
    let severityCorrect: boolean | undefined;

    if (isDefect && flaggedByUser) {
      kind = "caught";
      tp += 1;
      caught.push(item.itemId);
      severityCorrect = userSeverity !== undefined && userSeverity === defect.expectedSeverity;
      if (severityCorrect) severityCorrectCount += 1;
    } else if (isDefect && !flaggedByUser) {
      kind = "missed";
      fn += 1;
      missed.push(item.itemId);
    } else if (!isDefect && flaggedByUser) {
      kind = "false";
      fp += 1;
      falseItems.push(item.itemId);
    } else {
      kind = "correct-reject";
      tn += 1;
    }

    findingOutcomes.push({
      itemId: item.itemId,
      isDefect,
      flaggedByUser,
      kind,
      expectedSeverity: defect?.expectedSeverity,
      userSeverity,
      severityCorrect,
      rationaleKey: defect?.rationaleKey,
    });
  }

  const defectCount = tp + fn;
  const reviewCoverage = defectCount === 0 ? 1 : tp / defectCount;

  const missedHighCount = missed.filter((id) => {
    const d = defectMap.get(id);
    return d !== undefined && SEVERITY_RANK[d.expectedSeverity] === SEVERITY_RANK.high;
  }).length;

  const gateQuality = judgeGateQuality({
    gate: review.gateDecision,
    defectCount,
    caughtCount: tp,
    missedCount: missed.length,
    missedHighCount,
    falseCount: falseItems.length,
  });

  return {
    artifactId: artifact.artifactId,
    findingOutcomes,
    caughtItemIds: caught,
    missedItemIds: missed,
    falseItemIds: falseItems,
    metrics: {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      trueNegatives: tn,
      defectCount,
      reviewCoverage,
      severityCorrectCount,
    },
    gateDecision: review.gateDecision,
    gateQuality,
    hadDefects: defectCount > 0,
  };
}

/**
 * critical learning blocker の判定（P1-3）。決定的・pure。
 * high severity の見逃しがあり、かつ gate が too-lenient（未解決を残して通した）なら true。
 * この判定は mode に依存しない事実。mode によって「block を強制するか」は呼び出し側（mode policy）で決める。
 */
export function hasCriticalLearningBlocker(evaluation: ReviewEvaluation): boolean {
  const missedHigh = evaluation.findingOutcomes.some(
    (f) => f.kind === "missed" && f.expectedSeverity === "high",
  );
  return missedHigh && evaluation.gateQuality === "too-lenient";
}
