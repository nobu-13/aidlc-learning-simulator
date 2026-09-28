# RC2 Implementation Summary

AI-DLC Learning Simulator を「短い選択式クイズ」から「AI-DLC の判断理由を理解し、
自分で成果物を作り、Evidence をレビューし、実チームへの導入まで考えられる実践型
Learning Simulator」へアップグレードした RC2 の記録です。

- Baseline: `v0.1.0-pre-rc2`（commit `b3949e7e2dbdc223088339dc660fe4eb95772ddf`）
- Branch: `feat/rc2-learning-ux-upgrade`（main `ca9a5239...` から作成）
- Scope: local 実装のみ（AWS deploy / push なし）

RC2 の成功条件（Know → Decide → **Create → Review** への拡張）を満たしました。

---

## 1. Problem（Pre-RC2 の課題）

`docs/rc2-baseline-audit.md` §4 および課題定義 §4（Observed Defects）より、
Pre-RC2 では次の問題が確認されていました。

- Correctness bug: DP1 フィードバック空 / Reflection 空 / note 重複 / English Sheet に日本語混入 / reload で進捗消失
- 学習体験: option 別 feedback が弱く、判断の望ましさ・Dimension 影響が判断時に見えない
- Result: 9 Dimension 記号のみで、判断の帰結・タイムライン・次の学習が無い
- Navigation: Home / Back / Retry / 現在位置（lifecycle）/ progress が未実装で行き止まり
- Mode: Guided 以外は判断中の体験がほぼ同一
- 深さ: Create / Review 体験（要件作成・Evidence レビュー・承認分類・追跡・変更管理・手戻り）が無い

## 2. Evidence（根拠）

- `docs/rc2-baseline-audit.md`（Pre-RC2 Baseline / Findings §4 / Success Criteria §8）
- `evidence/product-review/learning-content-inventory.md`（Learning depth §4 / Feedback §6 / Mode §7 / Navigation §8 / Practice 候補 §9 / Deterministic 境界 §10 / Missing content §12）
- 実装 source（`src/`）と baseline tag

Source Audit と課題定義（§4 Observed Defects）で一致した項目を High Confidence Finding として最優先で解決しました。

## 3. Change（変更内容）

### Domain（pure・決定的・mode/locale 非依存を維持）

- `decision-judgment.ts`: option の judgment（recommended / context-dependent / risky）と Dimension impact を EffectRule から決定的に導出。根拠なく "Recommended" を付けない。
- `feedback-model.ts`: 各 Decision の Feedback Card を構築（LearningPoint が無い DP でも judgment + impact + provenance で意味のある feedback を出す）。
- `result-summary.ts`: Result Dashboard（summary / 9 Dimension / Decision Timeline / Remaining Risks / 決定的 Next-Focus 推薦）。
- `practice/`: 5 つの決定的 practice（Requirement Create / Evidence Review / Approval・Delegation 分類 / Traceability / Change Control）を entity + rubric + catalog + locale + provenance に分離。
- `adoption-sheet-composer.ts`: locale 対応の disclaimer、Workshop 入力の反映、Decision Timeline セクションを追加。

### UI（domain と分離・presentation のみ）

- `app-shell.tsx`（統一 AppShell: Home / Back / mode / scenario / 言語 / 復元バナー）、`lifecycle-stepper.tsx`、`feedback-card.tsx`、`result-dashboard.tsx`、`practice-views.tsx`、`lang-switcher.tsx`。
- `app-views.tsx` 全面刷新（Home 再設計 / mode-aware Reflection / Adoption Workshop）。
- `styles.css`: design tokens ベースの design system（card / stepper / feedback / dashboard / practice / workshop / mobile / reduced-motion / 44px tap target）。

### App / State

- `use-app-state.ts`: ProgressStore をフローに接続（起動時 restore / 各操作で save）、note を Decision 単位化、Back / Retry / practice navigation を追加。

## 4. Validation（検証）

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: 141 / 141 PASS（Pre-RC2 baseline 76 を包含）
- `npm run build`: PASS。gzip 合計 約 96 KB（JS 93.09 + CSS 2.51 + HTML 0.63）で既存 NFR 300 KB 上限を維持。
- 決定性 / mode 不変 / locale 不変 / 9 Dimension semantics 不変を invariant テストで保証。

## 5. RC2 Self Audit

課題定義 §32 の Findings を 1 件ずつ再評価。

| Pre-RC2 Finding | RC2 Status | Evidence | Test |
|---|---|---|---|
| DP1 Feedback empty | RESOLVED | `feedback-model.ts` が空 LP でも feedback 生成 + core-e2e `dp-ac` に `lp-ac` 追加 | `rc2-ui.test.tsx` DP1 feedback / `feedback-model.test.ts` |
| Reflection empty | RESOLVED | `ReflectionView` を判断一覧 + good/improve + weak-dims + mode 別問い + self-note に | `rc2-ui.test.tsx` Reflection is not empty |
| note duplicate | RESOLVED | note を Decision 単位化（`ScenarioView` の `useEffect([dpId])` で reset） | `rc2-ui.test.tsx` note duplication regression |
| English Sheet Japanese comment | RESOLVED | disclaimer を `adoption.sheet.disclaimer` locale key 化 | `rc2-ui.test.tsx` English sheet no JP / `practice-locale.test.ts` |
| reload progress loss | RESOLVED | `use-app-state` で ProgressStore load/save をフロー接続、`restoreFrom` | `rc2-ui.test.tsx` reload restores progress / corrupt fallback |
| Mode similarity | IMPROVED | Guided=概念先出し / Simulation=簡潔 feedback / Adoption=Workshop + 実チーム問い | `rc2-ui.test.tsx` mode differentiation |
| option-independent feedback | RESOLVED | `deriveOptionJudgment` で選択別 status/impact | `decision-judgment.test.ts` / `feedback-model.test.ts` |
| Result causality | RESOLVED | Decision Timeline（stage / selected / judgment / 寄与 Dimension） | `result-summary.test.ts` / `rc2-ui.test.tsx` Result Dashboard |
| Navigation | RESOLVED | AppShell（Home/Back）+ Result（Retry/Focus/Home）+ practice back | `rc2-ui.test.tsx` navigation |
| Lifecycle position | RESOLVED | `LifecycleStepper`（completed/current/upcoming + progress %） | `rc2-ui.test.tsx` Lifecycle Stepper |
| Create | RESOLVED | Requirement Practice（決定的 rubric） | `practice-rubric.test.ts` / `rc2-practice.test.tsx` |
| Review | RESOLVED | Evidence Review + Approval/Delegation + Traceability | `practice-rubric.test.ts` / `rc2-practice.test.tsx` |
| Focus depth | IMPROVED | Focus library を objective/related-dimensions 付き card 化 + Result からの Next-Focus 導線 | `rc2-ui.test.tsx` review-dims+next-focus |
| Adoption Workshop | RESOLVED | 編集可能セクション + ユーザー入力を Sheet に user-authored 反映 + Markdown preview/download | `rc2-practice.test.tsx` Adoption Workshop |
| mobile heading | IMPROVED | `.home-title { overflow-wrap: anywhere }` + `@media(max-width:640px)` | 手動 CSS レビュー（実機測定は未実施） |
| Sheet mobile layout | IMPROVED | mobile で preview font 縮小 + action-row flex | 手動 CSS レビュー（実機測定は未実施） |
| Change Control（欠落） | RESOLVED | Change Control Practice（re-evaluate / re-approve / change-scope 判断） | `practice-rubric.test.ts` Change Control |
| explicit Rework（欠落） | RESOLVED | feedback からの Back（決定的 rollback）+ Change Control の return-to-previous 選択肢 | `rc2-ui.test.tsx` feedback back |
| Traceability 可視化 | RESOLVED | Result Timeline の Decision→Stage→Dimension + Traceability Practice | `result-summary.test.ts` / `practice-rubric.test.ts` |

## 6. Known Limitations

- Requirement / Evidence / 分類などの **semantic 品質**（曖昧さ・測定可能性のニュアンス・ビジネス的正しさ）は runtime AI が無いため評価しない。UI に「この版では意味的評価をしない」と明示。
- WCAG 準拠は semantic HTML / keyboard / focus / aria-live / color 非依存 / contrast を実装し axe（critical/serious ゼロ）で確認したが、支援技術での実測・専門家レビューは未実施のため「完全準拠」とは断言しない。
- mobile レイアウトは CSS 設計とテストで担保したが、実機 390px での目視測定は本セッションでは未実施。
- Adoption Sheet の見出しは FR8.2 の 10 固定を維持（追加見出しは Decision Timeline / user notes のみ）。

## 7. Deferred

- provenance 4 区分のうち `harness-behavior` / `simulation-assumption` を実題材で使う拡張（P2）。
- Focus 2 問目を「Decide → Review」へ深める scenario data 拡張（本 RC2 は Practice で Review を新設し、Focus は library 提示・推薦を強化するに留めた）。
- Requirement Practice の入力・Workshop 入力の localStorage 永続（本 RC2 は scenario 進捗のみ永続）。

## 8. Pre-RC2 Comparison（最も大きく変わった学習体験・5 点以内）

1. **Feedback**: 全 Decision で選択別に judgment（推奨/文脈依存/リスク）+ Dimension impact + why + better alternative + provenance を提示（空 feedback を解消）。
2. **Result → Reflection**: 記号一覧から、Decision Timeline・寄与 Dimension・弱点・次の学習を示す Learning Review Dashboard と、mode 別の実質的な振り返りへ。
3. **Create / Review の新設**: Requirement を書く / Evidence を分類する / 承認境界を引く / 追跡を確認する / 変更管理を判断する 5 practice を決定的 rubric で追加。
4. **Navigation / 現在位置**: AppShell（Home/Back/mode/scenario）+ Lifecycle Stepper + Retry + 進捗永続で行き止まりを解消。
5. **Adoption**: read-only Sheet から、ユーザー入力を反映する編集可能な Adoption Workshop へ（note 重複と英語シートの日本語混入も解消）。
