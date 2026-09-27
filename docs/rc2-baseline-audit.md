# RC2 Learning Experience Baseline

## 1. Purpose

このドキュメントの目的:

- Pre-RC2 時点の Learning Experience Baseline を記録する
- learning-content audit の結果を要約する
- RC2 redesign の根拠(なぜ改修するか)を残す
- RC2 前後で比較できる状態を作る

Baseline tag: `v0.1.0-pre-rc2`
Baseline commit: `b3949e7e2dbdc223088339dc660fe4eb95772ddf`

> 本ドキュメントは事実ベースの記録です。主な source は
> [`../evidence/product-review/learning-content-inventory.md`](../evidence/product-review/learning-content-inventory.md)、
> 現在の実装 (`../src/`)、および baseline tag `v0.1.0-pre-rc2` です。推測で新しい事実を追加していません。

## 2. Pre-RC2 Baseline

Pre-RC2 時点の事実(数値・仕様は learning-content-inventory.md および source で確認済み):

- React + TypeScript + Vite
- 静的 SPA(static web application)
- runtime backend なし
- runtime AI なし
- ja / en 対応
- deterministic evaluation(評価は決定的、mode を入力に取らない)
- 9 evaluation dimensions(固定順・改変不可)
- 3 learning modes(Guided Learning / Simulation / Adoption Review)
- 4 scenarios(Core `core-e2e` 1 本 + Focus 3 本)
- 10 decision points(Core 4 + Focus 各 2 × 3)
- Adoption Discussion Sheet(10 見出し固定の Markdown を決定的生成、ダウンロード可能)
- AWS CloudFront + private S3 (OAC) での静的サイト配信実績

## 3. What Worked

Pre-RC2 の時点で技術基盤は成立しています(「失敗した版」ではありません)。成立している主な部分:

- deterministic Scenario Engine(同一入力 → 同一評価)
- provenance model(判断根拠を AI-DLC spec / simulator-interpretation として提示)
- bilingual support(ja / en、意味的挙動は共通)
- 9 Dimension evaluation(非単調 dimension を含む決定的スコアリング)
- Core + Focus scenario 構成
- AWS deployment(CloudFront + private S3)
- reusable / data-driven architecture(Scenario は JSON、ロジックとデータを分離)
- automated tests(ユニットテスト green)

技術・データ基盤は動作しており、RC2 は「作り直し」ではなく **学習体験の再設計** です。

## 4. Learning Experience Audit Findings

learning-content-inventory.md から確認された主要 gap の要約です。

### 4.1 Learning Depth

- Know / Decide は成立している(各 DecisionPoint で LearningPoint + provenance を提示し、選択式判断が 9 Dimension に反映される)
- Create / Review は未到達(ユーザーが成果物を書く体験、Evidence / 成果物を評価・改善する体験がない)

### 4.2 Mode Differentiation

- Guided は判断前に important DecisionPoint の provenance を先出しする差がある(`showConceptBeforeDecision: true`)
- Simulation / Adoption Review は判断中の体験がほぼ同一
- `showHints` / `emphasizeAdoptionReview` 等の policy 値が UI へ十分に反映されていない(差が policy 値レベルにとどまる)

### 4.3 Feedback

- option 別 feedback が弱い
- 判断の望ましさ(better / worse)が即時に分かりにくい
- Dimension impact が判断時点で見えない

### 4.4 Result / Reflection

- Result は 9 Dimension の記号表示が中心
- decision consequence / better alternative / next learning 等の情報が不足
- Reflection 画面は存在するが実質空(タイトルと次への導線のみ)

### 4.5 Navigation / Learning Position

- Home / Back / progress / current stage / retry / scenario switching が不足
- AI-DLC lifecycle 上の現在位置が見えない
- progress persistence(localStorage)がフローに十分接続されていない

### 4.6 Missing Learning Experiences

- Change Control
- explicit Rework
- Requirement Practice
- Evidence Review
- より深い Review / Create 体験

## 5. RC2 Design Goals (Planned for RC2)

以下の 8 項目は **RC2 で実装予定** です(実装済みではありません)。

1. Global Layout / Home / Navigation
2. Scenario + AI-DLC Lifecycle Stepper
3. Feedback Card
4. Result Dashboard
5. Learning Mode Visual Differentiation
6. Focus Scenario Library
7. Adoption Review → Adoption Workshop
8. Micro Interaction / Visual Polish

## 6. RC2 Learning Goals (Planned)

RC2 はデザイン刷新だけでなく、Learning Value の改善も目標とします(RC2 実装はまだ開始していないため、完了表現は用いません)。改善を目指す方向:

- Know → Decide → Create → Review へと学習の深さを拡張する
- Requirement Practice を追加する
- Evidence Review Practice を追加する
- clearer decision feedback(判断の理由と影響がより分かる)
- mode-specific learning experience(モードごとに体験が明確に異なる)
- lifecycle awareness(現在の工程位置が分かる)
- reflection(振り返り体験を実質化する)
- next-learning guidance(次に学ぶべきことの案内)

## 7. Explicitly Out of Scope for RC2 Design Upgrade

今回の UI/UX redesign(RC2)には以下を含めません。これらは将来の Stretch 候補であり、現在の RC2 scope とは区別します:

- runtime Amazon Bedrock
- backend
- API Gateway
- Lambda
- authentication
- database
- external telemetry
- runtime semantic scoring
- AWS infrastructure redesign

## 8. Success Criteria

RC2 完了後に比較可能な形での成功基準:

- 3 modes が UI/UX 上で明確に区別できる
- ユーザーが current lifecycle stage を理解できる
- decision 後に feedback / why / impact を理解できる
- Result から decision history を振り返れる
- Home / Back / Progress / Retry 等の主要 navigation が利用可能
- mobile で主要 flow を完走できる
- ja / en で semantic behavior が不変
- deterministic evaluation が不変
- existing tests が green のまま
- Create practice と Review practice が少なくとも 1 つずつ存在する

> 最後の Create / Review practice は、RC2 実装計画(§5 の Design Goals と §6 の Learning Goals、特に
> Requirement Practice / Evidence Review Practice)と整合します。

## 9. Evidence Sources

- Baseline tag: `v0.1.0-pre-rc2`(commit `b3949e7e2dbdc223088339dc660fe4eb95772ddf`)
- [`../evidence/product-review/learning-content-inventory.md`](../evidence/product-review/learning-content-inventory.md)
- AI-DLC design artifacts: [`../aidlc/spaces/default/intents/260924-classic/inception/requirements-analysis/requirements.md`](../aidlc/spaces/default/intents/260924-classic/inception/requirements-analysis/requirements.md)、[`../aidlc/spaces/default/intents/260924-classic/inception/user-stories/stories.md`](../aidlc/spaces/default/intents/260924-classic/inception/user-stories/stories.md)
- current automated test baseline: `../src/` 配下のユニットテスト(baseline 時点で green)
