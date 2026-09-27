# Unit of Work — Story Map

> 全 User Story を deployable unit へ割り当てる。unit は U1 単一なので全 US は U1（`u1-aidlc-learning-simulator-web`）に割り当たる。
> deployable target は U1 だが、追跡性を失わないよう各 US が U1 内部でどの Domain Component に対応するかも併記する（unit を増やす意味ではない）。

## Story → Unit → 内部 Component

| US ID | Unit ID | Directory | 主対応 内部 Domain Component |
|---|---|---|---|
| US1.1 | U1 | u1-aidlc-learning-simulator-web | LocaleResources, ProgressStore, /ui |
| US1.2 | U1 | u1-aidlc-learning-simulator-web | ExperiencePolicy, ApplicationOrchestrator, /ui |
| US2.1 | U1 | u1-aidlc-learning-simulator-web | ScenarioCatalog, ScenarioProgression, /ui |
| US2.2 | U1 | u1-aidlc-learning-simulator-web | ScenarioProgression, DimensionEvaluator, ResultModel, /ui |
| US2.3 | U1 | u1-aidlc-learning-simulator-web | ScenarioProgression, ResultModel |
| US2.4 | U1 | u1-aidlc-learning-simulator-web | ApprovalSemantics, /ui |
| US2.5 | U1 | u1-aidlc-learning-simulator-web | ApprovalSemantics, /ui |
| US2.6 | U1 | u1-aidlc-learning-simulator-web | ExperiencePolicy, ScenarioProgression, DimensionEvaluator, /ui |
| US3.1 | U1 | u1-aidlc-learning-simulator-web | ResultModel, DimensionEvaluator, /ui |
| US3.2 | U1 | u1-aidlc-learning-simulator-web | DimensionEvaluator, DecisionEffectRules, /ui |
| US4.1 | U1 | u1-aidlc-learning-simulator-web | AdoptionSheetComposer, ResultModel, /ui |
| US5.1 | U1 | u1-aidlc-learning-simulator-web | ScenarioCatalog, ScenarioProgression, /ui |
| US5.2 | U1 | u1-aidlc-learning-simulator-web | ScenarioCatalog, ScenarioProgression |
| US5.3 | U1 | u1-aidlc-learning-simulator-web | ScenarioCatalog, ScenarioProgression, ApprovalSemantics |
| US6.1 | U1 | u1-aidlc-learning-simulator-web | ExperiencePolicy, ResultModel, AdoptionSheetComposer, /ui |
| US7.1 | U1 | u1-aidlc-learning-simulator-web | /ui（accessibility 横断） |
| US7.2 | U1 | u1-aidlc-learning-simulator-web | ProgressStore |
| US7.3 | U1 | u1-aidlc-learning-simulator-web | ScenarioCatalog, ResultModel（ProvenanceEntry）, /ui |
| US7.4 | U1 | u1-aidlc-learning-simulator-web | DimensionEvaluator, DecisionEffectRules |
| US8.1 | U1 | u1-aidlc-learning-simulator-web | ScenarioLoader, ScenarioCatalog（build-time data） |
| US8.2 | U1 | u1-aidlc-learning-simulator-web | ScenarioLoader, ScenarioProgression |

## Cross-cutting concerns

deployable unit は 1 つのため、全 story は同一 unit 内。US7.1（accessibility）/ US7.3（provenance・教育値区別）/ US7.4（決定性）は U1 内で複数 module を横断する横断関心。これらは unit をまたがない（内部横断）。

とくに US7.1（accessibility）は単一 Domain Component の責務ではなく、主に `/ui` を中心として interaction/focus/keyboard/aria 等を横断する cross-cutting concern であるため、対応欄を Domain Component 名ではなく module-folder 表記（`/ui`）で示している（意図的な粒度差。新規 logical component として `Accessibility` を追加しない）。traceability.json の US7.1 note と表現を合わせている。

## Story implementation order within the unit

本ステージでは決めない（実装順序は Delivery Planning）。team practice の walking-skeleton（JSON 分離 → 1 Scenario 完走 → Decision 反映 → 結果表示 の薄い縦切りを最初に）を Delivery Planning が実装順の指針に用いる。

## Coverage verification

- 全 US1.1〜US8.2（21 件）が U1 へ割当済み。
- U1 は全 story を持つ（単一 unit）。未割当の story なし。
