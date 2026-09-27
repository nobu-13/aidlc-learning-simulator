import type { Locale } from "../domain/entities.ts";
import type { LocaleBundle } from "../i18n/locale-resources.ts";

const ja: LocaleBundle = {
  "sc.focus-refusal-recovery.title": "フォーカス：refusal / recovery（次の一手）",
  "sc.focus-refusal-recovery.summary": "拒否・失敗時に実行可能な next step が示されることを学ぶ短いシナリオ（AI-DLC v2.10.0 の必須 Topic）。",
  "sc.focus-refusal-recovery.st-recovery.title": "Refusal / Recovery",
  "sc.focus-refusal-recovery.dp-refusal.prompt": "Agent が操作を拒否（refusal）しました。まずどうしますか？",
  "sc.focus-refusal-recovery.o-read-refusal.label": "拒否理由と recovery path を読む",
  "sc.focus-refusal-recovery.o-force-retry.label": "理由を無視して同じ操作を強制再試行する",
  "sc.focus-refusal-recovery.dp-nextstep.prompt": "recovery path が提示されました。どう進めますか？",
  "sc.focus-refusal-recovery.o-actionable-next.label": "提示された実行可能な next step に従う",
  "sc.focus-refusal-recovery.o-give-up.label": "next step を無視して作業を放棄する",
  "sc.focus-refusal-recovery.lp-recovery.title": "refusal / recovery は実行可能な next step を示す",
  "sc.focus-refusal-recovery.lp-recovery.body": "拒否や失敗は行き止まりではなく、実行可能な次の一手（recovery path）を伴います。理由を読んで next step に従うことでリスクを抑え残存リスクを解消します。無視した強制再試行は Evidence を損ない手戻りを生みます。",
  "sc.focus-refusal-recovery.pv.spec": "refusal / recovery path が実行可能な next step を示すこと（AI-DLC v2.10.0 一次情報）。",
  "sc.focus-refusal-recovery.pv.interp": "強制再試行・放棄のリスクに関するシミュレーターの教育的解釈。",
};

const en: LocaleBundle = {
  "sc.focus-refusal-recovery.title": "Focus: refusal / recovery (the next step)",
  "sc.focus-refusal-recovery.summary": "A short scenario to learn that a refusal/failure surfaces an executable next step (a required Topic in AI-DLC v2.10.0).",
  "sc.focus-refusal-recovery.st-recovery.title": "Refusal / Recovery",
  "sc.focus-refusal-recovery.dp-refusal.prompt": "The agent refused an operation (refusal). What do you do first?",
  "sc.focus-refusal-recovery.o-read-refusal.label": "Read the refusal reason and the recovery path",
  "sc.focus-refusal-recovery.o-force-retry.label": "Ignore the reason and force-retry the same operation",
  "sc.focus-refusal-recovery.dp-nextstep.prompt": "A recovery path is presented. How do you proceed?",
  "sc.focus-refusal-recovery.o-actionable-next.label": "Follow the executable next step that was presented",
  "sc.focus-refusal-recovery.o-give-up.label": "Ignore the next step and abandon the work",
  "sc.focus-refusal-recovery.lp-recovery.title": "Refusal / recovery shows an executable next step",
  "sc.focus-refusal-recovery.lp-recovery.body": "A refusal or failure is not a dead end; it comes with an executable next step (recovery path). Reading the reason and following the next step limits risk and resolves residual risk. A blind force-retry damages evidence and creates rework.",
  "sc.focus-refusal-recovery.pv.spec": "Refusal / recovery path shows an executable next step (AI-DLC v2.10.0 primary source).",
  "sc.focus-refusal-recovery.pv.interp": "Simulator's educational interpretation of the risk of force-retry / abandonment.",
};

export const focusRefusalRecoveryLocales: Readonly<Record<Locale, LocaleBundle>> = { ja, en };
