# RC3 Stabilization — Live Regression Record

> RC3 Stabilization（PR #6）を production へ application-only deploy した後の regression 記録。
> 既存 `rc3-live-ux-audit.md` は上書きせず、本書を新規追加する（Evidence lineage 維持）。
> **secret / access key / account ID / role ARN / request ID の値は記録しない。**

## 0. Deploy Facts

- merged `main`: `aa9ad46ca3832f4e251818d87af248ecebeb0373`（PR #6 squash merge、`fix: stabilize RC3 learning journey UX`）
- 直前 main（RC3 initial）: `fcb66bb63969392d6a5e9350918d7a8c01f78566`
- RC2 Stable tag `v0.2.0` → `86d072872dce2f697ca2b8cfd9f0c54c504d7518`（不変・新規 tag なし）
- AWS profile / account / region: **redacted**（environment-specific identifier のため非公開）。
- Infrastructure: **既存を再利用。CloudFormation update / IAM / OAC / Response Headers Policy / bucket / distribution / cache policy の変更なし**（stack `LastUpdatedTime` は null のまま）。
- 許可された AWS mutation のみ実施: 既存 private S3 への `aws s3 sync --delete`、既存 CloudFront distribution の `/*` invalidation（bucket 名 / distribution ID は redacted）。
- deploy asset: `index.html` / `assets/index-Bq_Abu4j.js` / `assets/index-DuFuIq8L.css`（旧 RC3 asset `index-C_AtZzeS.js` / `index-CnVXHg1H.css` は sync `--delete` で除去）。
- CloudFront invalidation: id **redacted** → **Completed**。
- public URL: `https://d3htkxj6qo0vt2.cloudfront.net`（既存 evidence で公開済みの production URL）。

## 1. Verification Method（正直な明記）

本 regression は自動化されたブラウザ操作環境を持たないため、**実ブラウザでの手動目視監査は未実施**。
代わりに、RC2 stabilization deployment と同一方針で以下により担保する:

1. **live bundle == local build（byte-identical）**: `curl` で取得した live JS/CSS が、deploy した
   `dist/` の build 成果物と `cmp` 一致（deployed = tested build）。
2. **live bundle 内の実装 marker**: 各 finding の UI/挙動に対応する testid / locale key が live bundle に存在。
3. **automated tests**: 同一 commit（`aa9ad46`）に対し 234 tests PASS（うち RC3 journey/stabilization 66）。

したがって各 finding は **"Verified via deployed-equals-tested build + implementation markers + automated tests"** で
"Implemented & verified on the deployed build" と判定する。**実ユーザーの体感確認は Human による最終確認に委ねる**。

Basic production smoke（実施済み）:

| 項目 | 結果 |
|---|---|
| root `/` | HTTP 200 / text/html / title「AI-DLC Learning Simulator」/ `id="root"` |
| root asset 参照 | `index-Bq_Abu4j.js` / `index-DuFuIq8L.css`（= 新 build が live） |
| JS asset | HTTP 200 / text/javascript |
| CSS asset | HTTP 200 / text/css |
| live == local build | JS/CSS とも byte-identical |
| 存在しない asset | HTTP 403（200 rewrite しない） |
| 旧 RC3 asset | HTTP 403（削除済み） |
| CSP / HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy | すべて付与 |
| 予期しない 5xx | なし |

## 2. Per-Finding Regression

各 finding: Original status → Stabilization implementation → Live evidence → Final status。

### P1-1 Adoption answer leakage
- Original: pre-submit で valid/distractor/not-a-problem 等の answer-class cue が露出。
- Implementation: artifact item の label/body を中立な成果物内容へ書き換え。answer-class は submit 後 feedback（`rc3.defect.*`）のみ。
- Live evidence: live bundle に中立 item body が含まれ、"valid"/"distractor"/"罠" 等の cue は item 表示に無い。UI テスト「Adoption pre-submit shows no answer-class cue」PASS（deployed build と同一）。
- **Final: Verified on deployed build（pre-submit leakage なし）。**

### P1-2 Journey persistence / resume
- Original: reload で Home へ戻り復元不可。
- Implementation: journey state を persist、`resumable` 検出、`restoreJourney`、Home に Resume Journey。
- Live evidence: live bundle に `journey-resume-card` / `journey-resume` / `rc3.resume.title`。UI テスト（setup→reload→Resume / J3→reload→Resume）PASS。
- **Final: Verified on deployed build。**

### P1-3 Simulation critical-miss gate
- Original: high 見逃しでも Next 可能。
- Implementation: `hasCriticalLearningBlocker` + `mustBlockOnCriticalMiss`（Simulation のみ）。must-fix 時 Next 不可。
- Live evidence: live bundle に `feedback-must-fix`。domain テスト（gate A–E / blocker）+ mode 別テスト PASS。Guided/Adoption 非強制も確認。
- **Final: Verified on deployed build。**

### P1-4 Back / Home navigation
- Original: Journey 途中で Back/Home へ戻れない。
- Implementation: JourneyShell に Back/Home（presentation only）。Rework のみ revision/completed/rework を変更。
- Live evidence: live bundle に `journey-nav-home` / `journey-nav-back`。UI テスト（Home→Resume で state 保持 / Feedback→Back で progress 不変）+ domain テスト（navigation は domain 不変）PASS。
- **Final: Verified on deployed build。**

### P2-1 user-authored text raw
- Original: `⟦missing:...⟧` wrapper 表示。
- Implementation: `renderUserText`（rc3.sample.* のみ resolve、他は raw）。
- Live evidence: live bundle に `review-quoted-` + `renderUserText`。UI テスト（ja raw text / ja→en 不変、missing wrapper なし）PASS。
- **Final: Verified on deployed build。**

### P2-2 rework revision visibility
- Original: revision 変更が分からない。
- Implementation: RevisionBanner（Revision N + 差し戻し元 + 理由）。
- Live evidence: live bundle に `revision-banner`。UI テスト（rework 後 Revision 1 + 理由表示）PASS。
- **Final: Verified on deployed build。**

### P2-3 consequence experience
- Original: consequence が視覚的に弱い。
- Implementation: informational block（非選択・非採点・由来工程付き）。
- Live evidence: live bundle に `review-info-` / `rc3.consequence.origin`。domain テスト（informational / originStepId / TP-FP-FN-TN 不変）PASS。
- **Final: Verified on deployed build。**

### P2-4 completion decision support
- Original: 判断材料不足。
- Implementation: Completion Summary（evidence/unresolved/remaining-risk/rework/steps）。Release 情報は分離。
- Live evidence: live bundle に `completion-summary` / 「工程完了サマリー」/「Completion Summary」。domain + UI テスト（summary 表示 / release 情報混在なし）PASS。
- **Final: Verified on deployed build。**

### P2-5 result causal remediation
- Original: score dashboard のみ。
- Implementation: Causal Learning Summary（what/why/origin/consequence/revisit + 任意 Gym）。決定的。
- Live evidence: live bundle に `result-causal`。domain（causal summary 生成 / 決定性）+ UI テスト PASS。
- **Final: Verified on deployed build。**

## 3. Full Journey Regression（tests + markers）

- Guided / Simulation / Adoption の 1 周を UI テストで通し PASS（journey-ui.test.tsx）。
- Completion Approval ≠ Release Approval のインタースティシャルと 2 段承認を確認（テスト + live marker）。
- Training Gym（RC2 Focus/Practice 再利用）は RC2 UI baseline 57 tests 維持で主要回帰なし。
- Guided=Learn / Simulation=Practice / Adoption=Apply の mode 差は mode-policy + テストで維持。

## 4. Invariants
- 9 Dimension semantic 不変（`rc2-invariants` PASS）。
- Mode Ground Truth invariant 維持。
- consequence propagation は direct / one-hop（multi-hop 未実装）。
- runtime AI / network generation なし。RC2 baseline テスト維持。

## 5. Note on scoring
本書の再採点（scores）は自動テスト網羅 + live marker + byte-identical に基づく相対評価であり、
実ユーザー体感の定量値ではない（Educational Simulation Value と同様、実測値として扱わない）。

## 6. Limitations
- 実ブラウザ手動監査は未実施（SPA は単一 bundle。deployed=tested build + marker + automated tests で担保）。
- 支援技術での a11y 実測・実機 mobile 測定は未実施。
- semantic 品質評価は runtime AI 無しのため非対応。

## Sources
- merged `main` `aa9ad46`（PR #6）
- `deploy/cloudformation/static-site.yaml`（今回未変更）
- `docs/rc3-live-ux-audit.md`（原 Audit + Human Review Amendment。本書はその後続）
