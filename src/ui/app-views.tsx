// UI views（presentation・domain と分離。BR8.1）。
// domain state（ScenarioSession）は app 層が保持し、ここは render / user intent / a11y のみを担う。
import { useState } from "react";
import type { AppApi } from "../app/use-app-state.ts";
import type { Application } from "../app/application-orchestrator.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";
import type {
  ContributionLevel,
  DimensionId,
  ExperienceMode,
  ValidatedScenario,
} from "../domain/entities.ts";
import { DIMENSION_IDS } from "../domain/entities.ts";
import { presentationPolicyFor } from "../domain/experience-policy.ts";
import { composeAdoptionSheet } from "../domain/adoption-sheet-composer.ts";
import type { I18nResolver as I18nResolverType } from "../i18n/locale-resources.ts";
import { ProvenanceBadge } from "./provenance-badge.tsx";

const MODES: readonly ExperienceMode[] = ["guided", "simulation", "adoption-review"];

function LangSwitcher(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  return (
    <div>
      <label htmlFor="lang-select">{t("app.langLabel")}</label>{" "}
      <select
        id="lang-select"
        data-testid="lang-select"
        value={app.state.locale}
        onChange={(e) => app.setLocale(e.target.value === "ja" ? "ja" : "en")}
      >
        <option value="ja">{t("app.lang.ja")}</option>
        <option value="en">{t("app.lang.en")}</option>
      </select>
    </div>
  );
}

export function HomeView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  return (
    <section aria-labelledby="home-h">
      <h1 id="home-h">{t("app.title")}</h1>
      <p>{t("app.tagline")}</p>
      <button className="primary" data-testid="start" onClick={() => app.goModeSelect()}>
        {t("nav.start")}
      </button>{" "}
      <button data-testid="focus" onClick={() => app.goFocusLibrary()}>
        {t("nav.focus")}
      </button>
    </section>
  );
}

export function ModeSelectView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  return (
    <section aria-labelledby="mode-h">
      <h1 id="mode-h">{t("home.chooseMode")}</h1>
      <ul className="options">
        {MODES.map((mode) => (
          <li key={mode}>
            <button
              data-testid={`mode-${mode}`}
              aria-pressed={app.state.mode === mode}
              onClick={() => {
                app.setMode(mode);
                // core Scenario を選んで intro へ。
                const coreId = "core-e2e";
                app.chooseScenario(coreId);
              }}
            >
              <strong>{t(`mode.${mode}`)}</strong> — {t(`mode.${mode}.desc`)}
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
      <h1 id="focus-h">{t("nav.focus")}</h1>
      <ul className="options">
        {focus.map((s) => (
          <li key={s.scenario.scenarioId}>
            <button
              data-testid={`focus-${s.scenario.scenarioId}`}
              onClick={() => app.chooseScenario(s.scenario.scenarioId)}
            >
              {t(s.scenario.titleKey)}
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
  const [note, setNote] = useState("");
  const { scenario, progression, currentDecisionPointId, showFeedback, mode } = app.state;
  if (scenario === undefined || progression === undefined || currentDecisionPointId === undefined) {
    return <ErrorView app={app} application={undefined} t={t} />;
  }
  const dp = scenario.decisionPoints.get(currentDecisionPointId);
  if (dp === undefined) return <ErrorView app={app} application={undefined} t={t} />;
  const policy = presentationPolicyFor(mode);

  return (
    <section aria-labelledby="sc-h">
      <h1 id="sc-h">{t(scenario.scenario.titleKey)}</h1>

      {!showFeedback ? (
        <div>
          <h2>{t("scenario.decision.prompt")}</h2>
          <p>{t(dp.promptKey)}</p>

          {/* Guided モードでは important DecisionPoint の provenance を事前提示（概念先出し） */}
          {policy.showConceptBeforeDecision && dp.important
            ? dp.provenanceRefs.map((pid) => {
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
              })
            : null}

          <ul className="options">
            {dp.optionIds.map((oid) => {
              const opt = scenario.decisionOptions.get(oid);
              if (opt === undefined) return null;
              return (
                <li key={oid}>
                  <button data-testid={`option-${oid}`} onClick={() => app.choose(oid, note.trim() || undefined)}>
                    {t(opt.labelKey)}
                  </button>
                </li>
              );
            })}
          </ul>

          <label htmlFor="note">{t("scenario.decision.note")}</label>
          <textarea
            id="note"
            data-testid="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>
      ) : (
        <div aria-live="polite">
          <h2>{t("scenario.feedback.title")}</h2>
          {dp.learningPointRefs.map((lpid) => {
            const lp = scenario.learningPoints.get(lpid);
            if (lp === undefined) return null;
            return (
              <div key={lpid} data-testid={`lp-${lpid}`}>
                <h3>{t(lp.titleKey)}</h3>
                <p>{t(lp.bodyKey)}</p>
                {lp.provenanceRefs.map((pid) => {
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
            );
          })}
          <button className="primary" data-testid="proceed" onClick={() => app.proceed()}>
            {t("scenario.next")}
          </button>
        </div>
      )}
    </section>
  );
}

const LEVEL_LABEL: Record<ContributionLevel, string> = {
  "strong-negative": "−−",
  negative: "−",
  neutral: "0",
  positive: "＋",
  "strong-positive": "＋＋",
};

function dimensionLabelKey(id: DimensionId): string {
  return `dimension.${id}`;
}

export function ResultView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  const result = app.state.result;
  if (result === undefined) return <ErrorView app={app} application={undefined} t={t} />;
  return (
    <section aria-labelledby="res-h">
      <h1 id="res-h">{t("result.title")}</h1>
      <p className="sim-value-note" data-testid="sim-value-note">
        {t("result.simulationValueNote")}
      </p>
      <h2>{t("result.dimensions")}</h2>
      <ul className="dimension-list" data-testid="dimensions">
        {DIMENSION_IDS.map((id) => {
          const o = result.dimensionOutcomes.find((x) => x.dimensionId === id);
          const level = o ? o.level : "neutral";
          return (
            <li key={id}>
              <span>{t(dimensionLabelKey(id))}</span>
              <span aria-label={level} data-testid={`dim-${id}`}>
                {LEVEL_LABEL[level]} <span className="visually-hidden">{level}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <button className="primary" data-testid="to-reflection" onClick={() => app.toReflection()}>
        {t("result.toReflection")}
      </button>
    </section>
  );
}

export function ReflectionView(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  return (
    <section aria-labelledby="ref-h">
      <h1 id="ref-h">{t("reflection.title")}</h1>
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
  const [sheet, setSheet] = useState<string | null>(null);
  const { scenario, result, progression } = app.state;

  // Adoption Discussion Sheet を決定的に生成する（FR8.1）。domain の composeAdoptionSheet を
  // locale bundle 経由で呼ぶ（UI は生成ロジックを持たない・BR8.1）。
  const generate = (): void => {
    if (scenario === undefined || result === undefined) return;
    const notes = (progression?.decisionRecords ?? [])
      .map((r) => r.note)
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
    const md = composeAdoptionSheet({
      scenario,
      result,
      decisionRecords: progression?.decisionRecords ?? [],
      text: resolver.t,
      ...(notes.length > 0 ? { userNotes: notes } : {}),
    });
    setSheet(md);
  };

  // Markdown を Blob で download する（no-network posture: 外部送信せずクライアント内で完結）。
  const download = (): void => {
    if (sheet === null) return;
    const blob = new Blob([sheet], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aidlc-adoption-discussion-sheet.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="ado-h">
      <h1 id="ado-h">{t("adoption.title")}</h1>
      <p>{t("adoption.note")}</p>
      <button className="primary" data-testid="generate-sheet" onClick={generate}>
        {t("adoption.generate")}
      </button>
      {sheet !== null ? (
        <div>
          <button data-testid="download-sheet" onClick={download}>
            {t("adoption.download")}
          </button>
          <label htmlFor="sheet-preview">{t("adoption.title")}</label>
          <textarea id="sheet-preview" data-testid="sheet-preview" value={sheet} readOnly rows={16} />
        </div>
      ) : null}
    </section>
  );
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
      {runtimeMessage !== undefined ? (
        <p data-testid="runtime-error">{runtimeMessage}</p>
      ) : null}
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
    </section>
  );
}

export { LangSwitcher };
