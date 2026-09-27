import type { Locale } from "../domain/entities.ts";
import type { LocaleBundle } from "../i18n/locale-resources.ts";

const ja: LocaleBundle = {
  "sc.focus-evidence.title": "フォーカス：テスト失敗と Evidence",
  "sc.focus-evidence.summary": "テスト失敗時の判断と Evidence の十分性を深掘りする短いシナリオです。",
  "sc.focus-evidence.st-only.title": "テストと Evidence",
  "sc.focus-evidence.dp-fail.prompt": "CI でテストが失敗しました。最初にどうしますか？",
  "sc.focus-evidence.o-investigate.label": "失敗の原因を調査する",
  "sc.focus-evidence.o-tweak.label": "期待値を書き換えて通す",
  "sc.focus-evidence.dp-evidence.prompt": "完了報告の前に何を確認しますか？",
  "sc.focus-evidence.o-require-evidence.label": "テストが実際に実行された Evidence を要求する",
  "sc.focus-evidence.o-assume-ok.label": "ログを見ずに成功とみなす",
  "sc.focus-evidence.lp-ev.title": "未実行テストを成功扱いにしない",
  "sc.focus-evidence.lp-ev.body": "『実行済み』と『成功』は別です。Evidence がなければ完了とみなしません。",
  "sc.focus-evidence.pv.testing": "Testing Contract（v2.10.0 一次情報）。",
  "sc.focus-evidence.pv.evidence": "Evidence の十分性（v2.10.0 一次情報）。",
};

const en: LocaleBundle = {
  "sc.focus-evidence.title": "Focus: test failure and evidence",
  "sc.focus-evidence.summary": "A short scenario that digs into decisions on test failure and evidence sufficiency.",
  "sc.focus-evidence.st-only.title": "Testing & Evidence",
  "sc.focus-evidence.dp-fail.prompt": "A test failed in CI. What do you do first?",
  "sc.focus-evidence.o-investigate.label": "Investigate the cause of the failure",
  "sc.focus-evidence.o-tweak.label": "Rewrite the expected value to make it pass",
  "sc.focus-evidence.dp-evidence.prompt": "What do you check before reporting completion?",
  "sc.focus-evidence.o-require-evidence.label": "Require evidence that the tests actually ran",
  "sc.focus-evidence.o-assume-ok.label": "Assume success without checking logs",
  "sc.focus-evidence.lp-ev.title": "Never report unexecuted tests as passing",
  "sc.focus-evidence.lp-ev.body": "'Executed' and 'passed' differ. Without evidence, do not treat work as complete.",
  "sc.focus-evidence.pv.testing": "Testing Contract (v2.10.0 primary source).",
  "sc.focus-evidence.pv.evidence": "Evidence sufficiency (v2.10.0 primary source).",
};

export const focusEvidenceLocales: Readonly<Record<Locale, LocaleBundle>> = { ja, en };
