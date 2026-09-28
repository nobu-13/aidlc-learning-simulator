// FeedbackCardView — 選択に応じた Feedback を表示する（RC2 §9）。
// 全 Decision で meaningful feedback（selected / judgment / why / impact / better / provenance）を出す。
// 根拠は domain の FeedbackCard（決定的）。UI は locale 解決と表示のみ。
import type { ContributionLevel, DimensionId, ProvenanceEntry } from "../domain/entities.ts";
import type { FeedbackCard } from "../domain/feedback-model.ts";
import type { JudgmentStatus } from "../domain/decision-judgment.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";
import { ProvenanceBadge } from "./provenance-badge.tsx";

const STATUS_ICON: Record<JudgmentStatus, string> = {
  recommended: "✔",
  "context-dependent": "◐",
  risky: "▲",
};

function deltaLabel(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function dimLabelKey(id: DimensionId): string {
  return `dimension.${id}`;
}

function levelClass(level: ContributionLevel): string {
  if (level === "strong-positive" || level === "positive") return "impact-pos";
  if (level === "strong-negative" || level === "negative") return "impact-neg";
  return "impact-neutral";
}

export function FeedbackCardView(props: {
  card: FeedbackCard;
  t: I18nResolver["t"];
}): JSX.Element {
  const { card, t } = props;
  const status = card.judgment.status;

  return (
    <div className="feedback-card" data-testid="feedback-card" aria-live="polite">
      <div className="feedback-selected">
        <span className="feedback-field-label">{t("feedback.selected")}</span>
        <span data-testid="feedback-selected-label">{t(card.selectedOptionLabelKey)}</span>
      </div>

      <div className={`feedback-status status-${status}`} data-testid="feedback-status">
        <span className="feedback-field-label">{t("feedback.status")}</span>
        <span className="status-badge" data-testid={`status-${status}`}>
          <span aria-hidden="true">{STATUS_ICON[status]}</span> {t(`feedback.status.${status}`)}
        </span>
      </div>

      {/* Why: LearningPoint 本文（あれば）。DP に LP が無くても他フィールドで feedback は成立。 */}
      {card.learningPoints.length > 0 ? (
        <div className="feedback-why">
          <span className="feedback-field-label">{t("feedback.why")}</span>
          {card.learningPoints.map((lp) => (
            <div key={lp.learningPointId} data-testid={`fb-lp-${lp.learningPointId}`}>
              <h4>{t(lp.titleKey)}</h4>
              <p>{t(lp.bodyKey)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Dimension Impact: 内部 effect 表現と矛盾しない符号付きデルタ。 */}
      <div className="feedback-impact">
        <span className="feedback-field-label">{t("feedback.dimensionImpact")}</span>
        {card.judgment.impacts.length > 0 ? (
          <ul className="impact-list" data-testid="impact-list">
            {card.judgment.impacts.map((imp, i) => (
              <li key={`${imp.dimensionId}-${i}`} className={levelClass(imp.contribution)}>
                <span className="impact-dim">{t(dimLabelKey(imp.dimensionId))}</span>
                <span className="impact-delta" data-testid={`impact-${imp.dimensionId}`}>
                  {deltaLabel(imp.delta)}
                </span>
                {imp.rationaleKey !== undefined ? (
                  <span className="impact-rationale">{t(imp.rationaleKey)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="feedback-no-impact">{t("feedback.noImpact")}</p>
        )}
      </div>

      {/* Better Alternative（judgment が指し、選択と異なるときのみ）。 */}
      {card.betterAlternativeLabelKey !== undefined ? (
        <div className="feedback-better" data-testid="feedback-better">
          <span className="feedback-field-label">{t("feedback.betterAlternative")}</span>
          <span>{t(card.betterAlternativeLabelKey)}</span>
        </div>
      ) : null}

      {/* Provenance（根拠）。色非依存の ProvenanceBadge。 */}
      {card.decisionProvenance.length > 0 || card.learningPoints.some((lp) => lp.provenance.length > 0) ? (
        <div className="feedback-provenance">
          <span className="feedback-field-label">{t("feedback.provenance")}</span>
          {collectProvenance(card).map((pv) => (
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
    </div>
  );
}

/** DP provenance + LearningPoint provenance を重複排除して集める。 */
function collectProvenance(card: FeedbackCard): readonly ProvenanceEntry[] {
  const seen = new Set<string>();
  const out: ProvenanceEntry[] = [];
  for (const pv of card.decisionProvenance) {
    if (!seen.has(pv.provenanceId)) {
      seen.add(pv.provenanceId);
      out.push(pv);
    }
  }
  for (const lp of card.learningPoints) {
    for (const pv of lp.provenance) {
      if (!seen.has(pv.provenanceId)) {
        seen.add(pv.provenanceId);
        out.push(pv);
      }
    }
  }
  return out;
}
