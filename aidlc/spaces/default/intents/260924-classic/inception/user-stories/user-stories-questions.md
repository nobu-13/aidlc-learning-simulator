# User Stories — Planning Questions (PART 1)

> requirements.md（FR1–FR12 / NFR1–NFR9）と確定済みの product 方針をもとに、persona と story の作り方を決めるための質問です。既に決まっている事項（二層構造、9 dimension 評価、provenance、3 学習モード、i18n、localStorage 等）は再質問しません。各 `[Answer]:` に記号で回答してください。

## Q1. Persona の構成

どの利用者像を中心に User Story を書きますか（複数選択可）。

- A. AI-DLC 未経験の学習者（個人。まず全体像を掴みたい）
- B. 実業務導入の評価者（チームで AI-DLC 導入を検討。Adoption Review / Discussion Sheet を重視）
- C. Hackathon 審査者（短時間で価値を判断。英語既定で完走したい）
- D. Scenario 保守者・貢献者（JSON で Focus Scenario を追加する開発者・教材作成者）
- E. A + B を主 persona、C + D を副 persona として扱う
- X. Other (please specify)

[Answer]: E（主: A 未経験学習者 / B 実業務導入評価者。副: C Hackathon 審査者 / D Scenario 保守者・貢献者。Story 優先は A/B 中心。Hackathon 向け最適化で Educational/Practical Adoption Value を下げない。D は副だが明示的に Story 化する: JSON で Focus Scenario 追加 / provenance 維持 / AI-DLC 一次情報と Simulator 独自解釈の区別 / malformed Scenario を validation で検出 / domain logic を原則変更せず拡張）

## Q2. Story の分割・構成の軸

Story をどの軸で構成しますか。

- A. ユーザージャーニー（起動 → モード選択 → Core End-to-End 進行 → 結果 → Adoption Sheet → Focus 深掘り）中心
- B. 機能領域（Scenario エンジン / Decision / 評価 / 結果 / i18n / 永続化）中心
- C. 学習モード（Guided / Simulation / Adoption Review）中心
- D. A（ジャーニー）を主軸に、横断関心（i18n・accessibility・provenance・不正データ）を別グループで束ねる
- X. Other (please specify)

[Answer]: D（ユーザージャーニーを主軸。基本ジャーニー: 起動 → 言語選択 → 学習モード選択 → Core End-to-End 開始 → Context/Concept 確認 → Decision → Consequence/Explanation → 次 Stage または手戻り → Completion → Result/Reflection → Adoption Discussion Sheet → Focus Scenario Deep Dive → Adoption Review。主要ジャーニーは価値が端から端まで通る縦切り。横断関心を別グループへ: i18n / accessibility / provenance・traceability / localStorage / deterministic evaluation / malformed Scenario handling / Scenario maintainability / Markdown generation。機能一覧をそのまま分解せず、実際の学習体験を中心に）

## Q3. MVP 優先度（MoSCoW）の置き方

MVP の Must Have の線引きはどれに近いですか（正式な MVP 境界は Delivery Planning で確定。ここでは story 優先度の指針）。

- A. Core End-to-End の完走 + 結果表示 + 日英 + keyboard 完走 + 不正データの可読エラー を Must、Focus/Adoption Sheet/追加モードは Should 以下
- B. Core End-to-End + 少なくとも 1 つの Focus Scenario + Adoption Discussion Sheet までを Must（実業務導入価値を MVP に含める）
- C. 3 学習モードすべてを Must（学習体験の核として外せない）
- X. Other (please specify)

[Answer]: C（3 モード= Guided Learning / Simulation / Adoption Review をすべて Must。単なる UI バリエーションでなく Learn → Practice → Apply の連続した学習ループを MVP 内で成立させる。Guided: Concept と判断理由を理解、必要な Context/Concept を提示、Decision 後に理由・根拠を学ぶ。Simulation: Guidance/Hint を減らしユーザー自身が判断、理解度・判断傾向を確認。Adoption Review: 自分の Decision を Human/Agent Boundary・Approval Boundary・Evidence・Risk・Remaining Risks・Team Discussion Points の観点で振り返る。別 Application・別 Scenario 実装にはせず、同一 Scenario Engine / Source Data / Evaluation Model を共有。モード差は Guidance 量・Hint 有無・Decision 前後の説明量・Feedback 詳細度・Reflection の深さ・Adoption Discussion への接続で表現。Scenario/provenance 品質を犠牲にモード固有機能を過剰に増やさない。MVP Must に最低限含める: Core End-to-End Experience / 3 学習モード / 少なくとも 1 つの高品質 Focus Scenario / Result・Reflection / Adoption Discussion Sheet / 日本語・English / keyboard で主要 Flow 完走 / deterministic evaluation / provenance traceability / malformed Scenario の可読エラー。正式な実装単位・Delivery 順序は Delivery Planning で確定）

## Q4. 学習成果（説明可能性）の Story 化

NFR1 の「完走後に主要判断を説明できる」を、どう Story / 受け入れ基準に落としますか。

- A. 結果画面・Adoption Sheet が説明材料（Decision Timeline・concept 対応・boundary・remaining risks 等）を提示することを Story 化し、Early User Test 項目を受け入れ基準の観点として紐付ける
- B. 上記に加え、Guided/Adoption Review モードで「なぜこの判断か」の説明を体験中に提示する Story も明示
- C. 説明可能性は NFR として扱い、Story には結果提示までを含める（体験中の解説は design 判断に委ねる）
- X. Other (please specify)

[Answer]: B（結果画面/Adoption Sheet だけでなく、Guided Learning と Adoption Review では体験中にも「なぜこの判断か」を理解できる Story を明示。ただし Decision 前に正解を直接教えない。Guided は Decision 前に必要な Context/Concept を提示し、Decision 後に次を説明: なぜ適切/不適切だったか、どの AI-DLC Concept に関係するか、どの Risk が関係するか、どの Evidence が不足/十分だったか、どの Approval Boundary に影響するか、Human Intervention が必要/不要だった理由、Agent へ委任できた/すべきでなかった理由、どの Source/Simulator Interpretation/Simulation Assumption を根拠とするか。Simulation は事前 Hint を減らし Decision 後に Reflection。Adoption Review は正解確認に留めず「自分の実業務ではこの Boundary をどう設計するか」まで考えられる体験に。Requirements の Early User Test 説明可能性項目と User Story/AC を追跡可能にする）

## Q5. Story の粒度

Story 1 本あたりの大きさの好みはどれですか。

- A. 縦切り重視（1 Story で 1 つの体験が端から端まで通る。数は少なめ・各 3〜6 AC）
- B. 細かめ（画面・操作単位で分割。数は多め・追跡しやすい）
- C. 中庸（主要ジャーニーは縦切り、横断関心は機能単位）
- X. Other (please specify)

[Answer]: C（主要ジャーニーは縦切りで学習体験単位（画面/UI 部品単位でなく）に切る。例: 「AI-DLC 未経験者として、Context を理解した上で 1 つの Decision Point を判断し、その結果・理由・根拠を理解して次の Stage へ進みたい。なぜなら AI-DLC の判断プロセスを体験的に理解したいから」。横断 Story を分離: i18n / accessibility / persistence / provenance / Scenario validation / deterministic evaluation / Markdown generation / Scenario authoring・maintainability。Story 数を増やすこと自体を目的にしない。各 Story を Persona / User Value / Learning Outcome / Requirement IDs / Acceptance Criteria / 関連 provenance requirement / 必要なら Early User Test 観点 へ追跡可能に）

## 追加方針（User Stories 設計の最重要原則）

- 各 Story は「何を実装するか」だけでなく「その Story を通じてユーザーが何を理解・判断・説明できるようになるか」を明示する。
- 主要 Story は可能な限り次を持つ: **Persona / User Story / User Value / Learning Outcome / Requirement Traceability / Acceptance Criteria**。
- 重要な学習 Story の AC には次の観点も含める: Decision 結果だけでなく判断理由を説明できる / AI-DLC 仕様と Simulator 独自解釈を区別できる / Decision と Dimension への寄与を追跡できる / Source Reference・Simulator Interpretation・Simulation Assumption を必要に応じて確認できる。
- Hackathon 審査者向け Story は補助的に扱い、主 persona（学習者・実業務導入評価者）の価値を犠牲にしない。
- **最重要原則**: 本 Simulator は「AI-DLC を 5〜10 分で遊べる Application」ではなく「5〜10 分で全体像を体験し、その後自分で判断し、実業務導入まで考えられる AI-DLC 学習・導入支援 Simulator」として User Stories を設計する。

## Consolidated Summary Confirmation (初回 — Change Control ジャンプにより保留・履歴)

以下の計画で personas.md / stories.md / traceability.json を生成します（生成後にデザイナー・開発者・品質エンジニアの並行レビューを行います）。生成前に確認してください。

- **Persona**: 主 = P1 未経験学習者 / P2 実業務導入評価者。副 = P3 Hackathon 審査者 / P4 Scenario 保守者・貢献者。Story 優先は P1/P2 中心、P4 は明示的に Story 化。
- **Story 構成**: ユーザージャーニー主軸の縦切り（学習体験単位）+ 横断関心グループ。
  - 主要ジャーニー Story 群（縦切り）: 起動/言語選択/モード選択、Core End-to-End の Context→Decision→Consequence/Explanation→次 Stage or 手戻り、Completion→Result/Reflection、Adoption Discussion Sheet、Focus Scenario Deep Dive、Adoption Review。
  - 学習モード Story 群: Guided Learning（Decision 前に Context/Concept 提示、後に理由・根拠・provenance を説明。正解を事前に教えない）、Simulation（Hint を減らし自己判断→Reflection）、Adoption Review（自分の実業務での boundary 設計まで考える）。
  - 横断関心 Story 群: i18n（日英・切替で進捗保持・Outcome 一致）、accessibility（keyboard 完走・WCAG 2.2 AA 目標）、provenance/traceability、localStorage 永続化、deterministic evaluation、malformed Scenario の可読エラー、Scenario authoring/maintainability（P4）、Markdown Adoption Sheet 生成。
- **MVP（MoSCoW 指針、Provisional）**: 次を **Provisional Must**（User Stories 段階の暫定優先度）として扱う: Core End-to-End / 3 学習モード / 少なくとも 1 つの高品質 Focus Scenario / Result・Reflection / Adoption Discussion Sheet / 日英 / keyboard 完走 / deterministic evaluation / provenance / malformed Scenario の可読エラー。Should 以下 = 追加 Focus Scenario、共有リンク等。**正式な MVP 境界・実装順序・Delivery 単位は Delivery Planning で確定**する。
- **各 Story の属性**: Persona / User Story / User Value / Learning Outcome / Requirement Traceability（FR/NFR ID）/ Acceptance Criteria（Given/When/Then）。加えて **適用対象を限定した属性**: `provenance` は学習判断・Scenario・Explanation・Result 等に関係する Story で必須、`Early User Test` は Learning Outcome / Educational Effectiveness に関係する Story で必須。技術的・横断的 Story で該当しない場合は `N/A` を許可する（localStorage や単純な言語切替等へ意味のない provenance を付けない）。
- **重要学習 Story の AC 観点**: 判断理由を説明できる / AI-DLC 仕様と Simulator 独自解釈を区別できる / Decision と Dimension への寄与を追跡できる / Source Reference・Simulator Interpretation・Simulation Assumption を確認できる。
- **traceability.json**: requirements.md の全 FR/NFR を upstream_ids に列挙。各 ID の coverage は単純な有無に留めず、必要に応じて coverage type を持つ: `direct`（Story が Requirement を直接満たす）/ `supporting`（部分的・補助的に支える）/ `nfr-crosscutting`（複数 Story へ横断適用）/ `deferred`（Design/Delivery Planning で具体化、下流ステージ名を伴う）/ `gap`（対応 Story なし）。NFR を無理に単一 Story へ割り当てず横断要件として扱える。**coverage が存在するだけで「Requirement を検証済み」とは扱わない**——Traceability は「対応関係」であり Verification/Validation とは分離する。Requirement に対応しない Story、Story に対応しない Requirement を可視化できるようにする。
- **原則**: 「5〜10 分で遊べるアプリ」ではなく「5〜10 分で全体像を体験し、自分で判断し、実業務導入まで考えられる学習・導入支援 Simulator」。Educational/Technical Accuracy/Practical Adoption 価値を優先し、審査者向けは補助。

- Looks correct
- Request changes

（履歴の回答）Request changes（v2.10.0 への Learning Target 変更が承認済み requirements.md に semantic impact を持つため、strict Change Control に従い User Stories 生成を保留し、先に Requirements の変更・再承認を求めた。詳細は下記「Requested Changes Feedback」）

## Requested Changes Feedback

最初の確認で「Request changes」を受けた。反映内容:
1. **traceability.json の coverage type 化**: `direct` / `supporting` / `nfr-crosscutting` / `deferred` / `gap` を導入。NFR を単一 Story へ無理に割り当てず横断扱い可。coverage の存在 = 検証済み ではない（Traceability と Verification/Validation を分離）。
2. **provenance / Early User Test 属性の適用限定**: provenance は学習判断・Scenario・Explanation・Result 関連 Story で必須、Early User Test は Learning Outcome / Educational Effectiveness 関連 Story で必須、技術的・横断的 Story は `N/A` 許可。意味のない provenance を付けない。
3. **MVP を Provisional Must と明示**: 正式境界・実装順序・Delivery 単位は Delivery Planning で確定。

維持事項（変更なし）: P1/P2 主・P3/P4 副 / P4 も明示的に Story 化 / ジャーニー主軸 + 横断関心 / 3 モードを同一 Engine・Data で / Story を UI 部品でなく学習体験単位で / 全 FR/NFR を traceability.json へ列挙 / 未対応 Story・未対応 Requirement を可視化。

## Requested Changes（2回目）— v2.10.0 Learning Target 変更と Change Control ルーティング

2 回目の確認で、User Stories 計画は維持しつつ、生成前に重要な Requirement 変更（AI-DLC Learning Target を v2.9.0 → v2.10.0）が追加された。

**判断（Change Control, strict）**: この変更は承認済み `requirements.md`（A1・FR6.3・NFR3・OQ1）に semantic impact を持つため、User Stories 生成を先に進めず、先に Requirements の変更・再承認を Change Control に従って求める。

**バージョンの分離（明示）**:
- Development Workflow Runtime: **AI-DLC v2.9.0**（`.aidlc-version` = 2.9.0）。active workflow はこのまま継続。途中で project runtime を v2.10.0 へ refresh しない。
- Simulator Learning Target / Reference Baseline: **AI-DLC v2.10.0** へ変更。

**制約（正直な限界）**: 本エージェントは v2.10.0 の changelog を一次情報として検証できない。したがって v2.10.0 の具体差分を断定しない。影響評価は「v2.10.0 一次情報に対して再検証が必要な概念」を列挙し、確定は domain-design で v2.10.0 一次情報参照時に行う（provenance ルールに整合）。

**要求された処理順序**:
1. v2.10.0 への変更影響を分析（下記の概念を再確認対象として列挙）
2. 必要な Requirements 変更を反映
3. Requirements と User Stories 方針の整合性確認
4–6. personas.md / stories.md / traceability.json を生成
7. デザイナー / 開発者 / 品質エンジニアの並行レビュー
（Requirements 再承認が必要と判断 → User Stories 生成前に承認を求める＝本判断）

**再確認対象の概念（v2.10.0 一次情報に対して要再検証）**: Human/Agent Boundary、Approval Gate、Change Control、Construction 中の checkpoint/review、Guard と Human-controlled approval の区別、Evidence/Traceability、Test/completion 判断、Refusal/failure/interruption/recovery、Kiro IDE での delegation、AI-DLC 工程完了承認と AWS Release Approval の区別。

**Requirements 側の更新対象**: v2.9.0 を一次情報 baseline とする記述（A1）、FR6.3 の sourceRefs、NFR3 の provenance、Assumption として固定した対象 version、v2.9.0 前提の Scenario/Decision/Learning Point。

## Consolidated Summary Confirmation

Requirements が v2.10.0 Learning Target baseline で再承認されたため、User Stories 生成へ再入する。計画（Q1–Q5 の回答＋1・2 回目の Requested Changes 反映）は変更なしで維持し、v2.10.0 で確定した要件を前提に生成する。生成前に確認してください。

- **Persona**: 主 = P1 未経験学習者 / P2 実業務導入評価者。副 = P3 Hackathon 審査者 / P4 Scenario 保守者・貢献者（P4 も明示的に Story 化）。Story 優先は P1/P2 中心。
- **Story 構成**: ユーザージャーニー主軸の縦切り（学習体験単位）+ 横断関心グループ（i18n / accessibility / provenance / localStorage / deterministic eval / malformed handling / maintainability / markdown）。
- **学習モード**: Guided Learning / Simulation / Adoption Review を同一 Scenario Engine / Source Data / Evaluation Model で（Learn → Practice → Apply）。
- **v2.10.0 反映（要件確定分）**: boundary と approval gate の分離を **必須 Learning Concept**（FR2.2.1）として Story 化 / verified Unit・batch checkpoint review を **必須 Topic**（FR2.2.2）/ recovery の next-step を Failure・Recovery Focus の **必須 Learning Topic**（FR2.2.3）として扱う。ただし MVP 初期 Focus Scenario への投入順序・本数は OQ5 / Delivery Planning。harness/runtime 固有挙動（Kiro IDE delegation 等）は主要 Learning Concept へ自動昇格させない（FR2.3）。
- **provenance**: 重要学習 Story の AC は Source Reference / Simulator Interpretation / Simulation Assumption の区別に加え、AI-DLC specification と harness behavior を区別可能に（FR6.8 / NFR3、v2.10.0）。
- **MVP（Provisional Must）**: Core End-to-End / 3 学習モード / 高品質 Focus 1 本以上 / Result・Reflection / Adoption Discussion Sheet / 日英 / keyboard 完走 / deterministic eval / provenance / malformed 可読エラー。正式境界は Delivery Planning。
- **traceability.json**: v2.10.0 で再承認された全 FR/NFR を upstream に列挙。coverage type（direct / supporting / nfr-crosscutting / deferred / gap）。coverage = 検証済みではない（Traceability ≠ Verification/Validation）。
- **各 Story 属性**: Persona / User Story / User Value / Learning Outcome / Requirement Traceability / AC。provenance は学習判断・Scenario・Explanation・Result 関連で必須、Early User Test は Learning Outcome 関連で必須、技術/横断 Story は N/A 許可。

**生成時の明確化（Looks correct に付随）**: FR2.2.1 / FR2.2.2 / FR2.2.3 の 3 点はすべて User Stories / Traceability の対象。FR2.2.2 / FR2.2.3 の「MVP 初期 Focus Scenario へ投入するか」は OQ5 / Delivery Planning で決めるが、User Stories 自体を後回しにする意味ではない。よって 3 点とも: Story を生成 / Requirement Traceability を持たせる / Learning Outcome を明示 / provenance 要件を適用 / Provisional Must・Should 等の Delivery 優先度とは分離、という扱い。harness/runtime 固有挙動は主要 Learning Concept へ自動昇格させず、必要な場合のみ適切な Story へ補助的に紐付ける。

- Looks correct
- Request changes

[Answer]: Looks correct
