// AdoptionSheetComposer — "AI-DLC Adoption Discussion Sheet"（Markdown）を決定的に生成する（FR8 / BR7.1）。
//
// 同一入力 → 同一 Markdown（決定的・golden 検証可能）。Composer は LocaleResources に直接依存せず
// locale bundle（key→text の map）を受け取る（BR7.1）。
// user 入力（Workshop / note）は untrusted user-authored text として扱い、system 生成セクションと
// 構造上明確に区別する（security-design §2）。見出しは FR8.2 の順・表記で固定。
// Sheet は議論材料であり確定物ではない（BR7.2）。
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

/** heading の slug（Workshop 入力 key と対応）。 */
export function adoptionHeadingSlug(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface AdoptionSheetInput {
  readonly scenario: ValidatedScenario;
  readonly result: LearningResult;
  readonly decisionRecords: readonly DecisionRecord[];
  /** locale bundle: key を解決した表示テキスト（Composer は key を解決しない）。 */
  readonly text: (key: string) => string;
  /**
   * Workshop でユーザーが編集した各セクションの内容（heading slug → text）。
   * system 生成のガイダンスと視覚的に区別して出力する（RC2 §18）。
   */
  readonly workshopInputs?: Readonly<Record<string, string>>;
  /** 任意のユーザーメモ（untrusted・system 生成と混同させない）。 */
  readonly userNotes?: readonly string[];
}

/**
 * Adoption Discussion Sheet を Markdown 文字列として生成する。決定的。
 * user 入力は "> " ブロック引用 + 明示ラベルで、system 生成本文と構造上分離する。
 */
export function composeAdoptionSheet(input: AdoptionSheetInput): string {
  const lines: string[] = [];
  lines.push("# AI-DLC Adoption Discussion Sheet");
  lines.push("");
  // Educational-output disclaimer は locale bundle から取得する（en では英語のみ・ja では日本語・BUG 4.4）。
  lines.push(`<!-- ${input.text("adoption.sheet.disclaimer")} -->`);
  lines.push("");

  for (const heading of ADOPTION_SHEET_HEADINGS) {
    lines.push(`## ${heading}`);
    lines.push("");
    // system 生成のガイダンス / 導出値。
    lines.push(sectionBody(heading, input));
    lines.push("");
    // ユーザーが Workshop で書いた内容を、明示ラベル + 引用で区別して出力する。
    const userText = input.workshopInputs?.[adoptionHeadingSlug(heading)];
    if (userText !== undefined && userText.trim().length > 0) {
      lines.push(`**${input.text("adoption.userAuthoredLabel")}**`);
      lines.push("");
      for (const raw of userText.split("\n")) {
        lines.push(`> ${raw}`);
      }
      lines.push("");
    }
  }

  // Decision Timeline（決定的・system 生成）。ユーザーの実判断を Sheet に反映する。
  const timeline = decisionTimeline(input);
  if (timeline.length > 0) {
    lines.push(`## ${input.text("adoption.decisionTimelineHeading")}`);
    lines.push("");
    for (const row of timeline) lines.push(row);
    lines.push("");
  }

  // free-form note は末尾に、明示ラベル + 引用で system 生成と混同させない。
  const notes = (input.userNotes ?? []).filter((n) => n.trim().length > 0);
  if (notes.length > 0) {
    lines.push(`## ${input.text("adoption.userNotesHeading")}`);
    lines.push("");
    for (const note of notes) {
      for (const raw of note.split("\n")) {
        lines.push(`> ${raw}`);
      }
      lines.push("");
    }
  }

  // 末尾改行を 1 つに正規化して決定性を保つ。
  return lines.join("\n").replace(/\n+$/, "\n");
}

function decisionTimeline(input: AdoptionSheetInput): readonly string[] {
  const ordered = [...input.decisionRecords].sort((a, b) => a.orderIndex - b.orderIndex);
  return ordered.map((r) => {
    const option = input.scenario.decisionOptions.get(r.chosenDecisionOptionId);
    const label = option ? input.text(option.labelKey) : r.chosenDecisionOptionId;
    return `${r.orderIndex + 1}. ${label}`;
  });
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
      return t(`adoption.section.${adoptionHeadingSlug(heading)}`);
  }
}

function riskLine(input: AdoptionSheetInput): string {
  const remaining = input.result.dimensionOutcomes.find((o) => o.dimensionId === "remaining-risks");
  const level = remaining ? remaining.level : "neutral";
  return `${input.text("adoption.section.remaining-risks")} (remaining-risks: ${level})`;
}
