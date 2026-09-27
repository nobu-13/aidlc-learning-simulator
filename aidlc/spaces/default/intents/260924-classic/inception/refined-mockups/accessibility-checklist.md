# Accessibility Checklist — AI-DLC Learning Simulator

> 目標: **WCAG 2.2 AA**（team practice どおり「目標」として扱い、自動検証のみで準拠を主張しない。完全な準拠検証にはスクリーンリーダー等の手動確認が必要）。NFR4 / team `Accessibility` に整合。

## キーボード操作
- [ ] 主要 Flow（起動→言語→モード選択→Core End-to-End→結果→Adoption Sheet）を **keyboard のみで完走**できる（US7.1 / AC7.1.1）。
- [ ] すべての interactive 要素が Tab で到達でき、操作可能（Enter/Space）。
- [ ] Decision 選択肢は RadioGroup（矢印移動 + Space/Enter）。
- [ ] Disclosure は Enter/Space で開閉、`aria-expanded` 同期。
- [ ] キーボードトラップが無い（Modal を使う場合のみ意図的な focus trap + Escape）。
- [ ] skip-link で主要コンテンツへジャンプできる。

## フォーカス
- [ ] focus インジケータが常に視認可能（`focus-ring`、太さ/offset/コントラスト 3:1 以上、色のみに依存しない）（AC7.1.2）。
- [ ] focus は原則ユーザー主導。動的 Explanation 出現時に focus を奪わない（interaction-spec #3）。
- [ ] 論理ページ/Stage 遷移時は新見出しへ focus 移動（#1,5,6,7,8,9）。
- [ ] Disclosure/Modal を閉じたら適切な要素へ focus restoration。

## スクリーンリーダー / announce
- [ ] 動的に出る Explanation は `aria-live="polite"` region で告知（AC2.2.6）。
- [ ] エラーは `role="alert"` で即時告知（AC8.2.1 / AC8.2.3）。
- [ ] 見出し階層が正しい（h1→h2…、Stage/セクション構造）。
- [ ] 画像/アイコンに適切な代替テキスト（装飾は `aria-hidden`）。
- [ ] provenance 区分・Dimension 状態・boundary/gate をテキストでも判別可能（色/形だけに依存しない）。
- [ ] autosave 状態（「保存済み」）を近傍で告知。

## 色・コントラスト・非色依存
- [ ] テキストのコントラスト比 AA（通常 4.5:1、大文字 3:1）を満たす（実値は functional-design で検証）。
- [ ] 状態・区別を **色のみに依存しない**（Label/Icon/Shape/Position 併用）。特に boundary（Zone）と approval gate（Gate）、provenance 4 区分。
- [ ] focus/選択/エラーが色以外の手がかりを持つ。

## i18n（アクセシビリティ関連）
- [ ] 日英で意味・操作が同等（FR10.4）。`lang` 属性を切替に同期。
- [ ] 翻訳欠落で undefined/片言語混在を表示しない（AC1.1.4）。
- [ ] 言語切替で focus/進捗を破壊しない。

## 状態（5 states）
- [ ] empty（結果未完走 S3・Focus 空 S6）に説明と次アクション。
- [ ] error（不正 Scenario JSON: ロード時/進行中、localStorage 破損）を可読・告知・復帰可能に。
- [ ] loading は非同期がある箇所のみ（過剰演出回避）。
- [ ] success/populated と partial（長文・多数/少数）を考慮。

## モーション
- [ ] animation/transition を使う場合のみ `prefers-reduced-motion: reduce` を尊重（無効化/簡略化）。
- [ ] 演出 animation を必須にしない。

## レスポンシブ・reading order
- [ ] reading order = DOM order（Context→Decision→Consequence→Next）。
- [ ] mobile/narrow でも主要 Flow を 1 カラムで完走（AC 準拠、responsive 要件）。
- [ ] boundary/gate は mobile で縦積みしても意味が逆転・混同しない。
- [ ] タッチターゲット最小 44x44px（mobile）。

## 検証の誠実性（NFR8 / team practice）
- [ ] 自動チェック（axe / vitest-axe）で critical/serious 0 をアサート。
- [ ] ただし自動チェックは準拠の一部にすぎず、**手動確認（スクリーンリーダー等）が別途必要**である旨を明記。
- [ ] Early User Test は自動 Verification と分離（未実施を「準拠済み」と報告しない、downstream obligation R-03）。

## Sources
- NFR4 / team `## Testing Posture` の Accessibility 節 / design knowledge accessibility-wcag / interaction-spec.md。
