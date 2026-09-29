// RC4 RC Micro-Fix — regression suite（3件の micro-fix を実 User Journey で固定）。
//
// A. Release conflation は Product assertion ではなく user stance/question として表示される。
// B. Browser-level E2E: v0 → Return → Revision 1(partial) → Return → Revision 2(resolved) → terminal。
// C. Revision 2: localRevision=2 / artifactId 変化 / 実 content 変化。
// D. terminal resolved 再 Return は no-op（revision は 2 のまま）。
// E. 同一 finding について Medium(severity) と "Critical"(rework 理由) を矛盾表示しない。
// + Revision 2 到達を阻んでいた「partial を再指摘せず Return = no-op」罠に対する UX ガード。
import { opaqueItemToken } from "../domain/semantic-id.ts";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app/app.tsx";
import { createApplication, type Application } from "../app/application-orchestrator.ts";
import { scenarioModules } from "../scenarios/index.ts";
import type { StoragePort } from "../data/progress-store.ts";

function memoryStorage(): StoragePort {
  const data: Record<string, string> = {};
  return {
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}
function makeApp(): Application {
  return createApplication({ scenarioModules, storage: memoryStorage(), browserLanguages: ["en"] });
}
type U = ReturnType<typeof userEvent.setup>;

const NFR = "design-item-missing-nfr";

async function approveStep(user: U): Promise<void> {
  await user.selectOptions(screen.getByTestId("review-gate"), "approve");
  await user.click(screen.getByTestId("review-submit"));
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}

/** 現在 review の NFR item を指摘して Return for Rework、feedback の rework で同一 step へ戻る。 */
async function returnNfrViaFeedback(user: U): Promise<void> {
  const cb = screen.getByTestId(`review-item-${opaqueItemToken(NFR)}`);
  if (!(cb as HTMLInputElement).checked) await user.click(cb);
  const sev = screen.queryByTestId(`review-sev-${opaqueItemToken(NFR)}-high`);
  if (sev !== null) await user.click(sev);
  await user.selectOptions(screen.getByTestId("review-gate"), "return-for-rework");
  await user.click(screen.getByTestId("review-submit"));
  const rw = screen.queryByTestId("feedback-rework");
  if (rw !== null) await user.click(rw);
}

/** J3 まで進める（J1/J2 approve）。 */
async function toJ3(user: U): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
  await approveStep(user);
  await approveStep(user);
}

afterEach(() => cleanup());

// ============================================================
// B + C: v0 -> Return -> Rev1(partial) -> Return -> Rev2(resolved), invariants
// ============================================================
describe("RC Micro-Fix B/C — Revision 2 is reachable via real UI interaction", () => {
  it("v0 -> Return -> Rev1(partial) -> Return -> Rev2(resolved); artifactId & content change", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await toJ3(user);
    expect(screen.getByRole("heading", { level: 1 }).textContent ?? "").toMatch(/Design/i);
    expect(screen.queryByTestId("revision-banner")).toBeNull(); // Rev 0。

    // v0 の NFR 本文（defective）。
    const v0Body = (screen.getByTestId(`review-item-${opaqueItemToken(NFR)}`).closest("li")?.textContent ?? "");

    // 1st Return -> Rev1 partial。
    await returnNfrViaFeedback(user);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    expect(screen.getByTestId(`partial-badge-${opaqueItemToken(NFR)}`)).toBeInTheDocument();
    const v1Body = (screen.getByTestId(`review-item-${opaqueItemToken(NFR)}`).closest("li")?.textContent ?? "");
    // C: content が実際に変わった（v0 != v1）。
    expect(v1Body).not.toBe(v0Body);
    // partial 段階では具体値の一部（稼働率）が入り、RTO/RPO はまだ不足。
    expect(v1Body).toMatch(/99\.9%/);

    // 2nd Return -> Rev2 resolved。
    await returnNfrViaFeedback(user);
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");
    expect(screen.getByTestId(`resolved-badge-${opaqueItemToken(NFR)}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`partial-badge-${opaqueItemToken(NFR)}`)).toBeNull();
    const v2Body = (screen.getByTestId(`review-item-${opaqueItemToken(NFR)}`).closest("li")?.textContent ?? "");
    // C: v1 != v2、resolved に具体値（RTO/RPO）が入る。
    expect(v2Body).not.toBe(v1Body);
    expect(v2Body).toMatch(/RTO 30|RPO 5/);
  });
});

// ============================================================
// D: terminal resolved 再 Return は no-op（revision remains 2）
// ============================================================
describe("RC Micro-Fix D — re-Return after terminal resolved is explicitly rejected (RC5 P1-C)", () => {
  it("a 3rd Return on the resolved NFR is rejected (no fake revision) and revision stays at 2", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await toJ3(user);
    await returnNfrViaFeedback(user); // Rev1
    await returnNfrViaFeedback(user); // Rev2 resolved
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");

    // RC5 P1-C Case 2: 既に resolved（terminal）の指摘だけを選んで Return → 明示拒否。
    // silent に古い revision を再表示せず、rework-rejected 通知を出す。revision は 2 のまま。
    await returnNfrViaFeedback(user);
    expect(screen.getByTestId("rework-rejected")).toBeInTheDocument();
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");
    expect(screen.getByTestId(`resolved-badge-${opaqueItemToken(NFR)}`)).toBeInTheDocument();

    // dismiss で通知を閉じられる。
    await user.click(screen.getByTestId("rework-rejected-dismiss"));
    expect(screen.queryByTestId("rework-rejected")).toBeNull();
  });
});

// ============================================================
// Root-cause UX guard: partial を再指摘せず Return すると no-op（revision 停滞）
// ============================================================
describe("RC Micro-Fix #2 root cause — returning without a selected finding is a visible no-op", () => {
  it("2nd Return WITHOUT re-flagging the partial NFR keeps revision at 1 and warns the user", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await toJ3(user);
    await returnNfrViaFeedback(user); // Rev1 partial
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");

    // NFR を再指摘せず Return → feedback で「対象が無い」警告が出る（silent no-op ではない）。
    await user.selectOptions(screen.getByTestId("review-gate"), "return-for-rework");
    await user.click(screen.getByTestId("review-submit"));
    expect(screen.getByTestId("feedback-return-noop-warning")).toBeInTheDocument();
    // rework を押しても no-op で revision は 1 のまま。
    await user.click(screen.getByTestId("feedback-rework"));
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    expect(screen.getByTestId(`partial-badge-${opaqueItemToken(NFR)}`)).toBeInTheDocument();
    // partial hint が「チェックを入れたまま差し戻す」よう案内する（Revision 2 到達の導線）。
    const hint = within(screen.getByTestId(`partial-detail-${opaqueItemToken(NFR)}`)).getByText(/keep this item checked/i);
    expect(hint).toBeInTheDocument();
  });
});

// ============================================================
// A: Release conflation は user stance/question として提示（Product assertion ではない）
// ============================================================
describe("RC Micro-Fix A — release conflation is framed as the user's stance", () => {
  it("shows a question prompt and a first-person option, not a bare 'Completion = Release' assertion", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    for (let i = 0; i < 6; i++) await approveStep(user);
    await user.click(await screen.findByTestId("completion-approve"));
    const toRelease = screen.queryByTestId("interstitial-continue");
    if (toRelease !== null) await user.click(toRelease);

    // 設問（question）形式で提示される。
    const prompt = await screen.findByTestId("release-conflate-prompt");
    expect(prompt.textContent ?? "").toMatch(/do you treat|same decision/i);
    // checkbox の label はユーザー自身の stance（「同じ判断として扱う」）。
    const cb = screen.getByTestId("release-conflate");
    expect(cb.getAttribute("aria-label") ?? "").toMatch(/treat them as the same decision/i);
    // 裸の "Completion Approval = Release Approval" assertion は出さない。
    expect(screen.queryByText(/^AI-DLC Completion Approval = Release Approval$/)).toBeNull();
    // scoring mechanic は不変（checkbox は依然存在し操作できる）。
    await user.click(cb);
    expect((cb as HTMLInputElement).checked).toBe(true);
  });
});

// ============================================================
// E: 同一 finding について Medium と "Critical" を矛盾表示しない
// ============================================================
describe("RC Micro-Fix E — severity wording is consistent for the same finding", () => {
  it("returning a Medium finding does not label the rework reason as 'Critical'", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));
    // J1: requirement-omission（ground truth = medium）を medium で指摘して Return。
    const OMISSION = "req-item-omission";
    await user.click(screen.getByTestId(`review-item-${opaqueItemToken(OMISSION)}`));
    const sev = screen.queryByTestId(`review-sev-${opaqueItemToken(OMISSION)}-medium`);
    if (sev !== null) await user.click(sev);
    await user.selectOptions(screen.getByTestId("review-gate"), "return-for-rework");
    await user.click(screen.getByTestId("review-submit"));
    await user.click(screen.getByTestId("feedback-rework"));

    // RevisionBanner の差し戻し理由は severity-neutral（"Critical" と断定しない）。
    const banner = screen.getByTestId("revision-banner");
    expect(banner.textContent ?? "").not.toMatch(/\bCritical\b/);
    // 差し戻し理由は reviewer finding ベースの中立表現。
    expect(banner.textContent ?? "").toMatch(/reviewer finding/i);
  });
});
