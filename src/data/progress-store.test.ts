import { describe, it, expect } from "vitest";
import {
  ProgressStore,
  emptyProgress,
  PERSISTENCE_SCHEMA_VERSION,
  type PersistedProgress,
  type StoragePort,
} from "./progress-store.ts";

const KEY = "aidlc-learning-simulator/progress/v1";

function fakeStorage(initial?: Record<string, string>): StoragePort & { data: Record<string, string> } {
  const data: Record<string, string> = { ...(initial ?? {}) };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function sampleProgress(): PersistedProgress {
  return {
    persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
    locale: "ja",
    mode: "guided",
    sessions: [{ sessionId: "sess-1", scenarioId: "s1", status: "in-progress", decisionRecordIds: ["dr-1"] }],
    decisionRecords: [
      { decisionRecordId: "dr-1", sessionId: "sess-1", decisionPointId: "dp1", chosenDecisionOptionId: "o1", orderIndex: 0 },
    ],
    completedScenarioIds: [],
    adoptionMemos: [],
    workshopInputs: {},
    practiceDrafts: {},
    journey: null,
  };
}

describe("ProgressStore", () => {
  it("空状態を返す（未保存時）", () => {
    const store = new ProgressStore(fakeStorage());
    const { progress, recovered } = store.load("en");
    expect(recovered).toBeNull();
    expect(progress).toEqual(emptyProgress("en"));
  });

  it("save→load の round-trip が stable-ID を保つ（BR6.1）", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    store.save(sampleProgress());
    const { progress, recovered } = store.load("en");
    expect(recovered).toBeNull();
    expect(progress.sessions[0]?.sessionId).toBe("sess-1");
    expect(progress.decisionRecords[0]?.chosenDecisionOptionId).toBe("o1");
  });

  it("破損 JSON は PersistenceError を漏らさず safe reset する（BR6.3）", () => {
    const store = new ProgressStore(fakeStorage({ [KEY]: "{not valid json" }));
    const { progress, recovered } = store.load("ja");
    expect(recovered).toBe("corrupt");
    expect(progress).toEqual(emptyProgress("ja"));
  });

  it("型不一致（破損 object）も safe reset する（BR6.3）", () => {
    const store = new ProgressStore(fakeStorage({ [KEY]: JSON.stringify({ persistenceSchemaVersion: 1, locale: "ja", sessions: "oops" }) }));
    const { progress, recovered } = store.load("ja");
    expect(recovered).toBe("corrupt");
    expect(progress.sessions).toHaveLength(0);
  });

  it("非互換 persistenceSchemaVersion は silent coercion せず safe reset する（BR6.2）", () => {
    const store = new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: 999,
          locale: "ja",
          sessions: [],
          decisionRecords: [],
          completedScenarioIds: [],
          adoptionMemos: [],
        }),
      }),
    );
    const { progress, recovered } = store.load("ja");
    expect(recovered).toBe("incompatible");
    expect(progress).toEqual(emptyProgress("ja"));
  });

  it("v1 データは additive migration で受理し scenario 進捗を失わない（v1→v2）", () => {
    const store = new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: 1,
          locale: "ja",
          sessions: [{ sessionId: "sess-1", scenarioId: "s1", status: "in-progress", decisionRecordIds: ["dr-1"] }],
          decisionRecords: [
            { decisionRecordId: "dr-1", sessionId: "sess-1", decisionPointId: "dp1", chosenDecisionOptionId: "o1", orderIndex: 0 },
          ],
          completedScenarioIds: [],
          adoptionMemos: [],
        }),
      }),
    );
    const { progress, recovered } = store.load("ja");
    expect(recovered).toBeNull();
    // scenario 進捗は保持。
    expect(progress.sessions[0]?.sessionId).toBe("sess-1");
    // 追加フィールドは空で補完され、version は最新へ。
    expect(progress.persistenceSchemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(progress.mode).toBe("guided");
    expect(progress.workshopInputs).toEqual({});
    expect(progress.practiceDrafts).toEqual({});
    // v3 で追加した journey は空（null）で補完される。
    expect(progress.journey).toBeNull();
  });

  it("v2 データは additive migration で受理し journey は空で開始する（v2→v3・RC2 controlled transition）", () => {
    const store = new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: 2,
          locale: "ja",
          mode: "simulation",
          sessions: [{ sessionId: "sess-1", scenarioId: "s1", status: "in-progress", decisionRecordIds: [] }],
          decisionRecords: [],
          completedScenarioIds: [],
          adoptionMemos: [],
          workshopInputs: { "project-context": "kept" },
          practiceDrafts: {},
        }),
      }),
    );
    const { progress, recovered } = store.load("ja");
    // RC2 in-progress state は corruption 扱いにしない（安全に維持）。
    expect(recovered).toBeNull();
    expect(progress.persistenceSchemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(progress.sessions[0]?.sessionId).toBe("sess-1");
    expect(progress.workshopInputs["project-context"]).toBe("kept");
    // RC2 の scenario は RC3 Journey へ変換しない。
    expect(progress.journey).toBeNull();
  });

  it("v3 journey が round-trip する", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      journey: {
        mode: "simulation",
        profileId: "user",
        currentStepId: "j3-design",
        userAuthored: { goal: "g" },
        structured: { dataSensitivity: "personal-info" },
        revisions: { "j1-requirements": 1 },
        completedStepIds: ["j1-requirements", "j2-acceptance-scope"],
        reworkHistory: [
          { fromStepId: "j3-design", toStepId: "j1-requirements", action: "return", trigger: "critical-finding", atRevision: 1 },
        ],
        reviews: { "j2-acceptance-scope": { findings: [{ itemId: "ac-item-mismatch" }], gateDecision: "approve" } },
        releaseConflated: false,
      },
    };
    store.save(p);
    const { progress } = store.load("ja");
    expect(progress.journey?.currentStepId).toBe("j3-design");
    expect(progress.journey?.completedStepIds).toContain("j1-requirements");
    expect(progress.journey?.reworkHistory[0]?.trigger).toBe("critical-finding");
  });

  it("v2 の workshopInputs / practiceDrafts が round-trip する", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      workshopInputs: { "project-context": "my ctx" },
      practiceDrafts: { "req-create": { goal: "g" } },
    };
    store.save(p);
    const { progress } = store.load("ja");
    expect(progress.workshopInputs["project-context"]).toBe("my ctx");
    expect(progress.practiceDrafts["req-create"]?.goal).toBe("g");
  });

  it("userReset は localStorage をクリアする（NFR7.5a）", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    store.save(sampleProgress());
    expect(s.data[KEY]).toBeDefined();
    store.userReset();
    expect(s.data[KEY]).toBeUndefined();
    expect(store.load("ja").progress).toEqual(emptyProgress("ja"));
  });
});
