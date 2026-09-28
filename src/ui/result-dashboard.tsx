// ResultDashboardView — Learning Review Dashboard（RC2 §10）。
// summary / 9 Dimension / Decision Timeline / Remaining Risks / Next Focus を表示する。
// すべて domain の ResultDashboard（決定的）から描画する。
import type { AppApi } from "../app/use-app-state.ts";
import type { ContributionLevel, DimensionId } from "../domain/entities.ts";
import type { ResultDashboard } from "../domain/result-summary.ts";
import type { JudgmentStatus } from "../domain/decision-judgment.ts";
import type { Application } from "../app/application-orchestrator.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";

const LEVEL_LABEL: Record<ContributionLevel, string> = {
  "strong-negative": "−−",
  negative: "−",
  neutral: "0",
  positive: "＋",
  "strong-positive": "＋＋",
};

const STATUS_ICON: Record<JudgmentStatus, string> = {
  recommended: "✔",
  "context-dependent": "◐",
  risky: "▲",
};

function dimLabelKey(id: DimensionId): string {
  return `dimension.${id}`;
}

function levelClass(level: ContributionLevel): string {
  if (level === "strong-positive" || level === "positive") return "dim-pos";
  if (level === "strong-negative" || level === "negative") return "dim-neg";
  return "dim-neutral";
}

export function ResultDashboardView(props: {
  app: AppApi;
  application: Application;
  dashboard: ResultDashboard;
  t: I18nResolver["t"];
}): JSX.Element {
  const { app, application, dashboard, t } = props;

  return (
    <section aria-labelledby="res-h" className="dashboard">
      <h1 id="res-h">{t("result.dashboard.title")}</h1>
      <p className="sim-value-note" data-testid="sim-value-note">
        {t("result.simulationValueNote")}
      </p>

      {/* A. Summary */}
      <div className="card" data-testid="result-summary">
        <h2>{t("result.summary.title")}</h2>
        <p>{t("result.summary.completed")}</p>
        <div className="summary-grid">
          <div>
            <h3>{t("result.summary.positive")}</h3>
            {dashboard.positiveDimensions.length > 0 ? (
              <ul>
                {dashboard.positiveDimensions.map((id) => (
                  <li key={id}>{t(dimLabelKey(id))}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("result.summary.none")}</p>
            )}
          </div>
          <div>
            <h3>{t("result.summary.review")}</h3>
            {dashboard.reviewDimensions.length > 0 ? (
              <ul data-testid="review-dimensions">
                {dashboard.reviewDimensions.map((id) => (
                  <li key={id}>{t(dimLabelKey(id))}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("result.summary.none")}</p>
            )}
          </div>
        </div>
      </div>

      {/* B. 9 Dimension Dashboard */}
      <div className="card">
        <h2>{t("result.dimensions")}</h2>
        <ul className="dimension-list" data-testid="dimensions">
          {dashboard.dimensionRows.map((row) => (
            <li key={row.dimensionId} className={levelClass(row.level)}>
              <span className="dim-name">{t(dimLabelKey(row.dimensionId))}</span>
              <span className="dim-meaning muted">{t(`${dimLabelKey(row.dimensionId)}.meaning`)}</span>
              <span className="dim-level" data-testid={`dim-${row.dimensionId}`}>
                {LEVEL_LABEL[row.level]} <span className="visually-hidden">{row.level}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* C. Decision Timeline */}
      <div className="card">
        <h2>{t("result.timeline.title")}</h2>
        <ol className="timeline" data-testid="timeline">
          {dashboard.timeline.map((row) => (
            <li key={row.decisionRecordId} className="timeline-row">
              {row.stageTitleKey !== undefined ? (
                <span className="timeline-stage">{t(row.stageTitleKey)}</span>
              ) : null}
              <p className="timeline-prompt">{t(row.promptKey)}</p>
              <p className="timeline-selected">
                <span className="feedback-field-label">{t("result.timeline.selected")}</span>{" "}
                {t(row.selectedOptionLabelKey)}
              </p>
              <p className={`timeline-judgment status-${row.judgment.status}`}>
                <span className="feedback-field-label">{t("result.timeline.judgment")}</span>{" "}
                <span aria-hidden="true">{STATUS_ICON[row.judgment.status]}</span>{" "}
                {t(`feedback.status.${row.judgment.status}`)}
              </p>
              {row.judgment.impacts.length > 0 ? (
                <p className="timeline-contribution">
                  <span className="feedback-field-label">{t("result.timeline.contribution")}</span>{" "}
                  {row.judgment.impacts
                    .map((i) => `${t(dimLabelKey(i.dimensionId))} ${i.delta > 0 ? "+" : ""}${i.delta}`)
                    .join(" · ")}
                </p>
              ) : null}
              {row.note !== undefined && row.note.trim().length > 0 ? (
                <p className="timeline-note">
                  <span className="feedback-field-label">{t("result.timeline.note")}</span> {row.note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {/* E. Remaining Risks */}
      <div className="card">
        <h2>{t("result.remainingRisks.title")}</h2>
        <p className={levelClass(dashboard.remainingRisksLevel)} data-testid="remaining-risks">
          {t("dimension.remaining-risks")}: {LEVEL_LABEL[dashboard.remainingRisksLevel]}{" "}
          <span className="visually-hidden">{dashboard.remainingRisksLevel}</span>
        </p>
      </div>

      {/* F. Recommended Next Learning（弱 Dimension → Focus の決定的 mapping のみ） */}
      {dashboard.nextFocus.length > 0 ? (
        <div className="card" data-testid="next-focus">
          <h2>{t("result.nextLearning.title")}</h2>
          <ul className="options">
            {dashboard.nextFocus.map((rec) => {
              const focus = application.getScenario(rec.focusScenarioId);
              if (focus === undefined) return null;
              return (
                <li key={rec.focusScenarioId}>
                  <button
                    data-testid={`next-focus-${rec.focusScenarioId}`}
                    onClick={() => app.chooseScenario(rec.focusScenarioId)}
                  >
                    {t(focus.scenario.titleKey)}
                    <span className="muted">
                      {" "}
                      — {t("result.nextLearning.reason")}: {t(dimLabelKey(rec.reasonDimensionId))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="action-row">
        <button className="primary" data-testid="to-reflection" onClick={() => app.toReflection()}>
          {t("result.toReflection")}
        </button>
        <button data-testid="result-retry" onClick={() => app.retry()}>
          {t("result.retry")}
        </button>
        <button data-testid="result-to-focus" onClick={() => app.goFocusLibrary()}>
          {t("result.toFocus")}
        </button>
        <button data-testid="result-to-home" onClick={() => app.goHome()}>
          {t("result.toHome")}
        </button>
      </div>
    </section>
  );
}
