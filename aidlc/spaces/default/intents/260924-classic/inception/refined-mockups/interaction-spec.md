# Interaction Specification — AI-DLC Learning Simulator

> `component-spec-template` に準拠。見た目でなく interaction / focus / disclosure / announce の契約を定義。Modal は不要な限り使わない（progressive disclosure は inline Disclosure を基本）。

## 共通 Interaction 原則
- **reading order = DOM order**: Context → Decision → Consequence/Explanation → Next。responsive で崩さない。
- **focus は原則ユーザー主導**: 動的表示で勝手に focus を奪わない。例外は下表で明示。
- **色以外の手がかり**: 状態・区別は Label/Icon/Shape/Position でも表す。
- **announce**: 動的に出る Explanation/エラーは `aria-live`（重要度に応じ `polite`/`assertive`）または `role="alert"` で告知。

## Interaction States（主要コンポーネント）

| コンポーネント | initial | active/in-progress | selected | completed | empty | error | disabled | loading |
|---|---|---|---|---|---|---|---|---|
| Mode カード (S1) | 通常 | フォーカス/hover | 選択強調 | — | — | — | — | — |
| Decision 選択肢 (S2) | 未選択（Scenario 依存の subset を data から提示） | フォーカス移動中 | ◉ 選択・確定ボタン enable | 確定後は読み取り専用 | — | 不整合時エラー | 確定後 | （非同期無しなら無） |
| 確定ボタン (S2) | disabled（未選択時） | 押下 | — | 結果表示後は「次へ」 | — | — | 未選択時 disabled | — |
| provenance Disclosure | 閉（区分ラベルのみ可視） | 開閉トグル | — | 開: 詳細+Reference | — | — | — | — |
| Dimension 展開 (S3) | 閉（サマリのみ） | 開閉 | — | 開: 詳細4項目 | 未完走は empty | — | — | — |
| Adoption メモ (S4) | 空 | 入力中（autosave「保存済み」） | — | 反映可 | — | 保存失敗時通知 | — | — |
| Adoption Sheet (S5) | 未生成 | 生成中 | — | 生成済/コピー成功 | 未完走は生成不可説明 | 生成失敗通知 | 未完走時 disabled | — |
| Focus カード (S6) | 通常 | フォーカス/hover | — | 完了バッジ | ライブラリ空 empty | — | — | — |

`loading` は実際に非同期処理がある箇所のみ定義（教材はビルド時同梱で基本同期）。

## Focus 遷移仕様（名前付き Interaction）

1. **Mode Selection → Scenario 開始**: モードカードの「開始」を活性化 → Scenario Shell へ遷移。遷移後の初期 focus は Scenario の見出し（h1「Stage/Context」）。ページ遷移として focus をリセットし、skip-link で本文へ飛べる。
2. **Decision 選択 → Decision 確定**: 選択肢は radiogroup。矢印キーで移動、Space/Enter で選択。選択すると「判断を確定」ボタンが enabled。focus は選択肢に留まる（勝手に確定ボタンへ移さない）。
3. **Decision 確定 → Consequence/Explanation 表示**: 確定押下で「結果と理由」ブロックを inline 展開。**focus は自動移動しない**（読み順を尊重）。ただし新出コンテンツは `aria-live="polite"` の region に描画し、screen reader に告知。「次へ」ボタンは結果ブロックの末尾に配置し、Tab 到達順で自然に到達。この展開ブロックには次の**独立した構造スロット**を含む（注釈埋め込みでなく別領域）: (a) 「境界を混同した場合のリスク」スロット（AC2.4.2）、(b) 「工程完了承認 ≠ Release Approval」スロット（AC2.5.2）、(c) 承認の別ステップ表示「① AI-DLC Completion Approval」「② Release Approval（別途）」（AC2.5.1）。いずれも Decision 前には出さない。各スロットは見出し（heading）を持ち、Tab/読み上げ順で個別に到達できる。
4. **provenance Disclosure open/close**: `<button aria-expanded>` + 制御対象 region。open で詳細/Reference を展開、focus は開閉ボタンに留める。close で同ボタンに focus を保持（focus restoration 不要＝元々ボタン上）。
5. **Stage / Decision progression（次へ）**: 「次へ」で次 Stage の Context を表示。SPA 内遷移だが論理ページ切替として扱い、focus を新 Stage 見出しへ移動し `aria-live` で「Stage N/…」を告知。
6. **Scenario completion → Result/Reflection**: 完了で S3 へ遷移。focus は結果見出し（h1）。教育値バナーは `role="note"`。
7. **Guided → Simulation → Adoption Review**: モード間遷移は進捗を保持（localStorage）。遷移後 focus は各ビュー見出し。「次に何をすべきか」を各ビュー冒頭に明示。
8. **Result → Focus Scenario**: 「次に学ぶ Focus」からライブラリ(S6)または個別 Focus(S2 Shell)へ。focus は遷移先見出し。
9. **Adoption Review → Adoption Discussion Sheet**: 「Sheet に反映」で S5 へ。focus は Sheet 見出し。生成結果は `aria-live="polite"`。
10. **error / empty state からの復帰**: エラーは `role="alert"` で即時告知、復帰アクション（再読込/Core へ/初期化）にラベル付きボタン。復帰後は主要見出しへ focus。

## 動的コンテンツの announce / focus 規約
- **Explanation 出現（#3）**: focus 非移動、`aria-live="polite"` 告知、Tab 順で到達。
- **エラー出現**: `role="alert"`（=assertive 相当）で即時読み上げ。破壊的でない限り focus は現在地維持、ただしフォーム検証エラーは該当フィールドへ focus 移動可。
- **Disclosure 開閉**: `aria-expanded` 同期。閉じたら開閉ボタンに focus 保持（他所へ飛ばさない）。
- **ページ/Stage 遷移（#1,5,6,7,8,9）**: 論理ページ切替として focus を新見出しへ移動し告知。

## Modal / Dialog / Popover
- 原則 **使わない**。progressive disclosure は inline Disclosure で実現。
- 採用する場合のみ（例: 破壊的操作の確認があれば）: focus trap / Escape で閉じる / 背景スクロール抑止 / 閉じたらトリガー要素へ focus restoration。ネスト Modal は禁止。
- 現 MVP では破壊的操作が少なく、Modal を必須にしない。

## Reduced Motion
- animation/transition を使う場合のみ `prefers-reduced-motion: reduce` で無効化/簡略化。
- 演出目的の animation を必須にしない。Disclosure/遷移は動きなしでも成立する設計。
