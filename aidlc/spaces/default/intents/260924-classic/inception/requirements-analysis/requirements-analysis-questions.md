# Requirements Analysis — Clarifying Questions

> AI-DLC を 5〜10 分で体験学習できる教育用 Simulator（静的 React+TS+Vite SPA、backend なし）の要件を確定するための質問です。
> steering（product/tech/quality）と practices で既に確定している事項は再質問しません。各 `[Answer]:` に記号で回答してください。

## Q1. 学習の中心テーマ（この Simulator で「何を」体験させるか）

AI-DLC を短時間で体験学習させる際、中心に据える学びは何ですか（複数選択可）。

- A. AI-DLC のライフサイクル全体の流れ（Ideation → Inception → Construction → Operation の順序と各フェーズの目的）
- B. 承認ゲート（approval gate）で人間が意思決定する体験（AI が提案し、人が承認/修正する関係）
- C. Requirements → Design → Implementation の traceability（要求が下流にどうつながるか）
- D. AI に任せる範囲と人が判断する範囲の境界（autonomy と human decision の使い分け）
- E. 上記を薄く全部（1 本の短いシナリオで流れを一周体験）
- X. Other (please specify)

[Answer]: X（「ライフサイクル全体 + 重要判断の Deep Dive」。学習対象: AI-DLC の Lifecycle と Stage の関係 / Requirements と Acceptance Criteria / Plan・Approval Gate / Change Control / Human・Agent Delegation Boundary / Evidence と Traceability / Testing Contract と「実行済み」の区別 / Test Failure 時の判断 / Approval 後の変更 / Risk・Evidence・Reversibility に応じた Human Intervention / AI-DLC 工程完了承認と Release Approval の違い / 失敗・中断・再開・手戻り / 実業務導入時に AI-DLC 外側へ残すべき統制。Stage 名の暗記ではなく「なぜその判断が必要か」を理解できることが学習目標）

## Q2. 体験の単位（Scenario の粒度と本数）

「5〜10 分で 1 周」を満たす Scenario の構成はどれが近いですか。

- A. 1 本の代表 Scenario を最後まで通す（MVP は 1 本、拡張余地としてデータ追加のみ）
- B. 短い Scenario を 2〜3 本用意し、ユーザーが 1 本選んで体験
- C. 1 本の Scenario 内に複数の Decision ポイント（分岐）があり、選択で結果が変わる
- X. Other (please specify)

[Answer]: X（「End-to-End Scenario + Focus Scenario Library」。(A) End-to-End: 1 プロジェクトを Requirements → Release まで進め全体を体験。(B) Focus: 特定判断を深掘りする短い Scenario を複数（候補: 曖昧な Requirement / Acceptance Criteria 不足 / Approval 後の Requirement 変更 / Source 変更後の再承認 / Low Risk を過剰 Human Review / High Risk を Agent へ委任しすぎ / 正常系 Test だけで完了 / Test 期待値を変更して Pass / IAM Permission 過剰 / Evidence 不足 / 未実行 Test を成功扱い / AI-DLC Approval を Production Approval と誤認 / 古い Knowledge・CodeKB 依存 / Session 中断・再開）。Scenario 数は現時点で固定しない。Scenario 追加が domain logic 変更を原則必要としないデータ駆動設計）

## Q3. ユーザーの操作モデル（何を選び、何が返るか）

体験中、ユーザーは主に何をしますか。

- A. 各ステップで提示される選択肢（Decision）から 1 つを選ぶ → 次のステップへ進む
- B. 選択に加えて自由入力（要求文やコメント）も行い、それも評価に含める
- C. 選択のみで、自由入力は行わない（決定性・採点の単純化を優先）
- X. Other (please specify)

[Answer]: X（基本は選択式。Decision 例: Delegate to Agent / Approve / Reject / Request More Evidence / Require Human Approval / Return to Previous Stage / Change Scope。加えて実務導入支援のため「任意の判断メモ」を追加可能にする。任意メモは採点に使わず local state にのみ保持。自由入力の AI 評価は Runtime Generative AI を要するため実装しない）

## Q4. スコアリング／評価の意味づけ（決定的であること前提）

Scenario scoring は決定的（同一入力→同一スコア）と確定済みです。スコアが表現するものは何ですか。

- A. AI-DLC のベストプラクティスにどれだけ沿った選択をしたか（教育的な「良い進め方」度）
- B. 正解/不正解の点数（クイズ的）
- C. 数値スコアは出さず、各 Decision に対する feedback / 解説のみ（学習価値優先、点数競争を避ける）
- D. 数値スコア＋各 Decision の feedback の両方
- X. Other (please specify)

[Answer]: X（単純な正誤点や総合 100 点を中心にしない。Concept / Decision Dimension として表示: Requirement Clarity / Acceptance Criteria Coverage / Evidence Quality / Approval Boundary / Delegation Quality / Risk Handling / Traceability / Rework / Remaining Risks。Human Intervention が多いほど良い・Autonomy が高いほど良い、という評価にはしない。Risk/Evidence/Reversibility/Impact/Approval Boundary に対し委任または介入の判断が適切だったかを説明。必要な数値は Educational Simulation Value として明示し実測値と区別）

## Q5. 結果画面で見せるもの（学習の締めくくり）

1 周の最後に何を提示しますか（複数選択可）。

- A. 選んだ Decision の一覧と、それぞれの解説（なぜ良い/改善余地があるか）
- B. AI-DLC のどのフェーズ/原則に対応する選択だったかのマッピング（学びの振り返り）
- C. スコア/達成度の要約（Q4 で数値を採用する場合）
- D. 「次に学ぶとよいこと」への導線（例: 実際の AI-DLC ドキュメントや次の Scenario）
- X. Other (please specify)

[Answer]: X（結果画面に以下を含める: Decision Timeline / 各 Decision の判断と Consequences / AI-DLC Stage との対応 / Concept ごとの理解ポイント / Human・Agent Boundary / Approval Boundary / Rework が発生した理由 / Remaining Risks / Better Alternative / AI-DLC 一次情報への Reference / 次に学習すべき Focus Scenario。さらに Markdown で "AI-DLC Adoption Discussion Sheet" を生成する。見出し: Project Context / Requirements / Acceptance Criteria / Agent Delegation Boundary / Human Approval Boundary / Evidence Required / Testing Expectations / Remaining Risks / Team Discussion Points / Questions to Resolve Before Adoption。これは導入設計を自動確定するものではなく、実業務で AI-DLC 導入を議論するための Educational Output と明示する）

## Q6. 教育値と実測値の区別（practices の hard constraint に対応）

「educational simulation 値を実測値として表現しない」は確定済みです。UI 上での区別の出し方はどれにしますか。

- A. 明示ラベル（例: 「これは学習用のシミュレーション値です」）を結果やスコア付近に常時表示
- B. Scenario データ・結果に `simulated: true` 等のメタを持たせ、UI で区別表示
- C. A と B の両方（データにもメタを持ち、UI にも明示ラベル）
- X. Other (please specify)

[Answer]: C 拡張（UI 表示と Scenario data meta の両方で明示。Educational Simulation Value を実測値と誤認できない表示にする。各 Scenario に provenance 情報を持たせる: learningObjective / concept / sourceRefs / interpretationNote / simulationAssumptions。Scenario の「正解」をモデル知識だけから決めず、可能な限り AI-DLC v2.9.0 の一次情報へ紐付ける。AI-DLC 仕様そのものと本 Simulator 独自の推奨判断を区別できるようにする）

## Q7. i18n（日英必須）の切替と既定

日英 2 言語必須と確定済みです。運用はどうしますか。

- A. UI に言語切替を用意し、既定は日本語（Scenario 文言も UI 文言も両言語を持つ）
- B. UI 切替あり、既定はブラウザ言語に追従（なければ日本語）
- C. 切替あり、既定は英語（Hackathon 審査者向け）
- X. Other (please specify)

[Answer]: B 拡張（ブラウザ言語追従: ja → 日本語 / その他 → English / fallback → English。ユーザーは常時切替可能。言語変更で Scenario 進捗・Decision・結果・任意メモを失わない。日本語版と英語版で学習内容・Decision 結果が変わらないことを要求する）

## Q8. 完了・成功の判定（この MVP が「できた」と言える基準）

MVP の受け入れ基準として最も重視するものはどれですか（複数選択可）。

- A. 未経験者が説明なしで 5〜10 分で 1 周でき、AI-DLC の流れを説明できるようになる
- B. Scenario を JSON で追加・差し替えでき、ロジック変更なしで内容を拡張できる
- C. scoring/評価が決定的で、同一操作なら毎回同一結果になることがテストで保証される
- D. 日英どちらでも破綻なく（翻訳欠落・片言語混在なし）1 周できる
- E. WCAG 2.2 AA を目標に、キーボードのみで 1 周できる
- X. Other (please specify)

[Answer]: X（必須受け入れ基準: AI-DLC 未経験者が End-to-End Scenario を完走できる / 完走後に主要な AI-DLC 判断ポイントを説明できる / 「Human Review を増やせば常に正しい」学習モデルになっていない / Low Risk 委任と High Risk 介入の違いを体験できる / Requirement → Decision → Evidence → Result を追跡できる / AI-DLC Approval と Release Approval を区別できる / Focus Scenario を JSON 追加で拡張できる / deterministic core が同一入力で同一結果 / 日英双方で意味・Decision Outcome が一致 / keyboard のみで主要 Flow を完走 / Markdown Adoption Discussion Sheet を生成できる / Educational Simulation Value を実測値として表示しない / 各 Scenario の学習判断について根拠または Simulator 独自仮定を識別できる。Early User Test では完走率だけでなく、主要判断を自分の言葉で説明できるか・Human/Agent Boundary を説明できるか・実業務導入の議論材料になったか・誤解した Concept は何かを確認。少人数結果を一般的な学習効果として誇張しない）

## Q9. データ永続化・共有（backend なし前提での範囲）

backend/DB/登録なしと確定済みです。ユーザーの進行状態や結果の扱いはどうしますか。

- A. 永続化しない（リロードで最初から。MVP は最小）
- B. ブラウザの localStorage に進行/結果を保存（同一ブラウザで再開可能）
- C. 結果を URL クエリ/共有リンクとして書き出せる（審査者に共有しやすい）
- X. Other (please specify)

[Answer]: B 拡張（localStorage を使用。保存対象: 言語 / Scenario 進捗 / Decision / 任意判断メモ / Completed Scenario / Learning Result。Server-side persistence・Account・DB は使用しない。共有リンクは必須要件にはしない）

## 追加要件（最優先目的とラーニングモード）

**最優先目的（開発工期短縮より優先）**:
1. ユーザーが AI-DLC の考え方と開発フローを体験的に理解できること
2. Human / Agent Boundary、Approval、Change Control、Evidence、Testing 等の判断理由を説明できるようになること
3. 実業務へ AI-DLC を導入する際の議論・設計を支援できること
4. 学習後に実際のチームで利用できる検討材料を持ち帰れること
- 優先順位: Educational Value / Technical Accuracy / Practical Adoption Value > 開発工期短縮。
- Hackathon 要件は満たすが、Hackathon のためだけに Educational Depth を削らない。

**学習モード（別 Application にせず、同一 Scenario Engine / Source Data を使用）**:
1. **Guided Learning** — 初学者向け。判断前後に AI-DLC 概念を説明。
2. **Simulation** — ヒントを減らしてユーザー自身が判断。
3. **Adoption Review** — 自分の Decision を振り返り、実チームでの Delegation / Approval / Evidence を検討。

## Consolidated Summary Confirmation (初回・確定済み — 履歴)

以下の理解で `requirements.md` を生成します。生成前に確認してください。

- **最優先目的**: AI-DLC の考え方と開発フローを体験的に理解させ、判断理由を説明できるようにし、実業務導入の議論・検討材料を持ち帰れること。優先順位は Educational Value / Technical Accuracy / Practical Adoption Value > 開発工期短縮。Hackathon 要件は満たすが Educational Depth を削らない。
- **学習テーマ**: ライフサイクル全体 + 重要判断の Deep Dive（boundary / approval / change control / evidence / testing の「実行済み」区別 / test failure / 承認後変更 / risk ベース介入 / AI-DLC 承認と Release 承認の違い / 失敗・中断・再開・手戻り / AI-DLC 外側の統制）。「なぜその判断か」を理解できることが目標。
- **Scenario 構成（二層構造）**: (a) **Core End-to-End Experience** — 初学者が約 5〜10 分で AI-DLC 全体の主要判断を一周でき、Lifecycle / Human・Agent Boundary / Approval / Evidence / Testing / Release との違いを最低限体験できる（当初 Product Value「短時間で体験」を維持）。(b) **Deep Dive / Focus Scenarios** — 時間制限なし。Change Control / Test Failure / Approval 後変更 / Evidence 不足 / 過剰 Delegation / 過剰 Human Review / 中断・再開 等を深掘り。データ駆動で JSON 追加可能、本数は非固定。方針: 「5〜10 分ですべてを理解させる」のではなく「5〜10 分で全体像を体験し、その後必要な論点を深掘りできる」。
- **操作モデル**: 選択式 Decision（Delegate/Approve/Reject/Request More Evidence/Require Human Approval/Return/Change Scope）+ 任意メモ（非採点、local state）。Runtime 生成 AI は使わない。
- **評価**: 総合点ではなく Concept/Decision Dimension（Requirement Clarity / AC Coverage / Evidence Quality / Approval Boundary / Delegation Quality / Risk Handling / Traceability / Rework / Remaining Risks）。「介入が多い＝良い」にしない。数値は Educational Simulation Value として実測値と区別。
- **結果画面**: Decision Timeline・consequences・Stage 対応・concept 理解・各 boundary・rework 理由・remaining risks・better alternative・一次情報 reference・次の Focus Scenario。加えて Markdown "AI-DLC Adoption Discussion Sheet"（指定見出し、Educational Output と明示）。
- **provenance / Traceability（要件化）**: 各 Scenario に learningObjective/concept/sourceRefs/interpretationNote/simulationAssumptions。`sourceRefs` は単なる参考リンクではなく、重要な学習判断について次を識別できるものとする: (i) AI-DLC v2.9.0 のどの一次情報を根拠としているか、(ii) その一次情報から直接導ける内容か、(iii) Simulator 側の教育的解釈・推奨判断か、(iv) Scenario 成立のために置いた simulation assumption か。少なくとも重要 Decision Point について `Decision / Learning Point → Source Reference または Simulator Interpretation` を追跡可能にする。AI-DLC 仕様そのものと Simulator 独自の Best Practice を混同しないことを受け入れ基準にも含める。教育値と実測値は UI・data meta 両方で明示。
- **i18n**: ブラウザ言語追従（ja→日本語 / 他→English / fallback English）、常時切替、切替で進捗・Decision・結果・メモを失わない、日英で意味・Decision Outcome 一致。
- **永続化**: localStorage（言語/進捗/Decision/メモ/completed/result）。server/account/DB なし。共有リンクは任意。
- **学習モード**: Guided Learning / Simulation / Adoption Review の 3 モードを、同一 Scenario Engine・Source Data 上で提供（別アプリにしない）。
- **受け入れ基準**: 未経験者が Core End-to-End を約 5〜10 分で完走／主要判断を説明できる／「Human Review 多い＝正しい」でない／Low Risk 委任と High Risk 介入の違いを体験／Requirement→Decision→Evidence→Result 追跡／AI-DLC 承認と Release 承認の区別／Focus Scenario の JSON 拡張／deterministic core の同一入力同一結果／日英で意味・Outcome 一致／keyboard のみで主要 Flow 完走／Adoption Sheet 生成／教育値を実測値表示しない／各判断の根拠 or 独自仮定を識別／**AI-DLC 仕様そのものと Simulator 独自の Best Practice を混同しない（重要 Decision Point で spec 由来か Simulator 解釈かを識別できる）**。Early User Test は完走率だけでなく説明力・boundary 説明・導入議論材料・誤解 concept を確認し、少人数結果を誇張しない。

- Looks correct
- Request changes

[Answer]: Looks correct

## Requested Changes Feedback

最初の確認で「Request changes」を受けた。反映内容:
1. **5〜10 分の Core Experience を維持（二層構造）**: Core End-to-End Experience（約 5〜10 分で全体を一周）と Deep Dive / Focus Scenarios（時間制限なし）を分離。「5〜10 分ですべてを理解」ではなく「5〜10 分で全体像を体験し、その後深掘り」。
2. **Scenario provenance の Traceability を要件化**: `sourceRefs` で spec 由来（v2.9.0 の一次情報／直接導出可）か、Simulator 教育的解釈・推奨か、simulation assumption かを識別可能に。重要 Decision Point について `Decision / Learning Point → Source Reference または Simulator Interpretation` を追跡可能に。spec と Simulator 独自 Best Practice の非混同を受け入れ基準に追加。

維持事項（変更なし）: Educational/Technical Accuracy/Practical Adoption を最優先 / End-to-End + Focus Library / Runtime 生成 AI なし / Human Intervention 多い＝高評価にしない / 教育値と実測値の明確区別 / Adoption Discussion Sheet / 3 学習モードを同一 Engine・Data で / 日英 Decision Outcome 一致 / localStorage のみ / 実業務導入の Discussion Material 持ち帰り。

## Change Control — AI-DLC v2.10.0 Learning Target 変更（backward jump 再入）

**背景**: User Stories 計画中に AI-DLC v2.10.0 が正式リリースされ、Human が Simulator の Learning Target / Reference Baseline を v2.9.0 → v2.10.0 へ変更すると判断。strict Change Control に従い requirements-analysis へ backward jump し、影響分析・再承認を行う。

**バージョン分離（確定）**:
- Development Workflow Runtime = **AI-DLC v2.9.0**（`.aidlc-version` = 2.9.0）。active workflow はこのまま継続、途中で project runtime を v2.10.0 へ refresh しない。
- Simulator Learning Target / Reference Baseline = **AI-DLC v2.10.0**（明示的に固定。汎用化しない）。
- 将来の新 version は自動追従せず、同様に Change Control で影響分析・再承認する。

**一次情報**: 公式 `awslabs/aidlc-workflows` の v2.10.0 Release Notes（`https://github.com/awslabs/aidlc-workflows/releases`）を一次情報として参照。Release Notes に記載のない意味・動作は推測補完しない。AI-DLC 自体の version 差分は公式 Release/docs/source を優先（AWS Documentation MCP は AWS サービス設計の一次情報用）。

**v2.10.0 公式 Release Notes からの関連変更点（一次情報）**:
- Construction は **verified Unit / batch checkpoints** でレビューされる。
- Guards が **agent execution boundary と human-controlled approval gate の分離**をより明確化。
- 一般的な **refusal / recovery path が実行可能な next step を identify** する。
- Stage questions / gate replies / Testing Posture fields / story maps / claim sources / traceability records の **parser 改善**（reliability 向上）。
- **Kiro IDE delegation**（および Copilot routing・compiled tool dispatch・engine child execution）が正しい native path に。
- 補足（本 Simulator の学習題材に直接は影響薄）: compatible harness の共存、worktree の intent scope 化、parked Bolt の byte-for-byte 復元、model provider 保持、Windows/Linux 修正。

**既存 Requirements への semantic impact 評価（v2.10.0 一次情報ベース）**:
- **Human/Agent Boundary**: v2.10.0 は agent execution boundary と human approval gate の分離を強化。→ FR2.1 の学習対象・FR6.6 の重要 Decision Point (a)(b)・NFR3 に整合。意味の追加は不要だが、「boundary と gate の分離」を学習題材として明示できる（FR で強化）。
- **Approval Gate**: 同上。既存 FR6.6(a)・FR2.1 と整合。
- **Change Control**: 既存 FR2.1 / Focus Scenario 候補（承認後変更・source 変更後再承認）と整合。意味変更なし。
- **Construction checkpoint / review**: v2.10.0 は verified Unit / batch checkpoint レビュー。→ 学習題材（FR1.4 の "正常系 Test だけで完了" 等）と整合。Focus Scenario 候補に「verified Unit / batch checkpoint での review」を追加できる（学習題材の拡張、任意）。
- **Evidence / Traceability**: v2.10.0 は traceability records / claim sources の parser 改善。意味変更なし。FR6・NFR3 と整合。
- **Test / completion 判断**: 既存 FR1.4 / FR2.1 と整合。意味変更なし。
- **Failure / Refusal / Recovery**: v2.10.0 は refusal/recovery path が executable next step を identify。→ 学習題材（FR2.1 の失敗・中断・再開・手戻り、Focus Scenario 候補）と整合。「recovery は次の一手を示す」を学習ポイントに反映できる（任意強化）。
- **Kiro IDE delegation**: v2.10.0 で native path 修正。これは runtime harness の挙動であり、Simulator の学習題材としては「delegation の概念」に留まる。Simulator Runtime には影響しない（本アプリは静的 SPA で AI-DLC harness を実行しない）。
- **AI-DLC 工程完了承認 vs AWS Release Approval**: Release Notes に本区別自体の変更記載なし。既存 project.md の NEVER ルール・FR6.6(f) と整合。意味変更なし。

**結論**: v2.10.0 は主に「Construction checkpoint 強化・boundary/gate 分離明確化・recovery の next step 明示・parser 改善・Kiro IDE delegation 修正」であり、本 Simulator の要件と**方向性が一致**。破壊的な意味変更は検出されず、要件の削除は不要。更新は (1) baseline version の固定（A1）、(2) provenance baseline の v2.10.0 化（FR6.3/NFR3/OQ1）、(3) 上記整合点を学習題材として任意に強化、が中心。

## Consolidated Summary Confirmation

Change Control（strict）による v2.10.0 Learning Target 変更を反映した requirements.md の改訂内容です。生成前に確認してください。

- **バージョン分離（A1）**: Simulator Learning Target / Reference Baseline = AI-DLC **v2.10.0**（明示固定）。Development Workflow Runtime = AI-DLC **v2.9.0**（維持、active workflow 中に refresh しない）。
- **provenance baseline（FR6.3 / NFR3 / OQ1）**: v2.9.0 → **v2.10.0** に更新。sourceRefs / Technical Accuracy / 参照形式の基準を v2.10.0 に。
- **学習題材の強化（FR2.2）**: v2.10.0 一次情報に整合する範囲で追加——agent execution boundary と human approval gate の分離、Construction の verified Unit / batch checkpoint review、refusal/recovery が次の一手を示すこと。Release Notes に無い意味は補完しない。
- **影響評価の結論**: 破壊的な意味変更なし。Human/Agent Boundary・Approval Gate・Change Control・Construction checkpoint・Evidence/Traceability・Failure/Refusal/Recovery・Kiro IDE delegation・AI-DLC 完了承認 vs AWS Release Approval を再確認し、いずれも既存要件と整合。要件削除なし。
- **Change Control 記録**: `change-control-log.md`（development log）と requirements.md の `[CC-v2.10.0]` タグに記録。一次情報は公式 v2.10.0 Release Notes。
- 維持: 二層構造 / 3 学習モード / 9 dimension 非単調評価 / provenance 区別 / i18n / localStorage / Runtime 生成 AI なし / R-01〜R-05 反映済み。
- **harness/runtime と学習概念の区別**: Kiro IDE delegation 等の harness/runtime 固有挙動は影響確認対象として記録するが、Simulator の主要 Learning Concept へ自動昇格させない。AI-DLC 自体の学習概念（boundary/approval/evidence 等）と harness の実装挙動を区別する。

- Looks correct
- Request changes

[Answer]: Looks correct
