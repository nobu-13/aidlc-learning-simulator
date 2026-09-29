// RC5 P1-C: repeated rework semantics の E2E。
//
// MANDATORY E2E MATRIX:
//  #2 Return unresolved → rework → same step → revision increment
//  #3 Return partial → second rework → Revision 2
//  #4 Return resolved → rejected/no-op explicit → revision unchanged
//
// Critical invariant:
//  content changed  → revision increment
//  content unchanged → no increment
import { opaqueItemToken } from "../domain/semantic-id.ts";
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

const NFR = "design-item-missing-nfr";

async function approveStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.selectOptions(screen.getByTestId("review-gate"), "approve");
  await user.click(screen.getByTestId("review-submit"));
  const n = screen.queryByTestId("feedback-next");
  if (n !== null) await user.click(n);
}

/** J3(Design) まで進める。 */
async function toJ3(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId("journey-start-guided"));
  await approveStep(user);
  await approveStep(user);
}

/** NFR を high で指摘して return-for-rework → feedback rework。 */
async function returnNfr(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const cb = screen.getByTestId(`review-item-${opaqueItemToken(NFR)}`) as HTMLInputElement;
  if (!cb.checked) await user.click(cb);
  const sev = screen.queryByTestId(`review-sev-${opaqueItemToken(NFR)}-high`);
  if (sev !== null) await user.click(sev);
  await user.selectOptions(screen.getByTestId("review-gate"), "return-for-rework");
  await user.click(screen.getByTestId("review-submit"));
  const rw = screen.queryByTestId("feedback-rework");
  if (rw !== null) await user.click(rw);
}

describe("RC5 P1-C — partial rework reaches Revision 2, resolved re-return is rejected", () => {
  it("#3 Return partial → second Return → Revision 2（content 変化で revision increment）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await toJ3(user);
    expect(screen.queryByTestId("revision-banner")).toBeNull(); // Rev 0

    await returnNfr(user); // Rev1 partial
    expect(screen.getByTestId("revision-label")).toHaveTextContent("1");
    expect(screen.getByTestId(`partial-badge-${opaqueItemToken(NFR)}`)).toBeInTheDocument();

    await returnNfr(user); // Rev2 resolved
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");
    expect(screen.getByTestId(`resolved-badge-${opaqueItemToken(NFR)}`)).toBeInTheDocument();
  });

  it("#4 Return resolved item → explicit rejection（fake revision を作らない）", async () => {
    const user = userEvent.setup();
    render(<App application={makeApp()} />);
    await toJ3(user);
    await returnNfr(user); // Rev1
    await returnNfr(user); // Rev2 resolved
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");

    // 既に resolved の NFR を再選択して Return → 明示拒否・revision は 2 のまま。
    await returnNfr(user);
    expect(screen.getByTestId("rework-rejected")).toBeInTheDocument();
    expect(screen.getByTestId("revision-label")).toHaveTextContent("2");

    // dismiss で通知が消える。
    await user.click(screen.getByTestId("rework-rejected-dismiss"));
    expect(screen.queryByTestId("rework-rejected")).toBeNull();
  });
});
