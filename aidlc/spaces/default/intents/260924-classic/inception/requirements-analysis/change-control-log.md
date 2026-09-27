# Change Control Log — Requirements Analysis

> 開発途中で対象仕様の新版がリリースされ、Human が Requirement 変更を判断した Change Control 事例の記録（後から分析可能にするための Evidence）。

## Development Log

2026-09-25: AI-DLC v2.10.0 の正式リリースを受け、Human が Simulator の Learning Target / Reference Baseline を v2.9.0 から v2.10.0 へ変更すると判断。active Development Workflow Runtime は v2.9.0 のまま維持し、strict Change Control により Requirements Analysis へ backward jump して影響分析・再承認を実施する。

## Change Control 事例としての要点

- **トリガー**: 開発途中（User Stories 計画中）に対象仕様（AI-DLC）の新版 v2.10.0 が正式リリースされた。
- **Human の判断**: 自動追従せず、変更影響を評価したうえで Requirement を更新すると決定。
- **バージョン分離**: Learning Target = v2.10.0（教材の一次情報基準） / Development Workflow Runtime = v2.9.0（本開発の実行環境）。混同しない。project runtime を active workflow 中に refresh しない。
- **プロセス**: strict Change Control → requirements-analysis へ backward jump（`stages_reset: [requirements-analysis, user-stories]`）→ 公式 v2.10.0 Release Notes を一次情報に semantic impact 分析 → Requirements 更新（A1・FR6.3・NFR3・OQ1・FR2.2）→ advisory 再レビュー → Requirements 再承認ゲート → 承認後に User Stories 生成へ。
- **一次情報**: 公式 `awslabs/aidlc-workflows` v2.10.0 Release Notes（`https://github.com/awslabs/aidlc-workflows/releases`）。Release Notes に無い意味・動作は推測補完しない。
- **影響評価の結論**: 破壊的な意味変更なし。v2.10.0 の方向性（Construction checkpoint 強化・boundary/gate 分離明確化・recovery の next step 明示・parser 改善・Kiro IDE delegation 修正）は本 Simulator の学習題材・要件と整合。要件削除は不要。

## v2.10.0 一次情報からの関連変更点

- Construction は verified Unit / batch checkpoint でレビューされる。
- Guards が agent execution boundary と human-controlled approval gate の分離を明確化。
- refusal / recovery path が実行可能な next step を identify する。
- Stage questions / gate replies / Testing Posture fields / story maps / claim sources / traceability records の parser 改善。
- Kiro IDE delegation（および Copilot routing・compiled tool dispatch・engine child execution）が正しい native path に。
