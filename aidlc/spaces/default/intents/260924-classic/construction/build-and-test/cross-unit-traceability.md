# Cross-Unit Final Coverage Gate — aidlc-learning-simulator

> Step 10 stage-level gate（Construction phase 境界ではない）。requirements.md の全 FR/NFR と stories.md の 3 セグメント AC を列挙し、code-generation の traceability.json（`OK` + 実在 target file）に対する被覆を検証する。単一 unit（U1）のため stage-level = unit-level。

## 判定サマリ

- **verdict: PASS（MVP Known Gaps を明示）**
- FR/NFR/AC を code-generation `traceability.json` に **1:1 明示追記済み**（human 判断・案C）。coverage 110 エントリ: **OK 100 / PARTIAL 10 / MISSING 0**。
- v2.10.0 必須 Topic の checkpoint review（AC5.2.1/5.2.2）と refusal/recovery（AC5.3.1/5.3.2）は Focus Scenario 2 本を追加して **OK** 化（ai-dlc-spec provenance・テスト付き）。
- 残り **10 件は PARTIAL = MVP Known Gaps**（機構はあるが AC 細部未充足）。削除・隠蔽せず `PARTIAL` として明示追跡し、承認 gate / 本書 / Operation handoff で surface する（緩めない）。Traceability != Verification の原則を維持（振る舞いは 76 tests で検証）。

## FR/NFR 被覆（実装ファイル・テスト単位）

| ID | 被覆 target（実在） | 検証 | 状態 |
|---|---|---|---|
| FR1（二層構造） | src/scenarios/（core + focus）, src/ui/app-views.tsx | scenarios.test.ts / app-views.test.ts | Covered |
| FR2（学習概念・provenance 4 区分） | src/domain/entities.ts, src/ui/provenance-badge.tsx | scenarios.test.ts | Covered |
| FR3（データ駆動・決定的） | src/data/schema.ts, src/data/scenario-loader.ts, src/domain/dimension-evaluator.ts | schema/loader/evaluator tests | Covered |
| FR4（Decision 操作・note） | src/domain/scenario-progression.ts, src/ui/app-views.tsx | scenario-progression.test.ts / app-views.test.ts | Covered |
| FR5（9 Dimension・非単調） | src/domain/dimension-evaluator.ts | dimension-evaluator.test.ts | Covered |
| FR6（教育値/実測値・provenance） | src/ui/provenance-badge.tsx, src/ui/app-views.tsx（sim-value-note） | app-views.test.ts | Covered |
| FR7（結果画面） | src/domain/result-model.ts, src/ui/app-views.tsx（ResultView） | app-views.test.ts | Covered |
| FR8（Adoption Sheet） | src/domain/adoption-sheet-composer.ts, src/ui/app-views.tsx（AdoptionReviewView） | adoption-sheet-composer.test.ts / app-views.test.ts | Covered |
| FR9（3 モード） | src/domain/experience-policy.ts | experience-policy.test.ts | Covered |
| FR10（i18n ja/en） | src/i18n/locale-resources.ts, src/i18n/messages.ts | locale-resources.test.ts | Covered |
| FR11（localStorage 永続） | src/data/progress-store.ts | progress-store.test.ts | Covered |
| FR12（不正 JSON 可視挙動） | src/data/scenario-loader.ts, src/ui/app-views.tsx（ErrorView） | scenario-loader.test.ts / app-views.test.ts | Covered |
| NFR2（決定性） | src/domain/dimension-evaluator.ts, .eslintrc.cjs | dimension-evaluator.test.ts（反復・順序不変）+ ESLint 排除 | Covered |
| NFR3（Traceability/provenance 4 区分） | src/domain/entities.ts, src/data/schema.ts（ai-dlc-spec→reference 必須） | schema.test.ts | Covered |
| NFR4（a11y 目標） | src/ui/*, provenance-badge.tsx | app-views.test.ts（axe/keyboard）; contrast/手動は Unverified（performance-validation/手動） | Covered（自動範囲）/ 手動未 |
| NFR5（保守性・層分離） | /src レイヤー構成 | 構造・scenarios.test.ts | Covered |
| NFR6（portability/static） | vite.config.ts（VITE_BASE） | build success | Covered |
| NFR7（proportionate security） | src/data/progress-store.ts（localStorage-only）, security-design 準拠 | progress-store.test.ts; secret=0 | Covered |
| NFR8（honesty of claims） | src/ui/app-views.tsx（Educational Simulation Value 注記） | app-views.test.ts（sim-value-note） | Covered |
| NFR9.1/9.2/9.3（runtime latency） | — | 実測は performance-validation（Operation） | Unverified（deferred・owning stage あり） |
| NFR9.4（bundle budget） | vite build 出力 | 74.05KB gzip ≤ 300KB | Covered |
| NFR1（educational effectiveness） | 定性目標 | Early User Test（後段・定性） | 定性・本ステージ範囲外 |

## AC 被覆（1:1 明示・案C 反映後）

- 全 66 AC を code-generation `traceability.json` に AC → implementation → test で 1:1 明示。**OK 56 / PARTIAL 10**（AC5.2/5.3 は Focus Scenario 追加で OK 化）。
- AC5.2.1/5.2.2 → `src/scenarios/focus-checkpoint-review.json` + `scenarios.test.ts`（ai-dlc-spec provenance）。
- AC5.3.1/5.3.2 → `src/scenarios/focus-refusal-recovery.json` + `scenarios.test.ts`（ai-dlc-spec provenance）。

## MVP Known Gaps（PARTIAL 10 件・明示・実装しない方針）

機構は存在するが AC 細部が未充足。学習価値優先・過剰演出回避（product.md）のため今回は実装せず、`PARTIAL` として明示追跡し Operation handoff / 後続改善候補とする:
AC1.2.4 / AC1.2.5 / AC2.1.4 / AC2.3.1 / AC2.6.4 / AC3.1.1 / AC3.1.4 / AC5.1.3 / AC6.1.1 / AC8.2.3。
（削除・隠蔽せず、緩めず surface する。）

## 未検証・deferred ID（緩めない）

- **NFR9.1 / NFR9.2 / NFR9.3**: 本ステージで実測不可 → performance-validation（Operation）が owning stage。Unverified。
- **NFR4（color-contrast / 手動 a11y）**: 自動評価不可 → 手動確認。Unverified。
- 完全未被覆（実装もテストも無い）FR/NFR/AC は**なし**（MISSING 0）。

## Sources
- enumerate: `../../inception/requirements-analysis/requirements.md`（FR1-12 / NFR1-9）, `../../inception/user-stories/stories.md`（AC）。
- traceability: `../aidlc-learning-simulator-web/code-generation/traceability.json`。
- 実行証跡: `test-results.md`, `build-and-test-summary.md`。
