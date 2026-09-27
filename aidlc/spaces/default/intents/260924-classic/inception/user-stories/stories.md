# User Stories — AI-DLC Learning Simulator

> Learning Target = AI-DLC v2.10.0 / Development Workflow Runtime = v2.9.0（混同しない）。
> 各 Story: Persona / User Story / User Value / Learning Outcome / Requirement Traceability / Acceptance Criteria。
> provenance は学習判断・Scenario・Explanation・Result 関連 Story で必須、Early User Test は Learning Outcome 関連で必須、技術/横断 Story は `N/A` 許可。
> AC は Given/When/Then。ID: `US{group}.{seq}` / `AC{group}.{seq}.{n}`。MoSCoW は **Provisional**（正式境界は Delivery Planning）。
> Story の生成・Traceability・Learning Outcome・provenance の適用は、MVP 初期 Focus Scenario 投入可否（OQ5/Delivery Planning）とは分離する。

## Group 1 — 起動・言語・モード選択（ジャーニー入口）

### US1.1 言語の自動判定と切替
- **Persona**: P1, P2, P3
- **User Story**: 学習者として、起動時に自分のブラウザ言語で表示され、いつでも日英を切り替えたい。なぜなら母語で学びたく、審査者は英語で確認したいから。
- **User Value**: 言語障壁なく学習を開始できる。
- **Learning Outcome**: （UI 体験。学習概念そのものではない）
- **Requirement Traceability**: FR10.1, FR10.2, FR10.3, FR10.5
- **provenance**: N/A（i18n の UI 挙動。学習判断の provenance 対象ではない）
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC1.1.1 Given ブラウザ言語が `ja`、When アプリを開く、Then UI は日本語で表示される。
  - AC1.1.2 Given ブラウザ言語が `ja` 以外、When アプリを開く、Then UI は English で表示される（fallback も English）。
  - AC1.1.3 Given 学習の途中、When 言語を切り替える、Then Scenario 進捗・Decision・結果・任意メモを失わずに表示言語だけが変わる。
  - AC1.1.4 Given 任意の画面、When 表示を確認する、Then 翻訳欠落による undefined 表示や日英混在が無い。

### US1.2 学習モードの選択
- **Persona**: P1, P2
- **User Story**: 学習者として、Guided Learning / Simulation / Adoption Review から目的に合うモードを選びたい。なぜなら「学ぶ・試す・導入を考える」で必要な支援が違うから。
- **User Value**: 自分の習熟度・目的に合った学習ができる。
- **Learning Outcome**: 3 モードが Learn → Practice → Apply の連続であることを理解する。
- **Requirement Traceability**: FR9.1, FR3.2
- **provenance**: N/A（モード選択 UI）
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC1.2.1 Given 起動後、When モード選択を見る、Then Guided Learning / Simulation / Adoption Review の 3 つが選べ、各モードの目的が 1 行で説明され、初回向けに Guided Learning が推奨として示される。
  - AC1.2.2 Given いずれかのモードを選ぶ、When Core End-to-End を開始する、Then 選んだモードに応じた支援量（Guidance/Hint/説明/Feedback/Reflection）で進む。
  - AC1.2.3 Given 3 モード、When 同じ Scenario を各モードで開始する、Then 同一 Scenario Engine / Source Data / Evaluation Model を共有している（別実装でない）。
  - AC1.2.4 （first-run オンボーディング, design 反映）Given 初回起動（事前知識ゼロ想定）、When モード選択の前後で説明を見る、Then 「これは約 5〜10 分で AI-DLC を一周体験するもので、後から Focus で深掘りできる」という二層構造の入口と所要時間の目安が理解でき、迷わず開始できる。
  - AC1.2.5 （モード間遷移 UX, design 反映）Given いずれかのモードを完了、When 次のモードへ移る、Then 進捗を保ったままモード間を移動でき、Learn → Practice → Apply の次に何をすべきかが示される。

## Group 2 — Core End-to-End: Context → Decision → Consequence（学習の核）

### US2.1 Context/Concept を理解して次の判断に備える
- **Persona**: P1, P2
- **User Story**: 学習者・導入評価者として、各 Decision Point の前に必要な Context と Concept を理解したい。なぜなら判断の前提を知らずに選んでも学習・導入評価につながらないから。
- **User Value**: 判断の前提を理解した上で選択できる。
- **Learning Outcome**: その Stage で何が問われているか、どの AI-DLC Concept が関わるかを理解する。
- **Requirement Traceability**: FR1.1, FR1.2, FR2.1, FR9.1（Guided）
- **provenance**: 必須（提示する Concept は AI-DLC v2.10.0 一次情報 / Simulator 解釈 / assumption を区別）FR6.2, FR6.3, FR6.8
- **Early User Test**: (a) Lifecycle を説明できる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC2.1.1 Given Decision Point の直前、When Context を表示する、Then その判断に必要な状況と関連 AI-DLC Concept が提示される。
  - AC2.1.2 Given Guided Learning、When Context を見る、Then Decision 前に正解そのものは明示されない（判断は学習者が行う）。
  - AC2.1.3 Given Context 中の Concept 説明、When 出典を確認する、Then それが AI-DLC v2.10.0 一次情報由来か Simulator の教育的解釈か assumption かを、区分値（enum: `ai-dlc-spec` / `harness-behavior` / `simulator-interpretation` / `simulation-assumption`）と UI 上の区分ラベルで識別できる。
  - AC2.1.4 （P2 視点, design 反映）Given P2（導入評価者）、When Context を見る、Then 自チームの前提に引きつけて考えられる具体性（どの判断が実業務のどの boundary に対応するか）が示される。

### US2.2 1 つの Decision Point を判断し、結果と理由を理解して次へ進む
- **Persona**: P1, P2
- **User Story**: 学習者・導入評価者として、Context を理解した上で 1 つの Decision Point を判断し、その結果・理由・根拠を理解して次の Stage へ進みたい。なぜなら AI-DLC の判断プロセスを体験的に理解し、実業務への適用を検討したいから。
- **User Value**: 判断→結果→理由の一連を体験し、判断の意味を掴む。
- **Learning Outcome**: なぜその判断が適切/不適切かを、関係する Concept・Risk・Evidence・Approval Boundary の観点で説明できる。
- **Requirement Traceability**: FR4.1, FR4.4, FR1.1, FR7.1, FR5.1, FR5.2, FR5.4
- **provenance**: 必須 FR6.4, FR6.7, FR6.8（重要 Decision Point の根拠区分）
- **Early User Test**: (a)(c) Lifecycle / Human Review と委任の使い分けを説明できる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC2.2.1 Given Decision Point、When 選択肢（Delegate to Agent / Approve / Reject / Request More Evidence / Require Human Approval / Return to Previous Stage / Change Scope）を見る、Then 1 つを選んで次へ進める。
  - AC2.2.2 Given 判断後（Guided/Adoption Review）、When Consequence/Explanation を見る、Then なぜ適切/不適切か、どの Concept・Risk・Evidence・Approval Boundary に関係するか、Human Intervention が必要/不要だった理由、Agent へ委任できた/すべきでなかった理由が説明される。
  - AC2.2.3 Given 説明中の判断根拠、When 出典を確認する、Then 4 区分 taxonomy（`ai-dlc-spec` / `harness-behavior` / `simulator-interpretation` / `simulation-assumption`）のいずれに基づくかを区分ラベルで確認できる（`harness-behavior` は該当する場合のみ。`ai-dlc-spec` と混同しない）。
  - AC2.2.4 Given 同一 Scenario・同一 Decision sequence、When 2 回実行する、Then Dimension 結果は同一（決定的）。（決定性の完全契約は AC7.4.1 で担保）
  - AC2.2.5 Given 任意の Decision、When 判断メモを書く、Then メモは保存されるが採点には影響しない。結果画面・Adoption Sheet で当該メモを再確認できる。
  - AC2.2.6 （aria-live, design 反映）Given 判断後に Explanation が動的に表示される、When screen reader を使う、Then その動的コンテンツが `aria-live` 等で告知される。

### US2.3 手戻り・やり直しを体験する
- **Persona**: P1, P2
- **User Story**: 学習者として、必要に応じて前の Stage へ戻ったり Scope を変えたりして、判断をやり直したい。なぜなら実際の開発では手戻りが起き、その判断も学びだから。
- **User Value**: 手戻り・再判断の意味を体験する。
- **Learning Outcome**: いつ手戻り（Return / Change Scope）が妥当か、Rework がなぜ発生するかを理解する。
- **Requirement Traceability**: FR4.4, FR4.1, FR2.1（失敗・中断・再開・手戻り）
- **provenance**: 必須 FR6.4, FR6.7
- **Early User Test**: N/A（間接的に (a)(c) を補強）
- **MoSCoW**: Should (Provisional)
- **AC**:
  - AC2.3.1 Given 進行中、When Return to Previous Stage を選ぶ、Then 前の Stage に戻り、以前の Decision の文脈が保持される。
  - AC2.3.2 Given 手戻りが発生、When 結果で振り返る、Then Rework が発生した理由が提示される（FR7.1）。

### US2.4 boundary と approval gate の分離を学ぶ（v2.10.0 必須 Learning Concept）
- **Persona**: P1, P2
- **User Story**: 学習者として、agent execution boundary（Agent がどこまで実行してよいか）と human-controlled approval gate（人が承認する境界）の違いを体験的に理解したい。なぜなら両者を混同すると誤った委任・承認をするから。
- **User Value**: 「実行の境界」と「承認の境界」を区別できる。
- **Learning Outcome**: agent execution boundary と human-controlled approval gate の分離を説明できる。
- **Requirement Traceability**: FR2.2.1, FR2.1, FR6.6(a)(b)
- **provenance**: 必須 FR6.7, FR6.8（v2.10.0 spec 由来。harness/runtime 挙動と混同しない）
- **Early User Test**: (b)(c) Human/Agent Boundary / Human Review と委任の使い分けを説明できる
- **MoSCoW**: Must (Provisional)（教材化必須。初期 Focus 投入可否は OQ5/Delivery Planning とは独立）
- **AC**:
  - AC2.4.1 Given boundary を扱う Decision Point、When Context を見る、Then 「Agent が実行してよい範囲」と「人が承認する gate」が **別ラベル/別セクション**として提示される。
  - AC2.4.2 Given 判断後、When Explanation を見る、Then boundary と gate を混同した場合のリスクが **専用スロット**に提示される。
  - AC2.4.3 Given この Concept の根拠、When 出典を確認する、Then AI-DLC v2.10.0 の一次情報に基づくこと（harness/runtime 固有挙動ではないこと）を識別できる。

### US2.5 AI-DLC 工程完了承認と Release Approval の区別を学ぶ
- **Persona**: P1, P2
- **User Story**: 学習者として、AI-DLC の工程完了承認と（本番）Release Approval が別物であることを体験したい。なぜなら混同すると未承認のリリースを正当化しかねないから。
- **User Value**: 工程完了とリリース承認を区別できる。
- **Learning Outcome**: AI-DLC 工程完了承認と Release Approval の違いを説明できる。
- **Requirement Traceability**: FR2.1, FR6.6(f), C6
- **provenance**: 必須 FR6.7
- **Early User Test**: (d) 工程完了承認と Release Approval の違いを説明できる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC2.5.1 Given 完了承認に関わる Decision Point、When 判断する、Then 工程完了承認と Release Approval が **別ラベル/別ステップ**として提示され、前者が後者を意味しないことが体験される。
  - AC2.5.2 Given 判断後、When Explanation を見る、Then 両者を同一視した場合の帰結が **専用スロット**に提示される。

### US2.6 Simulation モードで自力判断を試す（Learn → Practice → Apply の Practice）
- **Persona**: P1, P2
- **User Story**: AI-DLC を学んだ利用者として、Guidance や Hint を減らした状態で同じ Scenario の Decision を自分で判断したい。なぜなら Guided Learning で得た理解を、自力で適用できるか確認したいから。
- **User Value**: Guided で学んだ知識を、自分自身の判断へ移せる。
- **Learning Outcome**: AI-DLC の主要 Concept について、事前に正解方向を提示されなくても Risk / Evidence / Boundary 等を考慮して Decision でき、自分の判断を Reflection できる。
- **Requirement Traceability**: FR9.1（Simulation）, FR3.2, FR4.1, FR5.1, FR5.4
- **provenance**: 必須 FR6.7（Reflection での根拠区分）
- **Early User Test**: (c) Human Review と委任の使い分けを自力で説明できる（関連）
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC2.6.1 Given Simulation モード、When Decision Point に至る、Then Decision 前の「正解方向を示す Hint / Guidance」が Guided Learning より減っている。
  - AC2.6.2 Given Simulation モード、When Scenario を進める、Then Guided と同一の Scenario Engine / Source Data / Evaluation Model を使用する（別実装でない）。
  - AC2.6.3 Given Decision Point、When 判断する、Then Decision 自体はユーザーが行う（自動判断されない）。
  - AC2.6.4 Given 判断後、When 結果を見る、Then 自分の判断を Reflection できる（理由・根拠区分を含む振り返り）。
  - AC2.6.5 Given 同一 Scenario・同一 Decision、When Guided と Simulation でそれぞれ評価する、Then 評価結果（Dimension 結果・Decision Outcome）は同一であり、モードによって評価ロジックを変えない（FR5.4.2）。

## Group 3 — Completion → Result / Reflection

### US3.1 結果画面で学びを振り返る
- **Persona**: P1, P2
- **User Story**: 学習者として、1 周の最後に自分の Decision と結果を振り返りたい。なぜなら体験を学びとして定着させたいから。
- **User Value**: Decision の連なりと結果を俯瞰し、学びを整理できる。
- **Learning Outcome**: 自分の判断傾向と、各判断が AI-DLC のどの Concept/Stage に対応するかを理解する。
- **Requirement Traceability**: FR7.1, FR5.1, FR5.2, FR5.4.4
- **provenance**: 必須 FR6.4, FR6.7（Reference・根拠区分の提示）
- **Early User Test**: (a)(b)(e) Lifecycle / boundary / Evidence 不足時の確認を説明できる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC3.1.1 Given 完走、When 結果を表示する、Then Decision Timeline / 各 Decision の Consequences / AI-DLC Stage 対応 / Concept 理解ポイント / Human・Agent Boundary / Approval Boundary / Rework 理由 / Remaining Risks / Better Alternative / 一次情報 Reference / 次の Focus Scenario が提示される。
  - AC3.1.2 Given 結果の各 Dimension、When 内訳を見る、Then どの Decision がその Dimension 結果に寄与したかを追跡できる（FR5.4.4）。
  - AC3.1.3 Given 結果のスコア/数値、When 表示を見る、Then Educational Simulation Value として明示され、実測値と区別される（FR6.1, NFR8）。
  - AC3.1.4 （empty state, design 反映）Given まだ Core End-to-End を完走していない、When 結果画面を開こうとする、Then クラッシュせず、未完走である旨と次にすべきことが可読に示される。

### US3.2 非単調な多次元評価として結果を理解する
- **Persona**: P1, P2
- **User Story**: 学習者として、結果が単一スコアでなく複数の観点で示され、「介入が多いほど良い」ではないと理解したい。なぜなら現実の良し悪しは文脈依存だから。
- **User Value**: 評価の非単調性を理解し、過剰介入/過剰委任の両方が問題になると学ぶ。
- **Learning Outcome**: Risk/Evidence/Reversibility/Impact/Approval Boundary に応じた委任・介入の適切さを説明できる。
- **Requirement Traceability**: FR5.1, FR5.2, FR5.4.5, FR5.3
- **provenance**: 必須 FR6.4
- **Early User Test**: (c) Human Review と委任の使い分けを説明できる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC3.2.1 Given 結果、When 評価を見る、Then 9 つの Concept/Decision Dimension で説明され、総合 100 点や正誤点が中心ではない。
  - AC3.2.2 Given 過剰な Human Intervention または High Risk の過剰委任を選んだ、When 評価を見る、Then いずれも「悪い」側に振れる（一方向評価でない）。

## Group 4 — Adoption Discussion Sheet

### US4.1 導入議論用 Markdown シートを生成する
- **Persona**: P2（主）, P1
- **User Story**: 実業務導入の評価者として、自分の体験から実チームでの導入議論に使える Markdown シートを持ち帰りたい。なぜなら学習を実務の意思決定につなげたいから。
- **User Value**: 実チームで議論できる具体的な検討材料を得る。
- **Learning Outcome**: 実業務導入時にチームで議論すべき項目を挙げられる。
- **Requirement Traceability**: FR8.1, FR8.2, FR8.3
- **provenance**: 必須 FR6.8（シート内の記述が spec 由来か Simulator 解釈かを区別）
- **Early User Test**: (f) 導入時にチームで議論すべき項目を 1 つ以上挙げられる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC4.1.1 Given 完走、When Adoption Discussion Sheet を生成する、Then 指定見出し（Project Context / Requirements / Acceptance Criteria / Agent Delegation Boundary / Human Approval Boundary / Evidence Required / Testing Expectations / Remaining Risks / Team Discussion Points / Questions to Resolve Before Adoption）を持つ Markdown が得られる。
  - AC4.1.2 Given 生成されたシート、When 内容を見る、Then 「導入設計を自動確定するものではなく議論用の Educational Output」である旨が明示される。
  - AC4.1.3 （決定性, developer/quality 反映）Given 同一の完走履歴（同一 Scenario・同一 Decision sequence）、When Adoption Discussion Sheet を生成する、Then 生成 Markdown は毎回同一（決定的、random/time 非依存）で、見出しは指定の順・表記。

## Group 5 — Focus Scenario Deep Dive（時間制限なし）

### US5.1 特定判断を深掘りする Focus Scenario を体験する
- **Persona**: P1, P2
- **User Story**: 学習者として、Core 体験の後に特定の判断（承認後変更・Evidence 不足・過剰委任等）を時間制限なく深掘りしたい。なぜなら重要論点は腰を据えて理解したいから。
- **User Value**: 重要論点を必要なだけ深く学べる。
- **Learning Outcome**: 各 Focus 論点について、なぜその判断が問題/適切かを説明できる。
- **Requirement Traceability**: FR1.3, FR1.4, FR1.5, FR2.1
- **provenance**: 必須 FR6.2, FR6.7
- **Early User Test**: N/A（論点別に (a)-(f) を補強）
- **MoSCoW**: Must (Provisional)（少なくとも 1 本の高品質 Focus Scenario。本数・初期セットは OQ5/Delivery Planning）
- **AC**:
  - AC5.1.1 Given Focus Scenario Library、When 1 つを選ぶ、Then 時間制限なく特定判断を深掘りできる。
  - AC5.1.2 Given Focus Scenario、When 完了する、Then その論点の学習ポイントと根拠区分が提示される。
  - AC5.1.3 （empty state, quality/design 反映）Given Focus Scenario Library が空（初期本数未確定・0 本）、When ライブラリを開く、Then クラッシュせず、空である旨と代替導線が可読に示される。

### US5.2 checkpoint review を扱う（v2.10.0 必須 Topic）
- **Persona**: P1, P2
- **User Story**: 学習者として、Construction が verified Unit / batch checkpoint でレビューされることを体験したい。なぜなら「まとめて後で」ではなく検証済み単位で確認する意味を理解したいから。
- **User Value**: checkpoint 単位のレビューの意味を理解する。
- **Learning Outcome**: verified Unit / batch checkpoint review がなぜ有効かを説明できる。
- **Requirement Traceability**: FR2.2.2, FR2.1
- **provenance**: 必須 FR6.7, FR6.8（v2.10.0 spec 由来）
- **Early User Test**: N/A
- **MoSCoW**: Should (Provisional)（教材化必須。MVP 初期 Focus への投入は OQ5/Delivery Planning）
- **AC**:
  - AC5.2.1 Given checkpoint review を扱う Focus Scenario、When 進める、Then verified Unit / batch checkpoint での確認が体験される。
  - AC5.2.2 Given この Topic の根拠、When 出典を確認する、Then AI-DLC v2.10.0 の一次情報に基づくことを識別できる。

### US5.3 refusal / recovery が次の一手を示すことを学ぶ（v2.10.0 必須 Learning Topic）
- **Persona**: P1, P2
- **User Story**: 学習者として、拒否（refusal）や失敗からの recovery が「実行可能な次の一手」を示すことを体験したい。なぜなら行き詰まったときの正しい進め方を理解したいから。
- **User Value**: 失敗・拒否時に何をすればよいかを理解する。
- **Learning Outcome**: refusal / recovery path が executable next step を示すことを説明できる。
- **Requirement Traceability**: FR2.2.3, FR2.1（失敗・中断・再開・手戻り）
- **provenance**: 必須 FR6.7, FR6.8（v2.10.0 spec 由来）
- **Early User Test**: (e) Evidence 不足時に何を確認すべきかを説明できる（関連）
- **MoSCoW**: Should (Provisional)（教材化必須。MVP 初期 Focus への投入は OQ5/Delivery Planning）
- **AC**:
  - AC5.3.1 Given Failure/Interruption/Recovery を扱う Focus Scenario、When 拒否や失敗に至る、Then 実行可能な next step が提示される。
  - AC5.3.2 Given recovery の説明、When 出典を確認する、Then AI-DLC v2.10.0 の一次情報に基づくことを識別できる。

## Group 6 — Adoption Review モード

### US6.1 自分の Decision を実業務観点で振り返る
- **Persona**: P2（主）, P1
- **User Story**: 実業務導入の評価者として、自分の Decision を Human/Agent Boundary・Approval Boundary・Evidence・Risk・Remaining Risks・Team Discussion Points の観点で振り返りたい。なぜなら学習を自チームの設計判断につなげたいから。
- **User Value**: 学習を実業務の boundary 設計の検討へ橋渡しできる。
- **Learning Outcome**: 「自分の実業務ではこの Boundary をどう設計するか」を考えられる。
- **Requirement Traceability**: FR9.1（Adoption Review）, FR7.1, FR8.1
- **provenance**: 必須 FR6.7, FR6.8
- **Early User Test**: (f) チームで議論すべき項目を挙げられる
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC6.1.1 Given Adoption Review モード、When 自分の Decision を振り返る、Then Scenario 内の正解確認に留まらず「自分の実業務での boundary 設計」を考える問いが提示される。
  - AC6.1.2 Given Adoption Review、When 完了する、Then Adoption Discussion Sheet（US4.1）へ接続できる。

## Group 7 — 横断関心（機能単位）

### US7.1 keyboard のみで主要 Flow を完走する（accessibility）
- **Persona**: P1, P2, P3
- **User Story**: 学習者として、マウスなしで主要な学習フローを完走したい。なぜなら多様な利用環境・支援技術で学べる必要があるから。
- **User Value**: キーボード利用者も学習できる。
- **Learning Outcome**: N/A（横断品質）
- **Requirement Traceability**: NFR4
- **provenance**: N/A
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC7.1.1 Given マウスを使わない、When Tab / Enter / Space で操作する、Then 起動→モード選択→Core End-to-End→結果→Adoption Sheet の主要 Flow を完走できる。
  - AC7.1.2 Given 各インタラクティブ要素、When フォーカスする、Then focus が視認でき、色のみに依存しない表現・十分な contrast・semantic HTML が保たれる（WCAG 2.2 AA を目標。自動検証のみで準拠は主張しない）。

### US7.2 進捗・結果を localStorage に永続化する
- **Persona**: P1, P2
- **User Story**: 学習者として、言語・進捗・Decision・メモ・完了・結果が同一ブラウザで保持されてほしい。なぜなら中断して再開したいから。
- **User Value**: 中断・再開できる。
- **Learning Outcome**: N/A（横断機能）
- **Requirement Traceability**: FR11.1, FR11.2
- **provenance**: N/A
- **Early User Test**: N/A
- **MoSCoW**: Should (Provisional)
- **AC**:
  - AC7.2.1 Given 学習の途中、When リロードする、Then 言語・進捗・Decision・任意メモ・Completed Scenario・Learning Result が保持される。
  - AC7.2.2 Given アプリ全体、When 動作を確認する、Then server / account / DB を使用していない。
  - AC7.2.3 （異常系, quality 反映）Given 破損・スキーマ不一致・値欠落・quota 超過の localStorage、When 起動する、Then 無言破綻せず、安全に初期化するか可読に通知する。

### US7.3 provenance と教育値/実測値の区別を UI とデータで担保する
- **Persona**: P2, P4
- **User Story**: 導入評価者・保守者として、教材の各判断が spec 由来か Simulator 解釈か assumption か（および harness 由来か）を識別でき、教育値を実測値と誤認しないようにしたい。なぜなら技術的正確性と信頼性が導入判断の前提だから。
- **User Value**: 教材の正確性と出所を信頼できる。
- **Learning Outcome**: N/A（横断品質。ただし学習 Story の provenance を支える）
- **Requirement Traceability**: FR6.1, FR6.2, FR6.3, FR6.5, FR6.8, NFR3, NFR8
- **provenance**: 必須（この Story 自体が provenance 機構）
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC7.3.1 Given 任意の Scenario、When data meta を見る、Then learningObjective / concept / sourceRefs / interpretationNote / simulationAssumptions を持つ。
  - AC7.3.2 Given 重要 Decision Point、When 根拠を確認する、Then `sourceRefs` が **統一 4 区分 taxonomy**（`ai-dlc-spec` / `harness-behavior` / `simulator-interpretation` / `simulation-assumption`）を表す区分値（enum）を持ち、UI 上で当該区分ラベルが確認できる（重要 Decision Point では必須。`harness-behavior` は該当する場合のみ使用し `ai-dlc-spec` と混同しない）。
  - AC7.3.4 （taxonomy 統一, R-01 解消）Given provenance を扱う全 Story（US2.1 / US2.2 / US2.4 / US2.5 / US2.6 / US3.1 / US4.1 / US5.x / US6.1）、When 根拠区分を表示する、Then すべて同一の 4 区分 semantic taxonomy を用いる（3 区分表現と 4 区分表現を併存させない）。semantic taxonomy は本 User Stories で固定し、具体的な `sourceRefs` schema のフィールド構造・cardinality は OQ2 / domain-design で確定する。
  - AC7.3.3 Given スコア/数値表示、When UI を見る、Then Educational Simulation Value として明示され、実測値と誤認できない。

### US7.4 決定的な評価を保証する
- **Persona**: P2, P4
- **User Story**: 導入評価者・保守者として、同じ操作なら毎回同じ結果になることを保証したい。なぜなら学習体験の再現性と信頼性が必要だから。
- **User Value**: 再現可能で信頼できる評価。
- **Learning Outcome**: N/A（横断品質）
- **Requirement Traceability**: FR3.4, FR5.4.1, FR5.4.2, FR5.4.3, NFR2
- **provenance**: N/A
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC7.4.1 Given 同一 Scenario・同一 Decision sequence、When 複数回・入力順を変えて実行する、Then Dimension 結果は常に同一（random/time 非依存、順序不変）であり、凍結した golden 期待値と一致する。
  - AC7.4.2 Given 採点対象 Decision、When 評価ロジックを確認する、Then Dimension への影響は deterministic な rule/data として表現され、UI に暗黙の評価ロジックが無い。
  - AC7.4.3 （i18n 非依存, developer/quality 反映）Given 同一 Scenario・同一 Decision sequence、When 表示言語を ja/en で切り替える、Then Dimension 結果・Decision Outcome は言語に依らず同一（評価は言語非依存の rule/data。FR10.4）。

## Group 8 — Scenario 保守者・貢献者（P4）

### US8.1 JSON で Focus Scenario を追加・保守する
- **Persona**: P4
- **User Story**: Scenario 保守者として、domain logic を原則変更せず JSON で Focus Scenario を追加・保守したい。なぜなら教材をロジック改修なしで拡張したいから。
- **User Value**: ロジック変更なしで教材を拡張できる。
- **Learning Outcome**: N/A（保守者向け）
- **Requirement Traceability**: FR3.1, FR3.2, FR3.3, NFR5
- **provenance**: N/A（保守機能。ただし追加 Scenario には FR6.2 の provenance を課す）
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC8.1.1 Given 新しい Focus Scenario、When JSON を追加する、Then domain logic を変更せずに読み込まれ選択できる。
  - AC8.1.2 Given 追加 Scenario、When 保存する、Then provenance フィールド（FR6.2）を持たないものは不備として扱える。

### US8.2 不正な Scenario JSON を検出し可読に知らせる
- **Persona**: P4, P1（間接）
- **User Story**: Scenario 保守者として、不正な Scenario JSON を validation で検出し、どこが不正か分かるようにしたい。なぜなら壊れた教材が黙って動くと学習の信頼性が損なわれるから。
- **User Value**: 壊れた教材が本番へ出るのを防げる。
- **Learning Outcome**: N/A（保守品質）
- **Requirement Traceability**: FR12.1, FR12.2, FR12.3, FR12.4, C5, NFR5
- **provenance**: N/A
- **Early User Test**: N/A
- **MoSCoW**: Must (Provisional)
- **AC**:
  - AC8.2.1 Given 不正な Scenario JSON、When ロードする、Then アプリ全体が無言で停止せず、どの Scenario/どのフィールドが不正かの可読なエラーが表示される（エラーは screen reader にも告知される）。
  - AC8.2.2 Given 不正な Scenario、When 検証に失敗する、Then 正常な教材として開始されず、silent fallback もされない。
  - AC8.2.3 （mid-scenario 検出, quality 反映）Given schema は通ったが scenario 進行中に不整合（参照フィールド欠落等）を検出、When 続行不能になる、Then 無言停止せず可読エラーを表示し、silent fallback しない。

## 横断: harness/runtime の扱い
harness/runtime 固有挙動（Kiro IDE delegation 等）は主要 Learning Concept として独立 Story にしない（FR2.3）。必要な場合のみ、該当 Story（例: 委任を扱う US2.4）の説明に補助的に、かつ provenance 上 harness 由来と識別可能な形で紐付ける（FR6.8）。

## INVEST 準拠メモ
- 各 Story は独立に価値を届ける縦切り（横断関心は機能単位で分離）。US2.x はジャーニー上で順序性があるが、各々が独立した学習価値を持つよう AC を設計。
- すべての Story に測定可能な AC（Given/When/Then）を付与。sad path（AC1.1.4 翻訳欠落なし、AC8.2.x 不正 JSON）を含む。
- MoSCoW は Provisional（正式境界は Delivery Planning）。v2.10.0 必須 Topic（US2.4/US5.2/US5.3）は教材化必須で、MVP 初期 Focus 投入可否とは分離。
