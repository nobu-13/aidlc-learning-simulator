# Frontend Components — U1: aidlc-learning-simulator-web

> UI unit の component 階層・props/state・interaction flow・a11y。技術非依存の設計（React 実装は code-generation）。**UI は domain logic を所有しない**（BR8.1）: render / user intent 取得 / accessibility / presentation state のみ。domain は ApplicationOrchestrator を **presentation adapter 経由**で呼ぶ。表示は locale key 解決のみ（semantic を書き換えない）。

## Component 階層

```
App（結線・view 切替。domain orchestration そのものは持たない）
├─ LocaleProvider（stable locale key → display string の解決のみ）
├─ A11yLiveRegion（aria-live: 動的な result/error/feedback 通知）
├─ HomeView
├─ ModeSelectView（Guided / Simulation / Adoption Review 選択）
├─ ScenarioIntroView
├─ ScenarioView
│   ├─ StagePanel
│   │   └─ DecisionPointPanel
│   │       ├─ DecisionOptionList（option 2..n、keyboard 操作）
│   │       ├─ FeedbackPanel（LearningPoint 提示）
│   │       └─ ProvenanceBadge（4 区分 label+icon+text）
│   └─ ProgressIndicator
├─ ResultView
│   ├─ DimensionResultList（固定 9 Dimension の DimensionOutcome）
│   │   └─ DimensionResultItem（level + 寄与 rule/rationale の progressive disclosure）
│   └─ ReflectionPanel
├─ AdoptionReviewView
│   └─ AdoptionSheetPreview（決定的 Markdown プレビュー）
├─ FocusLibraryView（focus Scenario 一覧・除外された invalid の明示）
└─ ErrorView（Scenario unavailable / validation error の readable 表示）
```

## 主要 component の責務・props/state

| Component | 責務 | 主な props（入力） | presentation state | 呼ぶ adapter |
|---|---|---|---|---|
| App | view 遷移の管理、adapter 経由の domain 呼び出し結線 | — | currentView | orchestrator adapter 全般 |
| LocaleProvider | locale key→string 解決、言語切替 | activeLocale | — | locale adapter（semantic 不変） |
| A11yLiveRegion | 動的更新の読み上げ通知 | message, politeness | — | — |
| ModeSelectView | mode 選択の intent 取得 | availableModes | selectedMode | policy adapter |
| ScenarioView | 進行 UI、decision intent 取得 | scenarioViewModel（stable ID + locale key） | localExpanded 等 | progression adapter |
| DecisionOptionList | option 提示・選択 | options（optionId + labelKey） | focusedIndex | — |
| FeedbackPanel | LearningPoint 提示 | learningPointViewModel | disclosureOpen | — |
| ProvenanceBadge | 4 区分表示（label+icon+text） | category, hasReference | detailOpen | — |
| ResultView / DimensionResultList | 9 Dimension 結果表示 | dimensionOutcomes（dimensionId, level, contributingDecisionRecordIds） | expandedDimensionId | result adapter |
| AdoptionSheetPreview | 決定的 Sheet のプレビュー・書き出し | sheetMarkdown | — | adoption adapter |
| ErrorView | validation/unavailable の readable 表示 | errorViewModel（種別・読めなかった Scenario） | — | — |

viewModel は domain の semantic data（stable ID）＋ locale key で構成し、UI は表示時に LocaleProvider で string 解決する（BR5.1）。

## Interaction flow（presentation）

- **decision**: DecisionOptionList で option を選択（click / Enter / Space）→ App が progression adapter に intent を渡す → 更新後の viewModel を受けて FeedbackPanel を表示 → A11yLiveRegion で結果を通知。
- **provenance**: ProvenanceBadge は decision 後に category label を常時表示、詳細 reference は progressive disclosure（BR4.2/BR4.3）。
- **result**: 完了で ResultView へ。DimensionResultItem は level を label+形状+テキストで示し（色のみ依存しない）、寄与 rule/rationale を展開可能（説明可能性 BR3.7）。
- **error**: validation/unavailable は ErrorView に readable 表示（無言停止しない BR1.8）。

## Form / 入力 validation

- 自由入力は Adoption Review メモ（AdoptionReviewMemo.noteText）のみ。runtime 生成 AI 採点はしない（C3）。空でも可。保存は stable-ID 進行データとともに ProgressStore（表示文言でなく生メモ）。
- 選択入力（DecisionOption）は 2..n から 1 つ。未選択で次へ進めない（awaiting-decision 維持）。

## Accessibility（NFR4・WCAG 2.2 AA 目標）

- semantic HTML（button/nav/main/section、見出し階層）。
- keyboard のみで主要 Flow 完走（Tab 順 = reading order、Enter/Space で option 起動、focus をパネル遷移時に管理）。
- visible focus / 十分な contrast / 色のみに依存しない表現（provenance・dimension level は label+icon/shape+text）。
- 動的更新（feedback / result / error）は A11yLiveRegion（aria-live）で通知。
- 自動チェック（axe critical/serious ゼロ、jsx-a11y、user-event の keyboard テスト）は準拠の一部であり、完全な準拠検証には手動確認（スクリーンリーダー等）が必要である旨を明記（B8 で仕上げ、B1 から基本遵守）。

## UI に置かないもの（再掲・BR8.1）

evaluation calculation / Scenario progression rule / ApprovalSemantics / effect rule interpretation / deterministic ID generation / persistence serialization semantics。これらは domain / adapter が所有し、UI は結果の viewModel を表示するのみ。
