// UI views（presentation・domain と分離。BR8.1）。
// domain state（ScenarioSession）は app 層が保持し、ここは render / user intent / a11y のみを担う。
import { useEffect, useState } from "react";
import type { AppApi } from "../app/use-app-state.ts";
import type { Application } from "../app/application-orchestrator.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";
import type { ExperienceMode, ValidatedScenario } from "../domain/entities.ts";
import { presentationPolicyFor } from "../domain/experience-policy.ts";
import {
  ADOPTION_SHEET_HEADINGS,
  adoptionHeadingSlug,
  composeAdoptionSheet,
} from "../domain/adoption-sheet-composer.ts";
import type { I18nResolver as I18nResolverType } from "../i18n/locale-resources.ts";
import { ProvenanceBadge } from "./provenance-badge.tsx";
import { FeedbackCardView } from "./feedback-card.tsx";
import { LifecycleStepper } from "./lifecycle-stepper.tsx";
import { LangSwitcher } from "./lang-switcher.tsx";

const MODES: readonly ExperienceMode[] = ["guided", "simulation", "adoption-review"];

export function HomeView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  const resumable =
    app.state.progression?.session.status === "in-progress" ? app.state.progression : undefined;
  return (
    <section aria-labelledby="home-h" className="home">
      <div className="hero">
        <h1 id="home-h" className="home-title">
          {t("app.title")}
        </h1>
        <p className="home-tagline">{t("app.tagline")}</p>
        <button className="primary cta" data-testid="start" onClick={() => app.goModeSelect()}>
          {t("home.cta.start")}
        </button>
      </div>

      {resumable !== undefined && app.state.scenario !== undefined ? (
        <div className="card continue-card" data-testid="continue-card">
          <h2>{t("home.continue.title")}</h2>
          <p className="muted">{t("home.continue.desc")}</p>
          <p>{t(app.state.scenario.scenario.titleKey)}</p>
          <button className="primary" data-testid="continue" onClick={() => app.goHome()}>
            {t("home.continue.cta")}
          </button>
        </div>
      ) : null}

      <div className="card">
        <h2>{t("home.outcome.title")}</h2>
        <p>{t("home.outcome.body")}</p>
      </div>

      <div className="card">
        <h2>{t("home.modes.title")}</h2>
        <ul className="options card-grid">
          {MODES.map((mode) => (
            <li key={mode}>
              <button
                className="library-card"
                data-testid={`home-mode-${mode}`}
                onClick={() => {
                  app.setMode(mode);
                  app.chooseScenario("core-e2e");
                }}
              >
                <strong>{t(`mode.${mode}`)}</strong>
                <span className="muted">{t(`mode.${mode}.desc`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>{t("home.journey.title")}</h2>
        <ol className="journey">
          <li>{t("home.journey.step1")}</li>
          <li>{t("home.journey.step2")}</li>
          <li>{t("home.journey.step3")}</li>
          <li>{t("home.journey.step4")}</li>
        </ol>
      </div>

      <div className="card-grid two">
        <div className="card">
          <h2>{t("home.focus.title")}</h2>
          <p className="muted">{t("home.focus.desc")}</p>
          <button data-testid="focus" onClick={() => app.goFocusLibrary()}>
            {t("nav.focus")}
          </button>
        </div>
        <div className="card">
          <h2>{t("home.practice.title")}</h2>
          <p className="muted">{t("home.practice.desc")}</p>
          <button data-testid="practices" onClick={() => app.goPracticeLibrary()}>
            {t("practice.nav.title")}
          </button>
        </div>
      </div>
    </section>
  );
}

export function ModeSelectView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  return (
    <section aria-labelledby="mode-h">
      <h1 id="mode-h">{t("home.chooseMode")}</h1>
      <ul className="options card-grid">
        {MODES.map((mode) => (
          <li key={mode}>
            <button
              className="library-card"
              data-testid={`mode-${mode}`}
              aria-pressed={app.state.mode === mode}
              onClick={() => {
                app.setMode(mode);
                app.chooseScenario("core-e2e");
              }}
            >
              <strong>{t(`mode.${mode}`)}</strong>
              <span className="muted">{t(`mode.${mode}.desc`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FocusLibraryView(props: {
  app: AppApi;
  application: Application;
  t: I18nResolver["t"];
}): JSX.Element {
  const { app, application, t } = props;
  const focus = application.catalog.orderedScenarioIds
    .map((id) => application.catalog.scenarios.get(id))
    .filter((s): s is ValidatedScenario => s !== undefined && s.scenario.kind === "focus");
  return (
    <section aria-labelledby="focus-h">
      <h1 id="focus-h">{t("home.focus.title")}</h1>
      <p>{t("home.focus.desc")}</p>
      <ul className="options card-grid">
        {focus.map((s) => (
          <li key={s.scenario.scenarioId}>
            <button
              className="library-card"
              data-testid={`focus-${s.scenario.scenarioId}`}
              onClick={() => app.chooseScenario(s.scenario.scenarioId)}
            >
              <strong>{t(s.scenario.titleKey)}</strong>
              <span className="muted">{t(s.scenario.summaryKey)}</span>
              <span className="muted related-dims">
                {t("practice.relatedDimensions")}:{" "}
                {s.scenario.learningObjectiveIds.slice(0, 3).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ScenarioIntroView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  const scenario = app.state.scenario;
  if (scenario === undefined) return <ErrorView app={app} application={undefined} t={t} />;
  return (
    <section aria-labelledby="intro-h">
      <h1 id="intro-h">{t(scenario.scenario.titleKey)}</h1>
      <p>{t(scenario.scenario.summaryKey)}</p>
      <button className="primary" data-testid="begin" onClick={() => app.beginScenario()}>
        {t("scenario.intro.start")}
      </button>
    </section>
  );
}

export function ScenarioView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  // note は Decision 単位。currentDecisionPointId が変わるたびに reset する（BUG 4.3 の恒久対策）。
  const [note, setNote] = useState("");
  const { scenario, progression, currentDecisionPointId, showFeedback, mode, feedback } = app.state;
  const dpId = currentDecisionPointId;
  useEffect(() => {
    setNote("");
  }, [dpId]);

  if (scenario === undefined || progression === undefined || currentDecisionPointId === undefined) {
    return <ErrorView app={app} application={undefined} t={t} />;
  }
  const dp = scenario.decisionPoints.get(currentDecisionPointId);
  if (dp === undefined) return <ErrorView app={app} application={undefined} t={t} />;
  const policy = presentationPolicyFor(mode);

  return (
    <section aria-labelledby="sc-h" className="scenario">
      <h1 id="sc-h" className="visually-hidden">
        {t(scenario.scenario.titleKey)}
      </h1>

      <LifecycleStepper scenario={scenario} progression={progression} t={t} />

      {!showFeedback ? (
        <div className="decision-panel">
          <h2>{t("scenario.decision.prompt")}</h2>
          <p className="prompt">{t(dp.promptKey)}</p>

          {/* Guided: 判断前に概念（provenance）を先出し。Simulation/Adoption は先出ししない（§7）。 */}
          {policy.showConceptBeforeDecision && dp.important ? (
            <div className="concept-preview" data-testid="concept-preview">
              {dp.provenanceRefs.map((pid) => {
                const pv = scenario.provenanceEntries.get(pid);
                if (pv === undefined) return null;
                return (
                  <ProvenanceBadge
                    key={pid}
                    category={pv.category}
                    note={t(pv.noteKey)}
                    {...(pv.reference !== undefined ? { reference: pv.reference } : {})}
                    t={t}
                  />
                );
              })}
            </div>
          ) : null}

          <ul className="options">
            {dp.optionIds.map((oid) => {
              const opt = scenario.decisionOptions.get(oid);
              if (opt === undefined) return null;
              return (
                <li key={oid}>
                  <button
                    className="option-btn"
                    data-testid={`option-${oid}`}
                    onClick={() => app.choose(oid, note.trim() || undefined)}
                  >
                    {t(opt.labelKey)}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="form-field">
            <label htmlFor="note">{t("scenario.decision.note")}</label>
            <textarea
              id="note"
              data-testid="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      ) : (
        <div className="feedback-panel">
          <h2>{t("scenario.feedback.title")}</h2>
          {/* Simulation は即時の正誤を過剰に教えない: feedback を簡潔化（§7）。
              Guided/Adoption は full feedback。いずれも空にはしない。 */}
          {feedback !== undefined ? (
            mode === "simulation" ? (
              <SimulationFeedback card={feedback} t={t} />
            ) : (
              <FeedbackCardView card={feedback} t={t} />
            )
          ) : (
            <p>{t("scenario.feedback.title")}</p>
          )}
          <div className="action-row">
            <button className="primary" data-testid="proceed" onClick={() => app.proceed()}>
              {t("scenario.next")}
            </button>
            <button data-testid="decision-back" onClick={() => app.goBack()}>
              ← {t("nav.back")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Simulation 向けの簡潔 feedback（即時 correctness を過剰に出さず、selected + provenance のみ）。 */
function SimulationFeedback(props: {
  card: import("../domain/feedback-model.ts").FeedbackCard;
  t: I18nResolver["t"];
}): JSX.Element {
  const { card, t } = props;
  return (
    <div className="feedback-card feedback-simulation" data-testid="feedback-card" aria-live="polite">
      <div className="feedback-selected">
        <span className="feedback-field-label">{t("feedback.selected")}</span>
        <span data-testid="feedback-selected-label">{t(card.selectedOptionLabelKey)}</span>
      </div>
      {card.decisionProvenance.length > 0 ? (
        <div className="feedback-provenance">
          {card.decisionProvenance.map((pv) => (
            <ProvenanceBadge
              key={pv.provenanceId}
              category={pv.category}
              note={t(pv.noteKey)}
              {...(pv.reference !== undefined ? { reference: pv.reference } : {})}
              t={t}
            />
          ))}
        </div>
      ) : null}
      <p className="muted">{t("reflection.simulation.q")}</p>
    </div>
  );
}

export function ReflectionView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  const { scenario, dashboard, mode } = app.state;
  const [selfNote, setSelfNote] = useState("");

  const questionKey =
    mode === "guided"
      ? "reflection.guided.q"
      : mode === "simulation"
        ? "reflection.simulation.q"
        : "reflection.adoption.q";

  return (
    <section aria-labelledby="ref-h" className="reflection">
      <h1 id="ref-h">{t("reflection.title")}</h1>
      <p>{t("reflection.intro")}</p>

      {dashboard !== undefined && scenario !== undefined ? (
        <>
          <div className="card">
            <h2>{t("reflection.yourDecisions")}</h2>
            {dashboard.timeline.length > 0 ? (
              <ul data-testid="reflection-decisions">
                {dashboard.timeline.map((row) => (
                  <li key={row.decisionRecordId} className={`status-${row.judgment.status}`}>
                    {t(row.selectedOptionLabelKey)} —{" "}
                    <em>{t(`feedback.status.${row.judgment.status}`)}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("reflection.none")}</p>
            )}
          </div>

          <div className="card-grid two">
            <div className="card">
              <h3>{t("reflection.good")}</h3>
              <ul>
                {dashboard.timeline
                  .filter((r) => r.judgment.status === "recommended")
                  .map((r) => (
                    <li key={r.decisionRecordId}>{t(r.selectedOptionLabelKey)}</li>
                  ))}
              </ul>
            </div>
            <div className="card">
              <h3>{t("reflection.improve")}</h3>
              <ul data-testid="reflection-improve">
                {dashboard.timeline
                  .filter((r) => r.judgment.status === "risky")
                  .map((r) => (
                    <li key={r.decisionRecordId}>{t(r.selectedOptionLabelKey)}</li>
                  ))}
              </ul>
            </div>
          </div>

          {dashboard.reviewDimensions.length > 0 ? (
            <div className="card">
              <h3>{t("reflection.weakDimensions")}</h3>
              <p>{dashboard.reviewDimensions.map((id) => t(`dimension.${id}`)).join(" · ")}</p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">{t("reflection.none")}</p>
      )}

      <div className="card">
        <h2>{t("reflection.practicalQuestion")}</h2>
        <p>{t(questionKey)}</p>
        <div className="form-field">
          <label htmlFor="self-note">{t("reflection.selfNote")}</label>
          <textarea
            id="self-note"
            data-testid="reflection-note"
            value={selfNote}
            onChange={(e) => setSelfNote(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <button className="primary" data-testid="to-adoption" onClick={() => app.toAdoption()}>
        {t("reflection.toAdoption")}
      </button>
    </section>
  );
}

export function AdoptionReviewView(props: {
  app: AppApi;
  t: I18nResolver["t"];
  resolver: I18nResolverType;
}): JSX.Element {
  const { app, t, resolver } = props;
  const { scenario, result, progression } = app.state;
  // Workshop 入力（heading slug → text）。端末内のみ・外部送信なし。
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<string | null>(null);

  const buildSheet = (): string | null => {
    if (scenario === undefined || result === undefined) return null;
    const notes = (progression?.decisionRecords ?? [])
      .map((r) => r.note)
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
    return composeAdoptionSheet({
      scenario,
      result,
      decisionRecords: progression?.decisionRecords ?? [],
      text: resolver.t,
      workshopInputs: inputs,
      ...(notes.length > 0 ? { userNotes: notes } : {}),
    });
  };

  const generate = (): void => setSheet(buildSheet());

  const download = (): void => {
    const md = sheet ?? buildSheet();
    if (md === null) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aidlc-adoption-discussion-sheet.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="ado-h" className="adoption">
      <h1 id="ado-h">{t("adoption.workshop.title")}</h1>
      <p>{t("adoption.workshop.intro")}</p>

      <div className="workshop">
        {ADOPTION_SHEET_HEADINGS.map((heading) => {
          const slug = adoptionHeadingSlug(heading);
          return (
            <div key={slug} className="card workshop-section" data-testid={`workshop-${slug}`}>
              <h2>{heading}</h2>
              <p className="muted system-generated">
                <span className="tag">{t("adoption.workshop.systemGenerated")}</span>{" "}
                {sectionGuidance(heading, resolver.t)}
              </p>
              <div className="form-field">
                <label htmlFor={`ws-${slug}`}>
                  <span className="tag tag-user">{t("adoption.workshop.userAuthored")}</span>
                </label>
                <textarea
                  id={`ws-${slug}`}
                  data-testid={`ws-${slug}`}
                  rows={3}
                  value={inputs[slug] ?? ""}
                  onChange={(e) => setInputs((s) => ({ ...s, [slug]: e.target.value }))}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="action-row">
        <button className="primary" data-testid="generate-sheet" onClick={generate}>
          {t("adoption.generate")}
        </button>
        {sheet !== null ? (
          <button data-testid="download-sheet" onClick={download}>
            {t("adoption.download")}
          </button>
        ) : null}
      </div>

      {sheet !== null ? (
        <div className="card">
          <label htmlFor="sheet-preview">{t("adoption.workshop.preview")}</label>
          <textarea id="sheet-preview" data-testid="sheet-preview" value={sheet} readOnly rows={16} />
        </div>
      ) : null}
    </section>
  );
}

function sectionGuidance(heading: string, t: I18nResolver["t"]): string {
  const slug = adoptionHeadingSlug(heading);
  if (heading === "Testing Expectations") return t("adoption.testingExpectations");
  if (heading === "Remaining Risks") return t("adoption.section.remaining-risks");
  return t(`adoption.section.${slug}`);
}

export function ErrorView(props: {
  app: AppApi;
  application: Application | undefined;
  t: I18nResolver["t"];
}): JSX.Element {
  const { app, application, t } = props;
  const unavailable = application?.catalog.unavailable ?? [];
  const runtimeMessage = app.state.runtimeErrorMessage;
  return (
    <section className="error" aria-labelledby="err-h" role="alert">
      <h1 id="err-h">{t("error.title")}</h1>
      {runtimeMessage !== undefined ? <p data-testid="runtime-error">{runtimeMessage}</p> : null}
      {unavailable.length > 0 ? (
        <div>
          <p>{t("error.unavailableIntro")}</p>
          <ul data-testid="unavailable-list">
            {unavailable.map((u) => (
              <li key={u.ref}>
                {u.ref}: {u.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button data-testid="error-home" onClick={() => app.goHome()}>
        ⌂ {t("nav.home")}
      </button>
    </section>
  );
}

export { LangSwitcher };
