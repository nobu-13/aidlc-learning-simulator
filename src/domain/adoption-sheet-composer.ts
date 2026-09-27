// AdoptionSheetComposer — "AI-DLC Adoption Discussion Sheet"（Markdown）を決定的に生成する（FR8 / BR7.1）。
//
// 同一入力 → 同一 Markdown（決定的・golden 検証可能）。Composer は LocaleResources に直接依存せず
// locale bundle（key→text の map）を受け取る（BR7.1）。
// user note は untrusted user-authored text として扱い、system 生成セクションと構造上明確に区別する
// （security-design §2）。見出しは FR8.2 の順・表記で固定。Sheet は議論材料であり確定物ではない（BR7.2）。
import type { DecisionRecord, LearningResult, ValidatedScenario } from "./entities.ts";

/** Sheet の見出し（この順・この表記で固定・FR8.2）。 */
export const ADOPTION_SHEET_HEADINGS: readonly string[] = [
  "Project Context",
  "Requirements",
  "Acceptance Criteria",
  "Agent Delegation Boundary",
  "Human Approval Boundary",
  "Evidence Required",
  "Testing Expectations",
  "Remaining Risks",
  "Team Discussion Points",
  "Questions to Resolve Before Adoption",
] as const;

export interface AdoptionSheetInput {
  readonly scenario: ValidatedScenario;
  readonly result: LearningResult;
  readonly decisionRecords: readonly DecisionRecord[];
  /** locale bundle: key を解決した表示テキスト（Composer は key を解決しない）。 */
  readonly text: (key: string) => string;
  /** 任意のユーザーメモ（untrusted・system 生成と混同させない）。 */
  readonly userNotes?: readonly string[];
}

/**
 * Adoption Discussion Sheet を Markdown 文字列として生成する。決定的。
 * user note は "> " ブロック引用 + 明示ラベルで、system 生成本文と構造上分離する。
 */
export function composeAdoptionSheet(input: AdoptionSheetInput): string {
  const lines: string[] = [];
  lines.push("# AI-DLC Adoption Discussion Sheet");
  lines.push("");
  lines.push("<!-- Educational Output: 導入設計を自動確定するものではなく、議論のための教材です（FR8.3 / BR7.2） -->");
  lines.push("");

  for (const heading of ADOPTION_SHEET_HEADINGS) {
    lines.push(`## ${heading}`);
    lines.push("");
    lines.push(sectionBody(heading, input));
    lines.push("");
  }

  // user note は末尾に、明示ラベル + 引用で system 生成と混同させない（untrusted・security-design §2）。
  const notes = (input.userNotes ?? []).filter((n) => n.trim().length > 0);
  if (notes.length > 0) {
    lines.push("## Your Notes (user-authored)");
    lines.push("");
    for (const note of notes) {
      // 改行を引用行に正規化。Markdown として解釈させる意図はなく、引用テキストとして提示。
      for (const raw of note.split("\n")) {
        lines.push(`> ${raw}`);
      }
      lines.push("");
    }
  }

  // 末尾改行を 1 つに正規化して決定性を保つ。
  return lines.join("\n").replace(/\n+$/, "\n");
}

function sectionBody(heading: string, input: AdoptionSheetInput): string {
  const t = input.text;
  switch (heading) {
    case "Project Context":
      return t(input.scenario.scenario.summaryKey);
    case "Remaining Risks":
      return riskLine(input);
    case "Testing Expectations":
      return t("adoption.testingExpectations");
    default:
      // 各セクションの汎用ガイダンス（locale key で提供。未定義は i18n 側で欠落検出）。
      return t(`adoption.section.${slug(heading)}`);
  }
}

function riskLine(input: AdoptionSheetInput): string {
  const remaining = input.result.dimensionOutcomes.find((o) => o.dimensionId === "remaining-risks");
  const level = remaining ? remaining.level : "neutral";
  return `${input.text("adoption.section.remaining-risks")} (remaining-risks: ${level})`;
}

function slug(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
