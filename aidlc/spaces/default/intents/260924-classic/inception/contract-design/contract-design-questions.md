# Contract Design — 計画質問（AI-DLC Learning Simulator）

> 本ステージは system が honour すべき **formal contract**（境界の正式合意）を 1 回で洗い出します。対象となる境界は 2 種類のみ:
> (a) **inter-unit 境界**（provider unit ↔ consumer unit、system 内部）、(b) **public/external API 境界**（system 外部の consumer が消費する API）。
>
> 本プロジェクトの確定事実（Units Generation / Domain Design / Requirements より）:
> - deployable unit は **U1 単一**、`depends_on: []` → **inter-unit 境界は存在しない**。
> - **backend / API / DB / 外部 AI API なし**（C2 / OOS1 / NFR6）。static SPA。→ **system 外部が消費する public/external API は存在しない**。
> - したがって contract-design.md の skip 条件（単一自己完結 unit・inter-unit 境界なし・外部消費 API なし）に該当する余地がある。
> - 一方で唯一の「境界のデータ合意」候補が **build-time 同梱 Scenario JSON ↔ ScenarioLoader**（唯一の raw external validation 境界、ADR-003 / C5 / FR12 / NFR5）。これは shared-schema contract として本ステージで pin できる唯一の対象。ただし schema の**具体構造**は FR5.4 / OQ4 で **domain-design / functional-design 側に委譲**済み。
>
> 各 `[Answer]:` に記号（＋必要なら補足）で回答してください。

---

## Q1. inter-unit contract の有無

U1 は単一 deployable unit で `depends_on: []`。inter-unit（unit ↔ unit）の formal contract を定義する必要はありますか。

- A. なし（単一 unit・辺なしのため inter-unit contract は存在しない。contract-summary には「inter-unit 境界なし」を明記）
- B. あり（具体的な provider/consumer unit の組を補足してください）
- X. Other (please specify)

[Answer]: A（inter-unit contract なし。deployable unit は U1 のみ・`depends_on: []`・unit 間 provider/consumer 関係が存在しない。成果物に `No inter-unit contracts` と明示する）

---

## Q2. public/external API contract の有無

U1 は system 外部の consumer が消費する public/external API を公開しますか（backend/API/DB なし＝C2/OOS1 が前提）。

- A. なし（外部消費 API を公開しない。contract-summary に「external API なし」を明記。将来 API を持つ場合は Change Control で再入）
- B. あり（外部 consumer と API の形を補足してください）
- X. Other (please specify)

[Answer]: A（public/external API contract なし。static SPA で backend API/DB/external AI API/外部 consumer 向け API のいずれも持たない。将来 public API を追加する場合は Change Control で Contract Design へ再入する）

---

## Q3. Scenario JSON schema を本ステージの contract として pin するか

唯一の「境界のデータ合意」候補は **build-time 同梱 Scenario JSON ↔ ScenarioLoader**（ADR-003 の唯一の raw external validation 境界）。これを本ステージで **shared-schema contract** として扱いますか。schema の詳細構造・型・cardinality・score weight は FR5.4/OQ4 により domain-design/functional-design へ委譲済みである点に留意してください。

- A. **軽量に pin する**（推奨）: contract-summary に Scenario JSON を「authoring data ↔ ScenarioLoader の shared-schema contract」として 1 件記載。**トップレベル構造の骨子（Scenario/Stage/DecisionPoint/DecisionOption/LearningPoint/ProvenanceEntry の存在と stable-ID・必須参照の存在）と、validation failure 時の契約（fail-fast / readable error / silent fallback なし＝FR12）** のみを固定し、フィールド型・制約・score weight は functional-design へ明示委譲（OQ として open questions に残す）。
- B. pin しない: Scenario JSON schema は Domain Design（entity shape）と Functional Design が全面的に所有するとし、本ステージは「formal contract なし」を記録して skip 相当とする（contract-summary は「本 system に inter-unit/external contract は存在しない」旨と、Scenario schema の所有先ポインタのみ記載）。
- X. Other (please specify)

[Answer]: B（pin しない。Scenario JSON ↔ ScenarioLoader は重要な内部 data boundary だが inter-unit でも public/external API でもなく、U1 内部の build-time asset boundary。entity shape は Domain Design、具体 schema/型/制約/cardinality は Functional Design が所有し、Contract Design で別の formal contract として定義すると source of truth が重複する。成果物には `Scenario JSON is an internal build-time data boundary, not an inter-unit or public API contract.` と明記し、所有先として Domain Design（semantic entity shape）/ ScenarioLoader・ADR-003（raw external validation boundary）/ Functional Design（concrete schema・type・constraint・cardinality）を参照する）

---

## Q4. Scenario JSON contract の所有・versioning・互換性方針（Q3=A の場合のみ）

Q3 で A（軽量に pin）を選んだ場合、その shared-schema contract の所有と進化方針をどうしますか。

- A. **所有 = ScenarioLoader（検証境界）＋ Domain Design（entity shape）**。versioning は **additive-first**（新規任意フィールドは既存 Scenario を壊さない、未知フィールドは無視しない＝厳格 validation なので「未知フィールドは reject か ignore か」を functional-design で確定する OQ を残す）。破壊的変更（必須フィールド追加・意味変更）は Scenario JSON 全体の見直しを伴うため Change Control 相当で扱う。localStorage の `schemaVersion`（ProgressStore）とは別物として区別する。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: N/A（Q3=B のため本ステージで Scenario JSON contract の versioning を新規定義しない。Functional Design への申し送りとして残す決定対象: Scenario schema evolution policy / additive change・breaking change / unknown field を reject するか ignore するか / schema versioning / persisted localStorage `schemaVersion` との区別。とくに **Scenario schema version と ProgressStore の persistence schemaVersion は別概念**として扱う）

---

## Q5. validation error / 失敗時の境界挙動（contract の error 部分）

境界（ScenarioLoader）での validation 失敗時の契約挙動を確認します（FR12 と整合）。

- A. **FR12 準拠で固定**: 失敗時は (1) Application 全体を無言停止しない、(2) どの Scenario を読めなかったか可読エラーで示す、(3) 不正 Scenario を正常教材として開始しない、(4) error を握り潰して fallback 扱いしない。ScenarioValidationError を Loader が所有。error の**表示 UX 詳細**は functional-design へ委譲。
- B. 別方針（補足してください）
- X. Other (please specify)

[Answer]: A（FR12 準拠の既存 constraint を維持: Application 全体を無言停止しない / 読めなかった Scenario を識別できる readable error を出す / malformed Scenario を正常教材として開始しない / silent fallback しない / ScenarioValidationError は ScenarioLoader が所有 / presentation UX 詳細は Functional Design へ委譲。ただしこれは新しい public/inter-unit formal contract を作る意味ではなく、既存 Requirements / Domain Design の boundary invariant を contract-summary から**参照**する形にする）

---

## 決定サマリ（Contract Design の結論）

- inter-unit contract: **none**（U1 単一・`depends_on: []`）
- public/external API contract: **none**（static SPA、backend/API/DB/外部 AI API なし）
- Scenario JSON: **internal build-time data boundary** ゆえ formal contract 対象外（所有先を Domain Design / ScenarioLoader・ADR-003 / Functional Design へ trace）
- internal boundary constraints（FR12 の validation 失敗時挙動等）は Domain Design / Functional Design へ trace
- 本ステージは実質「明示的な **No Contract** 判断」。skip 相当だが、**なぜ skip できるか**と **Scenario JSON を見落としていないこと**を成果物に記録する。

---

## Consolidated Summary Confirmation

以下で `contract-summary.md` を生成します。生成前に確認してください。

- **inter-unit contract**: none（U1 単一 deployable unit、`depends_on: []`、unit 間 provider/consumer 関係なし → `No inter-unit contracts`）。
- **public/external API contract**: none（static SPA、backend/API/DB/外部 AI API・外部 consumer 向け API のいずれもなし。将来 public API を持つ場合は Change Control で Contract Design 再入）。
- **Scenario JSON ↔ ScenarioLoader**: internal build-time data boundary であり formal contract 対象外。`Scenario JSON is an internal build-time data boundary, not an inter-unit or public API contract.` と明記し、所有先を trace: Domain Design（semantic entity shape）/ ScenarioLoader・ADR-003（唯一の raw external validation boundary）/ Functional Design（concrete schema・type・constraint・cardinality）。
- **validation 失敗時 invariant（FR12）**: 新規 contract 化しない。既存 Requirements（FR12）/ Domain Design（ScenarioValidationError は ScenarioLoader 所有）の boundary invariant を contract-summary から**参照**する（無言停止しない / readable error / malformed を正常開始しない / silent fallback なし / presentation UX は Functional Design）。
- **結論**: 実質「明示的 No Contract 判断」。単なる skip ではなく、**なぜ contract が不要か**と **唯一の境界候補 Scenario JSON を見落としていないこと**を成果物に記録する。
- **Functional Design 申し送り（open questions）**: Scenario schema evolution policy（additive/breaking、unknown field reject vs ignore、schema versioning）。Scenario schema version と ProgressStore の persistence `schemaVersion` は別概念として扱う。

- Looks correct
- Request changes

[Answer]: Looks correct
