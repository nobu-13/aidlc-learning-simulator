// AppShell — 全画面共通のヘッダ/フレーム（RC2 §5）。
// Home / Back / current mode / current scenario / language switch を統一的に提供し、
// ユーザーが行き止まりにならないようにする。
import type { AppApi } from "../app/use-app-state.ts";
import { backLabelKind } from "../app/use-app-state.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";
import { LangSwitcher } from "./lang-switcher.tsx";

export function AppShell(props: {
  app: AppApi;
  t: I18nResolver["t"];
  children: JSX.Element;
}): JSX.Element {
  const { app, t, children } = props;
  const { view, mode, scenario } = app.state;
  // §8: logical back が可能なら "Back"、home へ丸める view では "Home" と明示する。
  const backKind = backLabelKind(app.state);

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-nav">
          <button
            className="shell-home"
            data-testid="nav-home"
            onClick={() => app.goHome()}
            aria-label={t("nav.home")}
          >
            ⌂ {t("nav.home")}
          </button>
          {backKind === "back" ? (
            <button className="shell-back" data-testid="nav-back" onClick={() => app.goBack()}>
              ← {t("nav.back")}
            </button>
          ) : backKind === "home" ? (
            <button
              className="shell-back"
              data-testid="nav-back-home"
              onClick={() => app.goBack()}
            >
              ⌂ {t("nav.home")}
            </button>
          ) : null}
        </div>
        <div className="shell-title">
          <span className="shell-app-title">{t("app.title")}</span>
        </div>
        <div className="shell-meta">
          {view === "scenario" || view === "scenario-intro" ? (
            <span className="shell-context" data-testid="shell-context">
              <span className="shell-mode">
                {t("shell.currentMode")}: {t(`mode.${mode}`)}
              </span>
              {scenario !== undefined ? (
                <span className="shell-scenario">
                  {t("shell.currentScenario")}: {t(scenario.scenario.titleKey)}
                </span>
              ) : null}
            </span>
          ) : null}
          <LangSwitcher app={app} t={t} />
        </div>
      </header>
      {app.state.recovered != null && app.state.recovered !== null ? (
        <div className="banner" role="status" data-testid="recovered-banner">
          <span>
            {app.state.recovered === "restored"
              ? t("resume.banner")
              : app.state.recovered === "corrupt"
                ? t("persist.recovered.corrupt")
                : t("persist.recovered.incompatible")}
          </span>
          <button data-testid="dismiss-recovered" onClick={() => app.dismissRecovered()}>
            ✕
          </button>
        </div>
      ) : null}
      <main className="shell-main">{children}</main>
    </div>
  );
}
