// App root — orchestrator を組み立て、RC3 Journey（Primary）と RC2 Training Gym（Focus/Practice）を
// routing する。RC3 Journey を Primary Learning Experience とし（Human Decision 4）、RC2 core-e2e は
// 3 Mode の primary flow としては露出しない（Gym 内で Focus/Practice として再利用）。
import { useEffect, useMemo, useState } from "react";
import { createApplication, type Application } from "./application-orchestrator.ts";
import { browserStorage } from "../data/progress-store.ts";
import { scenarioModules } from "../scenarios/index.ts";
import { useAppState } from "./use-app-state.ts";
import { useJourneyState } from "./use-journey-state.ts";
import { ErrorBoundary } from "../ui/error-boundary.tsx";
import { AppShell } from "../ui/app-shell.tsx";
import { ResultDashboardView } from "../ui/result-dashboard.tsx";
import { PracticeLibraryView, PracticeView } from "../ui/practice-views.tsx";
import { LangSwitcher } from "../ui/lang-switcher.tsx";
import {
  AdoptionReviewView,
  ErrorView,
  FocusLibraryView,
  HomeView,
  ModeSelectView,
  ReflectionView,
  ScenarioIntroView,
  ScenarioView,
} from "../ui/app-views.tsx";
import {
  JourneyCompletionView,
  JourneyFeedbackView,
  JourneyHomeView,
  JourneyInterstitialView,
  JourneyReleaseView,
  JourneyResultView,
  JourneyReviewView,
  JourneySetupView,
} from "../ui/journey-views.tsx";

/**
 * テスト用に Application を注入できるよう props で受け取れる。既定は本番構成。
 * initialSurface: 既定は RC3 Journey（Primary）。RC2 の regression テストは "gym" を指定して
 * 再利用中の RC2 machinery（core-e2e / Focus / Practice）を検証する（Human Decision 4: 旧 RC2 core は
 * RC3 equivalence 確立まで内部保持）。
 */
export function App(props: { application?: Application; initialSurface?: "journey" | "gym" }): JSX.Element {
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

  // Primary = RC3 Journey。"gym" へ切り替えると RC2 Focus/Practice（Training Gym）を使う。
  const [surface, setSurface] = useState<"journey" | "gym">(props.initialSurface ?? "journey");

  const app = useAppState(application);
  const journey = useJourneyState(application);
  const resolver = application.resolverFor(app.state.locale);
  const t = resolver.t;

  // RC5 P2-C: document.documentElement.lang を現在の locale と同期する。
  // 言語切替（ja↔en）で <html lang> も追従し、支援技術・ブラウザに正しい言語を伝える。
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = app.state.locale;
    }
  }, [app.state.locale]);

  if (surface === "journey") {
    return (
      <ErrorBoundary title={t("boundary.title")} body={t("boundary.body")}>
        <JourneyShell app={app} t={t} journey={journey}>
          {renderJourney()}
        </JourneyShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary title={t("boundary.title")} body={t("boundary.body")}>
      <AppShell app={app} t={t}>
        <>
          <div className="gym-banner">
            <button className="secondary" data-testid="gym-to-journey" onClick={() => setSurface("journey")}>
              ← {t("rc3.home.title")}
            </button>
            <span className="gym-title">{t("rc3.gym.title")}</span>
          </div>
          {renderGym()}
        </>
      </AppShell>
    </ErrorBoundary>
  );

  function renderJourney(): JSX.Element {
    const v = journey.state.view;
    switch (v) {
      case "journey-home":
        return <JourneyHomeView journey={journey} t={t} onExitToGym={() => setSurface("gym")} />;
      case "journey-setup":
        return <JourneySetupView journey={journey} t={t} />;
      case "journey-review":
        return <JourneyReviewView journey={journey} t={t} />;
      case "journey-feedback":
        return <JourneyFeedbackView journey={journey} t={t} />;
      case "journey-completion":
        return <JourneyCompletionView journey={journey} t={t} />;
      case "journey-interstitial":
        return <JourneyInterstitialView journey={journey} t={t} />;
      case "journey-release":
        return <JourneyReleaseView journey={journey} t={t} />;
      case "journey-result":
        return <JourneyResultView journey={journey} t={t} onToGym={() => setSurface("gym")} />;
      default:
        return <JourneyHomeView journey={journey} t={t} onExitToGym={() => setSurface("gym")} />;
    }
  }

  function renderGym(): JSX.Element {
    switch (app.state.view) {
      case "mode-select":
        return <ModeSelectView app={app} t={t} />;
      case "focus-library":
        return <FocusLibraryView app={app} application={application} t={t} />;
      case "practice-library":
        return <PracticeLibraryView app={app} t={t} />;
      case "practice":
        return <PracticeView app={app} t={t} />;
      case "scenario-intro":
        return <ScenarioIntroView app={app} t={t} />;
      case "scenario":
        return <ScenarioView app={app} t={t} />;
      case "result":
        return app.state.dashboard !== undefined ? (
          <ResultDashboardView app={app} application={application} dashboard={app.state.dashboard} t={t} />
        ) : (
          <ErrorView app={app} application={application} t={t} />
        );
      case "reflection":
        return <ReflectionView app={app} t={t} />;
      case "adoption":
        return <AdoptionReviewView app={app} t={t} resolver={resolver} />;
      case "error":
        return <ErrorView app={app} application={application} t={t} />;
      case "home":
      default:
        return <HomeView app={app} t={t} />;
    }
  }
}

/**
 * RC3 Journey 用 Shell（P1-4）。常時発見可能な Back / Home を提供する。
 * Navigation は presentation only — domain state（revision / completed / rework）を変えない。
 * Home へ戻っても Journey は破棄せず、Resume で復帰できる。
 */
function JourneyShell(props: {
  app: ReturnType<typeof useAppState>;
  journey: ReturnType<typeof useJourneyState>;
  t: Application["resolver"]["t"];
  children: JSX.Element;
}): JSX.Element {
  const { app, journey, t, children } = props;
  const backKind = journey.backKind;
  return (
    <div className="shell">
      {/* P3 a11y: main へ飛べる skip link（キーボード/支援技術で nav を飛ばせる）。 */}
      <a className="skip-link" href="#main-content" data-testid="skip-link">
        {t("a11y.skipToContent")}
      </a>
      <header className="shell-header">
        {/* P3 a11y: 主ナビゲーションを nav landmark にする（aria-label 付き）。 */}
        <nav className="shell-nav" aria-label={t("a11y.primaryNav")}>
          <button
            className="shell-home"
            data-testid="journey-nav-home"
            onClick={() => journey.goHome()}
            aria-label={t("rc3.nav.home")}
          >
            ⌂ {t("rc3.nav.home")}
          </button>
          {/* UX-NAV-001: Home は shell の journey-nav-home が唯一。backKind==="home" のとき
              二つ目の ⌂ Home を出さない（重複 Home を排除）。Back（feedback）のみ追加表示する。 */}
          {backKind === "back" ? (
            <button className="shell-back" data-testid="journey-nav-back" onClick={() => journey.goBack()}>
              ← {t("rc3.nav.back")}
            </button>
          ) : null}
        </nav>
        <div className="shell-title">
          <span className="shell-app-title">{t("app.title")}</span>
        </div>
        <div className="shell-meta">
          <LangSwitcher app={app} t={t} />
        </div>
      </header>
      {/* RC4 Persistence v4: 旧版 journey を safe reset したときの human-readable notice。
          AppShell と同じ recovered チャネル / dismiss を再利用する（新 framework は作らない）。
          internal schema version は露出しない。
          P3: restore 通知は Home でのみ出す。新しい Journey を開始（setup 以降）したら消す
          （進行中の画面に古い復元通知が残らないようにする）。 */}
      {app.state.recovered != null && journey.state.view === "journey-home" ? (
        <div className="banner" role="status" data-testid="journey-recovered-banner">
          <span>
            {app.state.recovered === "restored"
              ? t("resume.banner")
              : app.state.recovered === "corrupt"
                ? t("persist.recovered.corrupt")
                : t("persist.recovered.incompatible")}
          </span>
          <button data-testid="journey-dismiss-recovered" onClick={() => app.dismissRecovered()}>
            ✕
          </button>
        </div>
      ) : null}
      <main className="shell-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}



