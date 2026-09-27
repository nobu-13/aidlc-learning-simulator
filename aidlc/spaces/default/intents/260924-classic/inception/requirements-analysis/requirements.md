# Requirements — AI-DLC Learning Simulator

> 対象: AI-DLC を体験学習し、実業務導入の議論に使える教育用 Simulator。静的 React + TypeScript + Vite SPA、backend/DB/登録/外部 AI API なし、Scenario は JSON 管理でロジックと分離。要件 ID（`FR{n}` / `NFR{n}`）は下流の永続的な traceability キーであり、renumbering しない。

## Intent Analysis

ユーザー（学習者・AI-DLC 導入検討者）が達成したいこと:

- AI-DLC の考え方と開発フローを **体験的に理解**する。
- Human / Agent Boundary、Approval、Change Control、Evidence、Testing 等について **判断理由を説明できる**ようになる。
- 実業務へ AI-DLC を導入する際の **議論・設計を支援**し、実チームで使える **検討材料を持ち帰る**。

優先順位（明示的な非機能方針）: **Educational Value / Technical Accuracy / Practical Adoption Value > 開発工期短縮**。Hackathon 要件は満たすが、そのために Educational Depth を削らない [Q1][Q8][memory:M1]。

学習は「Stage 名の暗記」ではなく「なぜその判断が必要か」の理解を目標とする [Q1]。

## Functional Requirements

### FR1. 二層の学習体験構造
- FR1.1 **Core End-to-End Experience** を提供する。AI-DLC 未経験者が 1 つのプロジェクトを Requirements → Release まで進め、AI-DLC 全体の主要判断を **約 5〜10 分で一周**できる [Q2][Q8].
- FR1.2 Core End-to-End では、Lifecycle と Stage の関係、Human/Agent Boundary、Approval、Evidence、Testing、および Release との違いを **最低限体験**できる [Q1][Q2].
- FR1.3 **Deep Dive / Focus Scenario Library** を提供する。特定判断を深掘りする短い Scenario を複数持ち、**時間制限を設けない** [Q2].
- FR1.4 Focus Scenario の候補論点: 曖昧な Requirement、Acceptance Criteria 不足、Approval 後の Requirement 変更、Source 変更後の再承認、Low Risk 変更の過剰 Human Review、High Risk 変更の過剰 Agent 委任、正常系 Test だけで完了、Test 期待値変更で Pass、IAM Permission 過剰、Evidence 不足、未実行 Test を成功扱い、AI-DLC Approval を Production Approval と誤認、古い Knowledge/CodeKB 依存、Session 中断・再開 [Q2].
- FR1.5 全体方針は「5〜10 分ですべてを理解させる」ではなく「5〜10 分で全体像を体験し、その後必要な論点を深掘りできる」構造とする [Q2][memory:M1].

### FR2. 学習対象コンセプト（学習判断ポイント）
- FR2.1 次の判断コンセプトを学習対象として扱う（Learning Target = AI-DLC v2.10.0）: AI-DLC Lifecycle と Stage の関係 / Requirements と Acceptance Criteria / Plan・Approval Gate / Change Control / Human・Agent Delegation Boundary / Evidence と Traceability / Testing Contract と「実行済み」の区別 / Test Failure 時の判断 / Approval 後の変更 / Risk・Evidence・Reversibility に応じた Human Intervention / AI-DLC 工程完了承認と Release Approval の違い / 失敗・中断・再開・手戻り / 実業務導入時に AI-DLC 外側へ残すべき統制 [Q1].
- FR2.2 v2.10.0 一次情報に整合する学習題材の強化点（v2.10.0 Release Notes 由来。Release Notes に無い意味は補完しない）。各点について **「教材として扱うか（必須度）」と「MVP 初期 Focus Scenario に含めるか」を分離**する [CC-v2.10.0][R-06]:
  - FR2.2.1 **agent execution boundary** と **human-controlled approval gate** の分離: Core または主要 Learning Experience で扱う **必須 Learning Concept**。FR6.6(a)(b) の重要 Decision Point と対応。
  - FR2.2.2 **verified Unit / batch checkpoint review**: Focus Scenario Library で扱う **必須 Topic**。ただし MVP 初期 Focus Scenario に含めるかは OQ5 / Delivery Planning で確定。
  - FR2.2.3 **refusal / recovery path が実行可能な next step を示すこと**: Failure / Interruption / Recovery を扱う Focus Scenario 群の **必須 Learning Topic**。初期 MVP に含める具体 Scenario は OQ5 / Delivery Planning で確定。
  - まとめ: 上記 3 点はいずれも **教材化対象（必須）**。ただし初期 Focus Scenario の実装順序・本数は OQ5 / Delivery Planning へ委ねる（「教材として扱うか」と「MVP 初期 Scenario に含めるか」は別判断）。
- FR2.3 **harness/runtime 固有挙動 vs AI-DLC 学習概念の区別**: v2.10.0 の Kiro IDE delegation 等（Copilot routing・compiled tool dispatch・engine child execution・worktree/harness 共存等）は harness/runtime 固有の実装挙動であり、影響確認対象として記録するが Simulator の主要 Learning Concept へ自動昇格させない。AI-DLC 自体の学習概念（boundary / approval / evidence / testing 等）と harness の実装挙動を明確に区別する。この区別の provenance 上の担保は FR6.8 / NFR3 に接続する [CC-v2.10.0][R-07].

### FR3. Scenario エンジンとデータ駆動設計
- FR3.1 Scenario はデータ（JSON）として管理し、domain logic から分離する。Scenario 追加は **原則 domain logic 変更を必要としない** [Q2][tech-stack].
- FR3.2 End-to-End と Focus の全 Scenario、および 3 つの学習モードは、**同一の Scenario Engine と Source Data** を使用する（別 Application として実装しない）[Q9-modes].
- FR3.3 Scenario の本数は本時点で固定しない。将来の追加を JSON で行える [Q2].
- FR3.4 各 Scenario / Decision は決定的に評価される（同一入力→同一 Decision Outcome・同一 Score dimension 結果）[Q4][quality].

### FR4. Decision 操作モデル
- FR4.1 ユーザーは各 Decision Point で選択式の Decision を 1 つ選ぶ。Decision 種別（最低限）: `Delegate to Agent` / `Approve` / `Reject` / `Request More Evidence` / `Require Human Approval` / `Return to Previous Stage` / `Change Scope` [Q3].
- FR4.2 ユーザーは各 Decision に **任意の判断メモ**を付けられる。メモは **採点に使用しない**（local state のみ保持）[Q3][Q9].
- FR4.3 自由入力を実行時 AI で評価する機能は **実装しない**（Runtime Generative AI を要するため）[Q3].
- FR4.4 主要 Flow は Return to Previous Stage / Change Scope 等により **手戻り・やり直し**を体験できる [Q1][FR2].

### FR5. 評価モデル（Concept / Decision Dimension）
- FR5.1 評価は総合点や正誤 100 点を中心にせず、次の **Concept/Decision Dimension** として表示する: Requirement Clarity / Acceptance Criteria Coverage / Evidence Quality / Approval Boundary / Delegation Quality / Risk Handling / Traceability / Rework / Remaining Risks [Q4].
- FR5.2 「Human Intervention が多いほど良い」「Autonomy が高いほど良い」という単調な評価にしない。Risk / Evidence / Reversibility / Impact / Approval Boundary に対し、委任または介入の判断が適切だったかを**説明**する [Q4].
- FR5.3 評価に用いる数値は **Educational Simulation Value** として明示し、実測値とは区別する（→ NFR/FR6 参照）[Q4][Q6].
- FR5.4 **評価モデルの最低限の契約（Requirements で固定）**（具体的な score weight・schema 構造は OQ4 として domain-design / functional-design で確定）[R-01]:
  - FR5.4.1 すべての採点対象 Decision は、どの Dimension へ影響するかを **明示的に定義**する。
  - FR5.4.2 Dimension への影響は **deterministic な rule / data** として表現し、UI 内に暗黙の評価ロジックを持たせない。
  - FR5.4.3 同一 Scenario / 同一 Decision sequence は常に **同一 Dimension 結果**を返す。
  - FR5.4.4 各 Dimension 結果について、どの Decision が結果へ寄与したかを **追跡可能**にする。
  - FR5.4.5 Human Intervention や Autonomy の量だけで一方向に評価しない（FR5.2 の非単調性を実装契約として裏打ち）。

### FR6. 教育値と実測値の区別・provenance
- FR6.1 Educational Simulation Value を実測値と誤認できない形で表示する。**UI 表示と Scenario data meta の両方**で明示する [Q6][project:Forbidden].
- FR6.2 各 Scenario は provenance 情報を持つ: `learningObjective` / `concept` / `sourceRefs` / `interpretationNote` / `simulationAssumptions` [Q6].
- FR6.3 `sourceRefs` は単なる参考リンクではなく、重要な学習判断について次を識別できる: (i) AI-DLC v2.10.0（Learning Target / Reference Baseline）のどの一次情報を根拠とするか、(ii) その一次情報から直接導ける内容か、(iii) Simulator 側の教育的解釈・推奨判断か、(iv) Scenario 成立のための simulation assumption か [Q6][CC-v2.10.0].
- FR6.4 少なくとも重要 Decision Point について `Decision / Learning Point → Source Reference または Simulator Interpretation` を **追跡可能**にする [Q6].
- FR6.5 AI-DLC 仕様そのものと Simulator 独自の Best Practice / 教育的解釈を **区別**でき、混同しないようにする [Q6][Q8].
- FR6.6 **「重要 Decision Point」の定義（判定可能）**[R-02]: 次のいずれかに該当する Decision Point は重要 Decision Point として扱う:
  - (a) Approval Boundary を変更・通過する
  - (b) Human / Agent Delegation Boundary に関係する
  - (c) Change Control や再承認要否に関係する
  - (d) Evidence の十分性を判断する
  - (e) Test の実行・失敗・完了承認に関係する
  - (f) AI-DLC 工程完了承認と Release Approval の区別に関係する
  - (g) Rework または Remaining Risk を発生・解消させる
  - (h) Scenario の主要 Learning Objective に直接対応する
- FR6.7 重要 Decision Point については、その学習判断が **Source Reference / Simulator Interpretation / Simulation Assumption のいずれに基づくか**を **必須で追跡可能**にする [R-02][Q6].
- FR6.8 **AI-DLC Concept 仕様と harness/runtime 固有挙動の provenance 区別** [R-07][CC-v2.10.0]:
  - Scenario / Learning Point の provenance では、AI-DLC の **Concept 仕様**と **harness/runtime 固有挙動**（Kiro IDE delegation 等）を区別する。
  - harness/runtime 固有情報を教材化する場合、その事実を source / provenance 上で識別可能にする（例: sourceRefs / interpretationNote 上で harness 由来と明示）。
  - harness/runtime の変更を AI-DLC 本体の Concept 変更として扱わない。
  - 境界: AI-DLC 本体の Learning Concept ≠ harness/runtime 実装挙動。この境界を下流 Design でも維持する。

### FR7. 結果画面（学習の締めくくり）
- FR7.1 1 周の結果として次を提示する: Decision Timeline / 各 Decision の判断と Consequences / AI-DLC Stage との対応 / Concept ごとの理解ポイント / Human・Agent Boundary / Approval Boundary / Rework が発生した理由 / Remaining Risks / Better Alternative / AI-DLC 一次情報への Reference / 次に学習すべき Focus Scenario [Q5].

### FR8. AI-DLC Adoption Discussion Sheet
- FR8.1 結果から **Markdown 形式**の "AI-DLC Adoption Discussion Sheet" を生成できる [Q5].
- FR8.2 Sheet の見出し（この順・この表記）: `Project Context` / `Requirements` / `Acceptance Criteria` / `Agent Delegation Boundary` / `Human Approval Boundary` / `Evidence Required` / `Testing Expectations` / `Remaining Risks` / `Team Discussion Points` / `Questions to Resolve Before Adoption` [Q5].
- FR8.3 Sheet は導入設計を自動確定するものではなく、実業務で AI-DLC 導入を **議論するための Educational Output** であると明示する [Q5].

### FR9. 学習モード
- FR9.1 次の 3 モードを提供する（同一 Scenario Engine / Source Data 上、別アプリにしない）: **Guided Learning**（初学者向け、判断前後に AI-DLC 概念を説明）/ **Simulation**（ヒントを減らしユーザー自身が判断）/ **Adoption Review**（自分の Decision を振り返り、実チームでの Delegation/Approval/Evidence を検討）[Q9-modes].

### FR10. 国際化 (i18n)
- FR10.1 日本語・英語の 2 言語を必須とする [tech via practices][project:Mandated].
- FR10.2 既定言語はブラウザ言語に追従する: `ja` → 日本語 / その他 → English / fallback → English。ユーザーは常時切替できる [Q7].
- FR10.3 言語切替により Scenario 進捗・Decision・結果・任意メモを失わない [Q7].
- FR10.4 日本語版と英語版で学習内容・Decision Outcome が変わらない（意味・結果の一致）[Q7][Q8].
- FR10.5 翻訳欠落による undefined 表示や片言語混在をしない [project:Forbidden].

### FR11. 永続化
- FR11.1 localStorage に次を保存する: 言語 / Scenario 進捗 / Decision / 任意判断メモ / Completed Scenario / Learning Result [Q9].
- FR11.2 Server-side persistence / Account / DB を使用しない [Q9][product].
- FR11.3 結果の共有リンクは必須要件としない（任意）[Q9].

### FR12. 不正 Scenario JSON のユーザー可視挙動（runtime validation 失敗時）
- FR12.1 Scenario JSON が境界の runtime validation（C5）に失敗した場合、**Application 全体を無言で停止させない** [R-04].
- FR12.2 **どの Scenario を読み込めなかったか**をユーザーまたは開発者が判別できる **可読なエラー**を表示する [R-04].
- FR12.3 不正 Scenario を正常な教材として **開始しない** [R-04].
- FR12.4 validation error を握り潰して fallback Scenario として **扱わない** [R-04].
- FR12.5 詳細な表示方法（error / empty state の UX）は functional-design で確定してよい [R-04][OQ].

## Non-Functional Requirements

- NFR1 **Educational Effectiveness**: AI-DLC 未経験者が Core End-to-End を約 5〜10 分で完走でき、完走後に主要な AI-DLC 判断ポイントを自分の言葉で説明できる（定性目標）。**Early User Test の確認項目**（最低限、Core End-to-End 完走後にユーザーが説明/提示できること）[R-05][Q8]:
  - (a) AI-DLC の主要 Lifecycle を説明できる
  - (b) Human / Agent Boundary を説明できる
  - (c) なぜ Human Review が必要になる場合と Agent へ委任できる場合があるかを説明できる
  - (d) AI-DLC 工程完了承認と Release Approval の違いを説明できる
  - (e) Evidence 不足時に何を確認すべきかを説明できる
  - (f) 実業務導入時にチームで議論すべき項目を 1 つ以上挙げられる
  現段階では合格率や統計的有意性は要求しない。少人数の Early User Test 結果を一般的な学習効果として誇張しない（NFR8）[R-05].
- NFR2 **Determinism**: deterministic core（scoring / evaluation・scenario transition・requirement coverage・approval boundary 判定・markdown 生成）は同一入力に対し同一結果を返す。乱数・時刻・順序に依存しない。テストで検証する [Q4][Q8][team:Testing Posture].
- NFR3 **Technical Accuracy / Traceability**: 重要 Decision Point の学習判断が、AI-DLC v2.10.0（Learning Target / Reference Baseline）一次情報由来か Simulator 独自解釈かを識別でき、追跡できる（FR6）。仕様と独自 Best Practice を混同しない。加えて、必要に応じて **AI-DLC specification / harness behavior / Simulator Interpretation / Simulation Assumption** の 4 区分を識別できること（FR6.8）——harness/runtime 挙動を AI-DLC 本体の Concept と混同しない [Q6][Q8][CC-v2.10.0][R-07].
- NFR4 **Accessibility**: WCAG 2.2 AA を目標とする（検証なしに準拠を主張しない）。keyboard のみで主要 Flow を完走できる。focus 表示・十分な contrast・色のみに依存しない表現・semantic HTML を基本方針とする [Q8][team:Accessibility].
- NFR5 **Maintainability / Data-driven**: Focus Scenario を JSON 追加で拡張でき、domain logic 変更を原則要さない。データ/ドメイン/UI をレイヤー分離する [Q2][team:Code Style].
- NFR6 **Portability / Static hosting**: 静的 SPA として動作し、backend を持たない。同一 Source Code / Application で AWS（審査中の公式ライブ）と GitHub Pages（審査後）に配信でき、Hosting 固有設定・build artifact の差異は許容、別実装は作らない [team:Deployment][project].
- NFR7 **Security (proportionate)**: 静的 SPA として Secret / Credential / Token を Repository・バンドル・Evidence に含めない。CI に npm audit / Dependabot / 最小権限を敷く（過剰な security tooling は追加しない）[team:Deployment][project:Forbidden].
- NFR8 **Honesty of claims**: Educational Simulation Value を実測値として表示しない。Early User Test の少人数結果を一般的な学習効果として誇張しない [Q4][Q6][Q8].
- NFR9 **Performance (light)**: 教材データはビルド時同梱で、初回ロードから体験開始まで通常のブロードバンドで数秒以内を目安とする（厳密なしきい値は design で確定）。

## Constraints

- C1 技術スタックは React + TypeScript（strict mode）+ Vite の静的 SPA に固定 [tech-stack][project:Mandated].
- C2 backend / DB / ユーザー登録 / 外部 AI API を追加しない [product][project:Forbidden].
- C3 Runtime Generative AI を使用しない（自由入力の AI 評価は実装しない）[Q3].
- C4 Scenario データは JSON で管理し domain logic と分離する [tech-stack][project:Mandated].
- C5 外部 Scenario JSON は境界で runtime validation する [project:Mandated].
- C6 AI-DLC 工程完了承認と AWS Release Approval を同一視しない [project:Forbidden].

## Assumptions

- A1 **バージョンの区別（Change Control で確定）** [Q6][CC-v2.10.0]:
  - **Simulator Learning Target / Reference Baseline = AI-DLC v2.10.0**。provenance の基準はこの版。明示的に固定し「現行版」等に汎用化しない。将来の新版は自動追従せず、同様に Change Control で影響分析・再承認する。
  - **Development Workflow Runtime = AI-DLC v2.9.0**（本 workflow を進めている AI-DLC 自体の版。`.aidlc-version` = 2.9.0）。active workflow 中に project runtime を v2.10.0 へ refresh しない。
  - 両者は別物であり、Simulator の教材内容（学習対象＝v2.10.0）と本開発の実行環境（＝v2.9.0）を混同しない。参照形式の確定は domain-design（OQ1）。
- A2 対象ユーザーは AI-DLC 未経験〜導入検討者を含む。専門的な事前知識を前提にしない [Q1][Q8].
- A3 教材（Scenario）はビルド時に同梱され、実行時に外部から取得しない [C2][NFR6].
- A4 「約 5〜10 分」は Core End-to-End の目安であり、厳密なタイマー制約ではない [Q2][FR1.5].

## Assumptions & Open Questions

- OQ1 AI-DLC **v2.10.0** 一次情報（公式 `awslabs/aidlc-workflows` の Release Notes / docs / source）の参照形式（URL / doc パス / セクション ID / release-linked PR）と `sourceRefs` スキーマへの落とし込み → domain-design で確定 [memory:M2][CC-v2.10.0].
- OQ2 Scenario / Decision / Score dimension / provenance の JSON スキーマ具体化 → domain-design 以降 [memory:M2].
- OQ3 Adoption Discussion Sheet の Markdown 生成のクライアント側 UX（ダウンロード / クリップボードコピー）→ design で確定 [memory:M2].
- OQ4 評価 dimension の具体的な判定ルール（各 Decision がどの dimension にどう寄与するか）→ domain-design / functional-design で確定。
- OQ5 Focus Scenario の初期セット（MVP で同梱する本数と論点）→ scope 内で段階確定。

## Out of Scope

- OOS1 backend / API / DB / 認証 / アカウント管理。
- OOS2 実行時の生成 AI 連携・自由入力の AI 採点。
- OOS3 実企業の AI-DLC 導入設計の自動確定（Adoption Sheet は議論材料であり確定物でない）[FR8.3].
- OOS4 マルチユーザー同時編集・サーバー保存・共有リンクの必須実装（共有リンクは任意）[Q9].
- OOS5 実測パフォーマンス値・実運用メトリクスの提示（教育用シミュレーション値のみ）[NFR8].

## Open Questions

上記 `## Assumptions & Open Questions`（OQ1–OQ5）を参照。いずれも後続ステージ（domain-design / functional-design）で解決する。

## Sources

- [desc] Initial description: project-description.json は `[Project description]` プレースホルダ。実質の要求は steering rules と本ステージの interview から確定。
- [scope] Workflow-selected scope: classic（Depth=Standard、Test Strategy=Standard、Greenfield）。
- steering: product rules — 教育用 Simulator、backend/DB/登録/外部 AI API なし、GitHub Pages、MVP は学習価値優先。
- steering: tech-stack rules — React + TypeScript + Vite、静的 SPA、Scenario は JSON 管理、ロジックとデータ分離。
- steering: quality rules — TypeScript strict、主要ロジックの unit test、決定的な Scenario scoring、未実行テストを成功と報告しない、accessibility。
- [Q1]–[Q9] interview: `requirements-analysis-questions.md` の `[Answer]:` 群、および Consolidated Summary Confirmation（Looks correct）、Requested Changes Feedback（二層構造・provenance traceability の追加）。
- consumes: `aidlc/spaces/default/intents/260924-classic/inception/practices-discovery/team-practices.md`（team:Way of Working / Testing Posture / Accessibility / Deployment / Code Style）。
- memory: `aidlc/spaces/default/memory/project.md`（project:Mandated / Forbidden、affirmed 2026-09-24）、`team.md`、`org.md`、`phases/inception.md`。
- [memory:M1] 教育目的を「体験」から「説明可能性 + 導入議論」へ引き上げた解釈（stage memory.md）。
- [memory:M2] 一次情報参照形式・JSON スキーマ・Sheet 生成 UX は後続で確定（stage memory.md open questions）。
- [R-01][R-02][R-04][R-05] 助言レビュー（product-lead, iteration 1, READY）の所見を承認前に反映: FR5.4（評価契約）、FR6.6/FR6.7（重要 Decision Point 定義と provenance 必須）、FR12（不正 JSON のユーザー可視挙動）、NFR1（Early User Test 確認項目）。R-03（性能しきい値）は design で確定する方針を維持（NFR9）。レビュー記録: `inception/requirements-analysis/reviews/review-01.md`, `review-02.md`。
- [CC-v2.10.0] Change Control（strict）: AI-DLC v2.10.0 リリースを受け、Human が Simulator の Learning Target / Reference Baseline を v2.9.0 → v2.10.0 へ変更すると判断。Development Workflow Runtime は v2.9.0 のまま維持。requirements-analysis へ backward jump し、公式 `awslabs/aidlc-workflows` v2.10.0 Release Notes（`https://github.com/awslabs/aidlc-workflows/releases`）を一次情報として semantic impact 分析。破壊的な意味変更は検出されず、更新は A1・FR6.3・NFR3・OQ1 の baseline 化と FR2.2 の学習題材強化。詳細は `requirements-analysis-questions.md` の "Change Control — AI-DLC v2.10.0 Learning Target 変更" セクション。development log: `evidence.md`（requirements-analysis）。
