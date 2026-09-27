# Unit of Work — AI-DLC Learning Simulator

> **本ステージは deployable/runtime topology（依存 DAG）のみを定義する。実装順序・critical path は Delivery Planning（2.9）が決める。**
> static React + TypeScript + Vite SPA。deployable unit は 1 つ。Domain Design の 12 logical component は unit 内の code/module boundary として維持し、deployable unit へは分割しない。Learning Target = AI-DLC v2.10.0 / Dev Workflow Runtime = v2.9.0。

## Unit 一覧

| Unit ID | Directory | Name | Kind | Complexity | Deployment |
|---|---|---|---|---|---|
| U1 | `u1-aidlc-learning-simulator-web` | aidlc-learning-simulator-web | ui | L | standalone（monolithic static bundle） |

## U1: aidlc-learning-simulator-web

- **Description**: AI-DLC を体験学習する static SPA アプリケーション全体。browser で実行される単一の frontend application bundle。
- **Boundaries**: このアプリ全体が 1 deployable unit。内部は Domain Design の component 境界を code/module boundary として保持する:
  - `/domain`: ScenarioProgression / DecisionEffectRules / DimensionEvaluator / ApprovalSemantics / ResultModel（pure semantic logic、React/localStorage/raw JSON/locale text 非依存）
  - `/data`: ScenarioLoader（raw JSON 検証境界）/ ProgressStore（localStorage adapter）
  - `/app`: ApplicationOrchestrator（結線）
  - `/ui`: presentation（React）
  - `/scenarios`: Scenario JSON（build-time asset）
  - locale resources: ja/en 表示テキスト（build-time asset、semantic data と分離）
  - AdoptionSheetComposer（pure service）/ ExperiencePolicy（3 モードの提示ポリシー）
- **Responsibilities（unit が所有・提供するもの）**: 学習体験の全機能（Home/モード選択、Core Scenario 進行、Result/Reflection、Adoption Review、Adoption Discussion Sheet、Focus Scenario Library）、決定的評価、provenance、i18n、localStorage 永続化、accessibility。
- **Deployment model**: standalone。同一 source / 同一 application bundle を monolithic に static hosting へ配信。審査中は AWS（CloudFront + S3）、審査後は必要なら GitHub Pages。**Hosting 差異は deployment configuration（Vite `base` 等）として扱い、AWS 用 / GitHub Pages 用に別実装（別 unit）を作らない**。
- **Unit kind = ui**: browser static SPA の frontend surface。service（デプロイ実行体）ではない。build/package/deployment はこの unit の delivery concern として扱い、packaging unit を別途作らない。scalability doc 等の service 向け design artifact は不要。
- **Implementation notes / constraints**:
  - backend / DB / ユーザー登録 / 外部 AI API / runtime generative AI なし。
  - Scenario JSON / locale は build-time 同梱（runtime fetch なし）。malformed Scenario は起動時に ScenarioLoader で検証（silent fallback なし）。
  - determinism（evaluation / progression / sheet 生成、runtime ID の semantic key 由来導出）と canonical ownership を維持。
  - **complexity = L を理由に deployable unit を分割しない**（下記「Deployment topology vs Implementation decomposition」参照）。

## Deployment topology vs Implementation decomposition（重要な申し送り）

- **Deployment topology = 1 unit（U1）**。complexity=L は unit を増やす理由にしない。
- **Implementation decomposition = 複数 Work Unit**。実装は Delivery Planning（2.9）で次のような work unit に分解して管理する（本ステージは順序を決めない）:
  - domain model / rules（DecisionEffectRules 含む）
  - Scenario validation / data（ScenarioLoader、Scenario JSON）
  - progression（ScenarioProgression、runtime invariant guard）
  - evaluation（DimensionEvaluator、9 Dimension、非単調）
  - persistence（ProgressStore、localStorage、破損処理）
  - i18n（LocaleResources、翻訳欠落検出）
  - UI shell / scenario experience（/ui、progressive disclosure、boundary/gate、aria-live）
  - result / reflection（ResultModel、Result 画面）
  - Adoption Review / Sheet（AdoptionSheetComposer、Markdown 決定的生成）
  - accessibility（keyboard 完走、focus、WCAG 2.2 AA 目標）
  - testing（deterministic core、a11y、JSON fixture 健全性）
  - AWS deployment（CloudFront + S3、Evidence 取得。AI-DLC 完了承認と Release Approval は分離）
- deployment topology（1 unit）と implementation decomposition（複数 work unit）を混同しない。

## Sources
- consumes: `../domain-design/components.md`（12 component）, `../domain-design/decisions.md`（ADR、境界/所有制約）, `../requirements-analysis/requirements.md`, `../user-stories/stories.md`。
- Domain Design 申し送り: 12 component を deployable unit に分割しない、static SPA = 1 bundle、component 境界は module boundary。

### 本ステージの判断を直接支える主要 ADR（逆参照）
Units Generation は次の Domain Design 判断を **U1 内部の module boundary として維持**する（ADR 本文は `../domain-design/decisions.md` を正とし、ここでは転載しない）:
- **ADR-001**: canonical ownership — ScenarioCatalog（authoring）と ResultModel（実行結果）の所有分離。
- **ADR-003**: ScenarioLoader を唯一の raw external JSON validation boundary とする。
- **ADR-005**: DecisionEffectRules の data-driven 化。
- **ADR-006**: i18n の semantic / presentation separation。
- **ADR-008**: ProgressStore を port/adapter として分離。
- **ADR-009**: domain の UI/framework/storage 非依存（hexagonal 依存方向）。
- **ADR-011**: Domain Error を boundary 別に型区別。

これらは U1 を複数 deployable unit へ分割する理由にはならない（deployment topology != implementation decomposition、component dependency != unit DAG）。

## Assumptions & Open Questions
- OQ（Delivery Planning）: 上記 implementation work unit の Bolt 順序・critical path・walking-skeleton の実装順（team practice: JSON 分離 → 1 Scenario 完走 → Decision 反映 → 結果表示 の薄い縦切りを最初に）。
- None（deployable topology は U1 単一で確定）。
