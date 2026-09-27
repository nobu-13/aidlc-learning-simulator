// ExperiencePolicy — 3 モードの提示ポリシー（FR9 / BR5.2）。
// 同一 Scenario Engine / Source Data を共有し、評価は一切変えない。mode は「何をどれだけ提示するか」
// （ヒント量・概念説明の事前提示・振り返り強調）だけを決める。評価 engine とは独立（pure・決定的）。
import type { ExperienceMode } from "./entities.ts";

export interface PresentationPolicy {
  readonly mode: ExperienceMode;
  /** 判断前に AI-DLC 概念説明を提示するか（Guided で true）。 */
  readonly showConceptBeforeDecision: boolean;
  /** ヒント（推奨方向の示唆）を提示するか（Simulation で false）。 */
  readonly showHints: boolean;
  /** 判断後の feedback を強調表示するか。 */
  readonly emphasizeFeedback: boolean;
  /** Adoption Review 導線を前面に出すか（Adoption Review モードで true）。 */
  readonly emphasizeAdoptionReview: boolean;
}

const POLICIES: Record<ExperienceMode, PresentationPolicy> = {
  guided: {
    mode: "guided",
    showConceptBeforeDecision: true,
    showHints: true,
    emphasizeFeedback: true,
    emphasizeAdoptionReview: false,
  },
  simulation: {
    mode: "simulation",
    showConceptBeforeDecision: false,
    showHints: false,
    emphasizeFeedback: true,
    emphasizeAdoptionReview: false,
  },
  "adoption-review": {
    mode: "adoption-review",
    showConceptBeforeDecision: false,
    showHints: false,
    emphasizeFeedback: true,
    emphasizeAdoptionReview: true,
  },
};

/** mode に対応する提示ポリシーを返す。評価には一切影響しない（BR5.2）。 */
export function presentationPolicyFor(mode: ExperienceMode): PresentationPolicy {
  return POLICIES[mode];
}
