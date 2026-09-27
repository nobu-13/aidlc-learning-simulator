// provenance 4 区分表示（BR4.2 / FR6）。色のみに依存せず label + icon(記号) + text で区別する。
import type { ProvenanceCategory } from "../domain/entities.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";

// 記号アイコン（色非依存。スクリーンリーダーには label テキストで意味を伝える）。
const ICON: Record<ProvenanceCategory, string> = {
  "ai-dlc-spec": "◆",
  "harness-behavior": "▲",
  "simulator-interpretation": "●",
  "simulation-assumption": "◇",
};

const LABEL_KEY: Record<ProvenanceCategory, string> = {
  "ai-dlc-spec": "provenance.ai-dlc-spec",
  "harness-behavior": "provenance.harness-behavior",
  "simulator-interpretation": "provenance.simulator-interpretation",
  "simulation-assumption": "provenance.simulation-assumption",
};

export function ProvenanceBadge(props: {
  category: ProvenanceCategory;
  note: string;
  reference?: string;
  t: I18nResolver["t"];
}): JSX.Element {
  const { category, note, reference, t } = props;
  const label = t(LABEL_KEY[category]);
  return (
    <div className="provenance" data-testid={`provenance-${category}`}>
      <span className="cat-icon" aria-hidden="true">
        {ICON[category]}
      </span>
      <span className="cat-label">{label}</span>: <span className="cat-note">{note}</span>
      {reference !== undefined ? <span className="cat-ref"> — {reference}</span> : null}
    </div>
  );
}
