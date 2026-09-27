# Refined Mockups — Clarifying Questions

> user-stories（US1.1〜US8.2）と requirements（v2.10.0 baseline）から直接 mockup を設計します（classic は rough-mockups を skip）。承認時の Refined Mockups ガイダンス（5〜10 分導線 / Learn→Practice→Apply / 正解を漏らさず後で理由 / boundary と approval gate の視覚的分離 / provenance は確認可能だが情報過多にしない / 9 Dimension を段階提示 / keyboard・focus・aria-live・empty/error）は設計の前提として反映します。以下は残る設計判断です。各 `[Answer]:` に記号で回答してください。

## Q1. 画面インベントリ（主要スクリーン）

MVP の mockup 対象スクリーンはどれにしますか（複数選択可）。

- A. 起動/ホーム（言語・モード選択・オンボーディング）、Scenario 進行（Context→Decision→Consequence）、結果/Reflection、Adoption Discussion Sheet、Focus Scenario Library、（保守者向けは UI 化せず開発者体験として別扱い）
- B. A に加えて Adoption Review 専用ビュー、Focus Scenario 個別ビューも独立スクリーン化
- C. 最小（ホーム / Scenario 進行 / 結果 のみを詳細化し、他は簡易）
- X. Other (please specify)

[Answer]: X（A 基本。主要 mockup 対象: Home/Onboarding/Language/Mode Selection、Core Scenario 進行、Result/Reflection、Adoption Review 専用ビュー、Adoption Discussion Sheet、Focus Scenario Library。Focus Scenario 個別画面は独立 UI にせず Core と同じ Scenario 進行 Shell/Component 構造を再利用。Adoption Review は Learn→Practice→Apply の Apply を担う重要体験として独立ビューで mockup。保守者向け Scenario JSON 管理 UI は作らず Developer Experience として別扱い）

## Q2. Scenario 進行画面のレイアウト

Context→Decision→Consequence を 1 画面でどう構成しますか。

- A. 縦 1 カラムの段階表示（Context → Decision（選択肢）→ 判断後に Consequence/Explanation を下に展開する progressive disclosure）
- B. 2 ペイン（左: Context/進行、右: Decision と結果）
- C. ステップ式ウィザード（Stage ごとに画面遷移、進捗インジケータ付き）
- X. Other (please specify)

[Answer]: A（縦 1 カラム progressive disclosure: Context → Decision → Decision 確定 → Consequence/Explanation → Next。Decision 前に正解を漏らさず、判断後に理由・Risk・Evidence・Boundary・provenance を段階開示。desktop/tablet/mobile で同じ mental model を維持）

## Q3. 9 Dimension の段階提示の仕方

「9 Dimension を一度に押し付けない」を具体的にどう見せますか。

- A. 体験中は該当した Dimension だけをその場で軽く示し、結果画面で 9 Dimension 全体を俯瞰（+各 Dimension を展開で詳細）
- B. 体験中は Dimension を出さず、結果画面で初めて 9 Dimension を段階的に開示
- C. 常に全 9 を小さく表示し、寄与があった箇所をハイライト
- X. Other (please specify)

[Answer]: A（体験中はその Decision で実際に関係した Dimension だけを軽く提示。9 Dimension 全体は Result/Reflection で初めて俯瞰可能にし、各 Dimension を展開すると contributing Decisions / なぜ影響したか / Better Alternative / Remaining Risk を確認できる。常時 9 全表示はしない）

## Q4. provenance（根拠区分）の見せ方

「確認可能だが情報過多にしない」を UI でどう実現しますか。

- A. 既定は非表示。各 Explanation に「根拠を見る」トグル/アイコンを置き、開くと 4 区分ラベル（ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption）と該当 Reference を表示
- B. 各 Explanation に区分ラベルを常時小さく表示し、クリックで詳細
- C. 結果画面と Adoption Sheet にのみまとめて provenance を表示（体験中は出さない）
- X. Other (please specify)

[Answer]: B（各 Explanation に 4 区分 taxonomy（ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption）の小ラベルを常時表示。Reference URL や詳細は既定で展開せず、クリック/Disclosure で確認する progressive disclosure。「根拠区分は常に分かる／根拠の詳細は必要なときだけ」の 2 段階。provenance は Technical Accuracy/Trust の特徴として軽量に可視化し、完全には隠さない）

## Q5. boundary と approval gate の視覚的分離

「agent execution boundary と human-controlled approval gate を視覚的に混同させない」をどう表現しますか。

- A. 2 つを別々の視覚要素（例: boundary = 実行範囲を示すゾーン/枠、approval gate = 人の承認を要するゲート/停止点）として、色・アイコン・ラベルで明確に区別（色のみに依存しない）
- B. タイムライン上で「Agent 実行区間」と「Human 承認点」を別記号で示す
- C. A + B（画面内の区別 + タイムライン上の区別）
- X. Other (please specify)

[Answer]: C（画面内とタイムラインの両方で区別。agent execution boundary = Agent が実行可能な範囲/Zone、human-controlled approval gate = 人の承認が必要な停止点/Gate。色だけに依存せず Label・Icon・Shape・Position でも識別可能に。2 つを同一種類のステップ/Status として描かない）

## Q6. 視覚言語・デザインシステムの方針

デザインシステム/トークンの方針はどれにしますか（backend なし・軽量前提）。

- A. 軽量な独自トークン（spacing 4/8/16/24/32/48、限定カラーパレット、system font 系）を定義し、外部 UI ライブラリに依存しない
- B. 軽量な既製 UI ライブラリ（例: Radix/Headless 系のアクセシブルな primitive）+ 独自トークン
- C. まだ決めない（design-system-mapping では原則のみ、具体ライブラリは domain/functional-design で確定）
- X. Other (please specify)

[Answer]: B（軽量なアクセシブル primitive + 独自 Design Token。目的は見た目でなく keyboard interaction / focus management / disclosure / dialog・popover の ARIA / screen reader 対応の実装リスク低減。Design Token は独自定義: spacing / typography / radius / border / semantic color / focus ring / surface hierarchy。UI library へ強く依存する Application Architecture にはせず primitive レベルに留める。具体ライブラリの最終選定は必要なら後続 design で確定）

## Q7. レスポンシブ対応の範囲

対応レンジはどこまでを MVP スコープにしますか。

- A. desktop 優先 + tablet/mobile でも主要 Flow が縦積みで完走できる（1 カラム化）ことを保証
- B. desktop のみを詳細化（mobile は後続）
- C. mobile-first（狭幅を基準に設計し広幅へ拡張）
- X. Other (please specify)

[Answer]: A（desktop 優先。ただし tablet/mobile でも主要 Flow を 1 カラム化して完走できることを MVP 要件とする。desktop 専用 Application にはしない）

## Q8. mockup の成果物フィデリティ/形式

mockups.md をどの形式で作りますか。

- A. Markdown のテキストワイヤーフレーム（ASCII/箇条書きレイアウト + 状態記述 + 注釈）。軽量で差分レビューしやすい
- B. インライン SVG ワイヤーフレーム（構造を視覚化。artifact として preview 可能）を主要画面に添える + Markdown 注釈
- C. A + B（主要画面は SVG、詳細・状態・注釈は Markdown）
- X. Other (please specify)

[Answer]: C（主要画面は SVG wireframe、状態・Interaction・Accessibility・Responsive・provenance 等は Markdown annotation。SVG は見た目の完成度でなく Information Architecture / hierarchy / interaction / progressive disclosure の確認のために使う）

## 生成時に特に確認する点（承認ガイダンス）
1. P1 が説明なしでも 5〜10 分 Core へ入れるか
2. Learn→Practice→Apply が画面遷移として自然か
3. Decision 前に正解を漏らしていないか
4. Decision 後に「なぜ」が理解できるか
5. agent execution boundary と human approval gate が一目で別概念と分かるか
6. provenance が信頼性を高めつつ情報過多になっていないか
7. 9 Dimension を一度に押し付けていないか
8. keyboard / focus / aria-live / empty / error state が mockup 上でも設計されているか

## Consolidated Summary Confirmation

以下の方針で mockups.md / interaction-spec.md / design-system-mapping.md / accessibility-checklist.md を生成します。生成前に確認してください。

- **画面**: Home/Onboarding/Language/Mode Selection、Core Scenario 進行、Result/Reflection、Adoption Review 専用ビュー、Adoption Discussion Sheet、Focus Scenario Library。Focus 個別は Core と同じ Scenario 進行 Shell/Component を再利用。保守者 UI は作らず Developer Experience 扱い。
- **Scenario 進行**: 縦 1 カラム progressive disclosure（Context → Decision → 確定 → Consequence/Explanation → Next）。Decision 前に正解を漏らさず、後に理由・Risk・Evidence・Boundary・provenance を段階開示。全ブレークポイントで同一 mental model。
- **9 Dimension**: 体験中は該当 Dimension だけ軽く提示、Result/Reflection で 9 全体を俯瞰（各展開で contributing Decisions / なぜ影響 / Better Alternative / Remaining Risk）。常時 9 全表示しない。
- **provenance**: 各 Explanation に 4 区分ラベル（ai-dlc-spec / harness-behavior / simulator-interpretation / simulation-assumption）を常時小表示、詳細/Reference は Disclosure。軽量に可視化。
- **boundary vs approval gate**: 画面内 + タイムラインの両方で区別。Zone（実行範囲）と Gate（承認停止点）を Label/Icon/Shape/Position で識別（色のみ非依存）。同一種ステップとして描かない。
- **Design System**: 軽量アクセシブル primitive + 独自 Design Token（spacing/typography/radius/border/semantic color/focus ring/surface hierarchy）。UI library 強依存にせず primitive レベル。keyboard/focus/disclosure/ARIA/screen reader の実装リスク低減が目的。
- **Responsive**: desktop 優先 + tablet/mobile で主要 Flow を 1 カラム完走（MVP 要件）。desktop 専用にしない。
- **形式**: 主要画面は SVG wireframe、状態/Interaction/Accessibility/Responsive/provenance は Markdown annotation。SVG は IA/hierarchy/interaction/progressive disclosure 確認用。
- **accessibility-checklist**: WCAG 2.2 AA 目標。keyboard 完走・focus 表示・aria-live（動的 Explanation/エラー告知）・contrast・色非依存・semantic HTML・empty/error state。自動検証のみで準拠主張しない旨も明記。
- **維持**: User Stories の Learning Outcome / Requirement Traceability / 4 区分 provenance taxonomy。Learning Target = v2.10.0。生成時に承認ガイダンス 8 点を確認。

**生成時の追加指示（確認済み）**:
- **Interaction/Focus State**: 主要画面・主要 Interaction に initial / active・in-progress / selected / completed / empty / error / disabled（必要時）/ loading（非同期がある箇所のみ）を定義。
- **focus 遷移を interaction-spec.md に明記する Interaction**: Mode Selection→Scenario 開始 / Decision 選択→確定 / 確定→Consequence・Explanation 表示 / provenance Disclosure open・close / Stage・Decision progression / Scenario completion→Result・Reflection / Guided→Simulation→Adoption Review / Result→Focus Scenario / Adoption Review→Adoption Discussion Sheet / error・empty state からの復帰。
- **動的表示（Explanation/Error）**: screen reader への announce 方法 / keyboard focus を勝手に移動するか否か / 移動する場合の移動先 / Disclosure を閉じた際の focus restoration を設計。
- **Modal/Dialog/Popover**: 採用する場合のみ focus trap / Escape / focus restoration を定義。不要なら Modal 化しない。
- **Responsive reading order**: Context→Decision→Consequence/Explanation→Next の reading order を DOM order と一致させる。boundary/approval gate は desktop で横配置でも mobile では意味が逆転・混同しない縦積みに。
- **Reduced Motion**: animation/transition を使う場合のみ `prefers-reduced-motion` を考慮。演出 animation を必須にしない。

- Looks correct
- Request changes

[Answer]: Looks correct