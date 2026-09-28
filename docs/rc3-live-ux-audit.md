# RC3 Live UX Audit

> 事実ベースの記録。RC3 を production（CloudFront）へ deploy した後に実施した Live UX Audit の
> Finding と、その後の Human Review で追加された Finding を **時系列と出所を分けて** 記録する。
> Evidence lineage を維持するため、元 Audit の集計は後から書き換えない（追加は Amendment として明示）。

Baseline（RC3 deploy 時点）:
- main（RC3 squash merge）: `fcb66bb63969392d6a5e9350918d7a8c01f78566`
- RC2 Stable: `v0.2.0` → `86d072872dce2f697ca2b8cfd9f0c54c504d7518`
- production: `https://d3htkxj6qo0vt2.cloudfront.net`

---

## 1. Original RC3 Live UX Audit（当初集計）

**出所:** RC3 deploy 後の Live UX Audit（当初）。

集計:

- P0 = 0
- P1 = 3
- P2 = 5
- P3 = 2
- 判定: **NOT READY**

### P1（当初 3 件）
1. Adoption Review answer-class leakage — Review submit 前に valid/distractor/not-a-problem 等の
   answer-class 情報が見えており、Apply モードの前提を壊していた。
2. RC3 Journey persistence / resume failure — Simulation / Adoption 中に reload すると Home へ戻り、
   current step / setup / review 等を復元できなかった。
3. Simulation critical miss does not force rework — high/critical finding を見逃しても Next へ進めた。

### P2（当初 5 件）
5. User-authored text に `⟦missing:...⟧` wrapper が表示される。
6. Rework 後の revision 変更が分かりにくい。
7. Downstream consequence が視覚的に弱い。
8. Completion Approval に Evidence / Risk summary が不足。
9. Result に causal remediation / where-to-return guidance が不足。

### P3（当初 2 件・当時 defer）
- Training Gym boundary polish。
- mobile vertical density。

---

## 2. Human Review Amendment（後日・別出所）

> **これは当初 Audit の一部ではない。** Human の direct observation により、当初 Audit の後で
> 追加された Finding である。当初集計（§1）は改変せず、本 Amendment として明示的に追記する。

追加 P1:
4. **RC3 Journey lacks safe Back / Home navigation** — 8-step Journey の途中で Back / Home へ
   戻れず、ユーザーが「抜けられない」状態になっていた（Human direct observation）。

Amendment 反映後の Stabilization 開始時点の集計:

- P0 = 0
- P1 = **4**（当初 3 + Human Review 追加 1）
- P2 = 5
- P3 = 2
- 判定: **NOT READY**

---

## 3. RC3 Stabilization での対応（本パッチ）

branch: `fix/rc3-stabilization`。

> **Status: Implemented locally / Pending live verification.**
> 各 Finding は local 実装・local 検証（typecheck / lint / test 234 / build）で確認済みだが、
> **production（CloudFront）での live 検証は未実施**のため、「Live で RESOLVED」とはまだ記録しない。
> live 検証は deploy 後の別タスクで行い、その結果をもって RESOLVED を確定する。

| Finding | 区分 | 対応 | Status |
|---|---|---|---|
| P1-1 Adoption answer leakage | P1 | Artifact item の label/body を中立な成果物内容に書き換え、answer-class cue を除去。良否説明は submit 後 feedback（`rc3.defect.*`）のみ。 | Implemented locally / Pending live verification |
| P1-2 Persistence / resume | P1 | `useJourneyState` を store と接続。起動時 `resumable` 検出、`restoreJourney` で mode/step/inputs/reviews/revisions/decisions を復元、Home に Resume Journey を表示。 | Implemented locally / Pending live verification |
| P1-3 Simulation critical miss | P1 | `hasCriticalLearningBlocker`（high 見逃し + too-lenient）+ `mustBlockOnCriticalMiss`（Simulation のみ）。must-fix 時は Next を出さず rework を要求。Guided/Adoption は非強制。 | Implemented locally / Pending live verification |
| P1-4 Back / Home navigation | P1 | Journey Shell に常時 Back / Home。presentation only（revision/completed/rework を変えない）。Home でも Journey を保持し Resume 可能。 | Implemented locally / Pending live verification |
| P2-1 `⟦missing:...⟧` leakage | P2 | user-authored text を raw 表示（locale lookup を通さない）。canonical Sample のみ key を resolve。 | Implemented locally / Pending live verification |
| P2-2 Revision visibility | P2 | Revision N + 差し戻し元 + 理由を review 上に表示。 | Implemented locally / Pending live verification |
| P2-3 Consequence experience | P2 | Adoption の downstream consequence を informational block（非選択・非採点）で由来工程付き表示。 | Implemented locally / Pending live verification |
| P2-4 Completion decision support | P2 | Completion Summary（evidence / unresolved / remaining risk / rework / steps）。Release 固有情報は混ぜない。 | Implemented locally / Pending live verification |
| P2-5 Result causal remediation | P2 | Causal Learning Summary（what/why/origin/consequence/revisit + 任意 Gym 導線）を決定的に生成。 | Implemented locally / Pending live verification |

P3（Training Gym boundary polish / mobile vertical density）は本パッチの Stable blocker ではなく、
今回は AppShell 等の変更範囲で自然に改善される小修正に留める（全面再設計はしない）。

### 維持した不変条件
- 既存 9 Dimension semantic は不変。
- Mode Ground Truth invariant は不変（defect set は mode 非依存）。
- consequence propagation は direct / one-hop（multi-hop は未実装）。
- runtime AI なし。RC2 baseline テストは維持。
