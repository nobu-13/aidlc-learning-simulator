# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

- 主要ロジックは test-after を基本とする（TDD/BDD を一律に義務づけない）。仕様先行を義務づける明示ルールが無く、決定的 scoring と主要ロジックの unit test を担保できれば org 既定に沿う。ただし決定的な core ロジックはテスト先行または同時に書く。 (learned 2026-09-24) <!-- cid:260924-classic:practices-discovery:7023ea0277caacac96e8781390ce9ee105ffbfd58c90bae572454985301e3f75 -->

## Change Control

<!-- Project-specific. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

<!-- Project-specific specialisation. -->

- Application は静的 SPA であり backend 前提の複雑な本番承認フローは採用しない。ただし Hackathon 期間中の Official Live Application は AWS CloudFront + S3 であり、AWS への Deployment / Release は AI-DLC の工程完了承認とは分離して人間が判断する。審査終了後に GitHub Pages へ移行した場合は Hosting 形態に応じて Release 手順を簡素化できるが、Hosting 先が変わっても未承認の Deployment を正当化するルールにはしない。 (learned 2026-09-24) <!-- cid:260924-classic:practices-discovery:081e96025425c5b63404b52d41d6360d4c707db0bf37af552ea975cf596d8914 -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER 翻訳欠落を undefined や片言語混在のまま表示しない。 (affirmed 2026-09-24)

- NEVER 未実行テストを成功として報告しない。 (affirmed 2026-09-24)

- NEVER 教育用 simulation 値を実測値として表現しない。 (affirmed 2026-09-24)

- NEVER Secret / Credential / Token を Repository や Evidence へ保存しない。 (affirmed 2026-09-24)

- NEVER AI-DLC 工程完了承認と AWS Release Approval を同一視しない。 (affirmed 2026-09-24)

- NEVER Hackathon 用 AWS 接続 Evidence に機密情報を含める（Evidence から機密情報を除外する）。 (affirmed 2026-09-24)

- NEVER AWS 版と GitHub Pages 版で別実装を作る（同一の Source Code / Application を維持し、AWS 用と GitHub Pages 用に別実装を作らない。Deployment 設定や Hosting 固有設定の差異は許容する）。 (affirmed 2026-09-24)

- NEVER backend / DB / ユーザー登録 / 外部 AI API を追加する。 (affirmed 2026-09-24)

- NEVER MVP でゲーム性・演出を過剰に作り込む（学習価値を優先する）。 (affirmed 2026-09-24)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS TypeScript strict を維持する。 (affirmed 2026-09-24)

- ALWAYS 日本語・英語の 2 言語を必須とする。 (affirmed 2026-09-24)

- ALWAYS Scenario data / domain logic / UI を分離する。 (affirmed 2026-09-24)

- ALWAYS 外部 Scenario JSON を境界で runtime validation する。 (affirmed 2026-09-24)

- ALWAYS Scenario scoring を決定的にする（同一入力は同一スコアを返し、乱数・時刻・順序に依存しない）。 (affirmed 2026-09-24)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- 静的 SPA で backend も外部依存も無い場合、walking-skeleton の ceremony は省略し、代わりにデータ/ロジック分離を検証する薄い end-to-end の縦切り（例: Scenario JSON分離 → 1 件完走 → 結果表示）を最初に通す実装順序を採る。 (learned 2026-09-24) <!-- cid:260924-classic:practices-discovery:6910d9b2c94107f3530337f9f396bde16161b2776b092da7ce3f22b8f62253b1 -->
- practices は Hard Constraint（discovered-rules の ALWAYS/NEVER）と Working Practice（team-practices）を明確に分離する。変更可能な開発手法を ALWAYS/NEVER へ過剰に固定しない。 (learned 2026-09-24) <!-- cid:260924-classic:practices-discovery:d10dd80f57fecb9e11601b216fe9574314847d584e4db7a201a841c763a902a8 -->
- 教育用 Simulator の目的は「体験・暗記」ではなく「判断理由を説明でき、実業務導入を議論できる」水準に置く。学習成果（説明可能性）と provenance 追跡性を第一級の要件として扱う。 (learned 2026-09-24) <!-- cid:260924-classic:requirements-analysis:7ecf88c2112f2476376870410bdc3da25c42e140463256711c5a943acdf864cb -->
- 学習の評価は単一スコアではなく複数の Concept/Decision Dimension で説明する非単調モデルとする。Human Intervention 過多も High Risk の過剰委任も「悪い」側に振れ、介入が多いほど良い・Autonomy が高いほど良い、とはしない。 (learned 2026-09-24) <!-- cid:260924-classic:requirements-analysis:ee1f587b5713a27477c634767cb48878ab418cdc4219515630a0a7c05c0598c9 -->
- 短時間体験と教育的深さの緊張は二層構造で両立する。Core End-to-End は約 5〜10 分の時間内で全体像を体験し、Deep Dive / Focus Scenario は時間制限なしで論点を深掘りする。 (learned 2026-09-24) <!-- cid:260924-classic:requirements-analysis:5cc6bc290db68c9a2f6592b3a47e4616fbc7d986e129172f0af68d04c42bb424 -->
- 教育用 Simulator の正確性は「正解らしい説明」を作るだけでは不十分。重要 Decision / Learning Point について、AI-DLC 一次情報から直接導ける内容・Simulator 独自の教育的解釈/推奨・simulation assumption を区別し、provenance として追跡可能にする。仕様（spec）と教材側の Best Practice を混同しない。これは今後 Scenario / Design を判断する際の基準とする。 (learned 2026-09-24) <!-- cid:260924-classic:requirements-analysis:c1ae494750dc6b3cb8251c5bbea2c94fb64e46d15aa11a230daac6c0661dec48 -->
- 対象仕様（AI-DLC）の新版がリリースされた場合、承認済み Requirements へ strict Change Control で再入し、Learning Target / Reference Baseline（教材の一次情報基準）と Development Workflow Runtime（本開発の実行環境）を明示的に分離して管理する。active workflow 中に project runtime を新版へ自動 refresh しない。将来の version 更新にも再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:requirements-analysis:178f2e97beec35c26b07b19d222d79f35fc8f6231d713593dffa09254176999f -->
- 対象仕様の version 差分をモデル知識で断定せず、公式 Release Notes / docs / source を一次情報として影響分析する。一次情報に書かれていない意味・動作は推測で補完しない（provenance ルールに整合）。将来の version 更新にも再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:requirements-analysis:7cee112582935e1530dd0d430e672b2dfd85c46a283f0c9cdbd665945d4e6638 -->
- 対象仕様の新版で追加・変更された内容でも、harness/runtime 固有の実装挙動（Kiro IDE delegation 等）を自動的に主要 Learning Concept へ昇格させない。Simulator で教える AI-DLC の概念と実行環境固有の挙動を分離し、教材化する内容は Learning Objective との関係を確認して選別する。将来の version 更新にも再利用する project-specific guidance。 (learned 2026-09-25) <!-- cid:260924-classic:requirements-analysis:0f770e2bdf04cc4e8b49629176ce05b4ef3d1a231e01c48265a16457f76845bf -->
- User Story は UI 部品単位ではなく学習体験単位で縦切りにする。AI-DLC の新版で追加された必須 Learning Topic は「教材化するか（必須度）」と「MVP 初期 Scenario に含めるか（Delivery 優先度）」を分離して Story 化する。 (learned 2026-09-25) <!-- cid:260924-classic:user-stories:69b3fdce9fac051b90bf6a93e0ea71521f7454309348b014d095dbd05edafa67 -->
- 重要な学習 Story の Acceptance Criteria には、操作完了だけでなく次を含めて学習体験単位で検証可能にする: 判断理由を説明できること / AI-DLC specification・Simulator Interpretation・Simulation Assumption・harness behavior を必要に応じて区別できること / Decision がどの Dimension へ寄与したかを追跡できること。 (learned 2026-09-25) <!-- cid:260924-classic:user-stories:34e7272f0ebfc69e2dcbc626bd6fa1fa48afc8b8d705e4ecca25e157e054319e -->
- rough-mockups を skip する scope では、存在しない wireframes / user-flow を推測で補完せず、承認済み User Stories / Requirements から直接 Refined Mockups を設計する。 (learned 2026-09-25) <!-- cid:260924-classic:refined-mockups:bf2e3cc221cab103ed53746fca1541228cb911e7c8251f72c7160828cf118a97 -->
- Scenario 進行は縦 1 カラム progressive disclosure を基本とし、Focus 個別も同一 Scenario Shell を再利用する。Responsive では DOM order = reading order を維持し、boundary / approval gate は色だけでなく Label / Icon / Shape / Position でも区別する。 (learned 2026-09-25) <!-- cid:260924-classic:refined-mockups:f739c54fd79438f8990500a7f15c4d203217e87e4a8c4386f72b068bf584d3bd -->
- UI 表現を要求する Acceptance Criteria は、mockup の注釈だけでなく実際の画面構造へ落とし込む。主要 Learning Concept について「別ラベル」「専用スロット」「別ステップ」「視覚的区別」等が要求されている場合、その surface が wireframe 上で確認できる状態にする。 (learned 2026-09-25) <!-- cid:260924-classic:refined-mockups:2407494b952360157b6f4c92d2d6654c53f1d058e5227134c0ec0347bef74b6d -->
- 論理コンポーネントを UI 非依存 semantic model として設計し、authoring data / evaluation logic / runtime result を分離する。ProvenanceEntry は shared semantic value object として扱い、hexagonal な依存方向で domain の純粋性・決定性を守る（/domain は React/localStorage/UI library/locale 表示文字列/raw JSON を直接参照しない）。 (learned 2026-09-25) <!-- cid:260924-classic:domain-design:6d5f0f3390fdd6d1406bb91663a274ff24574358872cecb6c554cc51e9648396 -->
- failure は boundary 別に型区別する。External Validation は ScenarioLoader、Runtime Invariant は ScenarioProgression、Persistence failure は ProgressStore が所有する。stable ID を domain contract とし、ja/en 表示変更で identity / evaluation / traceability / persisted progress を変化させない。 (learned 2026-09-25) <!-- cid:260924-classic:domain-design:58886f65b4cda1d54478f5f9a0014565b2a321672701c74c5e226d8b640c8b6f -->
- semantic entity の owner / producer / holder / reference を明確に分離する。canonical owner は 1 つに固定し、runtime で生成する component や結果として保持する component を owner と混同しない。components.md / ADR / traceability など Domain Design の複数成果物間で同じ用語で ownership 表現を整合させる。 (learned 2026-09-25) <!-- cid:260924-classic:domain-design:484fae65b4bc6504d6ac772666c620f6e20430d44fed16f270179ea2ef4245da -->
- Units Generation では deployable topology と implementation decomposition を分離する。static SPA なので deployable unit は 1（U1 = aidlc-learning-simulator-web, kind ui）。Domain Design の logical component（12個）は unit 内 module boundary として維持し、logical component dependency を unit DAG に混同・再表現しない。complexity=L でも deployable unit を不用意に増やさず、実装 work 分解と順序は Delivery Planning へ委譲する。同種ステージでも再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:units-generation:92b59ed50c0aff5911e2be72ab241c1cab5e1e0f8a8af610bd6cb8338dbe27a0 -->
- traceability は US → U1（deployable target）だけで潰さず、internal Domain Component への対応も併記して Requirement/US → U1 → component の追跡性を保持する（unit を増やさずに）。Traceability != Verification（追跡性の確認は検証ではない）。同種ステージでも再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:units-generation:2ab1b462c6b0823df263d2c90188001704fa53a26f5e579f4f9df25db3e6f769 -->
- Contract Design では contract の有無を明示判断する。単一 deployable unit で depends_on:[]（inter-unit 境界なし）かつ backend/API/DB/外部 API なし（public/external API なし）の場合、formal contract は存在しない（explicit No Contract）。ただし単純 skip せず、なぜ contract が不要かと、唯一の境界候補（例: build-time data boundary）を見落としていないことを成果物に記録する。同種の単一 static SPA でも再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:contract-design:b464122b77b3d54a5a0a7f439161dcc2cbbba8192cab7d24f71109ef94a63635 -->
- 内部 data boundary（例: Scenario JSON ↔ ScenarioLoader）は重要でも inter-unit / public API ではない build-time asset boundary であり Contract Design で formal contract 化しない。formal 化すると Domain Design / Contract Design / Functional Design 間で source of truth が重複しドリフト源になるため、所有先（Domain Design=entity shape / validation boundary=ADR / Functional Design=concrete schema）へ参照 trace する。同種ステージでも再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:contract-design:06592f5ea9224ee2329c5d88ea3175c3c7ba4b4348a990262f5e9b01ccd987ba -->
- Delivery Planning の Bolt 順序は economic/risk-first で walking-skeleton 先行とする。単一 unit・solo・MVP では WSJF 等の形式スコアリングを使わず、dependency + risk reduction + learning value + skeleton-first の軽量順序付けで十分。各 Bolt はユーザーから見て動く vertical slice を維持し、module 単位の horizontal 実装にしない。Construction 全体の判断基準として再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:delivery-planning:2782f2a422e51b1bd040a07e36f76488585f1f431fb578a60f838dd07ce8f099 -->
- 早期に潰すリスク優先順は A(決定性・データ/ロジック分離) > B(provenance 4区分/教育的正確性) > C(accessibility)。ただし B は MVP 完成後に後回しにせず最初の Scenario から最小実装、C は Bolt 1 から semantic HTML/keyboard/visible focus/logical order を守る（provenance も accessibility も終盤専任にしない）。Construction の判断基準として再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:delivery-planning:6e463cf63212918eda1d039e3800f8671b634111e0685eeb75c9ff261841eddf -->
- Construction は unit-major + solo(aidlc-developer-agent) + sequential + skeleton-first で進める。unit-major は「巨大一括実装」ではなく単一 unit(U1) 内部を複数 Bolt の vertical slice として段階 Construction する意味。各 Bolt は implement → validate → evidence → 次 Bolt で閉じ、Coverage != Verification を維持する。Construction の判断基準として再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:delivery-planning:81ea481566971e9c79990e3f14b4ce79e85d5f67dddc4eaca63c0802f64be435 -->
- 評価 Dimension（9 軸・全 Scenario 共通の固定評価モデル）と Learning Concept（Scenario ごとに変わる学習テーマ）を分離する。Concept→Dimension mapping で異なる Scenario でも同一 9 Dimension（requirement-clarity/acceptance-criteria-coverage/evidence-quality/approval-boundary/delegation-quality/risk-handling/traceability/rework/remaining-risks）で比較・振り返り可能にする。Functional Design の中核 source-of-truth として、今後の Scenario 追加・評価モデル・教材設計で再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:functional-design:a76228c322f5f6bcb3a271347dfd256ade85f246b3a55233c34c35d072f4a19c -->
- evaluation contribution は連続値でなく離散 5 段階（strong-negative..strong-positive）で表現する。非単調性は全 Dimension に強制せず Dimension ごとに評価特性を定義する（Delegation Quality/Approval Boundary/Risk Handling は過少・過剰の双方を悪化させる非単調、Requirement Clarity 等は単調でよい）。Rework と Remaining Risks を Dimension に残し「悪かった」で終わらせず、やり直し量と残存リスクを学べるようにする。今後の評価モデル設計で再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:functional-design:d063c43ad8e1c468175fbe0689cc73ebab4b67194e704f7d29448a1dfa2b3f99 -->
- Scenario JSON schema は effectRules/provenanceEntries を scenario と同階層で一意所有し、参照（effectRuleRefs/provenanceRefs/learningPointRefs/transition nextRef/dimensionId）を同一 validated definition 内で解決する。ScenarioLoader が schema/stable-ID uniqueness/dangling reference/cardinality/provenance invariant/transition/schemaVersion を検証し、unknown field は reject、表示文言は locale key で JSON に生文言を持たない。今後の Scenario 追加・schema 進化で再利用する。 (learned 2026-09-25) <!-- cid:260924-classic:functional-design:990947a4b09f87076d21ebe2cf0d6a5945443f94ea323b44a5fd9769cb7760a2 -->
- Construction の per-unit ディレクトリは DAG unit 名（例: aidlc-learning-simulator-web）を使う。Units Generation の Directory 表記（u1- 接頭辞付き）ではない。per-unit の summary confirmation / review は --unit に DAG unit 名を渡す。誤ったパスに置くと per-unit review guard が unit を解決できないため、今後の Construction per-unit stage で同じ path 問題を再発させないよう最初から DAG unit 名のディレクトリに置く。 (learned 2026-09-25) <!-- cid:260924-classic:functional-design:38101dc680fdefb4b6d4a4f27eff1d9e29e68d6a650835801f324efc3557ebac -->
- performance NFR は数値だけでなく再現可能な測定条件（production build・同一 Lighthouse preset・固定環境の interaction latency・複数回代表値）を伴わせる。bundle size は budget target として regression 監視し、環境ノイズだけで CI を不安定にする厳格 performance gate にはしない。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-requirements:f2135e8ce539d64a69685b0b9b71b1870bd7ad78b0f8782c34c2ac3221c7028a -->
- 自由入力がある場合「PII なし」と単純化しない。アプリは PII を要求しないが、自由入力（DecisionRecord.note / Adoption memo）にユーザーが任意情報を書きうる。security 要件は「PII を要求しない・外部送信しない・localStorage を機密保存先として扱わない・ユーザーが reset できる」という境界で表現する。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-requirements:7ceaad224100aace17a9342e5ffa6809acdfc345d49b4407c9dd564560f02b1c -->
- time/random 排除は domain / evaluation / semantic-ID generation の境界に限定する（UI / performance 測定 / test utility まで一律禁止しない。directory-specific ESLint override を使う）。portability は byte-identical bundle ではなく same application source + hosting-specific configuration で定義する。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-requirements:58f2ba0d7565f54da8df67c4268ed2aafa246f14bedb1259b893bc003d8b26fe -->
- static SPA では service reliability artifact（可用性 SLA/フェイルオーバ等）が N/A であることと、client-side resilience requirement（malformed fail-fast・partial invalid isolation・PersistenceError safe reset・deterministic error behavior・application shell survival）が存在することを分離して記録する。scalability/service observability も同様に N/A と client 側要件を混同しない。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-requirements:73e0f718e3e8b74b69bdc26973c9e89f344023904e8f6c182a06dac92f306754 -->
- code splitting は機械的 lazy でなく実測（bundle budget と Lighthouse）主導で境界を決める。Core experience（Home/ModeSelect/Scenario shell）は eager/早期 preload を許容し、secondary（Adoption/Focus）を優先的に lazy load する。初回 bundle 削減（NFR9.1）と Scenario 開始レイテンシ（NFR9.2）のトレードオフを避ける。memoization はデフォルト必須にせず profiling で必要性が確認された場合のみ導入し、cache key は semantic input 由来（time/random/locale/mode を混入しない）。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-design:d83004c38ba846ff35c3ab4f4065248424aa043748bc0973c9f7c81ca19c181e -->
- no-network posture は「通信が一切ない」ではなく「static application asset（lazy chunk 等）の取得を除き、application data / user input を外部 service へ送信しない」と定義する。これにより code splitting の chunk 取得と両立し、「runtime fetch なし」は application data の制約であって static asset 取得を禁止する意味ではない。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-design:57fd64f3fd5a9c7fe4a8e3a4548d9984049b71ae0b983e3b6a858f5ca9f5022d -->
- 自由入力（note/memo）は input→storage→result→Markdown export の全経路で untrusted user-authored text として一貫して扱う。dangerouslySetInnerHTML を使わず React text/textarea として描画、Markdown preview は raw HTML execution を無効化、HTML injection を許す Markdown extension を有効化しない、user input で provenance / system-generated section を偽装できない構造にする。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-design:7db2a24a6c9dd26c5cd66f588f41da34305f69438e75befd8740a0201469a3d8 -->
- client error handling を 2 種に分離する。期待される domain/application error（ScenarioValidationError/DomainInvariantError/PersistenceError）は Orchestrator/adapter から explicit error state として ErrorView へ橋渡しし、想定外の React render exception のみ ErrorBoundary で view/shell を保護する。ErrorBoundary を domain error 処理の代替にしない。DomainInvariantError は握り潰さず当該 session を errored として明示し、不整合な部分状態で処理を続行しない。circuit breaker/retry は runtime 外部 service がないため不要。 (learned 2026-09-25) <!-- cid:260924-classic:nfr-design:1b4c5fa08b1b089e28127006e3ea29423f49b69dac21a399d0c4f53dc2e8478f -->
- AWS static hosting は CloudFront + OAC + Private S3 REST origin。S3 Static Website Endpoint は OAC 非対応のため使用しない（Block Public Access ON・bucket policy は OAC service principal のみ）。SPA 403/404→index.html fallback は deep-link path routing を使う場合のみ。IaC は S3+CloudFront+OAC+ResponseHeadersPolicy 程度の小規模構成では CloudFormation を優先（CDK bootstrap 等の複雑性を避け直接レビュー可能）。 (learned 2026-09-26) <!-- cid:260924-classic:infrastructure-design:b8b25a3fda4e3868dbe0569b5b3145d600089f3a70e60f52bb60d326db94679d -->
- AWS 側 security header は CloudFront Response Headers Policy を source of truth とし、GitHub Pages の meta CSP は best-effort と位置づけて hosting capability 差（frame-ancestors 等は meta で適用不可）を明示する。primary production hosting は AWS。 (learned 2026-09-26) <!-- cid:260924-classic:infrastructure-design:8e8f6e1c317b6da77080fe003475c7f4c45b4a7ae9ee6af763b1ca86a6126ef0 -->
- Infrastructure deploy(CloudFormation) と Application deploy(asset) を分離し、application deploy role へ CloudFormation 更新権限を混ぜない（S3 upload/sync + CloudFront invalidation に最小化）。GitHub OIDC 短期 credential を使い stored AWS deployment secret=0 を目指す（CI job は contents:read で id-token:write なし、deploy job のみ付与）。rollback は previous successful commit / immutable CI artifact を source of truth とし、再 build のみに依存しない。 (learned 2026-09-26) <!-- cid:260924-classic:infrastructure-design:513337a7528977c057c07a26b8a6eb87f13e5a6f3b8b4616c3cfa3c482cf3df9 -->
- no-network posture 下では runtime telemetry/APM を追加せず、client error visibility（ErrorView/A11yLiveRegion/ErrorBoundary）+ AWS 配信メトリクス（CloudFront/S3 標準）+ CI regression（Lighthouse/bundle）+ post-deploy smoke で proportionate に監視する。厳密な SLO/alert は MVP では設けない。 (learned 2026-09-26) <!-- cid:260924-classic:infrastructure-design:d165d203ebc728a8ac6249bf747c5599913062c1ee4eb5a18a43189a3c0ded71 -->
- Hackathon Release Approval では AWS live + public CloudFront URL + Kiro→AWS connection/deployment evidence を必須とし、GitHub Pages は AWS 失敗時の暫定 fallback に限定する（final substitute にしない）。AI-DLC Completion Approval と AWS Release Approval は分離する。 (learned 2026-09-26) <!-- cid:260924-classic:infrastructure-design:4fe2c187e710be43603a81d381ef9b309e47fb3b6361a7520594c0409e95c11a -->
- Kiro IDE では code-generation の Plan Approval guard / adapter が invoke_sub_agent（および target 無しツール）を target-less mutation として block しうる。mode=subagent でも subagent へ委任できない場合、承認済み plan と Testing Contract を唯一の入力として conductor が直接コード生成・レビューを行い、plan に忠実に実装する（承認済み以外の判断を持ち込まない）。承認後は workspace 書き込みと Bash は許可される。同種の Construction stage で再利用。 (learned 2026-09-26) <!-- cid:260924-classic:code-generation:28cb998ff86af4ad013592ffc3541ce8a970a898c21770f5ceb746cb2891d24e -->
- レビュー付きステージでは reviewer の verdict を記録する前に成果物（コード等）を変更しない。advisory findings を fold したい場合は、当該 iteration の verdict を先に記録してから Request Changes で fold→fresh review するか、fold してから fresh review を回す。verdict 記録前に reviewed bytes を変えると engine が verdict 記録を拒否し、review budget 消費済みだと Request Changes による loop-back リカバリが必要になる。今後の全レビュー付きステージで再利用。 (learned 2026-09-26) <!-- cid:260924-classic:code-generation:743544698ca5dd5ad85fa63903a9c41126a6c6aef8ec9efd55f1e5bcdf889ed4 -->
- Plan Approval の log decision / log answer に渡す --session は、.kiro-ide-current-session cursor の値ではなく human-turn hook が実際に HUMAN_TURN を記録している session（audit shard の Session 行で確認）に一致させる。cursor と実記録 session が食い違うと receipt が『actual offered choice from this prompt and session』で拒否され続ける。Kiro IDE で receipt が通らないときの第一の確認点。同種の gate で再利用。 (learned 2026-09-26) <!-- cid:260924-classic:code-generation:815171eef158924404666839a2c5f215933981729f0034b1b02304b2a2aa3b8e -->
- client-only static SPA では、runtime latency 系 NFR（cold load / interaction latency）と手動 a11y（color-contrast / スクリーンリーダー）は Build and Test でローカル実測できない。「自動チェック範囲で Met」と「production-like 環境 / 手動確認が必要な Unverified」に分類し、後者は owning stage（performance-validation / Operation）を明示して deferred とする。緩めず承認 gate で surface する。同種の Build and Test で再利用。 (learned 2026-09-26) <!-- cid:260924-classic:build-and-test:1c6af09d7e4df5d41f53eab4716371a1a846e01f725dc98f895cf35714770b1b -->
- traceability 自体が第一級の関心（学習テーマ・監査要件）である場合、cross-unit gate で FR/NFR だけでなく AC を traceability.json に 1:1（AC→implementation→test）で明示する。正直な MISSING/PARTIAL 分類は実装 gap を可視化する。学習上必須の MISSING は実装して OK 化し、残りは削除・隠蔽せず MVP Known Gaps として PARTIAL のまま明示追跡する（Traceability != Verification を維持）。同種のトレーサビリティ重視プロジェクトで再利用。 (learned 2026-09-26) <!-- cid:260924-classic:build-and-test:28cf34c818f5ec53a975e99d0abdadc4354f60e4697d6962d13e736602c7ba0b -->
