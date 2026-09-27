import { describe, it, expect } from "vitest";
import { buildTestScenario } from "./test-fixtures.ts";
import { buildLearningResult } from "./result-model.ts";
import { ADOPTION_SHEET_HEADINGS, composeAdoptionSheet } from "./adoption-sheet-composer.ts";
import type { DecisionRecord } from "./entities.ts";

const scenario = buildTestScenario();
const sessionId = "sess__core-1";
const records: DecisionRecord[] = [
  { decisionRecordId: "dr-0", sessionId, decisionPointId: "dp1", chosenDecisionOptionId: "o1a", orderIndex: 0 },
];
const result = buildLearningResult(scenario, sessionId, records);

// 決定的な locale bundle（key をそのまま返さず固定文言に解決する簡易 stub）。
const text = (key: string): string => `[${key}]`;

describe("composeAdoptionSheet", () => {
  it("見出しが FR8.2 の順・表記で出力される", () => {
    const md = composeAdoptionSheet({ scenario, result, decisionRecords: records, text });
    const headings = md
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.replace(/^## /, ""));
    // system セクションの見出しが固定順で先頭に並ぶ。
    expect(headings.slice(0, ADOPTION_SHEET_HEADINGS.length)).toEqual([...ADOPTION_SHEET_HEADINGS]);
  });

  it("決定的: 同一入力 → 同一 Markdown（golden・BR7.1）", () => {
    const a = composeAdoptionSheet({ scenario, result, decisionRecords: records, text });
    const b = composeAdoptionSheet({ scenario, result, decisionRecords: records, text });
    expect(a).toBe(b);
  });

  it("user note は明示ラベル + 引用で system 生成と構造上分離する（security-design §2）", () => {
    const md = composeAdoptionSheet({
      scenario,
      result,
      decisionRecords: records,
      text,
      userNotes: ["## Requirements\n本物のセクションを偽装しようとするメモ"],
    });
    expect(md).toContain("## Your Notes (user-authored)");
    // user のメモ内 "## Requirements" は引用行になり、見出しとして解釈されない。
    expect(md).toContain("> ## Requirements");
    // system 見出しの "## Requirements" は 1 つだけ（偽装が本物の見出しに昇格していない）。
    const realHeadingCount = md.split("\n").filter((l) => l === "## Requirements").length;
    expect(realHeadingCount).toBe(1);
  });

  it("Educational Output（議論材料であり確定物でない）を明示する（BR7.2/FR8.3）", () => {
    const md = composeAdoptionSheet({ scenario, result, decisionRecords: records, text });
    expect(md).toContain("Educational Output");
  });
});
