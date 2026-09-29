// RC5 Product Trust & Decision Integrity: 追加文言バンドル。
//
// data / logic 分離（tech-stack rule）: 本文テキストはここ（locale）に置き、domain/logic は
// 文言を hardcode しない。ja / en は key 集合が完全一致すること（diffBundleKeys テストで担保）。
//
// 対象:
//  - P1-A: JourneyOutcome / LearnerEvaluation の分離表示。
//  - P1-C: resolved item 再選択時の明示拒否メッセージ。
//  - P1-D: Conditional Approval の構造化条件・下流表示・open condition。
//  - P2-A: gate 決定別の verdict copy。
//  - P2-B: 既知欠陥を認識して Approve した場合の feedback。
//  - P2-D: Evidence artifact status と end-to-end assurance の分離。
//  - P2-F: mode identity badge。
import type { LocaleBundle } from "./locale-resources.ts";

const rc5Ja: LocaleBundle = {
  // ---------- P1-A: Journey Outcome / Learner Evaluation ----------
  "rc5.result.outcome.label": "工程の帰結",
  "rc5.result.learner.label": "あなたの判断品質",
  "rc5.outcome.blocked": "ブロック：工程完了は承認されず、リリースに進みませんでした。",
  "rc5.outcome.returned": "差し戻し：完了は承認されず、前工程へ戻りました。",
  "rc5.outcome.conditionally-completed": "条件付き完了：未解決の条件を残したまま完了を承認しました。",
  "rc5.outcome.completed": "工程完了：完了を承認しました（リリースは未実施）。",
  "rc5.outcome.release-approved": "リリース承認：最終ゲートを通過しました。",
  "rc5.outcome.release-conditional": "条件付きリリース：条件を残したままリリースを承認しました。",
  "rc5.outcome.release-rejected": "リリース却下：リリースは承認されませんでした。",
  "rc5.outcome.in-progress": "進行中：まだ完了判断に到達していません。",
  "rc5.learner.strong": "適切：重大な見逃しや危険な承認はありませんでした。",
  "rc5.learner.mixed": "一部改善余地：致命的ではない弱点が残りました。",
  "rc5.learner.needs-practice": "要練習：重大な見逃し、またはリスクを認識せず承認しました。",
  "rc5.result.weakness.none": "残っている弱点はありません。",
  "rc5.result.weakness.count": "残っている弱点：{n} 件。",
  "rc5.result.highlights.clean.halted":
    "レビュー自体は良好でしたが、工程は前進しませんでした（上の「工程の帰結」を参照）。",

  // ---------- P1-C: resolved item 再選択の明示拒否 ----------
  "rc5.rework.rejected.title": "この差し戻しは適用されませんでした",
  "rc5.rework.rejected.allResolved":
    "選択した指摘はすでに解消されています。追加修正が必要な「未解決」の項目を選択してから差し戻してください。",
  "rc5.rework.rejected.noValidTarget":
    "差し戻しの対象となる未解決の指摘が選択されていません。未解決項目を選択してください。",
  "rc5.rework.rejected.dismiss": "閉じる",

  // ---------- P1-D: Conditional Approval ----------
  "rc5.cond.title": "承認条件（Conditional Approval）",
  "rc5.cond.desc": "条件付き承認では、残す条件・必要な証跡・検証時点を構造化して記録します。この条件は後工程へ引き継がれます。",
  "rc5.cond.condition": "条件",
  "rc5.cond.condition.placeholder": "例：本番前に高負荷試験を完了すること",
  "rc5.cond.evidence": "必要な証跡",
  "rc5.cond.evidence.placeholder": "例：負荷試験レポート、承認記録",
  "rc5.cond.dueGate": "検証時点 / 期限ゲート",
  "rc5.cond.dueGate.before-release": "リリース前",
  "rc5.cond.dueGate.at-release": "リリース時",
  "rc5.cond.dueGate.post-release": "リリース後",
  "rc5.cond.add": "この条件を追加",
  "rc5.cond.none": "条件が未入力です。少なくとも 1 つの条件を入力してください。",
  "rc5.cond.list.title": "設定した条件",
  "rc5.cond.status.open": "未充足",
  "rc5.cond.status.conditionally-accepted": "条件付き受理",
  "rc5.cond.remove": "削除",
  "rc5.cond.sourceStep": "起点工程",
  "rc5.cond.findings": "対象の指摘",
  "rc5.cond.downstream.title": "前工程からの未解決条件",
  "rc5.cond.downstream.desc": "前工程で条件付き承認された項目です。まだ解消されていません。",
  "rc5.cond.downstream.none": "前工程からの未解決条件はありません。",
  "rc5.cond.gateImpact": "ゲートへの影響",
  "rc5.cond.gateImpact.body": "この条件が充足されるまで、リスクは残存します。",
  "rc5.cond.openConditions": "未解決の承認条件",
  "rc5.cond.openConditions.count": "未解決の承認条件：{n} 件",
  "rc5.cond.highRisk.note":
    "高深刻度の指摘を条件付きで通過させています。これは無条件に問題なしではなく、残存リスク＋条件＋検証要件として残ります。",

  // ---------- P2-A: gate 決定別 verdict copy ----------
  "rc5.gate.verdict.approve.sound": "妥当：問題が無い成果物を適切に承認しました。",
  "rc5.gate.verdict.approve.too-lenient": "甘すぎ：未解決の問題を残したまま承認しました。",
  // RC6 P2: 問題を認識した上で無条件承認した場合は「問題なし」とは言わない。
  "rc5.gate.verdict.approve.acknowledged-risk":
    "問題を認識した上で進行しました。このリスクは未解決のまま後工程へ残ります（問題なしの承認ではありません）。",
  "rc5.gate.verdict.approve-with-conditions.acknowledged-risk":
    "問題を認識し、条件付きで進行しました。認識したリスクは条件として後工程へ残ります。",
  "rc5.gate.verdict.approve-with-conditions.sound": "妥当：条件を付けて承認しました。条件は後工程へ引き継がれます。",
  "rc5.gate.verdict.approve-with-conditions.too-lenient":
    "甘すぎ：高深刻度の問題を条件付きでも通しています。条件だけでは不十分です。",
  "rc5.gate.verdict.return-for-rework.sound": "妥当：問題を検出し、差し戻して修正を求めました。",
  "rc5.gate.verdict.return-for-rework.too-strict": "厳しすぎ：問題が無いのに差し戻しました。",
  "rc5.gate.verdict.change-scope.sound": "妥当：スコープの問題を検出し、範囲変更を求めました。",
  "rc5.gate.verdict.change-scope.too-strict": "厳しすぎ：問題が無いのにスコープ変更を求めました。",
  "rc5.gate.verdict.block.sound": "妥当：重大な問題を検出し、工程を止めました。",
  "rc5.gate.verdict.block.too-strict": "厳しすぎ：問題が無いのに工程を止めました。",

  // ---------- P2-B: 既知欠陥 + Approve ----------
  "rc5.fb.knownDefectApproved":
    "問題を認識した上で承認しました。このリスクは後工程へ残ります。",

  // ---------- P2-D: Evidence semantics 分離 ----------
  "rc5.evidence.artifact.label": "証跡アーティファクトの状態",
  "rc5.evidence.artifact.complete": "揃っている",
  "rc5.evidence.artifact.incomplete": "不足あり",
  "rc5.evidence.assurance.label": "エンドツーエンドの保証",
  "rc5.evidence.assurance.sufficient": "十分",
  "rc5.evidence.assurance.partial": "部分的",
  "rc5.evidence.assurance.insufficient": "不十分",
  "rc5.evidence.traceability.label": "トレーサビリティ",
  "rc5.evidence.traceability.complete": "揃っている",
  "rc5.evidence.traceability.incomplete": "不足あり",

  // ---------- P2-F: mode identity ----------
  "rc5.mode.simulation.badge": "シミュレーション",
  "rc5.mode.simulation.tagline": "自力で判断する",
  "rc5.mode.adoption-review.badge": "導入検討レビュー",
  "rc5.mode.adoption-review.tagline": "自社導入を検討する",
  "rc5.mode.guided.badge": "ガイド付き",
  "rc5.mode.guided.tagline": "手順に沿って学ぶ",

  // ---------- P2-E: Main Journey vs Gym ----------
  "rc5.home.mainJourney.title": "メインジャーニー",
  "rc5.home.mainJourney.completed": "完了",
  "rc5.home.mainJourney.viewResult": "結果を見る",
  "rc5.home.practice.title": "練習（Gym）",
  "rc5.home.practice.inProgress": "進行中",
};

const rc5En: LocaleBundle = {
  // ---------- P1-A: Journey Outcome / Learner Evaluation ----------
  "rc5.result.outcome.label": "Journey outcome",
  "rc5.result.learner.label": "Your decision quality",
  "rc5.outcome.blocked": "Blocked: completion was not approved and release was not reached.",
  "rc5.outcome.returned": "Returned: completion was not approved; sent back for rework.",
  "rc5.outcome.conditionally-completed":
    "Conditionally completed: completion approved with unresolved conditions remaining.",
  "rc5.outcome.completed": "Completed: completion approved (release not performed).",
  "rc5.outcome.release-approved": "Release approved: the final gate was passed.",
  "rc5.outcome.release-conditional":
    "Release with conditions: release approved with conditions remaining.",
  "rc5.outcome.release-rejected": "Release rejected: release was not approved.",
  "rc5.outcome.in-progress": "In progress: a completion decision has not been reached yet.",
  "rc5.learner.strong": "Sound: no significant misses and no dangerous approvals.",
  "rc5.learner.mixed": "Some room to improve: non-critical weaknesses remain.",
  "rc5.learner.needs-practice":
    "Needs practice: a significant miss, or an approval made without recognizing the risk.",
  "rc5.result.weakness.none": "No weaknesses remain.",
  "rc5.result.weakness.count": "Weaknesses remaining: {n}.",
  "rc5.result.highlights.clean.halted":
    "Your review was sound, but the journey did not progress (see \"Journey outcome\" above).",

  // ---------- P1-C: resolved item re-selection explicit rejection ----------
  "rc5.rework.rejected.title": "This return was not applied",
  "rc5.rework.rejected.allResolved":
    "The items you selected are already resolved. Select an unresolved item that still needs a fix, then return for rework.",
  "rc5.rework.rejected.noValidTarget":
    "No unresolved finding was selected to return for. Select an unresolved item first.",
  "rc5.rework.rejected.dismiss": "Dismiss",

  // ---------- P1-D: Conditional Approval ----------
  "rc5.cond.title": "Approval conditions (Conditional Approval)",
  "rc5.cond.desc":
    "For a conditional approval, record the remaining condition, the required evidence, and the verification point. These conditions are carried into later steps.",
  "rc5.cond.condition": "Condition",
  "rc5.cond.condition.placeholder": "e.g. Complete load testing before production",
  "rc5.cond.evidence": "Required evidence",
  "rc5.cond.evidence.placeholder": "e.g. Load-test report, approval record",
  "rc5.cond.dueGate": "Verification point / due gate",
  "rc5.cond.dueGate.before-release": "Before release",
  "rc5.cond.dueGate.at-release": "At release",
  "rc5.cond.dueGate.post-release": "After release",
  "rc5.cond.add": "Add this condition",
  "rc5.cond.none": "No condition entered. Enter at least one condition.",
  "rc5.cond.list.title": "Conditions set",
  "rc5.cond.status.open": "Open",
  "rc5.cond.status.conditionally-accepted": "Conditionally accepted",
  "rc5.cond.remove": "Remove",
  "rc5.cond.sourceStep": "Source step",
  "rc5.cond.findings": "Related findings",
  "rc5.cond.downstream.title": "Open conditions from earlier steps",
  "rc5.cond.downstream.desc": "Items conditionally approved earlier. They are not yet resolved.",
  "rc5.cond.downstream.none": "No open conditions carried from earlier steps.",
  "rc5.cond.gateImpact": "Gate impact",
  "rc5.cond.gateImpact.body": "Risk remains until this condition is satisfied.",
  "rc5.cond.openConditions": "Open approval conditions",
  "rc5.cond.openConditions.count": "Open approval conditions: {n}",
  "rc5.cond.highRisk.note":
    "You passed a high-severity finding with conditions. This is not unconditionally clear — it remains as open risk plus a condition plus a verification requirement.",

  // ---------- P2-A: gate-specific verdict copy ----------
  "rc5.gate.verdict.approve.sound": "Sound: you approved a clean artifact appropriately.",
  "rc5.gate.verdict.approve.too-lenient": "Too lenient: you approved with unresolved issues remaining.",
  // RC6 P2: acknowledging a real defect and approving is not "problem-free".
  "rc5.gate.verdict.approve.acknowledged-risk":
    "You proceeded knowing the issue. This risk stays unresolved into later steps (this is not a problem-free approval).",
  "rc5.gate.verdict.approve-with-conditions.acknowledged-risk":
    "You acknowledged the issue and proceeded with conditions. The acknowledged risk carries forward as a condition.",
  "rc5.gate.verdict.approve-with-conditions.sound":
    "Sound: you approved with conditions. The conditions carry into later steps.",
  "rc5.gate.verdict.approve-with-conditions.too-lenient":
    "Too lenient: you passed a high-severity issue even with conditions. Conditions alone are not enough.",
  "rc5.gate.verdict.return-for-rework.sound": "Sound: you detected an issue and returned it for a fix.",
  "rc5.gate.verdict.return-for-rework.too-strict": "Too strict: you returned it with no issues present.",
  "rc5.gate.verdict.change-scope.sound": "Sound: you detected a scope issue and asked for a scope change.",
  "rc5.gate.verdict.change-scope.too-strict": "Too strict: you asked for a scope change with no issues present.",
  "rc5.gate.verdict.block.sound": "Sound: you detected a serious issue and halted the journey.",
  "rc5.gate.verdict.block.too-strict": "Too strict: you halted the journey with no issues present.",

  // ---------- P2-B: known defect + Approve ----------
  "rc5.fb.knownDefectApproved":
    "You proceeded knowing about the issue. This risk is carried into later steps.",

  // ---------- P2-D: Evidence semantics separation ----------
  "rc5.evidence.artifact.label": "Evidence artifact status",
  "rc5.evidence.artifact.complete": "Complete",
  "rc5.evidence.artifact.incomplete": "Incomplete",
  "rc5.evidence.assurance.label": "End-to-end assurance",
  "rc5.evidence.assurance.sufficient": "Sufficient",
  "rc5.evidence.assurance.partial": "Partial",
  "rc5.evidence.assurance.insufficient": "Insufficient",
  "rc5.evidence.traceability.label": "Traceability",
  "rc5.evidence.traceability.complete": "Complete",
  "rc5.evidence.traceability.incomplete": "Incomplete",

  // ---------- P2-F: mode identity ----------
  "rc5.mode.simulation.badge": "Simulation",
  "rc5.mode.simulation.tagline": "Decide on your own",
  "rc5.mode.adoption-review.badge": "Adoption Review",
  "rc5.mode.adoption-review.tagline": "Evaluate adoption for your org",
  "rc5.mode.guided.badge": "Guided",
  "rc5.mode.guided.tagline": "Learn step by step",

  // ---------- P2-E: Main Journey vs Gym ----------
  "rc5.home.mainJourney.title": "Main journey",
  "rc5.home.mainJourney.completed": "Completed",
  "rc5.home.mainJourney.viewResult": "View result",
  "rc5.home.practice.title": "Practice (Gym)",
  "rc5.home.practice.inProgress": "In progress",
};

/** RC5 追加文言の ja バンドル。 */
export const rc5ContentJa: LocaleBundle = { ...rc5Ja };

/** RC5 追加文言の en バンドル。 */
export const rc5ContentEn: LocaleBundle = { ...rc5En };
