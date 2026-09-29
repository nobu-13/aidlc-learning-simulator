// RC3 Journey views（presentation・domain と分離）。
// Guided / Simulation / Adoption の体験差は JourneyModePolicy を参照して表現する。
// domain logic は持たず、useJourneyState の API を呼ぶ。a11y: semantic HTML / aria-live / 一意 label。
import { useEffect, useMemo, useState } from "react";
import type { JourneyApi, ConditionalApprovalInput } from "../app/use-journey-state.ts";
import {
  CONDITION_DUE_GATES,
  type ConditionDueGate,
} from "../domain/journey/conditional-approval.ts";
import type { FeedbackItemViewModel } from "../domain/journey/feedback-viewmodel.ts";
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
  type StepConditionInput,
} from "../domain/journey/journey-entities.ts";
import type { ArtifactItemChange } from "../domain/journey/diff-engine.ts";
import { gateRequiresRework, gateIsBlocked } from "../domain/journey/gate-transition.ts";
import type { GateQuality } from "../domain/journey/review-evaluator.ts";
import { opaqueItemToken } from "../domain/semantic-id.ts";

type T = I18nResolver["t"];

const GATE_OPTIONS: readonly GateDecision[] = [
  "approve",
  "approve-with-conditions",
  "return-for-rework",
  "change-scope",
  "block",
];
const SEVERITIES: readonly Severity[] = ["low", "medium", "high"];

/** ContributionLevel を記号へ（Result / Completion summary 共通・補助表示）。 */
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

/** ContributionLevel を human-readable label へ（N4 P2-3）。symbol は補助。 */
function levelLabel(level: ContributionLevel, t: T): string {
  return t(`rc3.rating.${level}`);
}
const APPROVALS: readonly ApprovalDecision[] = ["approve", "approve-with-conditions", "return", "block"];

/**
 * UX-FT-001: Feedback learning event の traceability を「常に」全項目説明する（field を消さない）。
 * downstream / consequence が存在しないケースは human-readable な明示的 N/A を表示する。
 * false positive は false 用の Why / Consequence / Revisit 文言を使う。
 * Ground Truth semantics は変更しない（表示の正規化のみ）。
 */
function FeedbackTraceability(props: { vm: FeedbackItemViewModel; t: T; testPrefix: string }): JSX.Element {
  const { vm, t, testPrefix } = props;
  const isFalse = vm.resultType === "false";
  // affected/consequence の解決。missing のときは result type 別の明示的 N/A。
  const affectedText =
    vm.affectedLaterStepId !== undefined
      ? t(`rc3.journey.step.${vm.affectedLaterStepId}`)
      : t("rc3.trace.affected.na");
  const consequenceText =
    vm.consequenceKey !== undefined
      ? t(vm.consequenceKey)
      : isFalse
        ? t("rc3.trace.consequence.na.false")
        : t("rc3.trace.consequence.na.missed");
  const whyText =
    vm.whyItMattersKey !== undefined
      ? t(vm.whyItMattersKey)
      : isFalse
        ? t("rc3.trace.why.false")
        : t("rc3.trace.item"); // defect rationale が無い防御ケース（通常発生しない）
  const originText =
    vm.originStepId !== undefined ? t(`rc3.journey.step.${vm.originStepId}`) : t("rc3.trace.origin.na");

  return (
    <div className="trace-fields" data-testid={`${testPrefix}-trace`}>
      {vm.reviewerSeverity !== undefined ? (
        // RC4 Final: caught の場合、reviewer の判定を上書きせず、基準 severity と併記する。
        <div className="muted" data-testid={`${testPrefix}-trace-severity`}>
          <span data-testid={`${testPrefix}-trace-reviewer-severity`}>
            {t("rc4.trace.reviewerSeverity")}: {t(`rc3.sev.${vm.reviewerSeverity}`)}
          </span>
          {vm.groundTruthSeverity !== undefined ? (
            <span data-testid={`${testPrefix}-trace-groundtruth-severity`}>
              {" · "}
              {t("rc4.trace.groundTruthSeverity")}: {t(`rc3.sev.${vm.groundTruthSeverity}`)}
              {vm.severityMatches !== undefined
                ? ` (${vm.severityMatches ? t("rc4.trace.severity.match") : t("rc4.trace.severity.mismatch")})`
                : ""}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="muted" data-testid={`${testPrefix}-trace-severity`}>
          {t("rc3.trace.severity")}:{" "}
          {vm.severity !== undefined ? t(`rc3.sev.${vm.severity}`) : t("rc3.trace.severity.na")}
        </div>
      )}
      <div className="muted" data-testid={`${testPrefix}-trace-why`}>
        {t("rc3.trace.why")}: {whyText}
      </div>
      <div className="muted" data-testid={`${testPrefix}-trace-origin`}>
        {t("rc3.trace.origin")}: {originText}
      </div>
      <div className="muted" data-testid={`${testPrefix}-trace-affected`}>
        {t("rc3.trace.affected")}: {affectedText}
      </div>
      <div className="muted" data-testid={`${testPrefix}-trace-consequence`}>
        {t("rc3.trace.consequence")}: {consequenceText}
      </div>
    </div>
  );
}

/**
 * RC3 Journey の現在位置を示す Stepper（既存 lifecycle-stepper と同思想・RC3 専用）。
 *
 * STEP 3（Lifecycle status semantic）: 「レビュー済み（visited/reviewed）」と「通過（passed=Gate 承認済み）」と
 * 「要再作業（rework-required）」を混同しない。単なる next-step 到達を「品質的に完了」と表現しない。
 *  - passed        : completedStepIds に含む（Gate を Approve で通過）。
 *  - rework-required: current step かつ rework 履歴でこの step へ Return された（差し戻し中）。
 *  - reviewed      : review を submit 済みだが未通過（見たが承認していない）。
 *  - current       : 現在地。
 *  - upcoming      : 未到達。
 * ラベルは data-lifecycle 属性でも露出し、domain の内部 enum は出さない。
 */
function JourneyStepper(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const { progress, reviews } = journey.state;
  const current = progress.currentStepId;
  const passed = new Set(progress.completedStepIds);
  // この step へ Return された履歴があるか（差し戻し中の再作業対象）。
  const returnedTo = new Set(progress.reworkHistory.map((e) => e.toStepId));
  return (
    <nav className="stepper" aria-label={t("stepper.title")}>
      <ol className="stepper-list">
        {JOURNEY_STEP_IDS.map((id) => {
          // status: passed（通過）優先。それ以外は current / reviewed / upcoming。
          const isReworkRequired = id === current && returnedTo.has(id) && !passed.has(id);
          const status = passed.has(id)
            ? "completed"
            : id === current
              ? "current"
              : "upcoming";
          // lifecycle: 品質的意味（passed / rework-required / reviewed / visited）を別軸で提示。
          const lifecycle: "passed" | "rework-required" | "reviewed" | "none" = passed.has(id)
            ? "passed"
            : isReworkRequired
              ? "rework-required"
              : reviews[id] !== undefined
                ? "reviewed"
                : "none";
          const lifecycleLabel =
            lifecycle === "passed"
              ? t("rc4.reviewLabel.passed")
              : lifecycle === "rework-required"
                ? t("rc4.reviewLabel.rework-required")
                : lifecycle === "reviewed"
                  ? t("rc4.reviewLabel.reviewed")
                  : undefined;
          return (
            <li
              key={id}
              className={`stepper-item stepper-${status} stepper-lifecycle-${lifecycle}`}
              aria-current={id === current ? "step" : undefined}
              data-testid={`journey-step-${id}`}
              data-lifecycle={lifecycle}
            >
              <span className="stepper-status-label">{t(`stepper.status.${status}`)}</span>
              {lifecycleLabel !== undefined ? (
                <span className="stepper-lifecycle-label" data-testid={`journey-step-lifecycle-${id}`}>
                  {lifecycleLabel}
                </span>
              ) : null}
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

      {/* N6 P2-5: 完了済み journey は in-progress resume として扱わない。
          RC5 P2-E: Main Journey の状態は Gym とは独立に保持され、Home から常に結果へ戻れる。 */}
      {journey.state.journeyComplete ? (
        <div className="card continue-card" data-testid="journey-completed-card">
          <span className="main-journey-tag" data-testid="main-journey-tag">
            {t("rc5.home.mainJourney.title")}: {t("rc5.home.mainJourney.completed")}
          </span>
          <h2>{t("rc3.home.completed.title")}</h2>
          <p className="muted">{t("rc3.home.completed.desc")}</p>
          <button className="secondary" data-testid="journey-review-result" onClick={() => journey.resume()}>
            {t("rc5.home.mainJourney.viewResult")}
          </button>
        </div>
      ) : journey.state.resumable ? (
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
              <span className="mode-goal">{t("mode.guided.goal")}</span>
              <span className="mode-output muted">{t("mode.guided.output")}</span>
            </button>
          </li>
          <li>
            <button className="library-card" data-testid="journey-start-simulation" onClick={() => journey.startSimulation()}>
              <strong>{t("mode.simulation")}</strong>
              <span className="muted">{t("mode.simulation.desc")}</span>
              <span className="mode-goal">{t("mode.simulation.goal")}</span>
              <span className="mode-output muted">{t("mode.simulation.output")}</span>
            </button>
          </li>
          <li>
            <button className="library-card" data-testid="journey-start-adoption" onClick={() => journey.startAdoption()}>
              <strong>{t("mode.adoption-review")}</strong>
              <span className="muted">{t("mode.adoption-review.desc")}</span>
              <span className="mode-goal">{t("mode.adoption-review.goal")}</span>
              <span className="mode-output muted">{t("mode.adoption-review.output")}</span>
            </button>
          </li>
        </ul>
      </div>

      {/* N8 P2-7: Training Gym は secondary area であることを明示。 */}
      <div className="card gym-secondary" data-testid="gym-secondary-card">
        <h2>{t("rc3.gym.title")}</h2>
        <p className="muted">{t("rc3.gym.secondary")}</p>
        <button className="secondary" data-testid="to-gym" onClick={onExitToGym}>
          {t("rc3.gym.title")}
        </button>
      </div>
    </section>
  );
}

/**
 * RC5 P2-F: 現在の mode identity を明示する badge。
 * Simulation =「自力で判断する」/ Adoption Review =「自社導入を検討する」/ Guided =「手順に沿って学ぶ」。
 */
function ModeIdentityBadge(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const mode = journey.state.mode;
  return (
    <div className={`mode-identity mode-${mode}`} data-testid="mode-identity" data-mode={mode}>
      <span className="mode-badge" data-testid="mode-identity-badge">
        {t(`rc5.mode.${mode}.badge`)}
      </span>
      <span className="mode-tagline muted">{t(`rc5.mode.${mode}.tagline`)}</span>
    </div>
  );
}

export function JourneySetupView(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const s = journey.state;
  return (
    <section aria-labelledby="js-h" className="journey-setup">
      <h1 id="js-h">{t("rc3.setup.title")}</h1>
      {/* RC5 P2-F: setup で現在 mode を明示（Simulation / Adoption Review）。 */}
      <ModeIdentityBadge journey={journey} t={t} />
      {/* RC6 P2: Setup 冒頭で mode の目的を明示（Simulation=自力で判断 / Adoption=自社導入検討）。 */}
      {s.mode !== "guided" ? (
        <p className="mode-goal setup-mode-goal" data-testid="setup-mode-goal">
          {t(`mode.${s.mode}.goal`)}
        </p>
      ) : null}
      {/* RC6 P2: Adoption は「完走後に Gate Map / responsibilities / checklist / pilot actions を生成」を
          開始時点で提示する（何が得られるかを先に伝える）。 */}
      {s.mode === "adoption-review" ? (
        <p className="muted setup-adoption-output" role="note" data-testid="setup-adoption-output">
          {t("rc6.setup.adoption.output")}
        </p>
      ) : null}
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
  // G1/F7: current step の入力を hydration する。優先順位:
  //   1) 未 submit の下書き（reviewDrafts）で artifactId が一致するもの
  //   2) 確定済み review（reviews）で artifactId が一致するもの
  //   3) 空
  // artifactId をキーにするので、rework で revision が上がると（下書き/review とも clear されるため）空に戻る。
  const savedReview = journey.state.reviews[artifact.journeyStepId];
  const savedMatches = savedReview !== undefined && savedReview.artifactId === artifact.artifactId;
  const savedDraft = journey.state.reviewDrafts[artifact.journeyStepId];
  const draftMatches = savedDraft !== undefined && savedDraft.artifactId === artifact.artifactId;
  // hydration source: 下書き優先、なければ確定 review。
  const source =
    draftMatches && savedDraft !== undefined
      ? savedDraft
      : savedMatches && savedReview !== undefined
        ? savedReview
        : undefined;
  const initSelected = (): Record<string, Severity | undefined> => {
    if (source === undefined) return {};
    const out: Record<string, Severity | undefined> = {};
    for (const f of source.findings) out[f.itemId] = f.severity;
    return out;
  };
  const [selected, setSelected] = useState<Record<string, Severity | undefined>>(initSelected);
  const [gate, setGate] = useState<GateDecision>(source !== undefined ? source.gateDecision : "approve");
  const [note, setNote] = useState(source !== undefined ? (source.noteText ?? "") : "");
  // RC6 P1-A: step-level Approve with Conditions の構造化条件入力。
  const [condition, setCondition] = useState("");
  const [condEvidence, setCondEvidence] = useState("");
  const [condDueGate, setCondDueGate] = useState<ConditionDueGate>("before-release");

  // artifactId が変わったら（rework で revision 変化 / resume で別 step）hydration し直す。
  useEffect(() => {
    setSelected(initSelected());
    setGate(source !== undefined ? source.gateDecision : "approve");
    setNote(source !== undefined ? (source.noteText ?? "") : "");
    setCondition("");
    setCondEvidence("");
    setCondDueGate("before-release");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.artifactId]);

  // G1: 入力（finding / severity / gate / note）が変わるたびに未 submit 下書きを persist する。
  // 初回 hydration 直後の再書き込みは無害（同一値）。artifactId を必ず添えて誤 hydrate を防ぐ。
  useEffect(() => {
    const findings: ReviewFinding[] = Object.entries(selected).map(([itemId, severity]) =>
      severity !== undefined ? { itemId, severity } : { itemId },
    );
    journey.setReviewDraft({
      artifactId: artifact.artifactId,
      findings,
      gateDecision: gate,
      ...(note.trim().length > 0 ? { noteText: note } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, gate, note, artifact.artifactId]);

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

  // RC6 P1-A: approve-with-conditions を選んだら少なくとも 1 件の条件本文が必須。
  const conditionRequired = gate === "approve-with-conditions";
  const conditionValid = condition.trim().length > 0;
  const canSubmit = !conditionRequired || conditionValid;

  const submit = (): void => {
    if (!canSubmit) return;
    const findings: ReviewFinding[] = Object.entries(selected).map(([itemId, severity]) =>
      severity !== undefined ? { itemId, severity } : { itemId },
    );
    // RC6 P1-A: 条件付き承認なら構造化条件を review に載せる（submitReview が first-class 化する）。
    const conditions: StepConditionInput[] =
      conditionRequired && conditionValid
        ? [
            {
              condition: condition.trim(),
              ...(condEvidence.trim().length > 0 ? { requiredEvidence: condEvidence.trim() } : {}),
              dueGate: condDueGate,
            },
          ]
        : [];
    journey.submitReview({
      artifactId: artifact.artifactId,
      journeyStepId: artifact.journeyStepId,
      findings,
      gateDecision: gate,
      ...(note.trim().length > 0 ? { noteText: note } : {}),
      ...(conditions.length > 0 ? { conditions } : {}),
    });
  };

  // section ごとにグルーピング（J3 の functional-domain / nfr-architecture 等）。
  const sections = groupBySection(artifact.items);

  return (
    <section aria-labelledby="jr-h" className="journey-review">
      <JourneyStepper journey={journey} t={t} />
      {/* RC5 P2-F: review 中も現在 mode を明示。 */}
      <ModeIdentityBadge journey={journey} t={t} />
      <h1 id="jr-h">{t(artifact.titleKey)}</h1>
      <p className="muted">{t(artifact.summaryKey)}</p>

      <RevisionBanner journey={journey} stepId={artifact.journeyStepId} revision={artifact.revision} t={t} />

      {/* RC5 P1-C: resolved 済み項目のみを選んで Return した等、実 artifact 変化を生まない no-op
          Return を silent に受理せず、明示的に拒否したことを通知する（revision は増えない）。 */}
      {journey.state.reworkRejection !== undefined ? (
        <div className="card rework-rejected" role="alert" data-testid="rework-rejected">
          <h2>{t("rc5.rework.rejected.title")}</h2>
          <p>
            {journey.state.reworkRejection === "allResolved"
              ? t("rc5.rework.rejected.allResolved")
              : t("rc5.rework.rejected.noValidTarget")}
          </p>
          <button
            className="secondary"
            data-testid="rework-rejected-dismiss"
            onClick={() => journey.dismissReworkRejection()}
          >
            {t("rc5.rework.rejected.dismiss")}
          </button>
        </div>
      ) : null}

      {/* RC6 P1-B: 上流で確定した accepted fact（確定済みの可用性目標など）を前提として提示。 */}
      <AcceptedFactsCard artifact={artifact} t={t} testId="review-accepted-facts" />

      {/* RC5 P1-D: 前工程で条件付き承認した未解決条件を後続 review でも提示（下流へ引き継ぐ）。 */}
      <OpenConditionsCard journey={journey} t={t} testId="review-open-conditions" />

      {/* RC4 Phase 3: local Human Return → Agent Rework の Before/After（変更点）。 */}
      <LocalReworkDiffCard journey={journey} t={t} />
      {/* RC4 Phase 3: upstream defect resolution による downstream への影響（Before/After + 原因）。 */}
      <PropagationImpactCard journey={journey} t={t} />

      {Object.keys(artifact.quotedUserText).length > 0 ? (
        <div className="card quoted" data-testid="review-quoted">
          <h2>{t(journey.state.mode === "guided" ? "rc3.review.quoted.sample" : "rc3.review.quoted.user")}</h2>
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
                item.reviewability === "informational" &&
                (item.itemId.startsWith("data-classification-") ||
                  item.itemId.startsWith("workload-context-")) ? (
                  // RC6 P1-C / Parameter Sensitivity: structured 由来の文脈 grounding は
                  // 「顕在化した consequence」ではなく確定した文脈情報。専用表示にして
                  // worsened/improved の consequence 表示と混同させない。
                  <li
                    key={item.itemId}
                    className="review-item review-item-informational review-info-classification"
                    data-testid={`review-grounding-${item.itemId}`}
                    data-grounding="true"
                  >
                    <span className="info-badge">{t(item.labelKey)}</span>
                    <span className="muted">{t(item.bodyKey)}</span>
                  </li>
                ) : item.reviewability === "informational" ? (
                  // RC4 Integrity P1-3: informational 伝播 item は現在状態で表示を分岐する。
                  //  - improved（contentState=corrected）: 前工程修正で「解消」された影響（現在の問題ではない）。
                  //  - worsened（それ以外）: 前工程の見逃しがこの工程で「顕在化」（現在の問題）。
                  // 同一 item を「顕在化」文言で出しながら別所で「解消」表示する矛盾を排除する。
                  <li
                    key={item.itemId}
                    className={`review-item review-item-informational ${
                      item.contentState === "corrected" ? "review-info-improved" : "review-info-worsened"
                    }`}
                    data-testid={`review-info-${item.itemId}`}
                    data-impact={item.contentState === "corrected" ? "improved" : "worsened"}
                  >
                    <span className="info-badge">
                      {item.contentState === "corrected"
                        ? t("rc4.prop.improved.badge")
                        : t("rc3.consequence.label")}
                    </span>
                    <span>
                      <span className="muted">{t(item.bodyKey)}</span>
                    </span>
                    {item.originStepId !== undefined ? (
                      <span className="consequence-origin" data-testid={`review-info-origin-${item.itemId}`}>
                        {t("rc3.consequence.origin")}: {t(`rc3.journey.step.${item.originStepId}`)}
                      </span>
                    ) : null}
                    <span className="muted consequence-cause">
                      {item.contentState === "corrected"
                        ? t("rc4.prop.improved.cause")
                        : t("rc3.consequence.cause")}
                    </span>
                    {/* STEP 7: この工程 Gate への影響を human-readable に明示する。
                        worsened（未解決の上流見逃しがここで顕在化）= 上流で解決すべき。
                        improved（上流修正で解消）= 観察のみ。 */}
                    <span
                      className="muted consequence-gate-impact"
                      data-testid={`review-info-gate-impact-${item.itemId}`}
                      data-gate-impact={item.contentState === "corrected" ? "observation" : "upstream"}
                    >
                      {t("rc4.prop.gateImpact.label")}:{" "}
                      {item.contentState === "corrected"
                        ? t("rc4.prop.gateImpact.observation")
                        : t("rc4.prop.gateImpact.upstream")}
                    </span>
                  </li>
                ) : (
                // RC5 P1-B: cross-input robustness。
                //  - checkbox の <input> は <label> の兄弟にし、二重関連（htmlFor + 内包）を排除。
                //    内包 + htmlFor の二重関連は一部ブラウザで click が二重発火し「toggle が別項目/解除不能」に見える。
                //  - severity radio は独立の role="radiogroup" として checkbox の兄弟に置き、
                //    各 radio に id + <label htmlFor> を付与（containment 依存をやめる）。
                //  - checkbox click と radio click を同一 container handler で処理しない（各 input の onChange のみ）。
                (() => {
                  // RC6 P2: DOM 識別子は answer semantic を含まない opaque token を使う
                  // （slotId をそのまま出すと -omission/-distractor/-valid... で答えが漏れる）。
                  const tok = opaqueItemToken(item.itemId);
                  return (
                <li key={item.itemId} className="review-item">
                 <div role="group" aria-labelledby={`review-label-${tok}`}>
                  <div className="review-item-head">
                    <input
                      id={`review-cb-${tok}`}
                      type="checkbox"
                      className="review-item-checkbox"
                      data-testid={`review-item-${tok}`}
                      checked={item.itemId in selected}
                      onChange={() => toggle(item.itemId)}
                    />
                    <label htmlFor={`review-cb-${tok}`} id={`review-label-${tok}`}>
                      <strong>{t(item.labelKey)}</strong>
                      {item.contentState === "partial" ? (
                        <span className="partial-badge" data-testid={`partial-badge-${tok}`}>
                          {t("rc4.partial.badge")}
                        </span>
                      ) : item.contentState === "corrected" ? (
                        <span className="resolved-badge" data-testid={`resolved-badge-${tok}`}>
                          {t("rc4.resolved.badge")}
                        </span>
                      ) : null}
                      <span className="muted"> — {t(item.bodyKey)}</span>
                    </label>
                  </div>
                  {item.contentState === "partial" ? (
                    <div className="partial-detail" data-testid={`partial-detail-${tok}`}>
                      {item.remainingIssueKey !== undefined ? (
                        <p>
                          <strong>{t("rc4.partial.remaining")}:</strong> {t(item.remainingIssueKey)}
                        </p>
                      ) : null}
                      {item.whyInsufficientKey !== undefined ? (
                        <p className="muted">
                          <strong>{t("rc4.partial.why")}:</strong> {t(item.whyInsufficientKey)}
                        </p>
                      ) : null}
                      <p className="muted">{t("rc4.partial.hint")}</p>
                    </div>
                  ) : null}
                  {item.itemId in selected ? (
                    <fieldset
                      className="severity-picker"
                      data-testid={`severity-picker-${tok}`}
                    >
                      <legend className="muted">{t("rc3.review.severity")}:</legend>
                      {SEVERITIES.map((sev) => (
                        <span key={sev} className="chip">
                          <input
                            id={`review-sev-${tok}-${sev}`}
                            type="radio"
                            name={`sev-${tok}`}
                            data-testid={`review-sev-${tok}-${sev}`}
                            checked={selected[item.itemId] === sev}
                            onChange={() => setSev(item.itemId, sev)}
                          />
                          <label htmlFor={`review-sev-${tok}-${sev}`}>
                            {t(`rc3.sev.${sev}`)}
                          </label>
                        </span>
                      ))}
                    </fieldset>
                  ) : null}
                 </div>
                </li>
                  );
                })()),
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

      {/* RC6 P1-A: step-level の Approve with Conditions では構造化条件（condition/evidence/dueGate）を
          必ず入力させる。この条件は下流 review / Completion / Release / Result まで消えずに引き継がれる。 */}
      {conditionRequired ? (
        <div className="card conditional-form" data-testid="review-conditional-form">
          <h2>{t("rc5.cond.title")}</h2>
          <p className="muted">{t("rc6.cond.step.desc")}</p>
          <div className="field">
            <label htmlFor="review-cond-condition">{t("rc5.cond.condition")}</label>
            <textarea
              id="review-cond-condition"
              data-testid="review-cond-condition"
              value={condition}
              placeholder={t("rc5.cond.condition.placeholder")}
              onChange={(e) => setCondition(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="review-cond-evidence">{t("rc5.cond.evidence")}</label>
            <textarea
              id="review-cond-evidence"
              data-testid="review-cond-evidence"
              value={condEvidence}
              placeholder={t("rc5.cond.evidence.placeholder")}
              onChange={(e) => setCondEvidence(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="review-cond-duegate">{t("rc5.cond.dueGate")}</label>
            <select
              id="review-cond-duegate"
              data-testid="review-cond-duegate"
              value={condDueGate}
              onChange={(e) => setCondDueGate(e.target.value as ConditionDueGate)}
            >
              {CONDITION_DUE_GATES.map((g) => (
                <option key={g} value={g}>
                  {t(`rc5.cond.dueGate.${g}`)}
                </option>
              ))}
            </select>
          </div>
          {!conditionValid ? (
            <p className="muted" role="note" data-testid="review-cond-empty">
              {t("rc5.cond.none")}
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="field">
        <span>{t("rc3.review.note")}</span>
        <textarea
          data-testid="review-note"
          aria-label={t("rc3.review.note")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <button
        className="primary"
        data-testid="review-submit"
        disabled={!canSubmit}
        onClick={submit}
      >
        {t("rc3.review.submit")}
      </button>
    </section>
  );
}

/**
 * RC5 P2-A: gate 決定別 verdict 文言を返す。
 * judgeGateQuality が実際に出しうる (gate, quality) の組合せだけ gate 固有 key を持ち、
 * それ以外（起こりえない組合せ）は汎用 rc3.fb.gate.* へ fallback する（missing key を出さない）。
 */
function gateVerdictText(gate: GateDecision, quality: GateQuality, t: T): string {
  const specific: Partial<Record<GateDecision, ReadonlySet<GateQuality>>> = {
    approve: new Set<GateQuality>(["sound", "too-lenient", "acknowledged-risk"]),
    "approve-with-conditions": new Set<GateQuality>(["sound", "too-lenient", "acknowledged-risk"]),
    "return-for-rework": new Set<GateQuality>(["sound", "too-strict"]),
    "change-scope": new Set<GateQuality>(["sound", "too-strict"]),
    block: new Set<GateQuality>(["sound", "too-strict"]),
  };
  if (specific[gate]?.has(quality) === true) {
    return t(`rc5.gate.verdict.${gate}.${quality}`);
  }
  return t(`rc3.fb.gate.${quality}`);
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

  // P1-1 H2/H4: human-readable view model（internal ID を出さない）。
  const vm = journey.feedbackViewModel();
  const caught = vm?.caught ?? [];
  const missed = vm?.missed ?? [];
  const falseFlags = vm?.falsePositives ?? [];
  // P1-3/P1-4: must-fix は hook が判定した state.mustFix（high 見逃し + too-lenient + Simulation）を使う。
  const mustFix = journey.state.mustFix;
  const noIssues = ev.metrics.defectCount === 0 && caught.length === 0 && falseFlags.length === 0;

  return (
    <section aria-labelledby="jf-h" className="journey-feedback">
      <h1 id="jf-h">{t("scenario.feedback.title")}</h1>

      {noIssues ? (
        <p className="feedback-clean" data-testid="feedback-clean">
          {t("rc3.fb.noDefectHere")}
        </p>
      ) : null}

      {/* P3 N10: 空 section は出さない（caught があるときだけ表示）。 */}
      {caught.length > 0 ? (
        <div className="card">
          <h2>{t("rc3.fb.caught")}</h2>
          <ul data-testid="feedback-caught">
            {caught.map((f, i) => (
              <li key={`c-${i}`}>
                <strong>{t(f.itemTitleKey)}</strong>
                {/* RC4 Final: caught は「あなたの判定」を主表示（基準と相違でも上書きしない）。 */}
                {f.reviewerSeverity !== undefined ? (
                  <span className="muted">
                    {" — "}
                    {t("rc4.trace.reviewerSeverity")}: {t(`rc3.sev.${f.reviewerSeverity}`)}
                    {f.groundTruthSeverity !== undefined && f.severityMatches === false
                      ? ` · ${t("rc4.trace.groundTruthSeverity")}: ${t(`rc3.sev.${f.groundTruthSeverity}`)}`
                      : ""}
                  </span>
                ) : f.severity !== undefined ? (
                  <span className="muted"> — {t("rc3.review.severity")}: {t(`rc3.sev.${f.severity}`)}</span>
                ) : null}
                {f.whyItMattersKey !== undefined ? (
                  <div className="muted">
                    {t("rc3.fb.whyMatters")}: {t(f.whyItMattersKey)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {missed.length > 0 ? (
        <div className="card">
          <h2>{t("rc3.fb.missed")}</h2>
          <ul data-testid="feedback-missed">
            {missed.map((f, i) => (
              <li key={`m-${i}`}>
                <strong>{t(f.itemTitleKey)}</strong>
                <div className="muted">{t(f.itemBodyKey)}</div>
                {/* UX-FT-001: 全 traceability を常に表示（field 消失なし・明示的 N/A）。 */}
                <FeedbackTraceability vm={f} t={t} testPrefix={`feedback-missed-${i}`} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {falseFlags.length > 0 ? (
        <div className="card">
          <h2>{t("rc3.fb.false")}</h2>
          <ul data-testid="feedback-false">
            {falseFlags.map((f, i) => (
              <li key={`f-${i}`}>
                <strong>{t(f.itemTitleKey)}</strong>
                <div className="muted">{t(f.itemBodyKey)}</div>
                {/* UX-FT-001: false positive も「なぜ FP か / どこで判断 / downstream 該当有無」を常に説明。 */}
                <FeedbackTraceability vm={f} t={t} testPrefix={`feedback-false-${i}`} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* RC5 P2-A: gate 決定別の verdict copy。Approve / Return / Block / Change Scope / Conditional を
          同じ bucket にまとめず、gate 決定に応じた文言を出す。未定義の組合せは汎用文言へ fallback。 */}
      <p
        className={`gate-quality gate-${ev.gateQuality}`}
        role="status"
        aria-live="polite"
        data-testid="feedback-gate-quality"
        data-gate-decision={ev.gateDecision}
        data-gate-quality={ev.gateQuality}
      >
        {gateVerdictText(ev.gateDecision, ev.gateQuality, t)}
      </p>

      {/* RC5 P2-B: 既知欠陥を認識して Approve（caught>0 かつ approve 系）した場合、
          「Sound」ではなく「リスクを認識した上で進行した／リスクは下流へ残る」と伝える。 */}
      {(ev.gateDecision === "approve" || ev.gateDecision === "approve-with-conditions") &&
      caught.length > 0 ? (
        <p className="gate-known-defect" role="note" data-testid="feedback-known-defect">
          {t("rc5.fb.knownDefectApproved")}
        </p>
      ) : null}

      {/* P1-2 H5: consequence は fail-closed。heading だけの空カードは出さない。 */}
      {(policy.showWouldHaveConsequence || policy.explainConsequence) && missed.length > 0 ? (
        <div
          className={`card ${policy.showWouldHaveConsequence ? "would-have" : "explain-consequence"}`}
          data-testid={policy.showWouldHaveConsequence ? "feedback-would-have" : "feedback-explain"}
        >
          <h2>{t("rc3.fb.wouldHave")}</h2>
          <ul>
            {missed.map((f, i) => (
              <li key={`cons-${i}`}>
                <strong>{t(f.itemTitleKey)}</strong>
                {/* F5: 実際に後工程で何が起きるか（consequenceKey）。無い場合は body で fail-closed。 */}
                <div>
                  <strong>{t("rc3.fb.whatHappens")}:</strong>{" "}
                  {f.consequenceKey !== undefined ? t(f.consequenceKey) : t(f.itemBodyKey)}
                </div>
                {f.whyItMattersKey !== undefined ? (
                  <div className="muted">
                    {t("rc3.result.causal.why")}: {t(f.whyItMattersKey)}
                  </div>
                ) : null}
                {f.originStepId !== undefined ? (
                  <div className="muted">
                    {t("rc3.consequence.origin")}: {t(`rc3.journey.step.${f.originStepId}`)}
                  </div>
                ) : null}
                {f.affectedLaterStepId !== undefined ? (
                  <div className="muted">
                    {t("rc3.fb.affectedStep")}: {t(`rc3.journey.step.${f.affectedLaterStepId}`)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
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
      ) : gateRequiresRework(ev.gateDecision) ? (
        // P1-2（Gate Decision must constrain transitions）: Human が Return for Rework / Change Scope を
        // 選んだら、その決定を Product が無視して「次の工程へ」進めてはいけない。next CTA は出さず
        // Rework（差し戻し → Agent 修正 → 同一工程の再レビュー）だけを許す。domain guard（proceedAfterFeedback）
        // でも二重に拒否している（UI 条件だけに依存しない）。
        <div className="card must-fix" role="alert" data-testid="feedback-return-required">
          <p>{t("rc3.fb.returnRequired")}</p>
          {/* RC Micro-Fix #2: Return を選んだが finding を 1 つも指摘していない場合、差し戻しても
              修正対象が無く改訂されない（no-op）。この事実を明示し、指摘してから差し戻すよう促す。
              これが無いと partial（改善済み・未完了）item を再指摘せず Return して Revision が進まない罠になる。 */}
          {ev.caughtItemIds.length === 0 && ev.metrics.defectCount > 0 ? (
            <p className="muted" data-testid="feedback-return-noop-warning">
              {t("rc3.fb.returnNoTarget")}
            </p>
          ) : null}
          <button
            className="primary"
            data-testid="feedback-rework"
            onClick={() =>
              journey.reworkTo(
                journey.state.progress.currentStepId,
                ev.gateDecision === "change-scope" ? "scope-changed" : "critical-finding",
              )
            }
          >
            {t("rc3.fb.rework")}
          </button>
        </div>
      ) : gateIsBlocked(ev.gateDecision) ? (
        // P1-2: Block も次工程へ進めない。ブロック状態を明示し、再レビュー（差し戻し）のみを許す。
        <div className="card must-fix" role="alert" data-testid="feedback-blocked">
          <p>{t("rc3.fb.blocked")}</p>
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
          {/*
            Approve 系（gate が advance を許す）のときだけ next を出す。
            Guided は assistedRework=true で optional な差し戻し練習導線も併記する。
          */}
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

/**
 * RC4 Integrity（STEP 4）: Completion / Release / Result 共通の判断材料カード（single derived model）。
 * decisionReadiness() を唯一のソースにするので、Completion と Release で件数・severity が変わらない（P1-3）。
 * severity level に応じて data-severity を出し、a11y も維持する。
 */
function DecisionReadinessCard(props: {
  journey: JourneyApi;
  t: T;
  showReleaseImpact?: boolean;
  testId?: string;
}): JSX.Element {
  const { journey, t, showReleaseImpact = false, testId = "readiness-summary" } = props;
  const r = useMemo(() => journey.decisionReadiness(), [journey]);
  const completionLabel =
    r.completionDecision !== undefined
      ? t(`rc3.${r.completionDecision}`)
      : t("rc4.readiness.completionDecision.none");
  const highestSeverityLabel =
    r.highestSeverity === "none"
      ? t("rc4.readiness.highestSeverity.none")
      : t(`rc3.sev.${r.highestSeverity}`);
  return (
    <div className="card readiness-summary" data-testid={testId} data-highest-severity={r.highestSeverity}>
      <h2>{t("rc4.readiness.title")}</h2>
      <p className="muted">{t("rc4.readiness.desc")}</p>
      <ul>
        <li data-testid={`${testId}-completion-decision`}>
          {t("rc4.readiness.completionDecision")}: {completionLabel}
          {r.isConditionalCompletion ? (
            <span className="conditional-note" data-testid={`${testId}-conditional`}>
              {" "}
              — {t("rc4.readiness.conditional")}
            </span>
          ) : null}
        </li>
        {/* RC5 P2-D: Evidence 十分の一語で束ねず、artifact / traceability / assurance を分離表示。 */}
        <li data-testid={`${testId}-evidence`}>
          {t("rc5.evidence.artifact.label")}: {t(`rc5.evidence.artifact.${r.evidenceArtifactStatus}`)}
        </li>
        <li data-testid={`${testId}-traceability`}>
          {t("rc5.evidence.traceability.label")}: {t(`rc5.evidence.traceability.${r.traceabilityStatus}`)}
        </li>
        <li data-testid={`${testId}-assurance`} data-assurance={r.endToEndAssurance}>
          {t("rc5.evidence.assurance.label")}: {t(`rc5.evidence.assurance.${r.endToEndAssurance}`)}
        </li>
        <li data-testid={`${testId}-unresolved`}>
          {t("rc4.readiness.unresolved")}: {r.unresolvedFindingCount}
        </li>
        <li data-testid={`${testId}-highest-severity`}>
          {t("rc4.readiness.highestSeverity")}: {highestSeverityLabel}
        </li>
        <li data-testid={`${testId}-residual-risk`}>
          {t("rc4.readiness.residualRisk")}: {levelLabel(r.remainingRisksLevel, t)}{" "}
          <span aria-hidden="true" className="muted">
            ({levelSymbolOf(r.remainingRisksLevel)})
          </span>
        </li>
        <li data-testid={`${testId}-reviewed-steps`}>
          {t("rc4.readiness.reviewedSteps")}: {r.completedReviewStepCount} / {r.totalReviewStepCount}
        </li>
        {/* RC5 P1-D: 未解決の承認条件を readiness の一部として提示（Completion/Release/Result 共通）。 */}
        <li data-testid={`${testId}-open-conditions`}>
          {t("rc5.cond.openConditions")}: {r.openConditions.length}
        </li>
        {/* RC6 Parameter Sensitivity: 承認体制・リリース影響・可逆性を判断材料へ反映（observable）。 */}
        <li data-testid={`${testId}-approval-regime`}>
          {t("rc6.readiness.approvalRequirement.label")}:{" "}
          {t(`rc6.readiness.approvalRequirement.${r.approvalRegime}`)}
        </li>
        <li data-testid={`${testId}-release-impact-level`}>
          {t("rc6.readiness.releaseImpact.label")}: {t(`rc6.readiness.releaseImpact.${r.releaseImpactLevel}`)}
        </li>
        <li data-testid={`${testId}-reversibility`}>
          {t("rc6.readiness.reversibility.label")}: {t(`rc6.readiness.reversibility.${r.reversibilityLevel}`)}
        </li>
      </ul>

      {/* RC6: 承認体制がリリース影響に見合わない場合の注意。 */}
      {r.approvalRegimeGap ? (
        <p className="muted readiness-approval-gap" role="note" data-testid={`${testId}-approval-gap`}>
          {t("rc6.readiness.approvalGap")}
        </p>
      ) : null}
      {/* RC6: 戻せない変更の注意。 */}
      {r.irreversible ? (
        <p className="muted readiness-irreversible" role="note" data-testid={`${testId}-irreversible`}>
          {t("rc6.readiness.irreversibleNote")}
        </p>
      ) : null}

      <div className="residual-risks" data-testid={`${testId}-residual-list`}>
        <h3>{t("rc4.readiness.residualRisks.title")}</h3>
        {r.residualRisks.length === 0 ? (
          <p className="muted" data-testid={`${testId}-residual-none`}>
            {t("rc4.readiness.residualRisks.none")}
          </p>
        ) : (
          <ul>
            {r.residualRisks.map((risk, i) => (
              <li key={`${risk.manifestItemKey}-${i}`} data-testid={`${testId}-residual-${i}`}>
                {t(risk.manifestItemKey)}
                <span className="muted">
                  {" "}
                  — {t("rc4.readiness.origin")}: {t(`rc3.journey.step.${risk.originStepId}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showReleaseImpact ? (
        <p className="muted release-impact" role="note" data-testid={`${testId}-release-impact`}>
          <strong>{t("rc4.readiness.releaseImpact")}:</strong> {t("rc4.readiness.releaseImpact.body")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * RC5 P1-D: Conditional Approval の構造化入力フォーム。
 * approve-with-conditions を選んだときだけ現れ、condition/evidence/dueGate を構造化入力させる。
 * 少なくとも 1 件の condition が無いと承認できない（free-text memo とは別扱い）。
 */
function ConditionalApprovalForm(props: {
  t: T;
  testPrefix: string;
  onConfirm: (conditions: readonly ConditionalApprovalInput[]) => void;
  onCancel: () => void;
}): JSX.Element {
  const { t, testPrefix, onConfirm, onCancel } = props;
  const [condition, setCondition] = useState("");
  const [evidence, setEvidence] = useState("");
  const [dueGate, setDueGate] = useState<ConditionDueGate>("before-release");
  const valid = condition.trim().length > 0;
  return (
    <div className="card conditional-form" data-testid={`${testPrefix}-conditional-form`}>
      <h3>{t("rc5.cond.title")}</h3>
      <p className="muted">{t("rc5.cond.desc")}</p>

      <div className="field">
        <label htmlFor={`${testPrefix}-cond-condition`}>{t("rc5.cond.condition")}</label>
        <textarea
          id={`${testPrefix}-cond-condition`}
          data-testid={`${testPrefix}-cond-condition`}
          value={condition}
          placeholder={t("rc5.cond.condition.placeholder")}
          onChange={(e) => setCondition(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${testPrefix}-cond-evidence`}>{t("rc5.cond.evidence")}</label>
        <textarea
          id={`${testPrefix}-cond-evidence`}
          data-testid={`${testPrefix}-cond-evidence`}
          value={evidence}
          placeholder={t("rc5.cond.evidence.placeholder")}
          onChange={(e) => setEvidence(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${testPrefix}-cond-duegate`}>{t("rc5.cond.dueGate")}</label>
        <select
          id={`${testPrefix}-cond-duegate`}
          data-testid={`${testPrefix}-cond-duegate`}
          value={dueGate}
          onChange={(e) => setDueGate(e.target.value as ConditionDueGate)}
        >
          {CONDITION_DUE_GATES.map((g) => (
            <option key={g} value={g}>
              {t(`rc5.cond.dueGate.${g}`)}
            </option>
          ))}
        </select>
      </div>

      {!valid ? (
        <p className="muted" role="note" data-testid={`${testPrefix}-cond-empty`}>
          {t("rc5.cond.none")}
        </p>
      ) : null}

      <div className="approval-actions">
        <button
          className="primary"
          disabled={!valid}
          data-testid={`${testPrefix}-cond-confirm`}
          onClick={() =>
            onConfirm([
              {
                condition: condition.trim(),
                ...(evidence.trim().length > 0 ? { requiredEvidence: evidence.trim() } : {}),
                dueGate,
              },
            ])
          }
        >
          {t("rc5.cond.add")}
        </button>
        <button
          className="secondary"
          data-testid={`${testPrefix}-cond-cancel`}
          onClick={onCancel}
        >
          {t("rc5.rework.rejected.dismiss")}
        </button>
      </div>
    </div>
  );
}

/**
 * RC5 P1-D: 承認アクション群（approve / approve-with-conditions / return / block）。
 * approve-with-conditions を選ぶと ConditionalApprovalForm を挟み、構造化条件を収集してから確定する。
 */
function ApprovalActions(props: {
  t: T;
  testPrefix: string;
  onDecide: (decision: ApprovalDecision, conditions?: readonly ConditionalApprovalInput[]) => void;
}): JSX.Element {
  const { t, testPrefix, onDecide } = props;
  const [collectingConditions, setCollectingConditions] = useState(false);
  if (collectingConditions) {
    return (
      <ConditionalApprovalForm
        t={t}
        testPrefix={testPrefix}
        onConfirm={(conds) => {
          setCollectingConditions(false);
          onDecide("approve-with-conditions", conds);
        }}
        onCancel={() => setCollectingConditions(false)}
      />
    );
  }
  return (
    <div className="approval-actions">
      {APPROVALS.map((d) => (
        <button
          key={d}
          className={d === "approve" ? "primary" : "secondary"}
          data-testid={`${testPrefix}-${d}`}
          onClick={() => {
            if (d === "approve-with-conditions") setCollectingConditions(true);
            else onDecide(d);
          }}
        >
          {t(`rc3.${d}`)}
        </button>
      ))}
    </div>
  );
}

/**
 * RC6 P1-B: 上流で確定した accepted fact（例：確定済みの可用性目標 RTO/RPO）を「確定済み前提」として提示する。
 * この工程は値の有無を問い直さず、設計・検証が目標を満たすかを評価する、という枠組みを明示する。
 */
function AcceptedFactsCard(props: { artifact: { acceptedFacts: readonly { factId: string; sourceStepId: JourneyStepId; labelKey: string; valueLabelKey: string; statementKey: string }[] }; t: T; testId?: string }): JSX.Element | null {
  const { artifact, t, testId = "accepted-facts" } = props;
  const facts = artifact.acceptedFacts;
  if (facts.length === 0) return null;
  return (
    <div className="card accepted-facts" role="note" data-testid={testId}>
      <h2>{t("rc6.fact.title")}</h2>
      <p className="muted">{t("rc6.fact.desc")}</p>
      <ul>
        {facts.map((f, i) => (
          <li key={f.factId} data-testid={`${testId}-item-${i}`} data-fact-id={f.factId}>
            <strong>{t(f.labelKey)}:</strong> {t(f.valueLabelKey)}
            <span className="muted">
              {" "}
              — {t("rc6.fact.sourceStep")}: {t(`rc3.journey.step.${f.sourceStepId}`)}
            </span>
            <div className="muted">{t(f.statementKey)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * RC5 P1-D: 未解決の承認条件（open conditions）を表示するカード。
 * 下流 review step / Completion / Release / Result で「前工程からの未解決条件」を消さずに提示する。
 */
function OpenConditionsCard(props: { journey: JourneyApi; t: T; testId?: string }): JSX.Element | null {
  const { journey, t, testId = "open-conditions" } = props;
  const conditions = journey.openConditions();
  if (conditions.length === 0) return null;
  return (
    <div className="card open-conditions" role="note" data-testid={testId}>
      <h2>{t("rc5.cond.downstream.title")}</h2>
      <p className="muted">{t("rc5.cond.downstream.desc")}</p>
      <ul>
        {conditions.map((c, i) => (
          <li key={`${c.sourceStepId}-${i}`} data-testid={`${testId}-item-${i}`}>
            <strong>{c.condition}</strong>
            <span className="muted">
              {" "}
              — {t("rc5.cond.sourceStep")}: {t(`rc3.journey.step.${c.sourceStepId}`)}
            </span>
            {c.requiredEvidence !== undefined ? (
              <div className="muted" data-testid={`${testId}-evidence-${i}`}>
                {t("rc5.cond.evidence")}: {c.requiredEvidence}
              </div>
            ) : null}
            <div className="muted">
              {t("rc5.cond.dueGate")}: {t(`rc5.cond.dueGate.${c.dueGate}`)}
              {" · "}
              {t("rc5.cond.status.open")}
            </div>
            {c.highestSeverity === "high" ? (
              <div className="cond-high-risk" data-testid={`${testId}-highrisk-${i}`}>
                {t("rc5.cond.highRisk.note")}
              </div>
            ) : null}
            <div className="muted cond-gate-impact">
              {t("rc5.cond.gateImpact")}: {t("rc5.cond.gateImpact.body")}
            </div>
          </li>
        ))}
      </ul>
    </div>
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

      {/* P2-4: Completion 判断材料（既存・後方互換の testid 維持）。 */}
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
            {t("rc3.completion.summary.remainingRisk")}: {levelLabel(summary.remainingRisksLevel, t)}{" "}
            <span aria-hidden="true" className="muted">({levelSymbolOf(summary.remainingRisksLevel)})</span>
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

      {/* P1-3: Completion / Release / Result で同じ derived model を共有する。Completion 画面で
          highest severity / residual risk 内訳 / origin も見せておき、Release で消えないことを保証する。 */}
      <DecisionReadinessCard journey={journey} t={t} testId="completion-readiness" />

      {/* RC5 P1-D: 前工程からの未解決条件を Completion でも消さず提示。 */}
      <OpenConditionsCard journey={journey} t={t} testId="completion-open-conditions" />

      <ApprovalActions
        t={t}
        testPrefix="completion"
        onDecide={(d, conds) => journey.decideCompletion(d, conds)}
      />
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

      {/* P1-3（Release Decision Context Preservation）: Completion 画面で見た判断材料を Release でも
          必ず提示する。ユーザーが直前の画面を記憶しなくても Release 判断できるように、同じ derived model
          （decisionReadiness）から Evidence / 未解決 / 最高深刻度 / 残存リスク / origin / conditional を表示。 */}
      <DecisionReadinessCard journey={journey} t={t} showReleaseImpact />

      {/* RC Micro-Fix #1: conflation は intentional misconception probe（checked → conflated → scoring penalty）。
          scoring mechanic は不変。UX framing のみ変更し、「Completion = Release」という Product 自身の
          断定に見えない、ユーザー自身の stance を選ぶ設問形式にする。 */}
      <fieldset className="field release-conflate-field">
        <legend data-testid="release-conflate-prompt">{t("rc3.release.conflate.prompt")}</legend>
        {/* RC5 P1-B: input を label の兄弟にして二重関連を排除。 */}
        <div className="checkbox-row">
          <input
            id="release-conflate-cb"
            type="checkbox"
            data-testid="release-conflate"
            aria-label={t("rc3.release.conflate.option")}
            checked={conflated}
            onChange={(e) => setConflated(e.target.checked)}
          />
          <label htmlFor="release-conflate-cb">{t("rc3.release.conflate.option")}</label>
        </div>
      </fieldset>
      {/* RC5 P1-D: Completion で付けた未解決条件を Release でも提示（消さない）。 */}
      <OpenConditionsCard journey={journey} t={t} testId="release-open-conditions" />

      <ApprovalActions
        t={t}
        testPrefix="release"
        onDecide={(d, conds) => journey.decideRelease(d, conflated, conds)}
      />
    </section>
  );
}

export function JourneyResultView(props: { journey: JourneyApi; t: T; onToGym: () => void }): JSX.Element {
  const { journey, t, onToGym } = props;
  const result = useMemo(() => journey.finalResult(), [journey]);
  const causal = useMemo(() => journey.causalSummary(), [journey]);
  const policy = journey.policy;
  const history = journey.state.learningHistory;
  const reworkCount = journey.reworkCount();
  const dimLevel = (id: DimensionId): ContributionLevel =>
    result.dimensionOutcomes.find((x) => x.dimensionId === id)?.level ?? "neutral";
  const levelSymbol = (id: DimensionId): string => levelSymbolOf(dimLevel(id));

  return (
    <section aria-labelledby="jres-h" className="journey-result">
      <h1 id="jres-h">{t("rc3.result.title")}</h1>
      {policy.feedbackTiming === "final-only" ? (
        <p className="muted" role="note" data-testid="final-only-note">
          {t("rc3.result.finalOnlyNote")}
        </p>
      ) : null}

      {/* RC4 Final（STEP I）: 最重要サマリを最上部に。詳細は下部の既存カードへ残す。 */}
      <ResultHighlightsCard journey={journey} t={t} onToGym={onToGym} />

      {/* RC5 P1-D: 未解決の承認条件を Result でも保持して提示（open risk を消さない）。 */}
      <OpenConditionsCard journey={journey} t={t} testId="result-open-conditions" />
      <details className="result-details" data-testid="result-details" id="result-details-anchor">
        <summary>{t("rc4.result.details.toggle")}</summary>
        <div className="result-details-body">

      <div className="card">
        <h2>{t("result.dimensions")}</h2>
        <p className="muted">{t("result.simulationValueNote")}</p>
        <ul className="dimension-rows" data-testid="journey-dimensions">
          {DIMENSION_IDS.map((id) => (
            <li key={id} className="dimension-row">
              <span>{t(`dimension.${id}`)}</span>
              <span className="dimension-level" data-testid={`journey-dim-${id}`}>
                {/* N4: human-readable label を主表示、symbol は補助。 */}
                {levelLabel(dimLevel(id), t)}{" "}
                <span aria-hidden="true" className="muted">
                  ({levelSymbol(id)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* N3 P1-5: 最終状態と学習履歴を分離。current state != learning history。 */}
      <div className="card" data-testid="result-final-state">
        <h2>{t("rc3.result.finalState.title")}</h2>
        <p>
          {result.totalMissed === 0
            ? // RC6 P1-A: open condition が残っているなら「すべて解決済み」とは言わない。
              result.openConditions.length === 0
              ? t("rc3.result.finalState.clean")
              : t("rc6.result.finalState.openConditions")
            : `${t("rc3.result.missed")}: ${result.totalMissed}`}
        </p>
        {/* RC6 P1-A: 未解決条件件数を最終状態にも明示（Result で条件が消えない）。 */}
        {result.openConditions.length > 0 ? (
          <p className="muted" data-testid="result-final-open-conditions">
            {t("rc5.cond.openConditions")}: {result.openConditions.length}
          </p>
        ) : null}
      </div>

      <div className="card" data-testid="result-history">
        <h2>{t("rc3.result.history.title")}</h2>
        {history.entries.length === 0 && history.totalMissed === 0 && history.totalFalse === 0 && reworkCount === 0 ? (
          <p className="muted">{t("rc3.result.history.none")}</p>
        ) : (
          <>
            <ul className="history-aggregate">
              <li data-testid="history-missed">{t("rc3.result.history.missed")}: {history.totalMissed}</li>
              <li data-testid="history-false">{t("rc3.result.history.false")}: {history.totalFalse}</li>
              <li data-testid="history-rework">{t("rc3.result.history.rework")}: {reworkCount}</li>
            </ul>
            {/* F4: finding-level history（何を間違えたか）。human-readable のみ。 */}
            {history.entries.length > 0 ? (
              <ul className="history-findings" data-testid="history-findings">
                {history.entries.map((e, i) => {
                  // UX-RH-001: 全 event を同一 schema で正規化表示。field を消さず明示的 N/A を出す。
                  const isFalse = e.mistakeType === "false-positive";
                  const severityText =
                    e.severity !== undefined ? t(`rc3.sev.${e.severity}`) : t("rc3.trace.severity.na");
                  const whyText =
                    e.whyItMattersKey !== undefined
                      ? t(e.whyItMattersKey)
                      : isFalse
                        ? t("rc3.trace.why.false")
                        : t("rc3.trace.item");
                  const originText =
                    e.originStepId !== undefined
                      ? t(`rc3.journey.step.${e.originStepId}`)
                      : t("rc3.trace.origin.na");
                  const consequenceText =
                    e.consequenceKey !== undefined
                      ? t(e.consequenceKey)
                      : isFalse
                        ? t("rc3.trace.consequence.na.false")
                        : t("rc3.trace.consequence.na.missed");
                  const revisitText =
                    e.revisitStepId !== undefined
                      ? t(`rc3.journey.step.${e.revisitStepId}`)
                      : isFalse
                        ? t("rc3.trace.revisit.false")
                        : e.originStepId !== undefined
                          ? t(`rc3.journey.step.${e.originStepId}`)
                          : t("rc3.trace.origin.na");
                  return (
                    <li key={i} className="history-entry" data-testid={`history-entry-${i}`}>
                      <strong>
                        {t(`rc3.history.mistake.${e.mistakeType}`)}: {t(e.itemTitleKey)}
                      </strong>
                      <span className="muted">{t(e.itemBodyKey)}</span>
                      <span className="muted" data-testid={`history-entry-${i}-severity`}>
                        {t("rc3.trace.severity")}: {severityText}
                      </span>
                      <span className="muted" data-testid={`history-entry-${i}-why`}>
                        {t("rc3.trace.why")}: {whyText}
                      </span>
                      <span className="muted" data-testid={`history-entry-${i}-origin`}>
                        {t("rc3.trace.origin")}: {originText}
                      </span>
                      <span className="muted" data-testid={`history-entry-${i}-consequence`}>
                        {t("rc3.trace.consequence")}: {consequenceText}
                      </span>
                      <span className="revisit" data-testid={`history-entry-${i}-revisit`}>
                        {t("rc3.trace.revisit")}: {revisitText}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {/* N9 P2-8: Completion / Release の最終 Decision を human-readable 表示。 */}
      <div className="card" data-testid="result-decisions">
        <h2>{t("rc3.result.decisions.title")}</h2>
        <ul>
          <li data-testid="result-decision-completion">
            {t("rc3.result.decisions.completion")}:{" "}
            {journey.state.completionDecision !== undefined
              ? t(`rc3.decision.${journey.state.completionDecision}`)
              : t("rc3.result.decisions.notReached")}
          </li>
          <li data-testid="result-decision-release">
            {t("rc3.result.decisions.release")}:{" "}
            {journey.state.releaseDecision !== undefined
              ? t(`rc3.decision.${journey.state.releaseDecision}`)
              : t("rc3.result.decisions.notReached")}
          </li>
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
                  {t(`dimension.${c.dimensionId}`)}: {levelLabel(c.level, t)}{" "}
                  <span aria-hidden="true" className="muted">({levelSymbolOf(c.level)})</span>
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

        </div>
      </details>

      {/* RC4 Final（STEP H）: Adoption Review では実務持ち帰り output を出す（details の外＝常時可視）。 */}
      {journey.state.mode === "adoption-review" ? (
        <AdoptionOutputCard journey={journey} t={t} />
      ) : null}

      {/* H3 P2-2: Home はグローバル shell に一本化。ここでは Gym 導線のみ（Home ボタンを重複させない）。 */}
      <div className="result-actions">
        <button className="secondary" data-testid="result-to-gym" onClick={onToGym}>
          {t("rc3.result.toGym")}
        </button>
      </div>
    </section>
  );
}

/** RC4 Final（STEP I）: Result 上部の最重要サマリ（学び3件 / 最も危険な Decision / 次の練習）。 */
function ResultHighlightsCard(props: { journey: JourneyApi; t: T; onToGym: () => void }): JSX.Element {
  const { journey, t, onToGym } = props;
  const h = useMemo(() => journey.resultHighlights(), [journey]);
  // RC5 P1-A: delivery outcome と learner evaluation を分離した view model。
  const outcome = useMemo(() => journey.outcomeSummary(), [journey]);
  const hasAny =
    h.topLearnings.length > 0 || h.mostDangerousDecisionKey !== undefined || h.practiceNext !== undefined;
  const weakCount = h.topLearnings.length;
  // RC5 P1-A: 学習者評価は「弱点件数」ではなく LearnerEvaluation を主表示にする。
  // delivery outcome（blocked 等）とは別 semantic として並べる。Block が正しくても
  // learner=strong になりうるが、delivery outcome は blocked と表示する（肯定文言で覆わない）。
  const learnerText =
    outcome.learnerEvaluation === "strong"
      ? t("rc5.learner.strong")
      : outcome.learnerEvaluation === "mixed"
        ? t("rc5.learner.mixed")
        : t("rc5.learner.needs-practice");
  return (
    <div className="card result-highlights" data-testid="result-highlights">
      <h2>{t("rc4.result.highlights.title")}</h2>

      {/* RC5 P1-A: Journey Outcome（工程/配送の帰結）— 学習者評価とは別 semantic。
          Block/Return/Rejected では肯定文言を出さない。 */}
      <p
        className={`result-journey-outcome outcome-${outcome.outcome}`}
        data-testid="result-journey-outcome"
        data-outcome={outcome.outcome}
        data-halted={outcome.halted ? "true" : "false"}
      >
        <strong>{t("rc5.result.outcome.label")}:</strong> {t(`rc5.outcome.${outcome.outcome}`)}
      </p>

      {/* RC5 P1-A: Learner Evaluation（学習者の判断品質）— delivery とは独立。 */}
      <p
        className={`result-learner-eval learner-${outcome.learnerEvaluation}`}
        data-testid="result-learner-eval"
        data-learner-eval={outcome.learnerEvaluation}
      >
        <strong>{t("rc5.result.learner.label")}:</strong> {learnerText}
      </p>

      {/* 弱点件数の補足（詳細な学びは下部）。総合の断定文言はここでは使わない。 */}
      <p className="result-overall muted" data-testid="result-overall">
        {weakCount === 0
          ? t("rc5.result.weakness.none")
          : t("rc5.result.weakness.count").replace("{n}", String(weakCount))}
      </p>
      {!hasAny ? (
        <p className="muted" data-testid="result-highlights-clean">
          {/* RC5 P1-A: delivery が止まった場合は「レビューは良好だが工程は前進しなかった」旨。
              肯定 terminal verdict（全工程を良好に完了）で覆わない。 */}
          {outcome.halted
            ? t("rc5.result.highlights.clean.halted")
            : t("rc4.result.highlights.clean")}
        </p>
      ) : (
        <>
          <h3>{t("rc4.result.highlights.learnings")}</h3>
          {h.topLearnings.length === 0 ? (
            <p className="muted">{t("rc4.result.highlights.noLearnings")}</p>
          ) : (
            <ol className="highlight-learnings" data-testid="highlight-learnings">
              {h.topLearnings.map((c) => (
                <li key={c.dimensionId} data-testid={`highlight-learning-${c.dimensionId}`}>
                  <strong>{t(`dimension.${c.dimensionId}`)}</strong>: {t(`rc3.why.${c.dimensionId}`)}
                  {/* STEP 8: 根拠（詳細）への anchor。詳細履歴は details 内に維持する。 */}
                  <a
                    className="evidence-link"
                    href="#result-details-anchor"
                    data-testid={`highlight-evidence-link-${c.dimensionId}`}
                  >
                    {" "}
                    {t("rc4.result.highlights.evidenceLink")}
                  </a>
                </li>
              ))}
            </ol>
          )}

          <h3>{t("rc4.result.highlights.danger")}</h3>
          <p data-testid="highlight-danger">
            {h.mostDangerousDecisionKey !== undefined
              ? t(h.mostDangerousDecisionKey)
              : t("rc4.result.danger.none")}
          </p>

          <h3>{t("rc4.result.highlights.practiceNext")}</h3>
          {h.practiceNext !== undefined ? (
            <p data-testid="highlight-practice-next">
              {t(`dimension.${h.practiceNext.dimensionId}`)}
              {" — "}
              <button
                className="link-button"
                data-testid="highlight-practice-gym"
                onClick={onToGym}
              >
                {t("rc4.result.highlights.practiceCta")}
              </button>
            </p>
          ) : (
            <p className="muted" data-testid="highlight-practice-none">
              {t("rc4.result.highlights.practiceNone")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** RC4 Final（STEP H）: Adoption 実務持ち帰り output（Gate Map / 役割 / 承認方針 / Evidence / Pilot）。 */
function AdoptionOutputCard(props: { journey: JourneyApi; t: T }): JSX.Element {
  const { journey, t } = props;
  const out = useMemo(() => journey.adoptionOutput(), [journey]);
  return (
    <div className="card adoption-output" data-testid="adoption-output">
      <h2>{t("rc4.adopt.title")}</h2>
      <p className="muted">{t("rc4.adopt.desc")}</p>

      <h3>{t("rc4.adopt.gateMap.title")}</h3>
      <ul className="adoption-gate-map" data-testid="adoption-gate-map">
        {out.gateMap.map((g) => (
          <li key={g.stepId} data-testid={`adoption-gate-${g.stepId}`}>
            <strong>{t(`rc3.journey.step.${g.stepId}`)}</strong>
            {" — "}
            {t(`rc4.adopt.gate.${g.requirement}`)}
            {g.hadUnresolved ? (
              <span className="partial-badge" data-testid={`adoption-gate-attn-${g.stepId}`}>
                {" "}
                {t("rc4.adopt.gate.attention")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <h3>{t("rc4.adopt.resp.title")}</h3>
      <div className="adoption-resp" data-testid="adoption-responsibility">
        <div>
          <strong>{t("rc4.adopt.resp.humanTitle")}</strong>
          <ul>
            {out.responsibility.human.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>{t("rc4.adopt.resp.agentTitle")}</strong>
          <ul>
            {out.responsibility.agent.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </div>
      </div>

      <h3>{t("rc4.adopt.policy.title")}</h3>
      <ul className="adoption-policy" data-testid="adoption-approval-policy">
        <li>{t(out.approvalPolicy.completionKey)}</li>
        <li>{t(out.approvalPolicy.releaseKey)}</li>
        <li>
          <strong>{t(out.approvalPolicy.separationKey)}</strong>
        </li>
      </ul>

      <h3>{t("rc4.adopt.evidence.title")}</h3>
      <ul className="adoption-evidence" data-testid="adoption-evidence-checklist">
        {out.evidenceChecklist.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>

      <h3>{t("rc4.adopt.pilot.title")}</h3>
      <ol className="adoption-pilot" data-testid="adoption-pilot-next">
        {out.pilotNextActions.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ol>
    </div>
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

/**
 * RC4 Phase 3: 1 件の変更（added/changed/removed）を human-readable に描画する。
 * internal ID（itemId / defectId / enum）はそのまま出さず、label / body の locale 解決値と
 * changeType ラベルのみを見せる。before/after は body key を解決して実本文を表示する。
 */
function DiffChangeRow(props: {
  change: ArtifactItemChange;
  t: T;
  testId: string;
  /** RC5 P3: 同一カード内で既出の reason は重複表示しない（copy 重複の除去）。 */
  suppressReason?: boolean;
}): JSX.Element {
  const { change, t, testId, suppressReason = false } = props;
  const typeLabel = t(`rc4.diff.${change.changeType}`);
  const heading = change.labelKey !== undefined ? t(change.labelKey) : t("rc4.diff.title");
  return (
    <li className={`diff-change diff-${change.changeType}`} data-testid={testId}>
      <span className={`diff-badge diff-badge-${change.changeType}`} data-testid={`${testId}-type`}>
        {typeLabel}
      </span>
      <strong>{heading}</strong>
      {change.beforeBodyKey !== undefined ? (
        <div className="diff-before" data-testid={`${testId}-before`}>
          <span className="muted">{t("rc4.diff.before")}:</span> {t(change.beforeBodyKey)}
        </div>
      ) : null}
      {change.afterBodyKey !== undefined ? (
        <div className="diff-after" data-testid={`${testId}-after`}>
          <span className="muted">{t("rc4.diff.after")}:</span> {t(change.afterBodyKey)}
        </div>
      ) : null}
      {change.changeSummaryKey !== undefined && !suppressReason ? (
        <div className="muted diff-reason" data-testid={`${testId}-reason`}>
          {t("rc4.diff.reason")}: {t(change.changeSummaryKey)}
        </div>
      ) : null}
    </li>
  );
}

/**
 * RC5 P3: diff の changeSummaryKey が全変更で同一のとき、reason を各行に重複表示せず
 * カード下部に 1 度だけ出すためのヘルパー。distinct reason が 1 種類なら共通 reason を返す。
 */
function commonDiffReasonKey(changes: readonly ArtifactItemChange[]): string | undefined {
  const keys = new Set<string>();
  for (const c of changes) if (c.changeSummaryKey !== undefined) keys.add(c.changeSummaryKey);
  return keys.size === 1 ? [...keys][0] : undefined;
}

/**
 * RC4 Phase 3: Local Rework Diff（同一 step の前 Version → 現 Version）を表示する。
 * 未 rework / 変更なしのときは何も出さない（捏造しない）。
 */
function LocalReworkDiffCard(props: { journey: JourneyApi; t: T }): JSX.Element | null {
  const { journey, t } = props;
  const result = useMemo(() => journey.localReworkDiff(), [journey]);
  const diff = result.diff;
  if (diff === undefined || !diff.hasChanges) return null;
  // RC5 P3: 全変更で reason が同一なら 1 度だけ表示（copy 重複を除去）。
  const sharedReason = commonDiffReasonKey(diff.changes);
  return (
    <div className="card diff-card diff-local" data-testid="local-rework-diff">
      <h2>{t("rc4.diff.title")}</h2>
      <ul className="diff-changes">
        {diff.changes.map((c, i) => (
          <DiffChangeRow
            key={`${c.itemId}-${i}`}
            change={c}
            t={t}
            testId={`local-diff-${i}`}
            suppressReason={sharedReason !== undefined}
          />
        ))}
      </ul>
      {sharedReason !== undefined ? (
        <p className="muted diff-reason" data-testid="local-rework-diff-reason">
          {t("rc4.diff.reason")}: {t(sharedReason)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * RC4 Phase 3: Propagation Impact（upstream defect resolution による direct downstream 変化）を表示する。
 * 表示するもの: 起点 step / 対象 step / 原因の human-readable 説明 / Before・After / Added・Changed・Removed。
 * 影響が無い（diff undefined）ときは出さない（Anti-Fake propagation UI）。
 * internal ID は露出しない（step は human-readable label、原因は rc4.prop.explain.* 文言）。
 */
function PropagationImpactCard(props: { journey: JourneyApi; t: T }): JSX.Element | null {
  const { journey, t } = props;
  const result = useMemo(() => journey.propagationDiff(), [journey]);
  const diff = result.diff;
  if (diff === undefined || !diff.hasChanges || result.originStepId === undefined) return null;
  return (
    <div className="card diff-card diff-propagation" data-testid="propagation-impact">
      <h2>{t("rc4.prop.title")}</h2>
      <ul className="muted propagation-meta">
        <li data-testid="propagation-origin">
          {t("rc4.diff.originStep")}: {t(`rc3.journey.step.${result.originStepId}`)}
        </li>
        <li data-testid="propagation-target">
          {t("rc4.diff.affectedStep")}: {t(`rc3.journey.step.${result.targetStepId}`)}
        </li>
        <li data-testid="propagation-cause">{t("rc4.prop.explain.improved")}</li>
      </ul>
      <ul className="diff-changes">
        {diff.changes.map((c, i) => (
          <DiffChangeRow
            key={`${c.itemId}-${i}`}
            change={c}
            t={t}
            testId={`propagation-diff-${i}`}
            suppressReason={commonDiffReasonKey(diff.changes) !== undefined}
          />
        ))}
      </ul>
      {commonDiffReasonKey(diff.changes) !== undefined ? (
        <p className="muted diff-reason" data-testid="propagation-impact-reason">
          {t("rc4.diff.reason")}: {t(commonDiffReasonKey(diff.changes)!)}
        </p>
      ) : null}
    </div>
  );
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
  // この step への直近の「実 revision を進めた」rework entry（reason / from）を探す。
  // no-op attempt（isNoOpAttempt=true）は revision を進めないため除外する（表示の一貫性）。
  const history = journey.state.progress.reworkHistory;
  const last = [...history].reverse().find((e) => e.toStepId === stepId && e.isNoOpAttempt !== true);
  const isGuided = journey.state.mode === "guided";
  return (
    <div className="card revision-banner" data-testid="revision-banner">
      <strong data-testid="revision-label">
        {t("rc3.revision.label")} {revision}
      </strong>
      {/* RC4 Final: revision > 0 の時点で Agent が Return 判断に基づき Artifact を修正済み。
          multi-stage の partial 段階でも「改訂された」旨は出す（resolved 到達に限定しない）。 */}
      <p data-testid="revision-agent-revised">
        {t("rc4.revision.agentRevised")}
        {isGuided ? <span className="muted"> {t("rc4.revision.agentRevised.guided")}</span> : null}
      </p>
      {last !== undefined ? (
        <ul className="muted">
          <li>
            {t("rc3.revision.returnedFrom")}: {t(`rc3.journey.step.${last.fromStepId}`)}
          </li>
          <li>
            {t("rc3.revision.reason")}: {t(`rc3.trigger.${last.trigger}`)}
          </li>
          {/* RC4 Final: Review note を quote 表示（review → rework → revision explanation の trace）。 */}
          {last.reviewNote !== undefined && last.reviewNote.length > 0 ? (
            <li data-testid="revision-review-note">
              {t("rc4.revision.reviewNote")}: <q>{last.reviewNote}</q>
            </li>
          ) : null}
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
