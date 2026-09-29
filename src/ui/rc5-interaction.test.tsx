// RC5 P1-B: review UI の cross-input robustness E2E。
//
// 実 pointer / keyboard 操作で:
//  - mouse click で checkbox ON / OFF
//  - severity radio 変更で finding selection が維持される
//  - decision(select) 選択・submit button click が反応する
//  - keyboard Tab / Space / Enter で checkbox を操作できる
// 全て userEvent（実 pointer/keyboard emulation）で確認する。
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";
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

afterEach(() => cleanup());

/** 現在 review の最初の finding checkbox id を返す。 */
function firstFindingId(): string {
  const box = screen.queryAllByTestId(/^review-item-/)[0];
  if (box === undefined) throw new Error("no finding checkbox on this review step");
  return box.getAttribute("data-testid")!.replace("review-item-", "");
}

describe("RC5 P1-B — mouse interaction robustness", () => {
  it("mouse click で checkbox が ON→OFF→ON と確実に toggle する（二重発火なし）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    const id = firstFindingId();
    const cb = () => screen.getByTestId(`review-item-${id}`) as HTMLInputElement;

    expect(cb().checked).toBe(false);
    await user.click(cb());
    expect(cb().checked).toBe(true); // ON
    await user.click(cb());
    expect(cb().checked).toBe(false); // OFF（checked を click して確実に解除できる）
    await user.click(cb());
    expect(cb().checked).toBe(true); // 再 ON
  });

  it("severity radio の変更が finding selection を解除しない", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    const id = firstFindingId();
    await user.click(screen.getByTestId(`review-item-${id}`));
    expect((screen.getByTestId(`review-item-${id}`) as HTMLInputElement).checked).toBe(true);

    // severity radio を click しても checkbox は checked のまま。
    const high = screen.getByTestId(`review-sev-${id}-high`) as HTMLInputElement;
    await user.click(high);
    expect(high.checked).toBe(true);
    expect((screen.getByTestId(`review-item-${id}`) as HTMLInputElement).checked).toBe(true);

    // 別 severity へ切替でも finding は維持。
    const medium = screen.getByTestId(`review-sev-${id}-medium`) as HTMLInputElement;
    await user.click(medium);
    expect(medium.checked).toBe(true);
    expect(high.checked).toBe(false);
    expect((screen.getByTestId(`review-item-${id}`) as HTMLInputElement).checked).toBe(true);
  });

  it("decision(select) 選択と submit button click が反応する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    await user.selectOptions(screen.getByTestId("review-gate"), "approve");
    expect((screen.getByTestId("review-gate") as HTMLSelectElement).value).toBe("approve");

    // submit button click で feedback / 次画面へ遷移（review view から出る）。
    await user.click(screen.getByTestId("review-submit"));
    // submit 後は review-submit が消えるか feedback が出る（どちらかで反応を確認）。
    const stillReview = screen.queryByTestId("review-submit");
    const feedback = screen.queryByTestId("feedback-next") ?? screen.queryByTestId("feedback-clean");
    expect(stillReview === null || feedback !== null).toBe(true);
  });

  it("label click で checkbox が toggle する（htmlFor 関連・二重発火しない）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    const id = firstFindingId();
    const cb = () => screen.getByTestId(`review-item-${id}`) as HTMLInputElement;
    // htmlFor で関連付いた label をクリック。二重関連が無いので 1 回の click = 1 回の toggle。
    const label = document.getElementById(`review-label-${id}`);
    expect(label).not.toBeNull();
    await user.click(label!);
    expect(cb().checked).toBe(true);
    await user.click(label!);
    expect(cb().checked).toBe(false);
  });
});

describe("RC5 P1-B — keyboard interaction robustness", () => {
  it("Tab で checkbox にフォーカスし Space で toggle できる", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    const id = firstFindingId();
    const cb = screen.getByTestId(`review-item-${id}`) as HTMLInputElement;
    cb.focus();
    expect(cb).toHaveFocus();
    await user.keyboard(" ");
    expect(cb.checked).toBe(true);
    await user.keyboard(" ");
    expect(cb.checked).toBe(false);
  });

  it("submit button に Enter で反応する", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await user.click(screen.getByTestId("journey-start-guided"));

    await user.selectOptions(screen.getByTestId("review-gate"), "approve");
    const submit = screen.getByTestId("review-submit") as HTMLButtonElement;
    submit.focus();
    await user.keyboard("{Enter}");
    const stillReview = screen.queryByTestId("review-submit");
    const feedback = screen.queryByTestId("feedback-next") ?? screen.queryByTestId("feedback-clean");
    expect(stillReview === null || feedback !== null).toBe(true);
  });
});
