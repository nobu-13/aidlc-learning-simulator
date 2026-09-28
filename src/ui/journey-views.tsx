// RC3 Journey views（presentation・domain と分離）。
// Guided / Simulation / Adoption の体験差は JourneyModePolicy を参照して表現する。
// domain logic は持たず、useJourneyState の API を呼ぶ。a11y: semantic HTML / aria-live / 一意 label。
import { useMemo, useState } from "react";
import type { JourneyApi } from "../app/use-journey-state.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";
import type { ContributionLevel, DimensionId } from "../domain/entities.ts";
import { DIMENSION_IDS } from "../domain/entities.ts";
import {
  JOURNEY_STEP_IDS,
  STRUCTURED_INPUT_FIELD_IDS,
  STRUCTURED_INPUT_OPTIONS,
  USER_AUTHORED_FIELD_IDS,
  type ApprovalDecision,
  type ArtifactItem,
  type GateDecision,
  type JourneyStepId,
  type ReviewFinding,
  type Severity,
} from "../domain/journey/journey-entities.ts";

type T = I18nResolver["t"];

const GATE_OPTIONS: readonly GateDecision[] = [
  "approve",
  "approve-with-conditions",
  "return-for-rework",
  "change-scope",
  "block",
];
const SEVERITIES: readonly Severity[] = ["low", "medium", "high"];

/** ContributionLevel を記号へ（Result / Completion summary 共通）。 */
function levelSymbolOf(level: ContributionLevel): string {
  switch (level) {
    case "strong-positive":
      return "++";
    case "positive":
      return "+";
    case "negative":
      return "-";
    case "strong-negative":
      return "--";
    default:
      return "0";
  }
}
const APPROVALS: readonly ApprovalDecision[] = ["approve", "approve-with-conditions", "return", "block"];

/** RC3 Journey の現在位置を示す Stepper（既存 lifecycle-stepper と同思想・RC3 専用）。 */
function JourneyStepper(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const current = journey.state.progress.currentStepId;
  const completed = new Set(journey.state.progress.completedStepIds);
  return (
    <nav className="stepper" aria-label={t("stepper.title")}>
      <ol className="stepper-list">
        {JOURNEY_STEP_IDS.map((id) => {
          const status = completed.has(id) ? "completed" : id === current ? "current" : "upcoming";
          return (
            <li
              key={id}
              className={`stepper-item stepper-${status}`}
              aria-current={id === current ? "step" : undefined}
              data-testid={`journey-step-${id}`}
            >
              <span className="stepper-status-label">{t(`stepper.status.${status}`)}</span>
              <span>{t(`rc3.journey.step.${id}`)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function JourneyHomeView(props: { journey: JourneyApi; t: T; onExitToGym: () => void }): JSX.Element {
  const { journey, t, onExitToGym } = props;
  return (
    <section aria-labelledby="jh-h" className="home">
      <div className="hero">
        <h1 id="jh-h" className="home-title">
          {t("rc3.home.title")}
        </h1>
        <p className="home-tagline">{t("rc3.home.desc")}</p>
      </div>

      {journey.state.resumable ? (
        <div className="card continue-card" data-testid="journey-resume-card">
          <h2>{t("rc3.resume.title")}</h2>
          <p className="muted">{t("rc3.resume.desc")}</p>
          <button className="primary" data-testid="journey-resume" onClick={() => journey.resume()}>
            {t("rc3.resume.cta")}
          </button>
        </div>
      ) : null}

      <div className="card">
        <h2>{t("home.modes.title")}</h2>
        <p className="muted" role="note">
          {t("rc3.journey.groupingNote")}
        </p>
        <ul className="options card-grid">
          <li>
            <button className="library-card" data-testid="journey-start-guided" onClick={() => journey.startGuided()}>
              <strong>{t("mode.guided")}</strong>
              <span className="muted">{t("mode.guided.desc")}</span>
            </button>
          </li>
          <li>
            <button className="library-card" data-testid="journey-start-simulation" onClick={() => journey.startSimulation()}>
              <strong>{t("mode.simulation")}</strong>
              <span className="muted">{t("mode.simulation.desc")}</span>
            </button>
          </li>
          <li>
            <button className="library-card" data-testid="journey-start-adoption" onClick={() => journey.startAdoption()}>
              <strong>{t("mode.adoption-review")}</strong>
              <span className="muted">{t("mode.adoption-review.desc")}</span>
            </button>
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>{t("rc3.gym.title")}</h2>
        <p className="muted">{t("rc3.gym.desc")}</p>
        <button className="secondary" data-testid="to-gym" onClick={onExitToGym}>
          {t("rc3.gym.title")}
        </button>
      </div>
    </section>
  );
}

export function JourneySetupView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const s = journey.state;
  return (
    <section aria-labelledby="js-h" className="journey-setup">
      <h1 id="js-h">{t("rc3.setup.title")}</h1>
      <p className="muted">{t("rc3.setup.desc")}</p>
      <p className="boundary-note" role="note" data-testid="setup-boundary-note">
        {t("rc3.setup.boundaryNote")}
      </p>

      <div className="card">
        <h2>{t("rc3.setup.userAuthoredTitle")}</h2>
        {USER_AUTHORED_FIELD_IDS.map((f) => (
          <label key={f} className="field">
            <span>{t(`rc3.field.${f}`)}</span>
            <textarea
              data-testid={`setup-ua-${f}`}
              aria-label={t(`rc3.field.${f}`)}
              value={s.draftUserAuthored[f] ?? ""}
              onChange={(e) => journey.setDraftUserAuthored(f, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="card">
        <h2>{t("rc3.setup.structuredTitle")}</h2>
        {STRUCTURED_INPUT_FIELD_IDS.map((f) => (
          <label key={f} className="field">
            <span>{t(`rc3.struct.${f}`)}</span>
            <select
              data-testid={`setup-struct-${f}`}
              aria-label={t(`rc3.struct.${f}`)}
              value={s.draftStructured[f]}
              onChange={(e) => journey.setDraftStructured(f, e.target.value)}
            >
              {STRUCTURED_INPUT_OPTIONS[f].map((v) => (
                <option key={v} value={v}>
                  {t(`rc3.struct.val.${v}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <button className="primary" data-testid="setup-begin" onClick={() => journey.beginJourney()}>
        {t("rc3.setup.begin")}
      </button>
    </section>
  );
}

/** Artifact Review の入力（finding 選択 + severity + gate + note）。 */
export function JourneyReviewView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const artifact = useMemo(() => journey.currentArtifact(), [journey]);
  const [selected, setSelected] = useState<Record<string, Severity | undefined>>({});
  const [gate, setGate] = useState<GateDecision>("approve");
  const [note, setNote] = useState("");

  const toggle = (itemId: string): void => {
    setSelected((prev) => {
      const next = { ...prev };
      if (itemId in next) delete next[itemId];
      else next[itemId] = undefined;
      return next;
    });
  };
  const setSev = (itemId: string, sev: Severity): void => {
    setSelected((prev) => ({ ...prev, [itemId]: sev }));
  };

  const submit = (): void => {
    const findings: ReviewFinding[] = Object.entries(selected).map(([itemId, severity]) =>
      severity !== undefined ? { itemId, severity } : { itemId },
    );
    journey.submitReview({
      artifactId: artifact.artifactId,
      journeyStepId: artifact.journeyStepId,
      findings,
      gateDecision: gate,
      ...(note.trim().length > 0 ? { noteText: note } : {}),
    });
  };

  // section ごとにグルーピング（J3 の functional-domain / nfr-architecture 等）。
  const sections = groupBySection(artifact.items);

  return (
    <section aria-labelledby="jr-h" className="journey-review">
      <JourneyStepper journey={journey} t={t} />
      <h1 id="jr-h">{t(artifact.titleKey)}</h1>
      <p className="muted">{t(artifact.summaryKey)}</p>

      <RevisionBanner journey={journey} stepId={artifact.journeyStepId} revision={artifact.revision} t={t} />

      {Object.keys(artifact.quotedUserText).length > 0 ? (
        <div className="card quoted" data-testid="review-quoted">
          <h2>{t("rc3.review.quoted")}</h2>
          <ul>
            {Object.entries(artifact.quotedUserText).map(([field, text]) =>
              text !== undefined && text.length > 0 ? (
                <li key={field} data-testid={`review-quoted-${field}`}>
                  <strong>{t(`rc3.field.${field}`)}:</strong> {renderUserText(text, t)}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}

      <fieldset className="card">
        <legend>{t("rc3.review.findingsPrompt")}</legend>
        {sections.map(({ sectionId, items }) => (
          <div key={sectionId ?? "default"} className="review-section">
            {sectionId !== undefined ? <h3>{t(`rc3.section.${sectionId}`)}</h3> : null}
            <ul className="review-items">
              {items.map((item) =>
                item.reviewability === "informational" ? (
                  // consequence 顕在化＝情報。採点対象ではなく選択もできない（FIX 1）。
                  <li
                    key={item.itemId}
                    className="review-item review-item-informational"
                    data-testid={`review-info-${item.itemId}`}
                  >
                    <span className="info-badge">{t("rc3.consequence.label")}</span>
                    <span>
                      <span className="muted">{t(item.bodyKey)}</span>
                    </span>
                    {item.originStepId !== undefined ? (
                      <span className="consequence-origin" data-testid={`review-info-origin-${item.itemId}`}>
                        {t("rc3.consequence.origin")}: {t(`rc3.journey.step.${item.originStepId}`)}
                      </span>
                    ) : null}
                    <span className="muted consequence-cause">{t("rc3.consequence.cause")}</span>
                  </li>
                ) : (
                <li key={item.itemId} className="review-item">
                  <label htmlFor={`review-cb-${item.itemId}`}>
                    <input
                      id={`review-cb-${item.itemId}`}
                      type="checkbox"
                      data-testid={`review-item-${item.itemId}`}
                      aria-label={t(item.labelKey)}
                      checked={item.itemId in selected}
                      onChange={() => toggle(item.itemId)}
                    />
                    <span>
                      <strong>{t(item.labelKey)}</strong>
                      <span className="muted"> — {t(item.bodyKey)}</span>
                    </span>
                  </label>
                  {item.itemId in selected ? (
                    <span className="severity-picker">
                      <span className="muted">{t("rc3.review.severity")}:</span>
                      {SEVERITIES.map((sev) => (
                        <label key={sev} className="chip">
                          <input
                            type="radio"
                            name={`sev-${item.itemId}`}
                            data-testid={`review-sev-${item.itemId}-${sev}`}
                            checked={selected[item.itemId] === sev}
                            onChange={() => setSev(item.itemId, sev)}
                          />
                          {t(`rc3.sev.${sev}`)}
                        </label>
                      ))}
                    </span>
                  ) : null}
                </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </fieldset>

      <label className="field">
        <span>{t("rc3.review.gatePrompt")}</span>
        <select
          data-testid="review-gate"
          aria-label={t("rc3.review.gatePrompt")}
          value={gate}
          onChange={(e) => setGate(e.target.value as GateDecision)}
        >
          {GATE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {t(`rc3.gate.${g}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t("rc3.review.note")}</span>
        <textarea
          data-testid="review-note"
          aria-label={t("rc3.review.note")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <button className="primary" data-testid="review-submit" onClick={submit}>
        {t("rc3.review.submit")}
      </button>
    </section>
  );
}

/** Guided / Simulation の feedback（Adoption はここに来ない）。 */
export function JourneyFeedbackView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t, } = props;
  const policy = journey.policy;
  const ev = journey.state.lastEvaluation;
  if (ev === undefined) {
    return (
      <section className="journey-feedback">
        <button className="primary" data-testid="feedback-next" onClick={() => journey.proceedAfterFeedback()}>
          {t("rc3.fb.next")}
        </button>
      </section>
    );
  }

  const caught = ev.findingOutcomes.filter((f) => f.kind === "caught");
  const missed = ev.findingOutcomes.filter((f) => f.kind === "missed");
  const falseFlags = ev.findingOutcomes.filter((f) => f.kind === "false");
  // P1-3: must-fix は hook が判定した state.mustFix（high 見逃し + too-lenient + Simulation）を使う。
  const mustFix = journey.state.mustFix;

  return (
    <section aria-labelledby="jf-h" className="journey-feedback">
      <h1 id="jf-h">{t("scenario.feedback.title")}</h1>

      {!ev.hadDefects && caught.length === 0 && falseFlags.length === 0 ? (
        <p className="feedback-clean" data-testid="feedback-clean">
          {t("rc3.fb.noDefectHere")}
        </p>
      ) : null}

      <div className="card">
        <h2>{t("rc3.fb.caught")}</h2>
        <ul data-testid="feedback-caught">
          {caught.map((f) => (
            <li key={f.itemId}>{f.rationaleKey !== undefined ? t(f.rationaleKey) : f.itemId}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>{t("rc3.fb.missed")}</h2>
        <ul data-testid="feedback-missed">
          {missed.map((f) => (
            <li key={f.itemId}>
              <strong>{t("rc3.fb.whyMatters")}:</strong>{" "}
              {f.rationaleKey !== undefined ? t(f.rationaleKey) : f.itemId}
            </li>
          ))}
        </ul>
      </div>

      {falseFlags.length > 0 ? (
        <div className="card">
          <h2>{t("rc3.fb.false")}</h2>
          <ul data-testid="feedback-false">
            {falseFlags.map((f) => (
              <li key={f.itemId}>{f.itemId}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className={`gate-quality gate-${ev.gateQuality}`} role="status" data-testid="feedback-gate-quality">
        {t(`rc3.fb.gate.${ev.gateQuality}`)}
      </p>

      {policy.showWouldHaveConsequence && missed.length > 0 ? (
        <div className="card would-have" data-testid="feedback-would-have">
          <h2>{t("rc3.fb.wouldHave")}</h2>
        </div>
      ) : null}

      {policy.explainConsequence && missed.length > 0 ? (
        <div className="card explain-consequence" data-testid="feedback-explain">
          <h2>{t("rc3.fb.wouldHave")}</h2>
        </div>
      ) : null}

      {mustFix ? (
        <div className="card must-fix" role="alert" data-testid="feedback-must-fix">
          <p>{t("rc3.fb.mustFix")}</p>
          <button
            className="primary"
            data-testid="feedback-rework"
            onClick={() => journey.reworkTo(journey.state.progress.currentStepId, "critical-finding")}
          >
            {t("rc3.fb.rework")}
          </button>
        </div>
      ) : (
        <div className="feedback-actions">
          {policy.assistedRework ? (
            <button
              className="secondary"
              data-testid="feedback-rework-optional"
              onClick={() => journey.reworkTo(journey.state.progress.currentStepId, "critical-finding")}
            >
              {t("rc3.fb.rework")}
            </button>
          ) : null}
          <button className="primary" data-testid="feedback-next" onClick={() => journey.proceedAfterFeedback()}>
            {t("rc3.fb.next")}
          </button>
        </div>
      )}
    </section>
  );
}

export function JourneyCompletionView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const summary = useMemo(() => journey.completionSummary(), [journey]);
  return (
    <section aria-labelledby="jc-h" className="journey-approval">
      <JourneyStepper journey={journey} t={t} />
      <h1 id="jc-h">{t("rc3.completion.title")}</h1>
      <p className="muted">{t("rc3.completion.desc")}</p>

      {/* P2-4: Completion 判断材料。Release 固有情報は含めない。 */}
      <div className="card completion-summary" data-testid="completion-summary">
        <h2>{t("rc3.completion.summary.title")}</h2>
        <ul>
          <li data-testid="completion-evidence">
            {t("rc3.completion.summary.evidence")}:{" "}
            {t(`rc3.completion.summary.evidence.${summary.evidenceStatus}`)}
          </li>
          <li data-testid="completion-unresolved">
            {t("rc3.completion.summary.unresolved")}: {summary.unresolvedFindingCount}
          </li>
          <li data-testid="completion-remaining-risk">
            {t("rc3.completion.summary.remainingRisk")}: {levelSymbolOf(summary.remainingRisksLevel)}
          </li>
          <li data-testid="completion-rework">
            {t("rc3.completion.summary.reworkCount")}: {summary.reworkCount}
          </li>
          <li data-testid="completion-steps">
            {t("rc3.completion.summary.completedSteps")}: {summary.completedReviewStepCount} /{" "}
            {summary.totalReviewStepCount}
          </li>
        </ul>
        <p className="muted" role="note">
          {t("rc3.completion.summary.note")}
        </p>
      </div>

      <div className="approval-actions">
        {APPROVALS.map((d) => (
          <button
            key={d}
            className={d === "approve" ? "primary" : "secondary"}
            data-testid={`completion-${d}`}
            onClick={() => journey.decideCompletion(d)}
          >
            {t(`rc3.${d}`)}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Completion != Release を明示するインタースティシャル。 */
export function JourneyInterstitialView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  return (
    <section aria-labelledby="ji-h" className="journey-interstitial">
      <h1 id="ji-h">{t("rc3.interstitial.title")}</h1>
      <p role="note" data-testid="interstitial-body">
        {t("rc3.interstitial.body")}
      </p>
      <button className="primary" data-testid="interstitial-continue" onClick={() => journey.toRelease()}>
        {t("rc3.interstitial.continue")}
      </button>
    </section>
  );
}

export function JourneyReleaseView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  // "conflated" = ユーザーが「completion 通過を理由に無条件 release」を明示選択できるようにする。
  const [conflated, setConflated] = useState(false);
  return (
    <section aria-labelledby="jrl-h" className="journey-approval">
      <h1 id="jrl-h">{t("rc3.release.title")}</h1>
      <p className="muted">{t("rc3.release.desc")}</p>
      <label className="field" htmlFor="release-conflate-cb">
        <input
          id="release-conflate-cb"
          type="checkbox"
          data-testid="release-conflate"
          aria-label={`${t("approval.completion.label")} = ${t("approval.release.label")}`}
          checked={conflated}
          onChange={(e) => setConflated(e.target.checked)}
        />
        <span>
          {t("approval.completion.label")} = {t("approval.release.label")}
        </span>
      </label>
      <div className="approval-actions">
        {APPROVALS.map((d) => (
          <button
            key={d}
            className={d === "approve" ? "primary" : "secondary"}
            data-testid={`release-${d}`}
            onClick={() => journey.decideRelease(d, conflated)}
          >
            {t(`rc3.${d}`)}
          </button>
        ))}
      </div>
    </section>
  );
}

export function JourneyResultView(props: { journey: JourneyApi; t: T; onToGym: () => void }): JSX.Element {
  const { journey, t, onToGym } = props;
  const result = useMemo(() => journey.finalResult(), [journey]);
  const causal = useMemo(() => journey.causalSummary(), [journey]);
  const policy = journey.policy;
  const levelSymbol = (id: DimensionId): string => {
    const o = result.dimensionOutcomes.find((x) => x.dimensionId === id);
    return levelSymbolOf(o?.level ?? "neutral");
  };

  return (
    <section aria-labelledby="jres-h" className="journey-result">
      <h1 id="jres-h">{t("rc3.result.title")}</h1>
      {policy.feedbackTiming === "final-only" ? (
        <p className="muted" role="note" data-testid="final-only-note">
          {t("rc3.result.finalOnlyNote")}
        </p>
      ) : null}

      <div className="card">
        <h2>{t("result.dimensions")}</h2>
        <p className="muted">{t("result.simulationValueNote")}</p>
        <ul className="dimension-rows" data-testid="journey-dimensions">
          {DIMENSION_IDS.map((id) => (
            <li key={id} className="dimension-row">
              <span>{t(`dimension.${id}`)}</span>
              <span className="dimension-level" data-testid={`journey-dim-${id}`}>
                {levelSymbol(id)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>{t("rc3.diag.title")}</h2>
        <ul>
          <li data-testid="result-caught">{t("rc3.result.caught")}: {result.totalCaught}</li>
          <li data-testid="result-missed">{t("rc3.result.missed")}: {result.totalMissed}</li>
          <li data-testid="result-false">{t("rc3.result.false")}: {result.totalFalse}</li>
        </ul>
      </div>

      {result.consequences.length > 0 ? (
        <div className="card">
          <h2>{t("rc3.result.consequences")}</h2>
          <ul data-testid="result-consequences">
            {result.consequences.map((c) => (
              <li key={c.sourceDefectId}>{t(c.manifestItemKey)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {journey.state.progress.reworkHistory.length > 0 ? (
        <div className="card">
          <h2>{t("rc3.result.reworkHistory")}</h2>
          <ul data-testid="result-rework">
            {journey.state.progress.reworkHistory.map((r, i) => (
              <li key={i}>
                {t(`rc3.journey.step.${r.fromStepId as JourneyStepId}`)} →{" "}
                {t(`rc3.journey.step.${r.toStepId as JourneyStepId}`)} (r{r.atRevision})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* P2-5: 因果学習サマリ（何が/なぜ/由来/影響/戻り先）。決定的。 */}
      <div className="card causal-summary" data-testid="result-causal">
        <h2>{t("rc3.result.causal.title")}</h2>
        {causal.length === 0 ? (
          <p className="muted" data-testid="result-causal-none">
            {t("rc3.result.causal.none")}
          </p>
        ) : (
          <ul className="causal-list">
            {causal.map((c) => (
              <li key={c.dimensionId} className="causal-entry" data-testid={`result-causal-${c.dimensionId}`}>
                <strong>
                  {t(`dimension.${c.dimensionId}`)}: {levelSymbolOf(c.level)}
                </strong>
                <span>
                  {t("rc3.result.causal.why")}: {t(`rc3.why.${c.dimensionId}`)}
                </span>
                {c.originStepId !== undefined ? (
                  <span className="muted">
                    {t("rc3.result.causal.origin")}: {t(`rc3.journey.step.${c.originStepId}`)}
                  </span>
                ) : null}
                {c.consequenceKey !== undefined ? (
                  <span className="muted">
                    {t("rc3.result.causal.consequence")}: {t(c.consequenceKey)}
                  </span>
                ) : null}
                {c.revisitStepId !== undefined ? (
                  <span className="revisit" data-testid={`result-causal-revisit-${c.dimensionId}`}>
                    {t("rc3.result.causal.revisit")}: {t(`rc3.journey.step.${c.revisitStepId}`)}
                  </span>
                ) : null}
                {c.gymSuggested ? (
                  <button className="link-button" data-testid={`result-causal-gym-${c.dimensionId}`} onClick={onToGym}>
                    {t("rc3.result.causal.gym")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="result-actions">
        <button className="secondary" data-testid="result-to-gym" onClick={onToGym}>
          {t("rc3.result.toGym")}
        </button>
        <button className="primary" data-testid="result-to-home" onClick={() => journey.exit()}>
          {t("rc3.result.toHome")}
        </button>
      </div>
    </section>
  );
}

/**
 * quoted user-authored text を表示する（P2-1）。
 * canonical Sample は locale key（`rc3.sample.*`）なので resolve する。
 * user 入力の raw text は resolve せずそのまま表示する（⟦missing:...⟧ を出さない）。
 */
function renderUserText(text: string, t: T): string {
  return text.startsWith("rc3.sample.") ? t(text) : text;
}

/** Rework 後の revision を可視化する banner（P2-2）。revision 0 のときは出さない。 */
function RevisionBanner(props: {
  journey: JourneyApi;
  stepId: JourneyStepId;
  revision: number;
  t: T;
}): JSX.Element | null {
  const { journey, stepId, revision, t } = props;
  if (revision <= 0) return null;
  // この step への直近 rework entry（reason / from）を探す。
  const history = journey.state.progress.reworkHistory;
  const last = [...history].reverse().find((e) => e.toStepId === stepId);
  return (
    <div className="card revision-banner" data-testid="revision-banner">
      <strong data-testid="revision-label">
        {t("rc3.revision.label")} {revision}
      </strong>
      {last !== undefined ? (
        <ul className="muted">
          <li>
            {t("rc3.revision.returnedFrom")}: {t(`rc3.journey.step.${last.fromStepId}`)}
          </li>
          <li>
            {t("rc3.revision.reason")}: {t(`rc3.trigger.${last.trigger}`)}
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** items を sectionId でグルーピングする（section 定義順を保つ）。 */
function groupBySection(
  items: readonly ArtifactItem[],
): readonly { sectionId: string | undefined; items: readonly ArtifactItem[] }[] {
  const order: (string | undefined)[] = [];
  const map = new Map<string | undefined, ArtifactItem[]>();
  for (const it of items) {
    const key = it.sectionId;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)?.push(it);
  }
  return order.map((sectionId) => ({ sectionId, items: map.get(sectionId) ?? [] }));
}
