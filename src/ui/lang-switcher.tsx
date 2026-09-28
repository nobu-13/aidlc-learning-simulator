// LangSwitcher — 言語切替（presentation のみ。評価・進捗を変えない）。
import type { AppApi } from "../app/use-app-state.ts";
import type { I18nResolver } from "../i18n/locale-resources.ts";

export function LangSwitcher(props: { app: AppApi; t: I18nResolver["t"] }): JSX.Element {
  const { app, t } = props;
  return (
    <div className="lang-switcher">
      <label htmlFor="lang-select">{t("app.langLabel")}</label>{" "}
      <select
        id="lang-select"
        data-testid="lang-select"
        value={app.state.locale}
        onChange={(e) => app.setLocale(e.target.value === "ja" ? "ja" : "en")}
      >
        <option value="ja">{t("app.lang.ja")}</option>
        <option value="en">{t("app.lang.en")}</option>
      </select>
    </div>
  );
}
