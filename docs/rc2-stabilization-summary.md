# RC2 Stabilization Summary

Post-RC2 Live UX Audit で確認された実装上の問題を修正し、RC2 を安定版として閉じるための記録です。
**新機能の追加や Learning Flow の再設計は行っていません**（それらは RC3 へ分離）。

- Branch: `fix/rc2-stabilization`（`main` `fe48d89...` から作成）
- Scope: correctness / persistence / navigation / regression / localization / accessibility / state consistency のみ
- local 実装のみ（push / deploy / tag なし）

---

## 1. 修正一覧（Issue → Root cause → Fix → Regression test）

### P1-1: Resume が機能しない
- **Issue**: reload 後 Home に「前回の学習を復元しました」と Resume card が出るが、ボタンを押しても画面が変わらない。
- **Root cause**: continue-card のボタンが `goHome()`（Home では no-op）を呼んでいた。復元進捗は `state.progression` に読み込まれていたが、Home 表示のままで scenario へ遷移する導線が無かった。
- **Fix**: 起動時の復元進捗を `state.resumable` に保持し、`resume()` action で scenario view へ復帰。continue-card は `app.resume()` を呼ぶ。mode / scenario / current decision / stage / decisions / notes を復元。Core / Focus 両方。
- **Test**: Resume Core / Resume Focus / 不正 state の controlled fallback。

### P1-2: Adoption Workshop の入力が消える
- **Issue**: 10 項目入力後 reload で消える（「端末内に保存」表示と不一致）。
- **Root cause**: Workshop 入力が component ローカル `useState` のみで永続化されていなかった。
- **Fix**: 入力を `workshopInputs`（heading slug → text）として localStorage（persistence schema v2）へ保存し、復元。locale 切替で内容は変わらない。
- **Test**: Workshop reload restore / locale 切替で不変。

### P1-3: Practice 下書きが消える
- **Issue**: Requirement Create 途中の入力が reload で消える。
- **Root cause**: 入力が component ローカル state のみ。
- **Fix**: `practiceDrafts`（practiceId → field → text）を localStorage へ保存・復元。明示 reset のときのみ clear。Requirement Create（自由記述フォーム）に適用。chip 選択式の 4 Practice は session-scoped のまま（自由記述の消失リスクが無く、過度な architecture 変更を避ける）。
- **Test**: Requirement Practice reload restore / reset で clear。

### P2: Decision note の carry-over / duplication
- **Issue**: DP1 だけ note 入力すると次 DP に残り、Discussion Sheet に重複出力される場合がある。
- **Root cause**: note が単一 `useState` で、DP 変更時に「その DP に記録済みの note」を反映していなかった。
- **Fix**: note は DecisionRecord 単位で保持済み（domain）。UI 側は DP 変更時に「その DP の記録済み note（あれば）」を初期値にし、無ければ空。Sheet は各 DecisionRecord の note のみを出力（重複しない）。
- **Test**: A（DP1 のみ）/ B（全 DP 異なる）/ C（note なし）。

### P2: Feedback の進捗番号
- **Issue**: DP1 Feedback なのに「判断 2 / 4 · 25%」と表示。
- **Root cause**: stepper が「回答済み数 + 1」を常に current としており、feedback 表示中（対象は回答済みの DP）を区別していなかった。
- **Fix**: stepper に `showFeedback` を渡し、feedback 表示中は「回答済み数」を、判断入力中は「回答済み + 1」を current として表示。
- **Test**: DP1 Feedback で 1 / 4（2 を含まない）。

### P2: Back Navigation
- **Issue**: Result / Focus Intro からの Header Back が Home へ飛び、「Back」の期待と一致しない。
- **Root cause**: feedback 中以外の Back が常に Home へ遷移していた。
- **Fix**: view ごとの logical back を実装（scenario 入力→intro、intro→focus-library/mode-select、reflection→result、adoption→reflection、practice→practice-library、feedback→直前判断の取り消し）。論理的な前画面が Home になる view（Result / *-library / mode-select）では、ボタンを「Back」ではなく **Home** と明示表示（`backLabelKind`）。
- **Test**: Practice→Practice Library / Result は Home ラベル / Reflection→Result。

### P2: Workshop の locale preview 残留
- **Issue**: ja で生成後 en へ切替すると UI は en だが preview は ja のまま。
- **Root cause**: 生成した preview を locale 変更時に無効化していなかった。
- **Fix**: 生成時の出力言語を記録し、UI locale と異なると陳腐化通知（再生成を促す）を表示。preview には出力言語を明示。user-authored text 自体は翻訳しない。
- **Test**: 生成→切替で stale 通知 + 出力言語表示。

### P2: Workshop の accessibility label
- **Issue**: 10 textarea が accessibility tree 上すべて「Your input / あなたの記入」。
- **Root cause**: 各 textarea に section 固有の accessible name が無かった。
- **Fix**: 各 textarea に「`<heading> — Your input`」の `aria-label` を付与（ja/en）。
- **Test**: section 固有名で取得でき、全 accessible name が一意。

### 調査: 初回のみ旧 asset 表示（1 回観測）
- **結果: Not Reproduced（現行 deploy では再現しない）。**
- **調査内容**: source `index.html` は `/src/main.tsx` を参照し、Vite が build 時に hashed asset へ書換。現行 build の hash と live root の参照 hash は一致（RC2 が live、`x-cache: Hit`、毎回 RC2 hash を返す）。
- **推定原因（cache-timing / source bug ではない）**: `index.html` に `Cache-Control` が無く、distribution は AWS 管理 CachingOptimized policy（default TTL 1 日）を使用。deploy は「S3 sync → `/*` invalidation」の順で、invalidation 伝播の短時間内、または未反映の edge が古い `index.html`（旧 asset hash 参照）を返しうる。次の reload で新しい `index.html`（RC2 hash）になる ＝「初回旧・reload 後正常」と一致。
- **対応**: RC2 は **infrastructure / deploy 手順を変更しない**方針のため、根本対策（`index.html` に `Cache-Control: no-cache` を付与、または cache policy 変更）は実施せず。実施が必要な場合は **Human approval を要する Infrastructure 変更**として RC3 以降で判断する。**今回 Infrastructure 変更は行っていない。**

---

## 2. Persistence Architecture

- `PERSISTENCE_SCHEMA_VERSION` を 1 → **2** へ。追加: `mode` / `workshopInputs` / `practiceDrafts`。
- v1 → v2 は **additive migration**（不足フィールドを空で補完し version を最新化）。既存の scenario 進捗を失わない。意味変換は伴わない。
- invalid / 破損 state は従来どおり controlled fallback（silent coercion しない）。
- locale は semantic evaluation に影響しない（不変）。

## 3. Validation

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: **159 passed**（Pre-stabilization 141 + 18: progress-store 2 + stabilization UI 16）
- `npm run build`: PASS。gzip 合計 約 **97.2 KB**（JS 94.09 + CSS 2.51 + HTML 0.63）で NFR 300 KB 以下。
- mode-invariant / locale-invariant / 9 Dimension semantics: 不変（既存 invariant テストで担保）。

## 4. Deferred to RC3（今回変更しない）

- AI-DLC Journey redesign / 3 Mode 根本再設計 / Artifact-centric learning
- Focus Scenario 2 問目の Learning redesign / Interactive Review Loop
- Runtime AI / deeper semantic scoring / Traceability Practice の大幅拡張
- 新 Practice / 新 Scenario 大量追加 / visual redesign
- `index.html` の cache 制御（infra / deploy 手順変更・Human approval 必要）

## 5. Known Remaining RC2 Issues（stabilization 後）

- 旧 asset の一瞬表示は cache-timing 起因で、根本対策は infra 変更が必要（未実施・RC3 判断）。
- semantic 品質評価（曖昧さ・測定可能性）は runtime AI 無しのため非対応（RC3）。
- accessibility は axe（critical/serious ゼロ）で確認済みだが、支援技術での実測は未実施。
- chip 選択式 Practice（Evidence/Approval/Traceability/Change Control）の途中選択は session-scoped（reload で消える）。自由記述ではないため P1 とはしていない。

> Post-RC2 Live UX Audit 自体は上書きしていません。本書は修正記録の追加です。
