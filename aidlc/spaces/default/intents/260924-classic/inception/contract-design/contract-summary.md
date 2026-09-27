# Contract Summary — AI-DLC Learning Simulator

> 本ステージは system が honour すべき **formal contract**（境界の正式合意）を 1 回で洗い出す。対象境界は 2 種類のみ: (a) inter-unit 境界（system 内部の provider unit ↔ consumer unit）、(b) public/external API 境界（system 外部の consumer が消費する API）。
> **結論: 本 system に formal contract は存在しない（明示的 No Contract 判断）。** 単なる skip ではなく、なぜ contract が不要かと、唯一の境界候補である Scenario JSON を見落としていないことを以下に記録する。
> Learning Target = AI-DLC v2.10.0 / Dev Workflow Runtime = v2.9.0。

## 判定サマリ

| 観点 | 判定 | 根拠 |
|---|---|---|
| inter-unit contract | **none** | deployable unit は U1 単一、`depends_on: []`。unit 間 provider/consumer 関係が存在しない（Units Generation: `unit-of-work.md` / `unit-of-work-dependency.md`）。 |
| public/external API contract | **none** | static SPA。backend / API / DB / 外部 AI API・system 外部 consumer 向け API のいずれも持たない（C2 / OOS1 / NFR6）。 |
| 唯一の境界候補 Scenario JSON | **formal contract 対象外** | `Scenario JSON ↔ ScenarioLoader` は U1 内部の build-time asset boundary。inter-unit でも public API でもない。 |

## Contracts

**No inter-unit contracts.**（U1 単一・`depends_on: []` のため、pin すべき unit 間境界が存在しない。）

**No public/external API contracts.**（system 外部の consumer が消費する API を公開しない。将来 public API を持つ場合は Change Control で本ステージへ再入する。）

契約テーブルは空である（行なし）。これは記述漏れではなく、確定した No-Contract 判定の結果である。

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| — | （なし） | （なし） | （なし） | （なし） |

## Scenario JSON: internal build-time data boundary（contract 対象外の明示）

`Scenario JSON is an internal build-time data boundary, not an inter-unit or public API contract.`

- **位置づけ**: build-time 同梱の Scenario JSON は、U1 内部で `ScenarioLoader`（唯一の raw external validation 境界、ADR-003 / C5）が起動時に検証し、validated definitions を `ApplicationOrchestrator` 経由で `ScenarioCatalog` へ渡す。runtime fetch は行わない。unit をまたがず、外部 consumer も持たない。
- **なぜ Contract Design で pin しないか**: これを formal shared-schema contract として本ステージで定義すると、Domain Design（entity shape を所有）・Contract Design・Functional Design（concrete schema を所有）の間で **source of truth が重複**する。重複はドリフト源になるため、単一の所有先へ trace する方針を採る。
- **正式な所有先（trace）**:
  - **Domain Design** — semantic entity の shape・ownership・stable-ID・必須参照（`components.md`: Scenario / Stage / DecisionPoint / DecisionOption / LearningPoint / ProvenanceEntry は ScenarioCatalog 所有）。
  - **ScenarioLoader / ADR-003** — 唯一の raw external validation boundary（schema + cross-reference + provenance invariant を検証、`ScenarioValidationError` を所有）。
  - **Functional Design** — concrete schema・型・制約・cardinality・score weight（FR5.4 / OQ4 により委譲済み）。

## Boundary invariants（参照のみ・新規 contract 化しない）

Scenario JSON の validation 失敗時挙動は、新しい public/inter-unit formal contract を作らず、既存の Requirements / Domain Design の boundary invariant を**参照**する。

- **FR12（Requirements）** — 失敗時: (1) Application 全体を無言停止しない、(2) どの Scenario を読み込めなかったか識別できる readable error を出す、(3) malformed Scenario を正常教材として開始しない、(4) error を握り潰して silent fallback しない。
- **Domain Design** — `ScenarioValidationError` は `ScenarioLoader` が所有（fail-fast、silent fallback なし）。runtime invariant（mid-scenario 不整合）は `ScenarioProgression` が所有し `DomainInvariantError` を発行、永続化失敗は `ProgressStore` が `PersistenceError` を所有（boundary 別型区別、ADR-011）。
- validation 失敗時の **presentation UX 詳細**（error / empty state の見せ方）は Functional Design（FR12.5）。

## Contract ownership rules

- 本 system は unit 間契約・外部 API 契約を持たないため、契約 spec の所有・破壊的変更合意・additive 安全性のルールは**適用対象なし**。
- 唯一の内部データ境界（Scenario JSON）は上記「所有先（trace）」に従い、Contract Design は所有しない。

## Open questions（Functional Design 申し送り）

| Contract | Question | Blocks |
|---|---|---|
| Scenario JSON schema（internal boundary） | schema evolution policy: additive change / breaking change の扱い | Functional Design |
| Scenario JSON schema（internal boundary） | 厳格 validation における unknown field を reject するか ignore するか | Functional Design |
| Scenario JSON schema（internal boundary） | Scenario schema versioning の方式（Scenario schema version は ProgressStore の persistence `schemaVersion` とは**別概念**として扱う） | Functional Design |
| validation 失敗時の表示 | error / empty state の presentation UX 詳細（FR12.5） | Functional Design |

## Sources
- consumes: `../units-generation/unit-of-work.md`, `../units-generation/unit-of-work-dependency.md`（U1 単一・`depends_on: []`）, `../domain-design/components.md`（entity ownership・ScenarioLoader 境界）, `../requirements-analysis/requirements.md`（C2/OOS1/NFR6/FR12/FR5.4）。
- 計画回答: `contract-design-questions.md`（Q1=A / Q2=A / Q3=B / Q4=N/A / Q5=A）。
