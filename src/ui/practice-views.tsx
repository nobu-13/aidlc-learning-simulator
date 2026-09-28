// Practice views（Create / Review 体験・RC2 §11–§16）。
// UI は入力とレンダリングのみ。採点は domain の practice-rubric（決定的）に委譲する。
import { useState } from "react";
import type { AppApi } from "../app/use-app-state.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";
import type { DimensionId } from "../domain/entities.ts";
import { getPractice } from "../domain/practice/practice-catalog.ts";
import { getPracticeProvenance } from "../domain/practice/practice-provenance.ts";
import type {
  ChangeControlResponse,
  ClassificationBucket,
  EvidenceClassification,
  Practice,
  RequirementFieldId,
} from "../domain/practice/practice-entities.ts";
import {
  evaluateChangeControl,
  evaluateClassification,
  evaluateEvidenceReview,
  evaluateRequirement,
  evaluateTraceability,
} from "../domain/practice/practice-rubric.ts";
import { ProvenanceBadge } from "./provenance-badge.tsx";

type T = I18nResolver["t"];

function RelatedDimensions(props: { ids: readonly DimensionId[]; t: T }): JSX.Element {
  const { ids, t } = props;
  return (
    <p className="muted related-dims">
      {t("practice.relatedDimensions")}: {ids.map((id) => t(`dimension.${id}`)).join(" · ")}
    </p>
  );
}

function PracticeProvenance(props: { refs: readonly string[]; t: T }): JSX.Element | null {
  const { refs, t } = props;
  const entries = refs.map((r) => getPracticeProvenance(r)).filter((e) => e !== undefined);
  if (entries.length === 0) return null;
  return (
    <div className="feedback-provenance">
      {entries.map((pv) =>
        pv === undefined ? null : (
          <ProvenanceBadge
            key={pv.provenanceId}
            category={pv.category}
            note={t(pv.noteKey)}
            {...(pv.reference !== undefined ? { reference: pv.reference } : {})}
            t={t}
          />
        ),
      )}
    </div>
  );
}

// ---------- Requirement Practice ----------

function RequirementPracticeView(props: {
  practice: Extract<Practice, { kind: "requirement" }>;
  t: T;
}): JSX.Element {
  const { practice, t } = props;
  const [values, setValues] = useState<Partial<Record<RequirementFieldId, string>>>({});
  const [evaluated, setEvaluated] = useState(false);
  const result = evaluated ? evaluateRequirement(practice, { values }) : null;

  return (
    <div>
      <p>{t(practice.summaryKey)}</p>
      <p className="muted">{t(practice.objectiveKey)}</p>
      {practice.notEvaluatedNoteKey !== undefined ? (
        <p className="not-evaluated" data-testid="not-evaluated">
          ⓘ {t(practice.notEvaluatedNoteKey)}
        </p>
      ) : null}
      <form onSubmit={(e) => e.preventDefault()}>
        {practice.fields.map((f) => (
          <div key={f.fieldId} className="form-field">
            <label htmlFor={`req-${f.fieldId}`}>
              {t(f.labelKey)}
              {f.required ? <span aria-hidden="true"> *</span> : null}
            </label>
            <textarea
              id={`req-${f.fieldId}`}
              data-testid={`req-${f.fieldId}`}
              rows={f.multiline ? 3 : 1}
              value={values[f.fieldId] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.fieldId]: e.target.value }))}
            />
          </div>
        ))}
      </form>
      <div className="action-row">
        <button className="primary" data-testid="practice-evaluate" onClick={() => setEvaluated(true)}>
          {t("practice.evaluate")}
        </button>
        <button
          data-testid="practice-reset"
          onClick={() => {
            setValues({});
            setEvaluated(false);
          }}
        >
          {t("practice.reset")}
        </button>
      </div>
      {result !== null ? (
        <div className="card practice-result" data-testid="practice-result" aria-live="polite">
          <p data-testid="req-all-satisfied">
            {result.allRequiredSatisfied ? "✔ " + t("practice.req.allSatisfied") : "▲ " + t("practice.req.notSatisfied")}
          </p>
          <p>
            {t("practice.req.completed")}:{" "}
            {result.completedRequiredFieldIds.map((id) => t(`practice.req.field.${id}`)).join(", ") || "—"}
          </p>
          <p data-testid="req-missing">
            {t("practice.req.missing")}:{" "}
            {result.missingRequiredFieldIds.map((id) => t(`practice.req.field.${id}`)).join(", ") || "—"}
          </p>
          <p data-testid="req-ac-count">
            {t("practice.req.acCount")}: {result.acceptanceCriteriaCount}
          </p>
          <RelatedDimensions ids={practice.relatedDimensionIds} t={t} />
          <PracticeProvenance refs={practice.provenanceRefs} t={t} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Evidence Review Practice ----------

function EvidenceReviewPracticeView(props: {
  practice: Extract<Practice, { kind: "evidence-review" }>;
  t: T;
}): JSX.Element {
  const { practice, t } = props;
  const [choices, setChoices] = useState<Record<string, EvidenceClassification>>({});
  const [evaluated, setEvaluated] = useState(false);
  const result = evaluated ? evaluateEvidenceReview(practice, { classifications: choices }) : null;
  const classes: readonly EvidenceClassification[] = ["sufficient", "insufficient", "missing-required"];

  return (
    <div>
      <p>{t(practice.summaryKey)}</p>
      <p className="muted">{t(practice.objectiveKey)}</p>
      <ul className="practice-items">
        {practice.items.map((item) => {
          const r = result?.items.find((x) => x.itemId === item.itemId);
          return (
            <li key={item.itemId} className="card practice-item" data-testid={`ev-item-${item.itemId}`}>
              <strong>{t(item.labelKey)}</strong>
              <p className="muted">{t(item.descriptionKey)}</p>
              <div className="chip-group" role="group" aria-label={t(item.labelKey)}>
                {classes.map((c) => (
                  <button
                    key={c}
                    className={`chip ${choices[item.itemId] === c ? "chip-selected" : ""}`}
                    aria-pressed={choices[item.itemId] === c}
                    data-testid={`ev-${item.itemId}-${c}`}
                    onClick={() => setChoices((s) => ({ ...s, [item.itemId]: c }))}
                  >
                    {t(`practice.ev.class.${c}`)}
                  </button>
                ))}
              </div>
              {r !== undefined ? (
                <div className={`practice-verdict ${r.correct ? "verdict-ok" : "verdict-ng"}`}>
                  <p data-testid={`ev-verdict-${item.itemId}`}>
                    {r.correct ? "✔ " + t("practice.result.correct") : "▲ " + t("practice.result.incorrect")}
                  </p>
                  <p>
                    {t("practice.expectedAnswer")}: {t(`practice.ev.class.${r.expected}`)}
                  </p>
                  <p>
                    {t("practice.why")}: {t(r.rationaleKey)}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="action-row">
        <button className="primary" data-testid="practice-evaluate" onClick={() => setEvaluated(true)}>
          {t("practice.evaluate")}
        </button>
        <button
          data-testid="practice-reset"
          onClick={() => {
            setChoices({});
            setEvaluated(false);
          }}
        >
          {t("practice.reset")}
        </button>
      </div>
      {result !== null ? (
        <div className="card practice-result" data-testid="practice-result" aria-live="polite">
          <p data-testid="ev-score">
            {t("practice.result.score")}: {result.correctCount} / {result.totalCount}
          </p>
          <RelatedDimensions ids={practice.relatedDimensionIds} t={t} />
          <PracticeProvenance refs={practice.provenanceRefs} t={t} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Classification Practice ----------

function ClassificationPracticeView(props: {
  practice: Extract<Practice, { kind: "classification" }>;
  t: T;
}): JSX.Element {
  const { practice, t } = props;
  const [assign, setAssign] = useState<Record<string, ClassificationBucket>>({});
  const [evaluated, setEvaluated] = useState(false);
  const result = evaluated ? evaluateClassification(practice, { assignments: assign }) : null;

  return (
    <div>
      <p>{t(practice.summaryKey)}</p>
      <p className="muted">{t(practice.objectiveKey)}</p>
      {practice.notEvaluatedNoteKey !== undefined ? (
        <p className="not-evaluated">ⓘ {t(practice.notEvaluatedNoteKey)}</p>
      ) : null}
      <ul className="practice-items">
        {practice.actions.map((a) => {
          const r = result?.actions.find((x) => x.actionId === a.actionId);
          return (
            <li key={a.actionId} className="card practice-item" data-testid={`cls-item-${a.actionId}`}>
              <strong>{t(a.labelKey)}</strong>
              <p className="muted">{t(a.contextKey)}</p>
              <div className="chip-group" role="group" aria-label={t(a.labelKey)}>
                {practice.buckets.map((b) => (
                  <button
                    key={b}
                    className={`chip ${assign[a.actionId] === b ? "chip-selected" : ""}`}
                    aria-pressed={assign[a.actionId] === b}
                    data-testid={`cls-${a.actionId}-${b}`}
                    onClick={() => setAssign((s) => ({ ...s, [a.actionId]: b }))}
                  >
                    {t(`practice.cls.bucket.${b}`)}
                  </button>
                ))}
              </div>
              {r !== undefined ? (
                <div className={`practice-verdict ${r.correct ? "verdict-ok" : "verdict-ng"}`}>
                  <p data-testid={`cls-verdict-${a.actionId}`}>
                    {r.correct ? "✔ " + t("practice.result.correct") : "▲ " + t("practice.result.incorrect")}
                  </p>
                  <p>
                    {t("practice.expectedAnswer")}: {t(`practice.cls.bucket.${r.expected}`)}
                  </p>
                  <p>
                    {t("practice.why")}: {t(r.rationaleKey)}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="action-row">
        <button className="primary" data-testid="practice-evaluate" onClick={() => setEvaluated(true)}>
          {t("practice.evaluate")}
        </button>
        <button
          data-testid="practice-reset"
          onClick={() => {
            setAssign({});
            setEvaluated(false);
          }}
        >
          {t("practice.reset")}
        </button>
      </div>
      {result !== null ? (
        <div className="card practice-result" data-testid="practice-result" aria-live="polite">
          <p data-testid="cls-score">
            {t("practice.result.score")}: {result.correctCount} / {result.totalCount}
          </p>
          <RelatedDimensions ids={practice.relatedDimensionIds} t={t} />
          <PracticeProvenance refs={practice.provenanceRefs} t={t} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Traceability Practice ----------

function TraceabilityPracticeView(props: {
  practice: Extract<Practice, { kind: "traceability" }>;
  t: T;
}): JSX.Element {
  const { practice, t } = props;
  const [judg, setJudg] = useState<Record<string, boolean>>({});
  const [evaluated, setEvaluated] = useState(false);
  const result = evaluated ? evaluateTraceability(practice, { completeJudgments: judg }) : null;

  return (
    <div>
      <p>{t(practice.summaryKey)}</p>
      <p className="muted">{t(practice.objectiveKey)}</p>
      <ul className="practice-items">
        {practice.chains.map((c) => {
          const r = result?.chains.find((x) => x.chainId === c.chainId);
          return (
            <li key={c.chainId} className="card practice-item" data-testid={`tr-item-${c.chainId}`}>
              <ol className="trace-chain">
                <li>
                  <span className="feedback-field-label">{t("practice.tr.link.requirement")}</span> {t(c.requirementKey)}
                </li>
                <li>
                  <span className="feedback-field-label">{t("practice.tr.link.acceptance")}</span>{" "}
                  {t(c.acceptanceCriterionKey)}
                </li>
                <li>
                  <span className="feedback-field-label">{t("practice.tr.link.implementation")}</span>{" "}
                  {t(c.implementationKey)}
                </li>
                <li>
                  <span className="feedback-field-label">{t("practice.tr.link.test")}</span> {t(c.testKey)}
                </li>
              </ol>
              <div className="chip-group" role="group" aria-label={c.chainId}>
                <button
                  className={`chip ${judg[c.chainId] === true ? "chip-selected" : ""}`}
                  aria-pressed={judg[c.chainId] === true}
                  data-testid={`tr-${c.chainId}-complete`}
                  onClick={() => setJudg((s) => ({ ...s, [c.chainId]: true }))}
                >
                  {t("practice.tr.judge.complete")}
                </button>
                <button
                  className={`chip ${judg[c.chainId] === false ? "chip-selected" : ""}`}
                  aria-pressed={judg[c.chainId] === false}
                  data-testid={`tr-${c.chainId}-incomplete`}
                  onClick={() => setJudg((s) => ({ ...s, [c.chainId]: false }))}
                >
                  {t("practice.tr.judge.incomplete")}
                </button>
              </div>
              {r !== undefined ? (
                <div className={`practice-verdict ${r.correct ? "verdict-ok" : "verdict-ng"}`}>
                  <p data-testid={`tr-verdict-${c.chainId}`}>
                    {r.correct ? "✔ " + t("practice.result.correct") : "▲ " + t("practice.result.incorrect")}
                  </p>
                  {r.missingLink !== undefined ? (
                    <p>
                      {t("practice.tr.missingLink")}: {t(`practice.tr.link.${r.missingLink}`)}
                    </p>
                  ) : null}
                  <p>
                    {t("practice.why")}: {t(r.rationaleKey)}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="action-row">
        <button className="primary" data-testid="practice-evaluate" onClick={() => setEvaluated(true)}>
          {t("practice.evaluate")}
        </button>
        <button
          data-testid="practice-reset"
          onClick={() => {
            setJudg({});
            setEvaluated(false);
          }}
        >
          {t("practice.reset")}
        </button>
      </div>
      {result !== null ? (
        <div className="card practice-result" data-testid="practice-result" aria-live="polite">
          <p data-testid="tr-score">
            {t("practice.result.score")}: {result.correctCount} / {result.totalCount}
          </p>
          <RelatedDimensions ids={practice.relatedDimensionIds} t={t} />
          <PracticeProvenance refs={practice.provenanceRefs} t={t} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Change Control Practice ----------

function ChangeControlPracticeView(props: {
  practice: Extract<Practice, { kind: "change-control" }>;
  t: T;
}): JSX.Element {
  const { practice, t } = props;
  const [resp, setResp] = useState<Record<string, ChangeControlResponse>>({});
  const [evaluated, setEvaluated] = useState(false);
  const result = evaluated ? evaluateChangeControl(practice, { responses: resp }) : null;

  return (
    <div>
      <p>{t(practice.summaryKey)}</p>
      <p className="muted">{t(practice.objectiveKey)}</p>
      <ul className="practice-items">
        {practice.cases.map((c) => {
          const r = result?.cases.find((x) => x.caseId === c.caseId);
          return (
            <li key={c.caseId} className="card practice-item" data-testid={`cc-item-${c.caseId}`}>
              <strong>{t(c.promptKey)}</strong>
              <p className="muted">{t(c.contextKey)}</p>
              <div className="chip-group" role="group" aria-label={t(c.promptKey)}>
                {c.options.map((o) => (
                  <button
                    key={o}
                    className={`chip ${resp[c.caseId] === o ? "chip-selected" : ""}`}
                    aria-pressed={resp[c.caseId] === o}
                    data-testid={`cc-${c.caseId}-${o}`}
                    onClick={() => setResp((s) => ({ ...s, [c.caseId]: o }))}
                  >
                    {t(`practice.cc.response.${o}`)}
                  </button>
                ))}
              </div>
              {r !== undefined ? (
                <div className={`practice-verdict ${r.correct ? "verdict-ok" : "verdict-ng"}`}>
                  <p data-testid={`cc-verdict-${c.caseId}`}>
                    {r.correct ? "✔ " + t("practice.result.correct") : "▲ " + t("practice.result.incorrect")}
                  </p>
                  <p>
                    {t("practice.expectedAnswer")}: {t(`practice.cc.response.${r.expected}`)}
                  </p>
                  <p>
                    {t("practice.why")}: {t(r.rationaleKey)}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="action-row">
        <button className="primary" data-testid="practice-evaluate" onClick={() => setEvaluated(true)}>
          {t("practice.evaluate")}
        </button>
        <button
          data-testid="practice-reset"
          onClick={() => {
            setResp({});
            setEvaluated(false);
          }}
        >
          {t("practice.reset")}
        </button>
      </div>
      {result !== null ? (
        <div className="card practice-result" data-testid="practice-result" aria-live="polite">
          <p data-testid="cc-score">
            {t("practice.result.score")}: {result.correctCount} / {result.totalCount}
          </p>
          <RelatedDimensions ids={practice.relatedDimensionIds} t={t} />
          <PracticeProvenance refs={practice.provenanceRefs} t={t} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Library + dispatcher ----------

import { PRACTICES } from "../domain/practice/practice-catalog.ts";

export function PracticeLibraryView(props: { app: AppApi; t: T }): JSX.Element {
  const { app, t } = props;
  return (
    <section aria-labelledby="plib-h">
      <h1 id="plib-h">{t("practice.nav.title")}</h1>
      <p>{t("practice.nav.desc")}</p>
      <ul className="options card-grid">
        {PRACTICES.map((p) => (
          <li key={p.practiceId}>
            <button
              className="library-card"
              data-testid={`practice-${p.practiceId}`}
              onClick={() => app.choosePractice(p.practiceId)}
            >
              <strong>{t(p.titleKey)}</strong>
              <span className="muted">{t(p.summaryKey)}</span>
              <span className="muted related-dims">
                {t("practice.relatedDimensions")}:{" "}
                {p.relatedDimensionIds.map((id) => t(`dimension.${id}`)).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PracticeView(props: { app: AppApi; t: T }): JSX.Element {
  const { app, t } = props;
  const practiceId = app.state.practiceId;
  const practice = practiceId !== undefined ? getPractice(practiceId) : undefined;
  if (practice === undefined) {
    return (
      <section aria-labelledby="perr-h" className="error" role="alert">
        <h1 id="perr-h">{t("error.title")}</h1>
      </section>
    );
  }
  return (
    <section aria-labelledby="practice-h">
      <h1 id="practice-h">{t(practice.titleKey)}</h1>
      <button data-testid="practice-back" onClick={() => app.goPracticeLibrary()}>
        ← {t("practice.back")}
      </button>
      {renderPractice(practice, t)}
    </section>
  );
}

function renderPractice(practice: Practice, t: T): JSX.Element {
  switch (practice.kind) {
    case "requirement":
      return <RequirementPracticeView practice={practice} t={t} />;
    case "evidence-review":
      return <EvidenceReviewPracticeView practice={practice} t={t} />;
    case "classification":
      return <ClassificationPracticeView practice={practice} t={t} />;
    case "traceability":
      return <TraceabilityPracticeView practice={practice} t={t} />;
    case "change-control":
      return <ChangeControlPracticeView practice={practice} t={t} />;
    default: {
      const _exhaustive: never = practice;
      return _exhaustive;
    }
  }
}
