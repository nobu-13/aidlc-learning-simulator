// App root — orchestrator を組み立て、view flow を routing する。
import { useMemo } from "react";
import { createApplication, type Application } from "./application-orchestrator.ts";
import { browserStorage } from "../data/progress-store.ts";
import { scenarioModules } from "../scenarios/index.ts";
import { useAppState } from "./use-app-state.ts";
import { ErrorBoundary } from "../ui/error-boundary.tsx";
import {
  AdoptionReviewView,
  ErrorView,
  FocusLibraryView,
  HomeView,
  LangSwitcher,
  ModeSelectView,
  ReflectionView,
  ResultView,
  ScenarioIntroView,
  ScenarioView,
} from "../ui/app-views.tsx";

/** テスト用に Application を注入できるよう props で受け取れる。既定は本番構成。 */
export function App(props: { application?: Application }): JSX.Element {
  const application = useMemo(
    () =>
      props.application ??
      createApplication({
        scenarioModules,
        storage: browserStorage(),
        browserLanguages: typeof navigator !== "undefined" ? [...navigator.languages] : undefined,
      }),
    [props.application],
  );

  const app = useAppState(application);
  const resolver = application.resolverFor(app.state.locale);
  const t = resolver.t;

  return (
    <ErrorBoundary title={t("boundary.title")} body={t("boundary.body")}>
      <main>
        <LangSwitcher app={app} t={t} />
        {renderView()}
      </main>
    </ErrorBoundary>
  );

  function renderView(): JSX.Element {
    switch (app.state.view) {
      case "home":
        return <HomeView app={app} t={t} />;
      case "mode-select":
        return <ModeSelectView app={app} t={t} />;
      case "focus-library":
        return <FocusLibraryView app={app} application={application} t={t} />;
      case "scenario-intro":
        return <ScenarioIntroView app={app} t={t} />;
      case "scenario":
        return <ScenarioView app={app} t={t} />;
      case "result":
        return <ResultView app={app} t={t} />;
      case "reflection":
        return <ReflectionView app={app} t={t} />;
      case "adoption":
        return <AdoptionReviewView app={app} t={t} resolver={resolver} />;
      case "error":
        return <ErrorView app={app} application={application} t={t} />;
      default:
        return <ErrorView app={app} application={application} t={t} />;
    }
  }
}
