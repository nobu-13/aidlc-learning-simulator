# Delivery Planning — 計画質問（AI-DLC Learning Simulator）

> 本ステージ（2.9）は Construction をどの順序・どの単位で進めるかの実行計画を作ります。**Bolt** とは「動く成果物で終わる 1 回の build パス（Unit of Work を 1 つ以上束ね、Definition of Done・確認したい仮説・担当を持つ）」のことです。Units Generation（2.7）は deployable topology（U1 単一・`depends_on: []`）を確定しており、実装分解（複数 work unit）と実装順序は本ステージで決めます。
>
> 確定済みの前提:
> - deployable unit は **U1 単一**（static SPA、monolithic bundle）。
> - team formation（1.5）は classic では SKIP → 全 Bolt は AI（aidlc-developer-agent）が実行（solo build）。
> - team practice で **walking skeleton の薄い縦切り**を最初に通す方針を既に affirm 済み: **Scenario JSON 分離 → 1 Scenario 完走 → Decision 反映 → 結果表示**。
> - 実装 work unit 候補（unit-of-work.md より）: domain model/rules・Scenario validation/data・progression・evaluation・persistence・i18n・UI shell/scenario experience・result/reflection・Adoption Review/Sheet・accessibility・testing・AWS deployment。
>
> 各 `[Answer]:` に記号（＋必要なら補足）で回答してください。

---

## Q1. 最初に何を作るか（Bolt 戦略）

Construction の最初に優先すべきは何ですか。

- A. **walking skeleton 先行（推奨）**: 最初の Bolt を、全アーキテクチャ層を貫く最小の end-to-end 縦切り（Scenario JSON 分離 → 1 Scenario 完走 → Decision 反映 → 結果表示）とし、データ/ロジック分離と決定性の土台を早期検証。以降の Bolt で機能を厚くする。team practice と整合。
- B. リスク先行（最も不確実な部分を最初に）
- C. 価値先行（最も学習価値の高い体験を最初に）
- D. 混合（どこに何を適用するか補足してください）
- X. Other (please specify)

[Answer]: A（walking skeleton 先行。Bolt 1 で Scenario JSON 分離 → ScenarioLoader validation → 1 Scenario 開始 → Decision 選択 → ScenarioProgression 反映 → 最小 Dimension evaluation → Result 表示 を薄く end-to-end で通す。機能数ではなく layer 間接続・semantic data と presentation の分離・deterministic progression/evaluation・stable-ID flow が実際に成立することを最初に検証する）

---

## Q2. 形式的スコアリングモデル（WSJF 等）を使うか

Bolt の順序付けに形式的モデル（WSJF: 価値・緊急度 ÷ ジョブサイズ）を使いますか。MVP・単一 unit・solo build である点に留意してください。

- A. **使わない（推奨）**: 単一 unit・solo・MVP のため重量級スコアリングは過剰。walking-skeleton-first ＋ 依存順の軽量な rationale（risk-and-sequencing-rationale.md に記述）で十分とする。
- B. 使う（risk / value / size の重み付けを補足してください）
- X. Other (please specify)

[Answer]: A（WSJF 等の形式的モデルは使わない。単一 unit・solo build・MVP のため dependency / risk reduction / learning value / walking-skeleton-first による軽量な順序付けで十分。順位理由は risk-and-sequencing-rationale.md に残す）

---

## Q3. 1 つの Bolt の大きさ

1 Bolt をどの粒度にしますか。

- A. **薄い縦切り（推奨）**: Bolt は Unit をまたぐ薄い vertical slice（skeleton 後は「evaluation を厚くする」「Adoption Sheet を足す」等の機能単位）。early に動くものを保ちながら段階的に厚くする。
- B. 実装 work unit 単位（domain / data / ui …を 1 Bolt ずつ）
- C. 関連 work unit を束ねた中粒度
- X. Other (please specify)

[Answer]: A（薄い縦切り。module 単位の horizontal implementation ではなく、各 Bolt 終了時にユーザーから見て動く状態を維持する vertical slice で厚くする。例: skeleton が動く → evaluation が意味を持つ → Guided Learning として成立 → Result/Reflection まで成立 → Adoption Sheet まで成立）

---

## Q4. Bolt の並行実行

複数 Bolt を同時に進められますか。

- A. **逐次（推奨）**: solo build（AI 単独）かつ単一 unit のため、Bolt は 1 本ずつ順次実行。skeleton → 機能追加の順序依存を尊重。
- B. 一部並行（どの Bolt を並行にできるか補足してください）
- X. Other (please specify)

[Answer]: A（逐次。solo build のため Bolt は 1 本ずつ。各 Bolt を implement → validate → evidence → 次 Bolt の順で閉じてから次へ進む。Bolt 未完のまま別 Bolt を並行開始しない）

---

## Q5. 外部依存・ブロッカー

このチーム外で進行を止めうる要因（外部 API・データ・承認・他チームの引き渡し）はありますか。

- A. **実質なし（推奨）**: backend/API/DB/外部 AI API を持たない self-contained な static SPA のため runtime 外部依存なし。唯一の外部要素は **AWS ホスティング（CloudFront + S3）の provisioning/デプロイ**で、これは最後の deployment Bolt に紐づく（AI-DLC 工程完了承認と AWS Release Approval は別物）。external-dependency-map.md は軽量に記述。
- B. あり（内容・所有者・所要時間・ブロックする Bolt・遅延時の対応を補足してください）
- X. Other (please specify)

[Answer]: A（runtime 上の外部依存なし。AWS hosting は deployment Bolt にのみ紐づける。ただし「最後に初めて問題が分かる」ことを避けるため、Construction 序盤に **preflight 確認のみ**行う: AWS account/credential 利用可否 / S3・CloudFront deployment 権限 / Kiro から AWS 操作できる状態 / Hackathon 用 deployment evidence 取得方法。これは deployment Bolt を前倒しする意味ではない。AI-DLC Completion Approval と AWS Release Approval は引き続き分離）

---

## Q6. 最も懸念すること（早期に潰すべきリスク）

このビルドで最も心配な点は何ですか（早期の Bolt で扱うため）。

- A. **決定性とデータ/ロジック分離**（推奨候補）: Scenario JSON の検証境界・決定的評価・順序不変性を skeleton で早期検証。
- B. **provenance / 教育的正確性**: 4 区分（ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption）の区別を早期に固める。
- C. **accessibility（WCAG 2.2 AA 目標）**: keyboard 完走・focus・contrast を早期から作り込む。
- D. 複数（優先順とともに補足してください）
- X. Other (please specify)

[Answer]: D（優先順 A > B > C、ただし C を最後まで無視しない）。
  1. **A 決定性とデータ/ロジック分離（最優先）**: Bolt 1 skeleton で最低限、same semantic input + same decision sequence → same result / ja・en 表示で semantic result が変化しない / mode で evaluation result が変わらない / runtime semantic ID が時刻・乱数非依存 / Scenario JSON validation boundary が ScenarioLoader に閉じている / UI に evaluation logic を置かない、を検証。ここが崩れると後続全体に手戻りが出るため最速で潰す。
  2. **B provenance / 教育的正確性（次点・MVP 完成後に後回しにしない）**: 最初の Scenario から 4 区分（ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption）が機能する最小実装を入れる。AI-DLC v2.10.0 仕様と Simulator 独自解釈を混同しないことは信頼性に直結。
  3. **C accessibility（終盤専任にしない）**: Bolt 1 から semantic HTML / keyboard 操作 / visible focus / logical focus order / dynamic result・error notification の設計を守り、後続 Bolt で WCAG 2.2 AA 観点の完成度を高める。

---

## Q7. Construction の進め方（iteration / staffing / check-in）

単一 unit・solo build を前提に、Construction の運用モードを確認します。

- **iteration**: 単一 unit のため、設計〜実装を unit 単位でまとめて進める `unit-major`（skeleton-first で早期に動くコードを得る）か、各設計ステージを通しで回す既定の `stage-major` か。
- **staffing**: 全 unit をこのセッションで 1 つずつ solo build するか、複数チームで unit を分担するか（複数チームは unit-major が前提かつ workspace root が source repo である必要）。

- A. **unit-major ＋ solo（推奨）**: 単一 unit を skeleton-first で設計〜コードまで一貫実行。全 Bolt を AI（aidlc-developer-agent）が solo build。check-in は各承認ゲートで実施。
- B. stage-major ＋ solo（既定。各設計ステージを通しで回し code-generation を最後に）
- C. team ownership（複数チームで分担。前提と check-in rhythm を補足してください）
- X. Other (please specify)

[Answer]: A（unit-major ＋ solo）。全 Bolt: staffing = aidlc-developer-agent solo / execution = sequential / check-in = 各 required approval gate / strategy = skeleton-first。ただし unit-major を「全部まとめて巨大実装する」意味にはせず、U1 内部を複数 Bolt の vertical slice として段階的に Construction する。

---

## 追加要望（Bolt 計画の記載事項）

各 Bolt について最低限: Bolt ID/name・Goal・User-visible working outcome・Included work units/Domain Components・User Stories/Requirements covered・Hypothesis or risk being validated・Definition of Done・Validation/tests・Evidence to retain・Dependencies on earlier Bolts・Explicitly deferred items・Owner = aidlc-developer-agent。
**Coverage != Verification** を維持し、Story/Requirement を Bolt へ割り当てただけで「検証済み」扱いにしない。

---

## Consolidated Summary Confirmation

以下で 4 artifact（bolt-plan.md / team-allocation.md / risk-and-sequencing-rationale.md / external-dependency-map.md）を確定し、Inception→Construction の phase boundary check（再実行 PASS）とともに承認ゲートへ進みます。**Request-Changes（v2.9.0 runtime semantics 整合）を反映済み**です。生成前に確認してください。

- **Bolt = planning / delivery slice**（engine の runtime 実行境界ではない）。engine の正式な walk order は `unit-of-work-dependency.md` と Construction stage semantics に従う。「engine が B1→B9 を順次実行する」とは解釈しない。
- **U1 = 唯一の AI-DLC Unit of Work**。**B1〜B8 は U1 内部の planned implementation slices**（独立 runtime boundary ではない）。複数 Unit 化が必要になれば Units Generation へ Change Control。
- **unit-major** = Unit を Construction stages 3.1〜3.5 へ通す walk mode（Bolt-major でも巨大一括実装でもない）。
- **slice 数と順序**: 9 slice を skeleton-first の vertical slice で逐次。B1 Walking Skeleton（配線・基本決定性・stable-ID）→ B2 評価拡充 → B3 provenance → B4 Guided/i18n → B5 Result/永続化 → B6 Adoption Sheet → B7 Focus/Simulation → B8 accessibility 仕上げ & JSON fixture 健全性 → B9 AWS Deployment Readiness & Evidence Preparation。
- **各 slice の記載事項**: ID/name・Goal・User-visible outcome・work units/Components・US/FR coverage・Hypothesis/risk・DoD・Validation/tests・Evidence・Dependencies・Explicitly deferred・Owner=aidlc-developer-agent。
- **順序付け**: WSJF 不使用。walking-skeleton-first + risk-first。単一ノード DAG のため topological order からの逸脱なし。
- **リスク優先**: A(決定性・データ/ロジック分離) > B(provenance) > C(accessibility)。**Risk A は B1/B2/B4 にまたがり段階的に close**（ja/en 不変・mode 不変は B4 で正式検証）。B は最初の Scenario から最小実装、C は Bolt 1 から基本遵守。
- **運用**: unit-major + solo(aidlc-developer-agent) + sequential + skeleton-first。check-in は各 required approval gate。
- **B9 = deployment readiness まで**（production build・config/IaC・CloudFront+S3 readiness・smoke-test plan・preflight・evidence capture plan・secrets 非露出確認）。**実 deployment execution は Operation の Deployment Execution へ handoff**。AI-DLC Completion Approval と AWS Release Approval は分離。
- **外部依存**: runtime 外部依存なし。Construction 序盤に AWS preflight のみ。
- **用語整合**: 4 artifact で Bolt=planning slice / runtime walk source=unit-of-work-dependency.md / unit-major / U1=single Unit / B1-B8=planned slices / deployment execution=Operation handoff / Coverage!=Verification を統一。
- **Phase boundary check**: `verification/phase-check-inception.md` = **PASS**（改訂後に再実行、traceability 不変。GAP/ORPHAN/invalid/missing なし。Deferred 4 件は委譲先付き hand-off）。

- Looks correct
- Request changes

[Answer]: Looks correct
