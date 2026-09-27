// LocaleResources — i18n の semantic/presentation 分離（ADR-006 / FR10 / BR5.x）。
//
// locale key → 表示テキストの解決のみを行う。semantic data（評価・進行・永続）は locale に依存しない。
// 翻訳欠落は blank/undefined を出さず可視化する（dev/test で検出・production でも明示・BR5.3）。
// 既定言語はブラウザ言語追従（ja→日本語 / 他→English、fallback→English・FR10.2）。
import type { Locale } from "../domain/entities.ts";

export type LocaleBundle = Readonly<Record<string, string>>;

/** 欠落 key の可視化マーカー（undefined/blank を出さない・BR5.3）。 */
export function missingKeyMarker(key: string): string {
  return `⟦missing:${key}⟧`;
}

export interface I18nResolver {
  readonly locale: Locale;
  /** key を解決。欠落時は missingKeyMarker を返し、onMissing で検出できる。 */
  t(key: string): string;
  /** 欠落 key の集合（dev/test 検出用）。 */
  missingKeys(): readonly string[];
  /** 指定 locale bundle 全体を返す（AdoptionSheetComposer 等へ bundle 単位で渡す）。 */
  bundle(): LocaleBundle;
}

export function createResolver(locale: Locale, bundle: LocaleBundle): I18nResolver {
  const missing = new Set<string>();
  return {
    locale,
    t(key: string): string {
      const v = bundle[key];
      if (v === undefined || v.length === 0) {
        missing.add(key);
        return missingKeyMarker(key);
      }
      return v;
    },
    missingKeys(): readonly string[] {
      return [...missing].sort();
    },
    bundle(): LocaleBundle {
      return bundle;
    },
  };
}

/** ブラウザ言語から既定 locale を決める（ja→ja / その他→en・FR10.2）。 */
export function defaultLocaleFrom(languages: readonly string[] | undefined): Locale {
  const first = languages?.[0]?.toLowerCase() ?? "";
  return first.startsWith("ja") ? "ja" : "en";
}

/**
 * 2 つの locale bundle の key 集合が一致するか検証する（ja/en の学習内容一致・FR10.4 の一部）。
 * 不足 key をそれぞれ返す。テストで対称性を担保する。
 */
export function diffBundleKeys(
  a: LocaleBundle,
  b: LocaleBundle,
): { readonly missingInA: readonly string[]; readonly missingInB: readonly string[] } {
  const ak = new Set(Object.keys(a));
  const bk = new Set(Object.keys(b));
  const missingInA = [...bk].filter((k) => !ak.has(k)).sort();
  const missingInB = [...ak].filter((k) => !bk.has(k)).sort();
  return { missingInA, missingInB };
}
