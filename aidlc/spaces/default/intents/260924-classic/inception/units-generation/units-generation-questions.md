# Units Generation — Decomposition Plan Questions

> Domain Design の 12 logical component を deployable/runtime **unit** へどうグルーピングするかを決めます。Domain Design 承認時の申し送り（static React+TS+Vite SPA なので deployable unit は原則 1 つの frontend application bundle を基本、component 境界は code/module boundary として維持、unit を増やすこと自体を目的にしない、最小で自然な構成）を前提にします。本ステージは topology（依存 DAG）のみ。実装順序・critical path は Delivery Planning（2.9）が決めます。各 `[Answer]:` に記号で回答してください。

## Q1. Unit 境界戦略と粒度

deployable/runtime unit をどう切りますか。

- A. **単一 unit**（frontend application bundle 1 つ）。12 component は unit 内の code/module boundary（/domain /data /app /ui + /scenarios・locale の data separation）として維持。static SPA として最小・自然
- B. 2 unit に分ける: application bundle と scenario/content data を別 unit（data-driven 拡張を独立させる）
- C. 役割別に細かく分割（/domain, /ui, /data 等を別 unit）
- X. Other (please specify)

[Answer]: A（単一 frontend application unit。12 logical components は別 deployable unit に分割せず同一 unit 内の code/module boundary（/domain /data /app /ui /scenarios + locale resources）として維持。Domain Design の component 境界は失わず deployable topology だけ単純化。unit 名は application 全体を示す `aidlc-learning-simulator-web`。layer 名 unit（ui-unit/domain-unit 等）は避ける）

## Q2. Scenario データ / locale リソースの扱い

Scenario JSON（教材）と locale リソースを unit 上どう位置づけますか。

- A. application bundle に同梱する build-time asset（別 unit にしない）。code/module boundary（/scenarios, locale resources）としては分離を維持
- B. Scenario/locale を独立した data unit（kind: spec または library）として分け、bundle が消費
- C. Scenario は同梱、locale のみ別
- X. Other (please specify)

[Answer]: A（Scenario JSON と ja/en locale resources は application bundle へ同梱する build-time asset。ただし Scenario semantic data / locale display text / application code の論理分離は維持。独立 deployable unit にしない。理由: runtime fetch/backend 不要、static hosting 維持、malformed Scenario validation を起動時に一貫実行、MVP として運用面を増やさない）

## Q3. Unit kind（Construction の design 成果物マトリクスを規定）

単一 unit の場合、その kind は何にしますか（service=デプロイ実行体 / spec=契約・スキーマ / ui=フロントエンド surface / packaging=ビルド配布 / library=標準実行時なし再利用コード）。

- A. **ui**（frontend surface。static SPA として最も自然。scalability doc 等は不要になる）
- B. service（デプロイ実行体として扱う）
- C. まだ決めず全 design-artifact matrix を受ける（kind 省略）
- X. Other (please specify)

[Answer]: A（kind = `ui`。browser で実行される static SPA で主 surface は frontend UI。service にしない。build/package/deployment 設定はこの unit の delivery concern として扱い、packaging unit を別途作らない）

## Q4. デプロイモデル

- A. monolithic deploy（単一 static bundle を CDN/Pages へ）。審査中は AWS CloudFront、審査後 GitHub Pages（同一 Source、Hosting 差異は許容）
- B. independent deploy（複数 unit を個別デプロイ）
- X. Other (please specify)

[Answer]: A（monolithic deploy。同一 source / 同一 application bundle を基本とし、審査中は AWS hosting、審査後は必要なら GitHub Pages へ hosting 先を変更できる構成。Hosting 差異は deployment configuration として扱い application unit を分けない。AWS 用と GitHub Pages 用を別実装にしない）

## Q5. 依存・並行開発の方針（topology のみ。順序は 2.9）

- A. 単一 unit のため unit 間依存は無い（DAG は 1 ノード、depends_on: []）。並行性は unit 内 module レベルで扱う
- B. 複数 unit にする場合は topological 依存を明示し、独立 unit の並行開発余地を DAG に表す
- X. Other (please specify)

[Answer]: A（deployable unit は 1 つなので unit DAG は 1 ノード `depends_on: []`。12 logical component 間の依存を unit DAG へ再表現しない——それらは Domain Design 上の module/component dependency。deployable topology = 1 node / internal architecture = Domain Design の 12 component / implementation ordering = Delivery Planning、と分離）

## Consolidated Summary Confirmation

以下で unit-of-work.md / unit-of-work-dependency.md / unit-of-work-story-map.md / traceability.json を生成します。生成前に確認してください。

- **Deployable/runtime unit**: 1 つ。`U1` = `aidlc-learning-simulator-web`、Directory `u1-aidlc-learning-simulator-web`、kind `ui`、complexity `L`、deployment monolithic（standalone static bundle）。
- **境界**: Domain Design の 12 component は unit 内の code/module boundary（/domain /data /app /ui /scenarios + locale）として維持。deployable topology だけ単純化。
- **Scenario/locale**: application bundle 同梱の build-time asset（Scenario semantic data / locale display text / application code の論理分離は維持）。独立 unit にしない。
- **依存 DAG**: 1 ノード `depends_on: []`（yaml edge block）。12 component 依存を unit DAG に再表現しない。
- **story map**: 全 US1.1〜US8.2 を U1 へ割当（単一 unit）。
- **traceability.json**: 全 US を U1 へ OK 対応、Traceability != Verification。
- **重要な申し送り（unit-of-work.md に明記）**: complexity=L を理由に deployable unit を分割しない。Deployment topology = 1 unit、Implementation decomposition = 複数 Work Unit（Delivery Planning で管理: domain model/rules・Scenario validation/data・progression・evaluation・persistence・i18n・UI shell/scenario experience・result/reflection・Adoption Review/Sheet・accessibility・testing・AWS deployment）。実装順序・critical path は本ステージで決めず Delivery Planning へ。
- **維持**: single static SPA / backend なし / runtime generative AI なし / Domain Design module boundary 維持 / /domain 非依存 / ScenarioLoader 検証境界 / ProgressStore adapter / Orchestrator 結線 / determinism / canonical ownership / unit topology と module dependency を混同しない。Learning Target = v2.10.0。

**生成時の追加（確認済み）**: traceability.json / story-map で `Requirement / User Story → U1 → internal Domain Component` の追跡可能性を失わない。全 US の unit target は U1 だが、Domain Design で確定した component（ScenarioProgression / DimensionEvaluator / ApprovalSemantics / ResultModel / ScenarioLoader / ProgressStore / LocaleResources / ExperiencePolicy 他）への対応を残す。これは unit を増やす意味ではなく deployable topology は U1 のみ。

- Looks correct
- Request changes

[Answer]: Looks correct