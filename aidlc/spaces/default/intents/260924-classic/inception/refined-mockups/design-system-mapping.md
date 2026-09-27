# Design System Mapping — AI-DLC Learning Simulator

> 方針: 軽量なアクセシブル primitive + 独自 Design Token。目的は見た目でなく keyboard/focus/disclosure/ARIA/screen reader の実装リスク低減。UI library へ強依存しない（primitive レベルに留める）。具体ライブラリ最終選定は必要なら functional-design で確定。

## Design Tokens（独自定義）

| カテゴリ | トークン（例） | 値/意図 |
|---|---|---|
| spacing | `space-1..6` | 4 / 8 / 16 / 24 / 32 / 48 px（8px グリッド基調） |
| typography | `font-sans`, `text-sm/base/lg/xl`, `leading-normal` | system font スタック、可読サイズ、日英で行間確保 |
| radius | `radius-sm/md/lg` | 4 / 8 / 12 px |
| border | `border-hairline`, `border-strong` | 1px / 2px（選択・focus 用） |
| semantic color | `color-fg`, `color-bg`, `surface-1..3`, `color-primary`, `color-warn`, `color-danger`, `color-success` | 意味ベース。コントラスト比 AA を満たす前提で domain/functional-design で実値確定 |
| focus ring | `focus-ring`（2px, 3:1 以上のコントラスト, offset） | 全 interactive 要素で可視。色のみに依存しない（太さ/offset も） |
| surface hierarchy | `surface-1`（base）/ `surface-2`（card）/ `surface-3`（raised/disclosure） | 情報階層を面で表現 |
| motion | `motion-fast`(<=200ms), `motion-ease` | 使う場合のみ。`prefers-reduced-motion` で無効化 |

トークンは意味ベースで定義し、テーマ（light/将来 dark）差し替えを可能にする。実カラー値・コントラスト検証は functional-design。

## Primitive → 用途マッピング

| Primitive（アクセシブル） | 用途（画面/コンポーネント） | ARIA/挙動の要点 |
|---|---|---|
| Button | 確定/次へ/コピー/DL/モード開始 | `type=button`、disabled は `aria-disabled` 相当、focus ring |
| RadioGroup | Decision 選択肢（S2） | roving tabindex、矢印移動、Space/Enter 選択、`aria-checked` |
| Disclosure | provenance 詳細、概念をもっと読む、Dimension 展開 | `<button aria-expanded aria-controls>` + region、focus 保持 |
| Tabs（任意） | モード切替の入口（採用する場合） | `role=tablist/tab/tabpanel`、矢印移動 |
| Alert / Status region | エラー/告知/autosave 状態 | `role=alert`（緊急）/ `aria-live=polite`（通常） |
| Toast | コピー成功等 | 非モーダル、`aria-live=polite`、自動消滅でも操作可 |
| Dialog（不要なら未使用） | 破壊的確認があれば | focus trap / Escape / focus restoration |
| Textarea | 判断メモ / Adoption メモ | ラベル関連付け、autosave 状態を近傍に告知 |
| Badge/Tag | provenance 4 区分ラベル、Dimension 状態 | テキスト+形/位置で区別（色のみ非依存） |

依存方針: これら primitive は headless/アクセシブルな薄いレイヤーに閉じ込め、`/ui` から利用。`/domain`・`/data` は UI ライブラリを一切 import しない（team Code Style のレイヤー境界に整合）。

## provenance 4 区分の視覚表現（色以外の手がかりも）

| 区分 | ラベル | 形/アイコンの方針 |
|---|---|---|
| `ai-dlc-spec` | AI-DLC 仕様 | 実線枠 + 「仕様」アイコン |
| `harness-behavior` | harness 挙動 | 破線枠 + 「環境」アイコン（該当時のみ） |
| `simulator-interpretation` | 教材の解釈 | 点線枠 + 「解釈」アイコン |
| `simulation-assumption` | 前提 | 二重枠 + 「前提」アイコン |

色は補助。形・アイコン・ラベルテキストで区別できるようにする（`ai-dlc-spec` と `harness-behavior` を混同させない）。

## boundary vs approval gate の視覚語彙

| 概念 | 形 | アイコン | 位置/挙動 |
|---|---|---|---|
| agent execution boundary（Zone） | 角丸矩形 + 破線枠 | ▷（実行） | 実行可能区間として「範囲」を面で示す |
| human-controlled approval gate（Gate） | 六角形 + 実線 | ⬢（停止/承認） | 進行を止める「点」として示す |

同一種のステップ/Status として描かない（US2.4）。タイムライン(S2)と画面内セクションの両方で適用。

## Sources
- team-practices `## Code Style`（レイヤー境界 /domain /data /scenarios /ui /app、命名、a11y）。
- design knowledge: interaction-design-patterns（modal rules, progressive disclosure）, accessibility-wcag, component-spec-template。
- requirements: NFR4（WCAG 2.2 AA 目標）, NFR5（レイヤー分離）, FR6.8（provenance 区別）。
