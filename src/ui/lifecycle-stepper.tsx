// LifecycleStepper — Scenario 内の現在位置（AI-DLC lifecycle 上の stage）を常に示す（RC2 §8）。
// 実 Scenario data の stage のみを表示する。色だけに依存せず記号 + テキストで状態を伝える。
import type { ValidatedScenario } from "../domain/entities.ts";
import type { ProgressionState } from "../domain/scenario-progression.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";

type StageStatus = "completed" | "current" | "upcoming";

const STATUS_ICON: Record<StageStatus, string> = {
  completed: "✓",
  current: "▶",
  upcoming: "○",
};

/** 全 DecisionPoint に対する回答済み数から progress を出す（決定的）。 */
function decisionProgress(
  scenario: ValidatedScenario,
  progression: ProgressionState,
): { answered: number; total: number } {
  let total = 0;
  for (const stageId of scenario.orderedStageIds) {
    const stage = scenario.stages.get(stageId);
    if (stage !== undefined) total += stage.decisionPointIds.length;
  }
  const answered = progression.decisionRecords.length;
  return { answered, total };
}

export function LifecycleStepper(props: {
  scenario: ValidatedScenario;
  progression: ProgressionState;
  /** feedback 表示中か。true のとき「直近に回答した Decision」を current として表示する（§7）。 */
  showFeedback?: boolean;
  t: I18nResolver["t"];
}): JSX.Element {
  const { scenario, progression, showFeedback = false, t } = props;
  const currentStageId = progression.session.currentStageId;
  const completed = progression.session.status === "completed";
  const currentIdx = currentStageId
    ? scenario.orderedStageIds.indexOf(currentStageId)
    : scenario.orderedStageIds.length; // completed のときは全 stage 完了扱い

  const { answered, total } = decisionProgress(scenario, progression);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  // 表示する「現在の Decision 番号」（§7）:
  //  - feedback 表示中: 直近に回答した Decision が対象 = answered（既に記録済み）。
  //  - 判断入力中: これから答える Decision = answered + 1。
  //  - 完了: total。
  const currentDecisionNumber = completed
    ? total
    : showFeedback
      ? Math.min(answered, total)
      : Math.min(answered + 1, total);

  return (
    <nav className="stepper" aria-label={t("stepper.title")}>
      <ol className="stepper-list">
        {scenario.orderedStageIds.map((stageId, idx) => {
          const stage = scenario.stages.get(stageId);
          if (stage === undefined) return null;
          let status: StageStatus;
          if (completed || idx < currentIdx) status = "completed";
          else if (idx === currentIdx) status = "current";
          else status = "upcoming";
          return (
            <li
              key={stageId}
              className={`stepper-item stepper-${status}`}
              data-testid={`step-${stageId}`}
              aria-current={status === "current" ? "step" : undefined}
            >
              <span className="stepper-icon" aria-hidden="true">
                {STATUS_ICON[status]}
              </span>
              <span className="stepper-label">{t(stage.titleKey)}</span>
              <span className="visually-hidden">{t(`stepper.status.${status}`)}</span>
            </li>
          );
        })}
      </ol>
      <div className="stepper-progress" data-testid="stepper-progress">
        <div
          className="progressbar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t("stepper.progress")}
        >
          <span className="progressbar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="stepper-count" data-testid="stepper-count">
          {t("stepper.decision")} {currentDecisionNumber} {t("stepper.of")} {total} · {pct}%
        </span>
      </div>
    </nav>
  );
}
