// Decision note isolation regression（RC2 final micro-patch）。
// note は Decision（DecisionRecord）単位に厳密に束縛される。mode（Guided/Adoption）に依らず不変。
// 文字列一致による dedupe は行わない（同一文言を複数 Decision へ意図的入力するのは正当）。
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";

const KEY = "aidlc-learning-simulator/progress/v1";

function memoryStorage(): StoragePort & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

function makeApp(storage: StoragePort, languages: string[] = ["en"]): Application {
  return createApplication({ scenarioModules, storage, browserLanguages: languages });
}

const CORE_PATH = ["o-ac-clarify", "o-del-agent-lowrisk", "o-test-investigate", "o-rel-separate"];

/** core-e2e を指定 mode で走らせ、各 DP に notes[i]（null=入力しない）を入れて完走する。 */
async function runCore(
  user: ReturnType<typeof userEvent.setup>,
  modeTestId: string,
  notes: (string | null)[],
): Promise<void> {
  await user.click(screen.getByTestId("start"));
  await user.click(screen.getByTestId(modeTestId));
  await user.click(screen.getByTestId("begin"));
  for (let i = 0; i < CORE_PATH.length; i++) {
    const n = notes[i];
    if (n != null && n.length > 0) await user.type(screen.getByTestId("note"), n);
    await user.click(screen.getByTestId(`option-${CORE_PATH[i]}`));
    await user.click(screen.getByTestId("proceed"));
  }
}

/** Result timeline の行テキスト配列。 */
function timelineRows(): string[] {
  return within(screen.getByTestId("timeline"))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
}

/** Reflection → Adoption → generate し、Discussion Sheet 本文を返す。 */
async function sheetText(user: ReturnType<typeof userEvent.setup>): Promise<string> {
  await user.click(screen.getByTestId("to-reflection"));
  await user.click(screen.getByTestId("to-adoption"));
  await user.click(screen.getByTestId("generate-sheet"));
  return (screen.getByTestId("sheet-preview") as HTMLTextAreaElement).value;
}

function countRowsWith(rows: string[], text: string): number {
  return rows.filter((r) => r.includes(text)).length;
}

afterEach(() => cleanup());

// ---------- Case A: single note only on DP1 ----------

describe("note isolation — Case A (single note, DP1 only)", () => {
  it("Adoption: DP1 note のみ → timeline / sheet に 1 回だけ、他 DP には付かない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await runCore(user, "mode-adoption-review", ["single-note-check", null, null, null]);
    const rows = timelineRows();
    expect(countRowsWith(rows, "single-note-check")).toBe(1);
    const sheet = await sheetText(user);
    expect(sheet.split("single-note-check").length - 1).toBe(1);
  });

  it("Guided: DP1 note のみ → 同様に 1 回だけ（mode 間で挙動一致）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await runCore(user, "mode-guided", ["single-note-check", null, null, null]);
    const rows = timelineRows();
    expect(countRowsWith(rows, "single-note-check")).toBe(1);
  });
});

// ---------- Case B: distinct notes on every DP ----------

describe("note isolation — Case B (distinct notes)", () => {
  it("Adoption: 各 DP に異なる note → それぞれ 1 回ずつ、対応 Decision に付く", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await runCore(user, "mode-adoption-review", ["note-one", "note-two", "note-three", "note-four"]);
    const rows = timelineRows();
    expect(countRowsWith(rows, "note-one")).toBe(1);
    expect(countRowsWith(rows, "note-two")).toBe(1);
    expect(countRowsWith(rows, "note-three")).toBe(1);
    expect(countRowsWith(rows, "note-four")).toBe(1);
    // 対応関係: note-one は要件 DP の行、note-two は委任 DP の行。
    const reqRow = rows.find((r) => r.includes("note-one")) ?? "";
    expect(reqRow).toContain("Clarify the acceptance criteria");
    const delRow = rows.find((r) => r.includes("note-two")) ?? "";
    expect(delRow).toContain("Delegate to the agent");
    const sheet = await sheetText(user);
    for (const n of ["note-one", "note-two", "note-three", "note-four"]) {
      expect(sheet.split(n).length - 1).toBe(1);
    }
  });
});

// ---------- Case C: no notes ----------

describe("note isolation — Case C (no notes)", () => {
  it("Adoption: 全 DP note 無し → timeline に Note 表示なし / sheet に Your Notes なし", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await runCore(user, "mode-adoption-review", [null, null, null, null]);
    const rows = timelineRows();
    expect(countRowsWith(rows, "Note")).toBe(0);
    const sheet = await sheetText(user);
    expect(sheet).not.toContain("Your Notes (user-authored)");
  });
});

// ---------- Case D: same text intentionally on two DPs ----------

describe("note isolation — Case D (same text on two Decisions is legal)", () => {
  it("Adoption: DP1=DP2=same-note → 2 つの Decision にそれぞれ 1 回、dedupe しない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp(memoryStorage())} />);
    await runCore(user, "mode-adoption-review", ["same-note", "same-note", null, null]);
    const rows = timelineRows();
    // 2 つの異なる Decision 行に same-note がそれぞれ付く。
    expect(countRowsWith(rows, "same-note")).toBe(2);
    const sheet = await sheetText(user);
    // Sheet の user notes も 2 回（意図的な重複は保持）。
    expect(sheet.split("same-note").length - 1).toBe(2);
  });
});

// ---------- reload / resume mapping ----------

describe("note isolation — reload / Resume", () => {
  it("DP1 に note 入力後 reload → Resume → note は DP1 に保持され続き DP2 は空", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const { unmount } = render(<App application={makeApp(storage)} />);
    await user.click(screen.getByTestId("start"));
    await user.click(screen.getByTestId("mode-adoption-review"));
    await user.click(screen.getByTestId("begin"));
    await user.type(screen.getByTestId("note"), "persisted-note");
    await user.click(screen.getByTestId("option-o-ac-clarify"));
    await user.click(screen.getByTestId("proceed")); // DP2 へ（DP1 の record に note 保存）
    unmount();
    cleanup();

    render(<App application={makeApp(storage)} />);
    await user.click(screen.getByTestId("continue")); // Resume → scenario（DP2）
    // DP2 の note textarea は空（DP1 の note が漏れない）。
    expect(screen.getByTestId("note")).toHaveValue("");
    // 残り DP を完走し、timeline で DP1 のみ note を確認。
    await user.click(screen.getByTestId("option-o-del-agent-lowrisk"));
    await user.click(screen.getByTestId("proceed"));
    await user.click(screen.getByTestId("option-o-test-investigate"));
    await user.click(screen.getByTestId("proceed"));
    await user.click(screen.getByTestId("option-o-rel-separate"));
    await user.click(screen.getByTestId("proceed"));
    expect(countRowsWith(timelineRows(), "persisted-note")).toBe(1);
  });

  it("DecisionRecord に保存された note は DP1 のみ（storage 直接確認）", async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    render(<App application={makeApp(storage)} />);
    await runCore(user, "mode-adoption-review", ["only-dp1", null, null, null]);
    const saved = JSON.parse(storage.data[KEY]!);
    const notes = (saved.decisionRecords as Array<{ decisionPointId: string; note?: string }>)
      .filter((r) => typeof r.note === "string" && r.note.length > 0);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.decisionPointId).toBe("dp-ac");
    expect(notes[0]!.note).toBe("only-dp1");
  });
});
