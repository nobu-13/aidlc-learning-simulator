# RC3 Final Stabilization — Evidence

> RC3 Stable Freeze 前の最後の UX / learning correctness 修正記録。
> 基準は Human による `rc3-final-human-ux-audit.md`（Overall 43/100, P0=0 / P1=6 / P2=8 / P3=1, NOT READY）。
> **元 Audit は改変しない。** 本書は修正の Evidence を新規に記録する。
> 本記録時点の Status は **Implemented locally / Pending live verification**（commit/push/AWS/deploy/tag/release 未実施）。
> Finding ID（H1–H5 / N1–N10）を保持する。

## Baseline
- 対象 main: `aa9ad46`（RC3 Stabilization。PR #6 squash merge）
- branch: `fix/rc3-final-stabilization`（local 実装のみ）
- RC2 Stable `v0.2.0` → `86d0728`（不変）

## Findings → Fixes

| ID | Finding | 修正 | Status |
|---|---|---|---|
| H1 (P2-1) | Guided で「あなたの記述からの引用」表示 | mode 別 quote heading（Guided=サンプルプロジェクト / Sim・Adoption=あなたの記述） | Implemented locally / Pending live |
| H2/H4 (P1-1) | Feedback に internal ID、Artifact と非追跡 | `HumanReadableFeedbackViewModel`（itemTitle/body/severity/resultType/why/origin/affected）。caught/missed/false 全てで使用。ID/defectId/artifactId/locale key を UI へ出さない。Artifact item と 1:1 | Implemented locally / Pending live |
| H3 (P2-2) | Home 重複 | Home をグローバル shell に一本化。view 内の重複 Home を除去（Result の to-home を削除、Gym 導線のみ） | Implemented locally / Pending live |
| H5 (P1-2) | Consequence が heading のみ | consequence rendering を fail-closed。what/why/origin/affected を必ず human-readable 表示。Guided=explained / Simulation=would-have / Adoption=actual | Implemented locally / Pending live |
| N1 (P1-3) | Completion Return/Block でも Release へ進む | Completion decision を workflow transition へ反映。Approve/Approve-with-conditions→Release、Return→review へ rework、Block→Release 不可（Result blocked） | Implemented locally / Pending live |
| N2 (P1-4) | Simulation high miss でも進める | must-fix を state 化。high 見逃し + too-lenient で `proceedAfterFeedback` が advance 拒否、Next ボタン非表示、rework 必須。修正 review 後に進行可 | Implemented locally / Pending live |
| N3 (P1-5) | 最終 correct review で学習履歴が消える | `learningHistory`（current state と独立に miss/FP/rework を累積）。Result に Final state と Journey history を別表示 | Implemented locally / Pending live |
| N3/H4 (P1-6) | Result traceability 不足 | Result の Causal Learning Summary + finding-level（title/severity/why/origin/consequence/revisit）を human-readable 表示 | Implemented locally / Pending live |
| N4 (P2-3) | symbol のみの rating | human-readable label（優れている/良好/中立/要注意/重大な懸念）を主表示、symbol は補助（aria-hidden） | Implemented locally / Pending live |
| N5 (P2-4) | rework count 不整合 | single source of truth = `reworkHistory`。Completion/Result/Persistence/Resume で一致 | Implemented locally / Pending live |
| N6 (P2-5) | 完了後も「進行中」扱い | `journeyComplete` フラグ。Home は completed card（Resume を出さない、Review Result を提供） | Implemented locally / Pending live |
| N7 (P2-6) | mobile header 崩れ | 400px 以下で header を縦積み・overflow-hidden・44px target・wrap 整理 | Implemented locally / Pending live |
| N8 (P2-7) | Training Gym が第二の Home | Gym を secondary area として subtitle + dashed border で明示 | Implemented locally / Pending live |
| N9 (P2-8) | Result に Decision 表示なし | Result に Completion / Release decision を human-readable 表示（未到達は「未到達」） | Implemented locally / Pending live |
| N10 (P3) | 空 feedback section | caught/missed/false は 0 件なら非表示。全問題なしのときは明示メッセージ | Implemented locally / Pending live |

## Cross-cutting human readability
全 Journey で internal ID / raw enum / locale key / undefined / null / empty card / heading-only card を UI へ出さない方針。feedback は view model 経由、rating は label、consequence は fail-closed。

## Validation (local)
- typecheck PASS / lint PASS / test **252 PASS**（RC3 Final 追加 18: domain 4 + UI 14）/ build PASS
- gzip 約 **120.31 KB**（JS 116.42 + CSS 3.26 + HTML 0.63）< 300 KB
- RC2 invariants（9 Dimension semantic）+ locale symmetry（ja/en）PASS
- 依存追加なし / deploy/ 変更なし / runtime AI なし / network・runtime generation なし

## Local assessment（相対・実測値ではない）
- Feedback Traceability: 28 → 高改善（view model + 1:1 + severity/why/origin）
- Human Readability: 38 → 高改善（ID/enum/key 排除、rating label、fail-closed consequence）
- Consequence Learning: 35 → 改善（fail-closed body + origin/affected step）
- Rework Experience / Completion-Release / Result-Reflection / Navigation も各修正で改善

## Limitations
- 実ブラウザ手動監査は未実施（deployed=tested build + marker + automated tests で担保予定）。
- Stable 判定は Live Human Audit 後。
- semantic 品質評価は runtime AI 無しのため非対応。

## Sources
- `docs/rc3-final-human-ux-audit.md`（Human 提供の Final Audit。改変せず）
- `docs/rc3-live-ux-audit.md` / `docs/rc3-stabilization-live-regression.md`（先行記録）
- merged baseline `aa9ad46`

---

## Follow-up Review — Integration-layer Patch (F1–F7)

前回の Final Stabilization を presentation / persistence / UI integration まで再レビューした結果、
domain 実装は済んでいても integration 層で未完了・テスト不十分な Stable blocker が 7 件残っていた。
本パッチでこれらを修正した。**Status: Implemented locally / Pending live human verification**
（commit/push/AWS/deploy/tag/release は未実施。Live RESOLVED とはまだ書かない）。

| ID | 問題 | 修正 | Status |
|---|---|---|---|
| F1 | Setup 中の draft が beginJourney 前に保存されず、Home/reload で消失 | `setDraftUserAuthored`/`setDraftStructured` を永続化。`PersistedJourney` に `draftUserAuthored`/`draftStructured`/`savedView` を additive 追加。Simulation/Adoption の setup で Home→Resume / reload→Resume で入力と setup view を復元 | Implemented locally / Pending live |
| F2 | `resumeViewFor` が decision presence のみで判定し、Completion Return/Block でも Release へ resume し得た | decision semantics + progress + journeyComplete で判定。Return→review、Block→Result、Approve→Release。Return/Block から Release へ絶対 resume しない | Implemented locally / Pending live |
| F3 | `learningHistory` が persist されず reload で消失 | `PersistedJourney` に learningHistory を additive 追加。restore で safe default（missing=empty）。既存 v3 データ互換維持 | Implemented locally / Pending live |
| F4 | Result が total counts のみで「何を間違えたか」に答えられない | `LearningHistory` を finding-level（itemTitle/body/mistakeType/severity/why/origin/affected/consequence/revisit）へ拡張。stable key で dedup、aggregate count は実発生回数。Result に finding-level cards を human-readable 表示 | Implemented locally / Pending live |
| F5 | Feedback consequence に「実際に何が起きるか」が無い | `FeedbackViewModel` に `consequenceKey`（downstreamManifestation.manifestItemKey）を追加。Feedback consequence で What happens / Why / Origin / Affected を必ず表示（fail-closed） | Implemented locally / Pending live |
| F6 | 条件付き assert で feature 欠落でも PASS し得た | 重要 Acceptance を deterministic fixture（high-risk structured 等）で必ず対象状態を発生させ、hard assert（getByTestId / not-null / MUST NOT exist）に強化 | Implemented locally / Pending live |
| F7 | Resume 後に review UI の finding/severity/gate/note が復元されない | `JourneyReviewView` を `journey.state.reviews[currentStep]` から hydration（artifactId を依存 key に。rework で revision が上がれば empty に reinit） | Implemented locally / Pending live |

### Validation (local)
- typecheck PASS / lint PASS / test **265 PASS**（前回 252 + 本パッチ 13）/ build PASS
- gzip 約 **121.37 KB** < 300 KB
- RC2 invariants（9 Dimension）+ locale symmetry（ja/en）+ persistence（v1/v2/v3 additive migration）= 20 pass
- 依存追加なし / deploy/ 変更なし / runtime AI・network・time・random なし

### Persistence
`PersistedJourney` は additive extension のみ（`draftUserAuthored?` / `draftStructured?` / `savedView?` /
`journeyComplete?` / `learningHistory?`）。既存 persisted journey を corrupt 扱いせず、missing field は
empty/safe default で復元。silent data loss なし。

### Limitations
- 実ブラウザ手動監査は環境制約で未実施（deployed=tested build + marker + automated tests で担保予定）。
- Stable 判定は次回 Live Human Audit 後。

---

## Follow-up Patch (G1–G4)

Status: Implemented locally / Pending live human verification
Branch: `fix/rc3-final-stabilization`（commit/push/PR/merge/AWS/deploy/tag は未実施・working tree のみ）

| ID | 内容 | 実装 | 検証 |
|----|------|------|------|
| G1 | 未 submit の Review Draft を persist/restore | `JourneyState.reviewDrafts` + `ReviewDraft` 型を additive 追加。`setReviewDraft` API。`toPersistedJourney`/`restoreJourney`/`resume` で往復。`PersistedJourney.reviewDrafts?`（additive）。JourneyReviewView は入力のたびに下書きを persist し、hydration は 下書き（artifactId 一致）→ 確定 review → 空 の優先順位。submit / rework / completion-return で対象 step の下書きは破棄。 | test 24（reload→resume で finding/severity/gate/note 復元）。typecheck/lint/build green。 |
| G2 | Completion Return→rework→Completion 再到達後の resume routing | `advanceOrApprove` で j7 到達時に stale `completionDecision` を undefined へクリア。これにより `resumeViewFor` が "return" 残留で review へ誤誘導しない。 | test 25（Return→j6 再 review→Completion 再到達→reload→resume が Completion へ）。 |
| G3 | Completion Block 後の reload Home を Completed 扱い | 初期化の completed 判定を `restoreJourney` の `journeyComplete`（= persisted journeyComplete ∨ block ∨ release）へ統一。release 済みだけでなく Block も Completed。 | test 26（Block→reload→journey-completed-card 表示 / resume-card なし）。 |
| G4 | Consequence test で actual manifestation 本文を hard assert | F5 の「What happens ラベルのみ」検証を強化し、決定的 ground truth の manifestation 本文（`A missing NFR surfaced as a remaining risk at release.` / `A design security-constraint violation surfaced as a traceability gap.`）の実表示を hard assert。 | test 27。 |

### Gates
- typecheck: PASS（exactOptionalPropertyTypes + noUncheckedIndexedAccess 維持）
- lint: PASS
- test: 269 passed（rc3-final-patch 13→17。G1–G4 で +4）
- build: PASS / gzip JS 117.81 KB（< 300 KB）
- 永続化は全て additive（v1/v2/v3 migration・locale symmetry の既存テスト green）。runtime AI / network / deps / deploy に変更なし。

### Limitations
- 実ブラウザ手動監査は環境制約で未実施（byte-identical live bundle + marker + automated tests で担保）。Live RESOLVED 断定はしない。

---

## RC3.1 Stable Close Patch

Status: **RC3.1 Programmatically Verified / Closed**（Live Human Verified / Live RESOLVED / RC3 Stable ではない）
Base main: `145e8f12d0ba4550f70828306b706b311a6ecf31`
Branch: `fix/rc3.1-stable-close`

Final Live Human UX Audit で残った明確・局所的な既知 Finding を最小差分で閉じる。RC3 の大規模改修は行わない。

| Finding | 内容 | 対応 | 結果 |
|---------|------|------|------|
| UX-FT-001 | Feedback traceability incomplete（downstream 無しで field が消える） | UI 正規化。missed/false の全 learning event で Item / Severity(or N/A) / Why / Origin / Affected later step(or explicit N/A) / Consequence を常に表示。`FeedbackTraceability` 共通コンポーネント + `rc3.trace.*` の明示的 N/A key。false positive は「なぜ FP か・downstream 該当なし」を説明。**Ground Truth / TP-FP-FN-TN / severity 評価は不変**。 | Programmatically Closed |
| UX-RH-001 | Learning History incomplete（event ごとに schema が不揃い） | Result の history-entry を全 event 同一 schema へ正規化。Item title / Mistake type / Severity(or N/A) / Why / Origin / Consequence(or explicit N/A) / Revisit を常に表示。false positive も例外にしない。存在しない domain data は作らず UI normalization のみ。 | Programmatically Closed |
| UX-NAV-001 | Duplicate Home | shell の `journey-nav-home` を唯一の Home に一本化。`backKind==="home"` 時の二つ目の ⌂ Home（`journey-nav-back-home`）を削除。Back（feedback）と Resume/domain state は不変。 | Programmatically Closed |
| UX-MOB-001 | Language select < 44px | `.lang-switcher select` の `min-height` を 40px→44px。mobile(<=400px) でも 44px + width:100% を明示。header layout / overflow は不変。 | Programmatically Closed |
| UX-RW-001 | Rework artifact does not visibly change | **RC4 へ正式 Deferred**（今回コード変更なし）。RC4 で Actual Artifact Rework → Revised Artifact → Diff → Downstream Propagation → Evidence/Risk/Approval 反映を実装予定。RC3.1 で中途半端な fake artifact regeneration は追加しない（二重実装回避）。 | Deferred to RC4 |

### Added deterministic tests（`src/ui/rc3.1-stable-close.test.tsx`, 15 件）
1 miss w/ downstream→Affected 表示 / 2 miss w/o downstream→explicit N/A（omission 禁止）/ 3 false positive traceability（undefined/null/internal id なし）/ 4 history miss w/ consequence full schema / 5 全 history entry で全 field 非空 / 6 history false positive で全 field + N/A / 7-11 Setup·Review·Completion·Release·Result で Home ちょうど 1 / 12 CSS min-height>=44px / 13 Home→Resume regression / 14 Completion approve·return·block semantics 不変 / 15 Simulation critical miss で Next なし。

### Gates
- typecheck: PASS / lint: PASS
- test: **284 passed**（269 baseline 全維持 + 15 new）
- build: PASS / gzip JS 118.56 KB（< 300 KB）
- dependency diff: なし / deploy/ diff: なし / runtime AI・network: なし
- 変更ファイル: `src/app/app.tsx` / `src/i18n/messages.ts`（ja·en 対称）/ `src/ui/journey-views.tsx` / `src/ui/styles.css` / `src/ui/rc3.1-stable-close.test.tsx`（新規）

### Close 判定
- P1 known deterministic findings（UX-FT-001 / UX-RH-001）Closed
- Duplicate Home（UX-NAV-001）Closed / Mobile language target（UX-MOB-001）Closed
- 全 automated tests / typecheck / lint / build PASS、dependency·deploy 変更なし
→ **RC3.1 Programmatically Verified / Closed**。今回 Live 再監査は未実施のため Live Human Verified / RC3 Stable とはしない。
