// UI 用の presentation state controller（/app）。
// domain logic は持たず、domain 関数（progression/result）を呼び出して結果を presentation state に反映する（BR8.1）。
import { useCallback, useMemo, useState } from "react";
import type { Application } from "./application-orchestrator.ts";
import type {
  ExperienceMode,
  LearningResult,
  Locale,
  ValidatedScenario,
} from "../domain/entities.ts";
import {
  advanceStage,
  recordDecision,
  startScenario,
  type ProgressionState,
} from "../domain/scenario-progression.ts";
import { buildLearningResult } from "../domain/result-model.ts";

export type View =
  | "home"
  | "mode-select"
  | "focus-library"
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
  chooseScenario(scenarioId: string): void;
  beginScenario(): void;
  choose(optionId: string, note?: string): void;
  proceed(): void;
  toReflection(): void;
  toAdoption(): void;
  resetProgress(): void;
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

export function useAppState(app: Application): AppApi {
  const hasScenarios = app.catalog.orderedScenarioIds.length > 0;
  const [state, setState] = useState<AppState>(() => ({
    view: hasScenarios ? "home" : "error",
    locale: app.locale,
    mode: "guided",
    showFeedback: false,
  }));

  const setLocale = useCallback((locale: Locale) => {
    // 言語切替は presentation のみ。進捗・decision・note を失わない（FR10.3）。
    setState((s) => ({ ...s, locale }));
  }, []);

  const setMode = useCallback((mode: ExperienceMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const goHome = useCallback(() => setState((s) => ({ ...s, view: "home" })), []);
  const goModeSelect = useCallback(() => setState((s) => ({ ...s, view: "mode-select" })), []);
  const goFocusLibrary = useCallback(() => setState((s) => ({ ...s, view: "focus-library" })), []);

  const chooseScenario = useCallback(
    (scenarioId: string) => {
      const scenario = app.getScenario(scenarioId);
      if (scenario === undefined) {
        setState((s) => ({ ...s, view: "error" }));
        return;
      }
      setState((s) => ({ ...s, scenario, view: "scenario-intro" }));
    },
    [app],
  );

  const beginScenario = useCallback(() => {
    setState((s) => {
      if (s.scenario === undefined) return { ...s, view: "error" };
      try {
        const progression = startScenario(s.scenario);
        const dp = nextDecisionPointId(s.scenario, progression);
        return { ...s, progression, currentDecisionPointId: dp, view: "scenario", showFeedback: false };
      } catch (e) {
        return toErrored(s, e);
      }
    });
  }, []);

  const choose = useCallback((optionId: string, note?: string) => {
    setState((s) => {
      if (s.scenario === undefined || s.progression === undefined || s.currentDecisionPointId === undefined) {
        return s;
      }
      // runtime の DomainInvariantError は握り潰さず、制御された error view へ遷移する
      // （nfr-design の error handling 2-way split: 期待される domain error → ErrorView）。
      try {
        const progression = recordDecision(s.scenario, s.progression, s.currentDecisionPointId, optionId, note);
        return { ...s, progression, showFeedback: true };
      } catch (e) {
        return toErrored(s, e);
      }
    });
  }, []);

  const proceed = useCallback(() => {
    setState((s) => {
      if (s.scenario === undefined || s.progression === undefined) return s;
      const scenario = s.scenario;
      try {
        // 現 Stage 内に未回答 DecisionPoint が残っていればそれを提示、無ければ Stage を進める。
        const remaining = nextDecisionPointId(scenario, s.progression);
        if (remaining !== undefined) {
          return { ...s, currentDecisionPointId: remaining, showFeedback: false };
        }
        const progression = advanceStage(scenario, s.progression);
        if (progression.session.status === "completed") {
          const result = buildLearningResult(scenario, progression.session.sessionId, progression.decisionRecords);
          return { ...s, progression, result, view: "result", showFeedback: false };
        }
        const dp = nextDecisionPointId(scenario, progression);
        return { ...s, progression, currentDecisionPointId: dp, showFeedback: false };
      } catch (e) {
        return toErrored(s, e);
      }
    });
  }, []);

  const toReflection = useCallback(() => setState((s) => ({ ...s, view: "reflection" })), []);
  const toAdoption = useCallback(() => setState((s) => ({ ...s, view: "adoption" })), []);

  const resetProgress = useCallback(() => {
    app.store.userReset();
    setState((s) => ({
      view: "home",
      locale: s.locale,
      mode: s.mode,
      showFeedback: false,
    }));
  }, [app]);

  return useMemo(
    () => ({
      state,
      setLocale,
      setMode,
      goHome,
      goModeSelect,
      goFocusLibrary,
      chooseScenario,
      beginScenario,
      choose,
      proceed,
      toReflection,
      toAdoption,
      resetProgress,
    }),
    [
      state,
      setLocale,
      setMode,
      goHome,
      goModeSelect,
      goFocusLibrary,
      chooseScenario,
      beginScenario,
      choose,
      proceed,
      toReflection,
      toAdoption,
      resetProgress,
    ],
  );
}
