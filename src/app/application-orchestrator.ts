// ApplicationOrchestrator — 各 component の結線（/app）。
//
// ScenarioLoader → ScenarioCatalog を構築し、進行（ScenarioProgression）・評価（ResultModel）・
// 永続（ProgressStore）・i18n（LocaleResources）を UI へ port として公開する。
// domain logic はここに持たない（結線のみ）。UI は domain を直接触らずこの port 経由で操作する。
import type { Locale, ScenarioCatalog, ValidatedScenario } from "../domain/entities.ts";
import { buildScenarioCatalog, type RawScenarioSource } from "../data/scenario-loader.ts";
import { ProgressStore, type StoragePort } from "../data/progress-store.ts";
import {
  createResolver,
  defaultLocaleFrom,
  type I18nResolver,
  type LocaleBundle,
} from "../i18n/locale-resources.ts";
import { chromeBundles } from "../i18n/messages.ts";

/** Scenario JSON 1 ファイル分の入力（raw + 各 locale の追加 bundle）。 */
export interface ScenarioModule {
  readonly ref: string;
  readonly raw: unknown;
  /** Scenario 固有文言（locale key → text）。chrome bundle にマージされる。 */
  readonly localeBundles: Readonly<Record<Locale, LocaleBundle>>;
}

export interface OrchestratorConfig {
  readonly scenarioModules: readonly ScenarioModule[];
  readonly storage: StoragePort;
  /** ブラウザ言語（navigator.languages 等）。省略時は en 既定。 */
  readonly browserLanguages?: readonly string[] | undefined;
}

export interface Application {
  readonly catalog: ScenarioCatalog;
  readonly locale: Locale;
  readonly resolver: I18nResolver;
  readonly store: ProgressStore;
  /** 指定 locale の resolver を生成（言語切替時に UI が呼ぶ。進捗は失わない・FR10.3）。 */
  resolverFor(locale: Locale): I18nResolver;
  getScenario(scenarioId: string): ValidatedScenario | undefined;
}

/** 全 locale で共通に使う、chrome + 全 Scenario の bundle をマージした map。 */
function mergedBundles(
  modules: readonly ScenarioModule[],
): Readonly<Record<Locale, LocaleBundle>> {
  const merge = (locale: Locale): LocaleBundle => {
    const acc: Record<string, string> = { ...chromeBundles[locale] };
    for (const m of modules) {
      const b = m.localeBundles[locale];
      for (const k of Object.keys(b)) acc[k] = b[k]!;
    }
    return acc;
  };
  return { ja: merge("ja"), en: merge("en") };
}

export function createApplication(config: OrchestratorConfig): Application {
  const sources: RawScenarioSource[] = config.scenarioModules.map((m) => ({ ref: m.ref, raw: m.raw }));
  const catalog = buildScenarioCatalog(sources);
  const bundles = mergedBundles(config.scenarioModules);
  const store = new ProgressStore(config.storage);

  const defaultLocale = defaultLocaleFrom(config.browserLanguages);

  const resolverFor = (locale: Locale): I18nResolver => createResolver(locale, bundles[locale]);

  return {
    catalog,
    locale: defaultLocale,
    resolver: resolverFor(defaultLocale),
    store,
    resolverFor,
    getScenario: (scenarioId: string) => catalog.scenarios.get(scenarioId),
  };
}
