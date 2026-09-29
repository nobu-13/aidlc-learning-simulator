// RC6 — Grounded State Propagation の locale 文言（data / logic 分離）。
// domain/logic は文言を hardcode せず、この locale key を参照する。ja / en は key 集合が完全一致すること
// （diffBundleKeys テストで担保）。
//
// 対象:
//  - P1-A: step-level Conditional Approval の入力説明。
//  - P1-B: accepted upstream fact（確定した可用性目標＝RTO/RPO 相当）の下流提示。
//  - P1-C: structured input（Data sensitivity）の grounding（データ区分の明示）。
import type { LocaleBundle } from "./locale-resources.ts";

const rc6Ja: LocaleBundle = {
  // ---------- P1-A: step-level Conditional Approval ----------
  "rc6.cond.step.desc":
    "この工程で「条件付き承認」を選ぶと、残す条件・必要な証跡・検証時点を構造化して記録します。この条件は後続工程・完了判断・リリース判断・結果まで消えずに引き継がれます。",

  // ---------- P1-B: Accepted Upstream Facts（確定した可用性目標） ----------
  "rc6.fact.title": "前工程で確定した前提",
  "rc6.fact.desc": "以下は上流工程ですでに確定した値です。この工程では値の有無を問い直さず、設計・検証がこの目標を満たすかを評価します。",
  "rc6.fact.sourceStep": "確定元工程",
  "rc6.fact.availability-target.label": "可用性目標（RTO / RPO）",
  "rc6.fact.availabilityTarget.value.high": "RTO 30 分 / RPO 5 分（高可用性）",
  "rc6.fact.availabilityTarget.value.critical": "RTO 5 分 / RPO 1 分（クリティカル）",
  "rc6.fact.availabilityTarget.statement":
    "可用性目標は要件工程で確定済みです。設計工程ではこの目標を再定義せず、アーキテクチャと検証がこの目標を満たすかを評価してください。",

  // ---------- P1-C: Data sensitivity grounding（データ区分の明示） ----------
  "rc6.grounding.dataClassification.itemLabel": "データ区分",
  "rc6.grounding.dataClassification.public": "データ区分：公開（PII 境界なし）。外部サービス連携そのものは PII 越境違反ではない。",
  "rc6.grounding.dataClassification.internal": "データ区分：社内限定。社外への持ち出しには保護が必要。",
  "rc6.grounding.dataClassification.confidential": "データ区分：機密（PII 相当の境界あり）。外部への送信は原則違反。",
  "rc6.grounding.dataClassification.personal-info": "データ区分：個人情報（PII 境界あり）。外部への個人情報送信は違反。",

  // ---------- Parameter Sensitivity: workload grounding ----------
  "rc6.grounding.workload.itemLabel": "ワークロード特性",
  "rc6.grounding.workload.cpu-bound": "ワークロード特性：CPU 集約。計算資源のスケーリングと処理時間が設計の焦点。",
  "rc6.grounding.workload.io-bound": "ワークロード特性：I/O 集約。外部 I/O 待ちとタイムアウト設計が焦点。",
  "rc6.grounding.workload.data-heavy": "ワークロード特性：データ集約。大量データの整合性・スループット・保管設計が焦点。",
  "rc6.grounding.workload.interactive": "ワークロード特性：対話型。応答遅延（レイテンシ）とユーザー体験が焦点。",

  // ---------- P1-A: Result 最終状態（open condition が残る場合の表現） ----------
  "rc6.result.finalState.openConditions":
    "見逃した問題はありませんが、未解決の承認条件が残っています（すべて解決済みではありません）。",

  // ---------- P2: Adoption entry（開始時点で得られる成果物を提示） ----------
  "rc6.setup.adoption.output":
    "完走すると、ゲートマップ・役割分担・証跡チェックリスト・導入パイロットの次の一歩が生成されます。自社の Gate 設計・導入判断に使えます。",

  // ---------- Parameter Sensitivity: decision-readiness（承認体制・リリース影響・可逆性） ----------
  "rc6.readiness.approvalRequirement.label": "承認体制",
  "rc6.readiness.approvalRequirement.single": "単独承認",
  "rc6.readiness.approvalRequirement.dual": "二者承認",
  "rc6.readiness.approvalRequirement.committee": "委員会承認",
  "rc6.readiness.releaseImpact.label": "リリース影響度",
  "rc6.readiness.releaseImpact.low": "低",
  "rc6.readiness.releaseImpact.medium": "中",
  "rc6.readiness.releaseImpact.high": "高",
  "rc6.readiness.reversibility.label": "可逆性",
  "rc6.readiness.reversibility.reversible": "戻せる",
  "rc6.readiness.reversibility.partially-reversible": "部分的に戻せる",
  "rc6.readiness.reversibility.irreversible": "戻せない",
  "rc6.readiness.approvalGap":
    "リリース影響が高いのに単独承認です。承認体制が影響度に見合っていません。",
  "rc6.readiness.irreversibleNote":
    "この変更は戻せません。承認後の是正が困難なため、残存リスクを承認前に解消すべきです。",
};

const rc6En: LocaleBundle = {
  // ---------- P1-A: step-level Conditional Approval ----------
  "rc6.cond.step.desc":
    "Choosing Approve with Conditions here records the remaining condition, required evidence, and verification point as structured data. The condition is carried—without being dropped—through downstream steps, completion, release, and the result.",

  // ---------- P1-B: Accepted Upstream Facts ----------
  "rc6.fact.title": "Facts already fixed upstream",
  "rc6.fact.desc": "The values below were already decided in an upstream step. This step does not re-ask whether the value exists; it evaluates whether the design and validation meet the target.",
  "rc6.fact.sourceStep": "Fixed in",
  "rc6.fact.availability-target.label": "Availability target (RTO / RPO)",
  "rc6.fact.availabilityTarget.value.high": "RTO 30 min / RPO 5 min (high availability)",
  "rc6.fact.availabilityTarget.value.critical": "RTO 5 min / RPO 1 min (critical)",
  "rc6.fact.availabilityTarget.statement":
    "The availability target was fixed during Requirements. Design must not redefine it; instead, evaluate whether the architecture and validation meet the target.",

  // ---------- P1-C: Data sensitivity grounding ----------
  "rc6.grounding.dataClassification.itemLabel": "Data classification",
  "rc6.grounding.dataClassification.public": "Data classification: Public (no PII boundary). Using an external service is not by itself a PII-crossing violation.",
  "rc6.grounding.dataClassification.internal": "Data classification: Internal only. Taking it outside requires protection.",
  "rc6.grounding.dataClassification.confidential": "Data classification: Confidential (PII-equivalent boundary). External transmission is a violation by default.",
  "rc6.grounding.dataClassification.personal-info": "Data classification: Personal information (PII boundary). Sending personal data externally is a violation.",

  // ---------- Parameter Sensitivity: workload grounding ----------
  "rc6.grounding.workload.itemLabel": "Workload characteristic",
  "rc6.grounding.workload.cpu-bound": "Workload: CPU-bound. Compute scaling and processing time are the design focus.",
  "rc6.grounding.workload.io-bound": "Workload: I/O-bound. External I/O waits and timeout design are the focus.",
  "rc6.grounding.workload.data-heavy": "Workload: Data-heavy. Large-data integrity, throughput, and storage design are the focus.",
  "rc6.grounding.workload.interactive": "Workload: Interactive. Response latency and user experience are the focus.",

  // ---------- P1-A: Result final state (open conditions remain) ----------
  "rc6.result.finalState.openConditions":
    "No findings were missed, but unresolved approval conditions remain (not everything is resolved).",

  // ---------- P2: Adoption entry ----------
  "rc6.setup.adoption.output":
    "On completion, you get a gate map, responsibilities, an evidence checklist, and next pilot actions—usable for your own gate design and adoption decision.",

  // ---------- Parameter Sensitivity: decision-readiness ----------
  "rc6.readiness.approvalRequirement.label": "Approval regime",
  "rc6.readiness.approvalRequirement.single": "Single approver",
  "rc6.readiness.approvalRequirement.dual": "Dual approval",
  "rc6.readiness.approvalRequirement.committee": "Committee approval",
  "rc6.readiness.releaseImpact.label": "Release impact",
  "rc6.readiness.releaseImpact.low": "Low",
  "rc6.readiness.releaseImpact.medium": "Medium",
  "rc6.readiness.releaseImpact.high": "High",
  "rc6.readiness.reversibility.label": "Reversibility",
  "rc6.readiness.reversibility.reversible": "Reversible",
  "rc6.readiness.reversibility.partially-reversible": "Partially reversible",
  "rc6.readiness.reversibility.irreversible": "Irreversible",
  "rc6.readiness.approvalGap":
    "Release impact is high but only a single approver is required. The approval regime does not match the impact.",
  "rc6.readiness.irreversibleNote":
    "This change is irreversible. Because post-approval correction is hard, residual risk should be resolved before approval.",
};

export const rc6ContentJa: LocaleBundle = { ...rc6Ja };
export const rc6ContentEn: LocaleBundle = { ...rc6En };
