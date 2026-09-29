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

  it("valid v4 journey（必須 field 込み）が round-trip する", () => {
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
        // v4 必須 field。
        artifactVersions: { "j1-requirements": 1 },
        materializedSteps: { "j1-requirements": true },
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

  // ===== RC4 Persistence v4 =====
  it("v4: artifactVersions / materializedSteps を exact round-trip する", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      journey: {
        mode: "simulation",
        profileId: "user",
        currentStepId: "j4-implementation-traceability",
        userAuthored: {},
        structured: { availability: "critical" },
        revisions: { "j3-design": 1 },
        completedStepIds: ["j1-requirements", "j2-acceptance-scope", "j3-design"],
        reworkHistory: [],
        reviews: {},
        // v4 新規: exact 保存対象。
        artifactVersions: { "j3-design": 1, "j4-implementation-traceability": 1 },
        materializedSteps: { "j3-design": true, "j4-implementation-traceability": true },
        releaseConflated: false,
      },
    };
    store.save(p);
    const { progress, recovered } = store.load("ja");
    expect(recovered).toBeNull();
    expect(progress.journey?.artifactVersions).toEqual({
      "j3-design": 1,
      "j4-implementation-traceability": 1,
    });
    expect(progress.journey?.materializedSteps).toEqual({
      "j3-design": true,
      "j4-implementation-traceability": true,
    });
  });

  it("v4: local rework state（revision=1 / artifactVersion=1）を維持する", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      journey: {
        mode: "simulation",
        profileId: "user",
        currentStepId: "j3-design",
        userAuthored: {},
        structured: {},
        revisions: { "j3-design": 1 },
        completedStepIds: [],
        reworkHistory: [],
        reviews: {},
        artifactVersions: { "j3-design": 1 },
        materializedSteps: { "j3-design": true },
        releaseConflated: false,
      },
    };
    store.save(p);
    const { progress } = store.load("ja");
    expect(progress.journey?.revisions["j3-design"]).toBe(1);
    expect(progress.journey?.artifactVersions?.["j3-design"]).toBe(1);
  });

  it("v4: propagation state（revision=0 / artifactVersion=1）を維持する（revision != artifactVersion）", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      journey: {
        mode: "simulation",
        profileId: "user",
        currentStepId: "j4-implementation-traceability",
        userAuthored: {},
        structured: {},
        revisions: {}, // downstream は local rework していない = revision 0。
        completedStepIds: [],
        reworkHistory: [],
        reviews: {},
        artifactVersions: { "j4-implementation-traceability": 1 }, // propagation で +1。
        materializedSteps: { "j4-implementation-traceability": true },
        releaseConflated: false,
      },
    };
    store.save(p);
    const { progress } = store.load("ja");
    // revision 0 だが artifactVersion 1 が維持される（reload で fallback へ戻さない）。
    expect(progress.journey?.revisions["j4-implementation-traceability"]).toBeUndefined();
    expect(progress.journey?.artifactVersions?.["j4-implementation-traceability"]).toBe(1);
  });

  it("v4: mixed state（複数 step で異なる revision/artifactVersion）を exact 維持する", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      journey: {
        mode: "simulation",
        profileId: "user",
        currentStepId: "j3-design",
        userAuthored: {},
        structured: {},
        revisions: { "j1-requirements": 1 },
        completedStepIds: [],
        reworkHistory: [],
        reviews: {},
        artifactVersions: {
          "j1-requirements": 1, // local rework: rev 1 / ver 1
          "j2-acceptance-scope": 1, // propagation: rev 0 / ver 1
          "j3-design": 0, // 未変更: rev 0 / ver 0
        },
        materializedSteps: {
          "j1-requirements": true,
          "j2-acceptance-scope": true,
          "j3-design": true,
        },
        releaseConflated: false,
      },
    };
    store.save(p);
    const { progress } = store.load("ja");
    expect(progress.journey?.artifactVersions).toEqual({
      "j1-requirements": 1,
      "j2-acceptance-scope": 1,
      "j3-design": 0,
    });
    expect(progress.journey?.revisions).toEqual({ "j1-requirements": 1 });
  });

  it("v4: materializedSteps の true / false を exact round-trip する", () => {
    const s = fakeStorage();
    const store = new ProgressStore(s);
    const p: PersistedProgress = {
      ...sampleProgress(),
      journey: {
        mode: "guided",
        profileId: "sample",
        currentStepId: "j2-acceptance-scope",
        userAuthored: {},
        structured: {},
        revisions: {},
        completedStepIds: ["j1-requirements"],
        reworkHistory: [],
        reviews: {},
        artifactVersions: {},
        materializedSteps: { "j1-requirements": true, "j2-acceptance-scope": false },
        releaseConflated: false,
      },
    };
    store.save(p);
    const { progress } = store.load("ja");
    expect(progress.journey?.materializedSteps).toEqual({
      "j1-requirements": true,
      "j2-acceptance-scope": false,
    });
  });

  it("v3 journey は safe reset される（journey=null・heuristic migration しない）", () => {
    // v3（旧版）に journey が含まれる。artifactVersions/materializedSteps は存在しない。
    const store = new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: 3,
          locale: "ja",
          mode: "simulation",
          sessions: [{ sessionId: "sess-1", scenarioId: "s1", status: "in-progress", decisionRecordIds: [] }],
          decisionRecords: [],
          completedScenarioIds: [],
          adoptionMemos: [],
          workshopInputs: {},
          practiceDrafts: {},
          journey: {
            mode: "simulation",
            profileId: "user",
            currentStepId: "j3-design",
            userAuthored: {},
            structured: {},
            revisions: { "j3-design": 2 },
            completedStepIds: ["j1-requirements", "j2-acceptance-scope"],
            reworkHistory: [],
            reviews: {},
          },
        }),
      }),
    );
    const { progress, recovered } = store.load("ja");
    // journey は safe reset（null）。heuristic migration（artifactVersions=revisions 等）を行わない。
    expect(progress.journey).toBeNull();
    // 旧 journey が存在したので incompatible を通知（scenario 進捗は保持）。
    expect(recovered).toBe("incompatible");
    expect(progress.sessions[0]?.sessionId).toBe("sess-1");
    expect(progress.persistenceSchemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it("v3 journey なし（scenario のみ）は静かに migration する（journey reset 通知なし）", () => {
    const store = new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: 3,
          locale: "ja",
          mode: "guided",
          sessions: [{ sessionId: "sess-1", scenarioId: "s1", status: "in-progress", decisionRecordIds: [] }],
          decisionRecords: [],
          completedScenarioIds: [],
          adoptionMemos: [],
          workshopInputs: {},
          practiceDrafts: {},
          journey: null,
        }),
      }),
    );
    const { progress, recovered } = store.load("ja");
    expect(progress.journey).toBeNull();
    expect(recovered).toBeNull(); // reset する journey が無いので通知不要。
    expect(progress.sessions[0]?.sessionId).toBe("sess-1");
  });

  // ===== RC4 Final Integrity: missing vs empty field =====
  /** 有効な v4 journey の基本形（必須 field を差し替えてテストする土台）。 */
  function baseV4Journey(): Record<string, unknown> {
    return {
      mode: "simulation",
      profileId: "user",
      currentStepId: "j3-design",
      userAuthored: {},
      structured: {},
      revisions: { "j3-design": 1 },
      completedStepIds: [],
      reworkHistory: [],
      reviews: {},
      artifactVersions: { "j3-design": 1 },
      materializedSteps: { "j3-design": true },
      releaseConflated: false,
    };
  }
  function storeWithV4Journey(journey: Record<string, unknown>): ProgressStore {
    return new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
          locale: "ja",
          mode: "simulation",
          sessions: [],
          decisionRecords: [],
          completedScenarioIds: [],
          adoptionMemos: [],
          workshopInputs: {},
          practiceDrafts: {},
          journey,
        }),
      }),
    );
  }

  it("v4 journey + artifactVersions 欠落 → journey safe reset（default 補完しない）", () => {
    const j = baseV4Journey();
    delete j.artifactVersions; // missing field。
    const { progress } = storeWithV4Journey(j).load("ja");
    expect(progress.journey).toBeNull();
  });

  it("v4 journey + materializedSteps 欠落 → journey safe reset（default 補完しない）", () => {
    const j = baseV4Journey();
    delete j.materializedSteps; // missing field。
    const { progress } = storeWithV4Journey(j).load("ja");
    expect(progress.journey).toBeNull();
  });

  it("両方存在する正常 v4 → exact restore（safe reset しない）", () => {
    const { progress } = storeWithV4Journey(baseV4Journey()).load("ja");
    expect(progress.journey).not.toBeNull();
    expect(progress.journey?.artifactVersions).toEqual({ "j3-design": 1 });
    expect(progress.journey?.materializedSteps).toEqual({ "j3-design": true });
  });

  it("artifactVersions={} / materializedSteps={}（存在する空 record）は valid（missing ≠ empty）", () => {
    const j = baseV4Journey();
    j.artifactVersions = {};
    j.materializedSteps = {};
    const { progress } = storeWithV4Journey(j).load("ja");
    // 空 record は「未初期化」ではなく「初期状態」= valid。exact restore（reset しない）。
    expect(progress.journey).not.toBeNull();
    expect(progress.journey?.artifactVersions).toEqual({});
    expect(progress.journey?.materializedSteps).toEqual({});
  });

  it("artifactVersions が array（不正型）→ journey safe reset（empty record と区別）", () => {
    const j = baseV4Journey();
    j.artifactVersions = []; // 配列は plain record ではない = invalid。
    const { progress } = storeWithV4Journey(j).load("ja");
    expect(progress.journey).toBeNull();
  });

  it("malformed v4 journey は crash せず journey=null（safe）", () => {
    // v4 だが journey が壊れている（必須フィールド欠落）。
    const store = new ProgressStore(
      fakeStorage({
        [KEY]: JSON.stringify({
          persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
          locale: "ja",
          mode: "guided",
          sessions: [],
          decisionRecords: [],
          completedScenarioIds: [],
          adoptionMemos: [],
          workshopInputs: {},
          practiceDrafts: {},
          journey: { mode: "simulation" /* profileId 等が欠落 */ },
        }),
      }),
    );
    const { progress, recovered } = store.load("ja");
    // v4 の壊れた journey は additive 検証で null（RC2/scenario は維持・crash しない）。
    expect(progress.journey).toBeNull();
    expect(recovered).toBeNull();
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
