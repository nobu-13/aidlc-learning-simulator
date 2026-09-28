// UI 用の presentation state controller（/app）。
// domain logic は持たず、domain 関数（progression/result/feedback/dashboard）を呼び出して結果を
// presentation state に反映する（BR8.1）。localStorage 永続を ProgressStore 経由でフローに接続する。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Application } from "./application-orchestrator.ts";
import type {
  DecisionRecord,
  ExperienceMode,
  LearningResult,
  Locale,
  ScenarioSession,
  ValidatedScenario,
} from "../domain/entities.ts";
import {
  advanceStage,
  recordDecision,
  startScenario,
  type ProgressionState,
} from "../domain/scenario-progression.ts";
import { buildLearningResult } from "../domain/result-model.ts";
import { buildFeedbackCard, type FeedbackCard } from "../domain/feedback-model.ts";
import { buildResultDashboard, type ResultDashboard } from "../domain/result-summary.ts";
import { emptyProgress, type PersistedProgress } from "../data/progress-store.ts";

export type View =
  | "home"
  | "mode-select"
  | "focus-library"
  | "practice-library"
  | "practice"
  | "scenario-intro"
  | "scenario"
  | "result"
  | "reflection"
  | "adoption"
  | "error";

export interface AppState {
  readonly view: View;
  readonly locale: Locale;
  readonly mode: ExperienceMode;
  readonly scenario?: ValidatedScenario | undefined;
  readonly progression?: ProgressionState | undefined;
  readonly result?: LearningResult | undefined;
  /** 現在の DecisionPoint（scenario view で提示するもの）。undefined は「提示対象なし」。 */
  readonly currentDecisionPointId?: string | undefined;
  /** 直近 decision の feedback を表示中か。 */
  readonly showFeedback: boolean;
  /** feedback view で表示する Feedback Card（選択に応じて決定的に構築）。 */
  readonly feedback?: FeedbackCard | undefined;
  /** result view で表示する Dashboard（決定的に構築）。 */
  readonly dashboard?: ResultDashboard | undefined;
  /** 選択中の practice id（practice view）。 */
  readonly practiceId?: string | undefined;
  /** 復元通知（"corrupt" | "incompatible" | "restored" | null）。 */
  readonly recovered?: "corrupt" | "incompatible" | "restored" | null;
  /** runtime の DomainInvariantError 等で errored 遷移したときのメッセージ（握り潰さない）。 */
  readonly runtimeErrorMessage?: string | undefined;
}

/** runtime エラーを握り潰さず、制御された error view へ遷移する（DomainInvariantError never swallowed）。 */
function toErrored(s: AppState, error: unknown): AppState {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return { ...s, view: "error", runtimeErrorMessage: message };
}

export interface AppApi {
  readonly state: AppState;
  setLocale(locale: Locale): void;
  setMode(mode: ExperienceMode): void;
  goHome(): void;
  goModeSelect(): void;
  goFocusLibrary(): void;
  goPracticeLibrary(): void;
  choosePractice(practiceId: string): void;
  chooseScenario(scenarioId: string): void;
  beginScenario(): void;
  choose(optionId: string, note?: string): void;
  proceed(): void;
  goBack(): void;
  retry(): void;
  toReflection(): void;
  toAdoption(): void;
  resetProgress(): void;
  dismissRecovered(): void;
}

/** 現 Stage の「次に提示する DecisionPoint」を決める（未回答の最初の DecisionPoint）。 */
function nextDecisionPointId(
  scenario: ValidatedScenario,
  progression: ProgressionState,
): string | undefined {
  const stageId = progression.session.currentStageId;
  if (stageId === undefined) return undefined;
  const stage = scenario.stages.get(stageId);
  if (stage === undefined) return undefined;
  const answered = new Set(progression.decisionRecords.map((r) => r.decisionPointId));
  return stage.decisionPointIds.find((dp) => !answered.has(dp));
}

/** in-progress の scenario 進捗を PersistedProgress へ落とし込む（stable-ID のみ・表示文言なし）。 */
function toPersisted(state: AppState): PersistedProgress {
  const base = emptyProgress(state.locale);
  const sessions: ScenarioSession[] = [];
  const decisionRecords: DecisionRecord[] = [];
  const completed: string[] = [];
  if (state.progression !== undefined) {
    sessions.push(state.progression.session);
    decisionRecords.push(...state.progression.decisionRecords);
    if (state.progression.session.status === "completed") {
      completed.push(state.progression.session.scenarioId);
    }
  }
  return {
    ...base,
    sessions,
    decisionRecords,
    completedScenarioIds: completed,
  };
}

/** PersistedProgress から scenario 進捗を復元する（catalog に存在し、整合するもののみ）。 */
function restoreFrom(
  app: Application,
  persisted: PersistedProgress,
): Pick<AppState, "scenario" | "progression" | "currentDecisionPointId" | "view"> | null {
  const session = persisted.sessions[0];
  if (session === undefined) return null;
  if (session.status !== "in-progress") return null;
  const scenario = app.getScenario(session.scenarioId);
  if (scenario === undefined) return null;
  const records = persisted.decisionRecords
    .filter((r) => r.sessionId === session.sessionId)
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex);
  // currentStageId が scenario の stage 列に存在することを確認（不正なら復元しない → controlled fallback）。
  if (session.currentStageId === undefined || !scenario.stages.has(session.currentStageId)) {
    return null;
  }
  const progression: ProgressionState = { session, decisionRecords: records };
  const dp = nextDecisionPointId(scenario, progression);
  return { scenario, progression, currentDecisionPointId: dp, view: "scenario" };
}

export function useAppState(app: Application): AppApi {
  const hasScenarios = app.catalog.orderedScenarioIds.length > 0;

  const [state, setState] = useState<AppState>(() => {
    if (!hasScenarios) {
      return { view: "error", locale: app.locale, mode: "guided", showFeedback: false };
    }
    // 起動時に localStorage から復元を試みる（BUG 4.5 / FR11）。
    const loaded = app.store.load(app.locale);
    const base: AppState = {
      view: "home",
      locale: loaded.progress.locale,
      mode: "guided",
      showFeedback: false,
      recovered: loaded.recovered,
    };
    const restored = restoreFrom(app, loaded.progress);
    if (restored !== null) {
      return { ...base, ...restored, view: "home", recovered: "restored" };
    }
    return base;
  });

  // 復元可能な in-progress 進捗を保持（Home の「続きから」導線用）。
  const resumableRef = useRef<AppState | null>(null);
  useEffect(() => {
    if (resumableRef.current === null && state.progression?.session.status === "in-progress") {
      resumableRef.current = state;
    }
  }, [state]);

  // state 変化のたびに永続化する（in-progress / completed を保存）。
  const persist = useCallback(
    (next: AppState) => {
      try {
        app.store.save(toPersisted(next));
      } catch {
        // 保存失敗は学習継続を妨げない（次回起動時に safe fallback）。
      }
    },
    [app],
  );

  const update = useCallback(
    (fn: (s: AppState) => AppState, opts?: { persist?: boolean }) => {
      setState((s) => {
        const next = fn(s);
        if (opts?.persist) persist(next);
        return next;
      });
    },
    [persist],
  );

  const setLocale = useCallback(
    (locale: Locale) => {
      // 言語切替は presentation のみ。進捗・decision・note を失わない（FR10.3）。
      update((s) => ({ ...s, locale }), { persist: true });
    },
    [update],
  );

  const setMode = useCallback((mode: ExperienceMode) => update((s) => ({ ...s, mode })), [update]);

  const goHome = useCallback(() => update((s) => ({ ...s, view: "home" })), [update]);
  const goModeSelect = useCallback(() => update((s) => ({ ...s, view: "mode-select" })), [update]);
  const goFocusLibrary = useCallback(() => update((s) => ({ ...s, view: "focus-library" })), [update]);
  const goPracticeLibrary = useCallback(
    () => update((s) => ({ ...s, view: "practice-library" })),
    [update],
  );
  const choosePractice = useCallback(
    (practiceId: string) => update((s) => ({ ...s, practiceId, view: "practice" })),
    [update],
  );

  const chooseScenario = useCallback(
    (scenarioId: string) => {
      const scenario = app.getScenario(scenarioId);
      if (scenario === undefined) {
        update((s) => ({ ...s, view: "error" }));
        return;
      }
      update((s) => ({ ...s, scenario, view: "scenario-intro" }));
    },
    [app, update],
  );

  const beginScenario = useCallback(() => {
    update(
      (s) => {
        if (s.scenario === undefined) return { ...s, view: "error" };
        try {
          const progression = startScenario(s.scenario);
          const dp = nextDecisionPointId(s.scenario, progression);
          return {
            ...s,
            progression,
            currentDecisionPointId: dp,
            view: "scenario",
            showFeedback: false,
            feedback: undefined,
            result: undefined,
            dashboard: undefined,
          };
        } catch (e) {
          return toErrored(s, e);
        }
      },
      { persist: true },
    );
  }, [update]);

  const choose = useCallback(
    (optionId: string, note?: string) => {
      update(
        (s) => {
          if (
            s.scenario === undefined ||
            s.progression === undefined ||
            s.currentDecisionPointId === undefined
          ) {
            return s;
          }
          try {
            const progression = recordDecision(
              s.scenario,
              s.progression,
              s.currentDecisionPointId,
              optionId,
              note,
            );
            const feedback = buildFeedbackCard(s.scenario, s.currentDecisionPointId, optionId);
            return { ...s, progression, showFeedback: true, feedback };
          } catch (e) {
            return toErrored(s, e);
          }
        },
        { persist: true },
      );
    },
    [update],
  );

  const proceed = useCallback(() => {
    update(
      (s) => {
        if (s.scenario === undefined || s.progression === undefined) return s;
        const scenario = s.scenario;
        try {
          const remaining = nextDecisionPointId(scenario, s.progression);
          if (remaining !== undefined) {
            return { ...s, currentDecisionPointId: remaining, showFeedback: false, feedback: undefined };
          }
          const progression = advanceStage(scenario, s.progression);
          if (progression.session.status === "completed") {
            const result = buildLearningResult(
              scenario,
              progression.session.sessionId,
              progression.decisionRecords,
            );
            const dashboard = buildResultDashboard(
              scenario,
              result,
              progression.decisionRecords,
              app.catalog.orderedScenarioIds,
            );
            return {
              ...s,
              progression,
              result,
              dashboard,
              view: "result",
              showFeedback: false,
              feedback: undefined,
            };
          }
          const dp = nextDecisionPointId(scenario, progression);
          return { ...s, progression, currentDecisionPointId: dp, showFeedback: false, feedback: undefined };
        } catch (e) {
          return toErrored(s, e);
        }
      },
      { persist: true },
    );
  }, [update, app]);

  // 直前の判断へ戻る（feedback 表示中は入力へ戻す。決定的な safe transition・RC2 §16）。
  const goBack = useCallback(() => {
    update((s) => {
      if (s.showFeedback) {
        // feedback 表示中 → 最後の decision を取り消して選び直す。
        if (s.scenario === undefined || s.progression === undefined) {
          return { ...s, showFeedback: false, feedback: undefined };
        }
        const records = s.progression.decisionRecords;
        const last = records[records.length - 1];
        if (last === undefined) return { ...s, showFeedback: false, feedback: undefined };
        const trimmed = records.slice(0, -1);
        const progression: ProgressionState = {
          session: {
            ...s.progression.session,
            decisionRecordIds: trimmed.map((r) => r.decisionRecordId),
          },
          decisionRecords: trimmed,
        };
        return {
          ...s,
          progression,
          currentDecisionPointId: last.decisionPointId,
          showFeedback: false,
          feedback: undefined,
        };
      }
      return { ...s, view: "home" };
    }, { persist: true });
  }, [update]);

  const retry = useCallback(() => {
    update(
      (s) => {
        if (s.scenario === undefined) return { ...s, view: "home" };
        try {
          const progression = startScenario(s.scenario);
          const dp = nextDecisionPointId(s.scenario, progression);
          return {
            ...s,
            progression,
            currentDecisionPointId: dp,
            view: "scenario",
            showFeedback: false,
            feedback: undefined,
            result: undefined,
            dashboard: undefined,
          };
        } catch (e) {
          return toErrored(s, e);
        }
      },
      { persist: true },
    );
  }, [update]);

  const toReflection = useCallback(() => update((s) => ({ ...s, view: "reflection" })), [update]);
  const toAdoption = useCallback(() => update((s) => ({ ...s, view: "adoption" })), [update]);

  const resetProgress = useCallback(() => {
    app.store.userReset();
    resumableRef.current = null;
    setState((s) => ({
      view: "home",
      locale: s.locale,
      mode: s.mode,
      showFeedback: false,
      recovered: null,
    }));
  }, [app]);

  const dismissRecovered = useCallback(() => update((s) => ({ ...s, recovered: null })), [update]);

  return useMemo(
    () => ({
      state,
      setLocale,
      setMode,
      goHome,
      goModeSelect,
      goFocusLibrary,
      goPracticeLibrary,
      choosePractice,
      chooseScenario,
      beginScenario,
      choose,
      proceed,
      goBack,
      retry,
      toReflection,
      toAdoption,
      resetProgress,
      dismissRecovered,
    }),
    [
      state,
      setLocale,
      setMode,
      goHome,
      goModeSelect,
      goFocusLibrary,
      goPracticeLibrary,
      choosePractice,
      chooseScenario,
      beginScenario,
      choose,
      proceed,
      goBack,
      retry,
      toReflection,
      toAdoption,
      resetProgress,
      dismissRecovered,
    ],
  );
}
