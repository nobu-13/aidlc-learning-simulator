# Practices Discovery — Interview

> 5 つの実践領域（Way of Working / Walking Skeleton / Testing Posture / Deployment / Code Style）について、
> リードのドラフトと 3 名のレビュー（quality / developer / devsecops）を踏まえた確認質問です。
> greenfield のため org.md の既定を提案値として提示しています。各 `[Answer]:` に選択肢の記号で回答してください。

## Q1. Way of Working（ブランチ運用）

短命 feature branch を `main` へ **squash-merge** する trunk-based を採用します（小規模な静的サイト向けの単純なモデル）。

- A. 提案どおり（trunk-based + squash-merge）でよい
- B. squash ではなく通常マージ（履歴を残す）にしたい
- C. 個人開発なので `main` へ直接コミットで十分（PR 運用は任意）
- X. Other (please specify)

[Answer]: A（個人開発でも main 直コミットは原則避け、feature branch → PR → squash-merge を基本とする。Hackathon 提出時の履歴・レビュー・変更理由を追いやすくするため）

## Q2. Walking Skeleton（最初に薄い縦切りを通すか）

薄い end-to-end のスライスを最初に作りますか。walking skeleton とは、全体を端から端まで一度通す最小構成を最初に作り、本機能を足す前に各部分がつながることを確認する作り方です。この scope（classic）は専用の skeleton 儀式を前提としませんが、実装順序として「Scenario JSON をロジックから分離して読み込み → 1 つの Scenario を最後まで進めてスコア表示」の薄い縦切りを最初に通すことを推奨しています。

- A. 推奨どおり、最初にその薄い縦切りを通す（儀式化はしない）
- B. 薄い縦切りは不要、機能単位で普通に進める
- X. Other (please specify)

[Answer]: A（薄い縦切り「Scenario JSON分離 → 1 Scenario完走 → Decision反映 → 結果表示」を最初の Walking Skeleton として通す。最初から全 Scenario や演出を作り込まない）

## Q3. Testing Posture — Methodology と scoring の扱い

主要ロジックは実装後にテストを書く **test-after** を基本とします。ただし quality レビューは、決定的であることがハード制約の **Scenario scoring だけは、期待スコアを固定するテストを実装と同時（可能なら先行）に用意する**ことを推奨しています。

- A. 提案どおり（基本 test-after、scoring のみテスト先行/同時）
- B. 全面 test-after（scoring も後追いテストでよい）
- C. 全面 test-first（TDD）にしたい
- X. Other (please specify)

[Answer]: A（基本 test-after。ただし決定的ロジックは test-first または実装と同時: scoring/evaluation、scenario transition、requirement coverage、approval boundary 判定、markdown 生成。UI 表示は実装後テストが基本）

## Q4. Testing Posture — カバレッジ基準

org の classic 既定は「80% line-coverage floor（緩めない）」です。quality レビューは、小規模な教育 MVP には過大で line 指標は弱いとし、**コアロジック（scoring / 進行 / JSON 検証）は branch coverage を高め（例 90%）、UI/配線層は緩め（例 line 60〜70%）の二段構え**を推奨しています。

- A. 二段構え（コア: branch 高め / UI: 緩め）を採用する
- B. org 既定どおり一律 80% line floor を維持する
- C. カバレッジ floor は設けず、主要ロジックにテストがあることだけ担保する
- X. Other (please specify)

[Answer]: A 寄り（一律 80% は置かない。Core domain/decision/scoring は branch coverage を高めに維持、UI component はカバレッジ数値より主要 User Flow を重視。行カバレッジ達成だけのためのテスト追加はしない。初期段階では固定の数値 floor を置かず、コアロジックの未検証分岐を残さないことを優先）

## Q5. Testing Posture — accessibility テストの範囲

Code Style で `eslint-plugin-jsx-a11y`（静的チェック）を使います。quality レビューは加えて、主要画面に **axe による自動 a11y アサーション**と **キーボード操作テスト**（Tab 順・Enter/Space 起動）を推奨しています。狙う WCAG 水準はどうしますか。

- A. WCAG 2.1 AA を目標に、axe 自動チェック + キーボード操作テストを主要フローに入れる
- B. WCAG 2.1 A 相当の基本のみ（jsx-a11y 静的チェック中心、自動 a11y テストは任意）
- C. accessibility は配慮するが、MVP では静的 lint のみで自動テストは後回し
- X. Other (please specify)

[Answer]: X（WCAG 2.2 AA を目標。最低限 keyboard 操作・focus 表示・十分な contrast・色だけに依存しない表現・semantic HTML を必須。自動確認として axe 等の導入を検討するが、自動テストだけで AA 準拠を主張しない）

## Q6. Deployment / CI — scope との整合（重要）

このワークフロー（classic）では `ci-pipeline` と Operation フェーズが SKIP 設定です。一方でチームの実践としては「マージ前に CI で lint/test を実行しブロック」「GitHub Actions で `npm ci → lint → test → vite build → GitHub Pages 公開`」を意図しています。CI/デプロイの扱いをどうしますか。

- A. 実践として team-practices に記録するに留め、実際の CI/Pages ワークフロー構築は本ワークフローの対象外（後で手動整備）とする
- B. CI ゲート（少なくとも test + lint のマージブロック）と Pages デプロイを本 MVP スコープ内で構築したい（`ci-pipeline` ステージを追加する）
- X. Other (please specify)

[Answer]: B 拡張（CI を実際に構築: GitHub Actions で install / lint / typecheck / test / build を最低限実行。加えて AWS Deployment を Hackathon 要件として実際に実施する。ただし AI-DLC の工程完了と AWS release approval は分離して記録する。AWS 接続・Deployment 時には Hackathon 要件「coding agent connected to AWS console」の Evidence を必ず取得する）

## Q7. Deployment — GitHub Pages の公開形態

Vite の `base` 設定に影響します。どの形態で公開しますか。

- A. リポジトリのサブパス公開（`https://<user>.github.io/<repo>/`。`base` にリポジトリ名を設定）
- B. ユーザー/組織サイト（`https://<user>.github.io/`。`base` は `/`）
- C. まだ未定（サブパス想定で進め、後で確定）
- X. Other (please specify)

[Answer]: A + X（リポジトリのサブパス公開を前提: `https://<user>.github.io/aidlc-learning-simulator/`。ただし Hackathon 審査中は GitHub Pages を公開せず、AWS CloudFront を Official Live Application とする。審査終了後に同じ build artifact を GitHub Pages へ公開できる構成にする）

## Q8. Deployment — CI のサプライチェーン最小防御

devsecops レビューは、静的サイトでも npm 依存が最大のリスク源として、**`npm audit`（High/Critical でブロック）を CI に追加**、**Dependabot（週次）を有効化**、**GitHub Actions を最小権限（`contents: read` / `pages: write` / `id-token: write`）で宣言**することを推奨しています。

- A. すべて採用する（npm audit ゲート + Dependabot + 最小権限）
- B. 最小権限と `npm ci` の lockfile 規律のみ採用、audit/Dependabot は任意
- C. MVP では標準の GitHub secret scanning のみ、追加のスキャンは設けない
- X. Other (please specify)

[Answer]: A 拡張（npm audit + Dependabot + GitHub Actions 最小権限 + package-lock.json を commit + dependency version を意図せず広げない + Secret を Repository へ保存しない。ただし Hackathon 期間中に過剰な security tooling は追加しない）

## Q9. Code Style — データ/ロジック分離の実装規約

developer レビューは、tech-stack の「ロジックとデータの分離」を実装可能な境界として具体化することを推奨しています：`/domain`（純関数、React/IO を import しない）・`/data`（JSON→ドメイン型の検証境界を一箇所に集約）・`/scenarios/*.json`（データのみ）・`/ui`・`/app`。JSON は境界で一度だけ実行時検証し、不正 JSON は fail-fast で可読なエラー表示。

- A. 提案どおりのレイヤー境界 + 境界での JSON 実行時検証（zod 等）+ fail-fast を規約化する
- B. レイヤー分離は採用するが、実行時検証ライブラリは使わず手書き type guard で軽量に
- C. 分離原則の宣言に留め、具体的な構成は domain-design 以降で決める
- X. Other (please specify)

[Answer]: A + X（Scenario data / Domain・Decision logic / UI を分離。Scenario JSON は境界で runtime validation し、不正な Scenario は fail-fast。UI 側で Scenario 構造を直接解釈しすぎない設計。追加方針: 日本語・英語の 2 言語を必須とし、translation 不足で undefined や片言語混在を表示しない。Scenario 内容と UI 文言を分離。educational simulation value と実測値を明確に区別。AI-DLC audit / artifacts / Git 履歴 / development log を後から分析可能な形で残す）

## 追加の確定事項（interview で新たに判明した要求）

- **Hackathon 文脈**: 本プロジェクトは Hackathon 提出物。AI-DLC の工程完了記録と AWS release approval を分離して記録する。
- **公式ライブ環境**: 審査中の Official Live Application は AWS CloudFront。GitHub Pages は審査終了後に同一 build artifact で公開。
- **AWS Evidence**: AWS 接続・Deployment 時に「coding agent connected to AWS console」の Evidence を必ず取得する。
- **国際化 (i18n)**: 日本語・英語の 2 言語必須。翻訳欠落による undefined 表示や片言語混在を禁止。Scenario 内容と UI 文言を分離する。
- **教育値と実測値の区別**: educational simulation value と実測値を UI・データ上で明確に区別する。
- **監査可能性**: AI-DLC audit / artifacts / Git 履歴 / development log を後から分析可能な形で残す。

## Consolidated Summary Confirmation

> 注: 最初の確認で「Request changes」（Hard Constraint と Working Practice の分離、WCAG 2.2 AA は目標扱い）を受け、下記「修正後の確定内容」を反映済み。最終確認の `[Answer]:` はこのセクション末尾の 1 箇所のみが有効。

以下の内容で成果物（team-practices.md / discovered-rules.md / evidence.md）を最終化します。

**Way of Working**: trunk-based + feature branch → PR → squash-merge（個人開発でも main 直コミットは原則回避）。`main` = デプロイ可能な唯一のトランク。

**Walking Skeleton**: 最初に「Scenario JSON分離 → 1 Scenario完走 → Decision反映 → 結果表示」の薄い縦切りを通す。全 Scenario・演出の作り込みは後回し。

**Testing Posture**: Methodology = test-after。ただし決定的ロジック（scoring/evaluation、scenario transition、requirement coverage、approval boundary 判定、markdown 生成）はテスト先行/同時。UI は実装後テスト。カバレッジは一律 floor を置かず、コアは branch coverage を高めに維持しコアの未検証分岐を残さない、UI は主要 User Flow 重視。決定性検証（反復・順序不変・random/time 依存の静的排除・golden 期待値）。テストランナー = Vitest。CI で test/lint を実行、`--passWithNoTests=false`、exit code をゲートに。未実行テストを成功と報告しない。

**Accessibility**: WCAG 2.2 AA は目標として扱い、検証なしに準拠を主張しない。keyboard 操作・focus 表示・十分な contrast・色のみに依存しない表現・semantic HTML を基本方針とする。axe はアクセシビリティ確認の補助として使う。jsx-a11y 静的チェック併用。

**Deployment / CI**: GitHub Actions で install / lint / typecheck / test / build を実行。サプライチェーン最小防御（npm audit High/Critical でブロック、Dependabot 週次、Actions 最小権限 `contents: read`/`pages: write`/`id-token: write`、`package-lock.json` を commit + `npm ci`、dependency version を意図せず広げない）。Hackathon 中の Official Live Application は AWS CloudFront、GitHub Pages は審査後に同一 build artifact で公開（Vite `base` はリポジトリのサブパス `aidlc-learning-simulator`）。AI-DLC 工程完了と AWS release approval を分離記録。AWS 接続時に「coding agent connected to AWS console」Evidence を取得。過剰な security tooling は追加しない。

**Code Style / 分離**: Scenario data / Domain・Decision logic / UI を分離（`/domain` は純関数で React・IO を import しない、`/data` に JSON→ドメイン型検証境界を集約、`/scenarios/*.json` はデータのみ、`/ui`、`/app`）。JSON は境界で一度だけ runtime validation し不正 Scenario は fail-fast + 可読エラー。Prettier + ESLint、TypeScript strict、命名は TS 慣用。i18n（日本語・英語必須、翻訳欠落による undefined/片言語混在を禁止、Scenario 内容と UI 文言を分離）。educational simulation value と実測値を明確に区別。AI-DLC audit/artifacts/Git 履歴/development log を後から分析可能に残す。

- Looks correct
- Request changes

[Answer]: Looks correct

## Requested Changes Feedback

最初の確認で「Request changes」を受け、Hard Constraint と Working Practice を分離し、WCAG 2.2 AA を目標扱いとした。反映内容は以下。

**discovered-rules に記録するもの（Hard Constraint = ALWAYS / NEVER）**

- ALWAYS TypeScript strict を維持する。
- ALWAYS 日本語・英語の 2 言語を必須とする。
- ALWAYS Scenario data / domain logic / UI を分離する。
- ALWAYS 外部 Scenario JSON を境界で runtime validation する。
- NEVER 翻訳欠落を undefined や片言語混在のまま表示しない。
- NEVER 未実行テストを成功として報告しない。
- NEVER 教育用 simulation 値を実測値として表現しない。
- NEVER Secret / Credential / Token を Repository や Evidence へ保存しない。
- NEVER AI-DLC 工程完了承認と AWS Release Approval を同一視しない。
- NEVER Hackathon 用 AWS 接続 Evidence に機密情報を含めない（Evidence から機密情報を除外する）。
- NEVER AWS 版と GitHub Pages 版で別実装を作らない（同一の Source Code / Application を維持し、AWS 用と GitHub Pages 用に別実装を作らない。Deployment 設定や Hosting 固有設定の差異は許容する）。
- （既存の product 由来の制約は維持）NEVER backend / DB / ユーザー登録 / 外部 AI API を追加しない。NEVER MVP でゲーム性・演出を過剰に作り込まない。ALWAYS Scenario scoring を決定的にする。

**team-practices に残すもの（Working Practice）**

- trunk-based + PR → squash-merge。
- Walking Skeleton を最初に通す。
- 基本 test-after。
- deterministic core（scoring/evaluation、scenario transition、requirement coverage、approval boundary 判定、markdown 生成）はテスト先行または同時。
- branch coverage をコアで重視する。
- UI は主要 User Flow を重視する。
- axe はアクセシビリティ確認の補助として使う（自動テストのみで準拠を主張しない）。
- WCAG 2.2 AA は「目標」として扱い、検証なしに準拠を主張しない。keyboard 操作・focus 表示・十分な contrast・色のみに依存しない表現・semantic HTML を基本方針とする。
- GitHub Actions で install / lint / typecheck / test / build を行う。
- サプライチェーン最小防御（npm audit、Dependabot、Actions 最小権限、`package-lock.json` を commit + `npm ci`、dependency version を意図せず広げない）。
- GitHub Pages は Hackathon 審査終了後に公開する。審査中の Official Live Application は AWS CloudFront。
