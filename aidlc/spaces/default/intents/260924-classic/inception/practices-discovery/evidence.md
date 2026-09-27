# Evidence — Practices Discovery

> これは greenfield プロジェクトです。既存コードベースは無いため、実践は
> org.md の既定（提案されたデフォルトであり、確定したチームの事実ではない）と
> steering rules（product／tech／quality）から導出し、interview で人が確定
> しました。以下に各参加者の調査・推論、確定した decision、および未解決点を
> 示します。

## 各参加者の調査・推論

greenfield のため、コードやビルド構成の実 inspect は行っていません。lead および
3 名の delegated agent は次を参照して推論しました。

- **lead（integration）** — org.md の既定（Way of Working / Walking Skeleton /
  Testing Posture / Deployment / Code Style）と steering rules（product /
  tech-stack / quality）、`aidlc-state.md`（scope=classic、Depth=Standard、
  Test Strategy=Standard、Greenfield）、`phases/inception.md` を参照。5 セクションの
  ドラフトを起草し、interview 回答と 3 contribution を統合。
- **quality-agent** — Testing Posture・CI ゲート・テスト種別・カバレッジ運用を
  精査。決定性検証が「同一入力→同一スコア」だけでは弱いこと（反復・順序不変性・
  禁止依存の静的排除・golden 期待値の欠落）、80% line floor が小規模 MVP に過大で
  line 指標が弱いこと、accessibility が静的 lint だけでは不十分なこと、`ci-pipeline`
  と Operation が SKIP であるのに CI/CD を実践規定している不整合、「未実行を成功と
  報告しない」を exit code / `--passWithNoTests=false` で機械化する必要を指摘。
- **developer-agent** — 「ロジックとデータの分離」が原則宣言に留まり実装境界が
  未具体化である点を指摘。レイヤー境界（`/domain` 純関数・`/data` 検証境界・
  `/scenarios/*.json` データのみ・`/ui`・`/app`）、JSON を untrusted 外部入力として
  境界で 1 回だけ runtime validation する契約、`noUncheckedIndexedAccess`、
  malformed JSON の fail-fast + 可読エラー、命名規約・`data-testid` を推論・提案。
- **devsecops-agent** — 静的 SPA では攻撃面がサプライチェーンと CI に集約される
  と分析。`npm audit`（High/Critical ブロック）・Dependabot 週次・GitHub Actions
  最小権限（`contents: read` / `pages: write` / `id-token: write`）・lockfile 規律
  （`npm ci` + `package-lock.json` commit）・直接依存の pin・secret scanning を推奨。
  DAST / SBOM / コンテナスキャン / 重量級 SAST は本形態では不要と判断。

## interview で確定した decision

- **Hard Constraint / Working Practice の分離**: 最初の確認で「Request changes」を
  受け、ハード制約（ALWAYS / NEVER）は `discovered-rules.md` へ、working practice は
  `team-practices.md` へ分離することを人が確定（"Requested Changes Feedback" が
  authoritative）。
- **Way of Working**: trunk-based + feature branch → PR → squash-merge。個人開発
  でも `main` 直コミットを原則回避。`main` = 唯一のデプロイ可能トランク。
- **Walking Skeleton**: 「Scenario JSON分離 → 1 Scenario完走 → Decision反映 →
  結果表示」の薄い縦切りを最初に通す（儀式化しない）。
- **Testing Posture**: Methodology = test-after。deterministic core（scoring/
  evaluation・scenario transition・requirement coverage・approval boundary 判定・
  markdown 生成）はテスト先行/同時。一律 floor を置かず、コアは branch coverage を
  高めに維持、UI は主要 User Flow 重視。決定性検証（反復・順序不変・random/time の
  静的排除・golden）と JSON fixture 健全性テスト。Vitest、`--passWithNoTests=false`、
  exit code をゲートに。
- **Accessibility as target**: WCAG 2.2 AA は「目標」として扱い、検証なしに準拠を
  主張しない。keyboard 操作・focus 表示・contrast・色のみに依存しない表現・
  semantic HTML を基本方針とし、axe / user-event を補助的に使う（自動テストのみで
  AA 準拠を主張しない）。
- **Deployment / CI**: GitHub Actions で install / lint / typecheck / test / build。
  サプライチェーン最小防御を採用。過剰な security tooling は追加しない。
- **公開形態 / Hackathon**: 審査中の Official Live Application は AWS CloudFront、
  GitHub Pages は審査後に公開。AWS 版と GitHub Pages 版は同一の Source Code /
  Application を使用する。Hosting 固有設定や Deployment 設定の差異は許容し、Vite
  `base` 等の差異により build artifact が異なることは許容する（同一 build artifact
  であることは要求しない）。Vite `base` はリポジトリのサブパス
  `aidlc-learning-simulator`。AWS 用と GitHub Pages 用に Application 本体を別実装
  することは禁止する。
- **AI-DLC / AWS approval の分離**: AI-DLC 工程完了と AWS release approval を分離
  記録。AWS 接続時に「coding agent connected to AWS console」の Evidence を取得し、
  機密情報は Evidence から除外する。
- **i18n / 教育値**: 日英 2 言語必須、翻訳欠落を表示しない、Scenario 内容と UI 文言を
  分離。educational simulation value と実測値を明確に区別。
- **Code Style / 分離**: レイヤー境界と境界での JSON runtime validation、fail-fast、
  純関数化を規約化。

## scope 整合の記録（SKIP vs practice の reconciliation）

- `aidlc-state.md` では `ci-pipeline (3.7)` と Operation フェーズ全体が **SKIP** で、
  classic ワークフローにはパイプラインを構築する実装ステージが存在しない。それでも
  interview で人は Q6 に「B 拡張」を選び、CI（GitHub Actions で install / lint /
  typecheck / test / build）を **working practice かつ Hackathon 要件として実際に
  構築する**と決定した。この不整合は次のように調停する。
  - CI は team-practices の Deployment / Testing Posture に working practice として
    記録し、実 CI/Pages ワークフローの構築は本 classic ワークフローの stage 外として
    別途手動整備する前提（quality の OBJECT を反映）。必要なら後続で `--stage
    ci-pipeline` を人の判断で追加する。
  - **AWS deploy は Hackathon 要件**であり、AI-DLC の工程完了記録とは分離して別途
    記録する（同一視しない）。AWS 接続 Evidence は機密情報を除外して取得する。

## 未解決の不確実性（後続ステージで確定）

- **Scenario JSON schema**（フィールド、スコアリングの重み付け構造）は
  requirements-analysis／domain-design で確定する。
- **MVP 内の WCAG 対象範囲**: WCAG 2.2 AA は目標として合意済みだが、MVP でどの画面・
  どの成功基準を必須スコープとするかの厳密な範囲は未確定。
- **GitHub Pages サブパス**: リポジトリのサブパス公開（`base` =
  `aidlc-learning-simulator`）は確定。CloudFront との base 差異の吸収方法は
  deployment 詳細で確定する。
- malformed Scenario の表示 UX / 部分読み込みの可否、typosquatting チェックの運用
  詳細、Dependabot の自動マージ可否は実装時に確定する。

## Development Log

2026-09-24: AWS設計時に一次情報を参照できるよう、KiroへAWS Documentation MCPを追加。開発支援用途のみとし、Simulator Runtimeには依存させない。

2026-09-24: Practices Discovery 承認後、Git リポジトリを初期化し baseline commit を作成（branch `main`、commit `1e37b42`）。この commit を追跡の初期 baseline とする。過去記録（`practices-discovery-timestamp.md` の `commit no-commit` 等）は事実として保持し、baseline commit に紐付けたように書き換えない。以降の Requirements / Design / Implementation では可能な範囲で対象 commit と Evidence を追跡する。

- この MCP 追加は Application Requirement や Runtime Architecture の変更ではなく、
  **開発時の調査・設計支援環境の変更**として扱う。
- AWS Documentation MCP の設定は Hackathon 要件「coding agent connected to the
  AWS console」の Evidence として **扱わない**。AWS Console と Kiro の接続 Evidence
  は後続の AWS Deployment フェーズで別途取得する。

## Sources

- `aidlc/spaces/default/memory/org.md` — Way of Working / Walking Skeleton /
  Testing Posture / Deployment / Code Style の framework 既定。
- steering: product rules — 教育用 Simulator、backend／DB／登録／外部 AI API なし、
  GitHub Pages、MVP は学習価値優先。
- steering: tech-stack rules — React + TypeScript + Vite、静的 SPA、
  Scenario は JSON 管理、ロジックとデータの分離。
- steering: quality rules — TypeScript strict mode、主要ロジックの unit test、
  決定的な Scenario scoring、未実行テストを成功と報告しない、accessibility。
- `aidlc/spaces/default/intents/260924-classic/aidlc-state.md` — scope=classic、
  Depth=Standard、Test Strategy=Standard、Project Type=Greenfield、
  ci-pipeline / Operation は SKIP。
- `aidlc/spaces/default/memory/phases/inception.md` — inception phase guardrails。
- interview: `practices-discovery-questions.md` — `[Answer]:` 群、
  Consolidated Summary Confirmation（Looks correct）、Requested Changes Feedback
  （Hard Constraint / Working Practice の分離、WCAG 2.2 AA を目標扱い）。
- contributions: `contributions/aidlc-quality-agent.md`、
  `contributions/aidlc-developer-agent.md`、`contributions/aidlc-devsecops-agent.md`。
