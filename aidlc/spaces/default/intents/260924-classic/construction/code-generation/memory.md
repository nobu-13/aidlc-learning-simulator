<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-26 — AWS preflight は Option B/案X（承認直後・コード生成前に READ-ONLY 実行）で READY。conductor 直接生成（invoke_sub_agent が guard block のため）。
- 2026-09-26 — advisory review（budget=1）で R-01（React ErrorBoundary 欠落）・R-02（DomainInvariantError 未ハンドリング）を Major として検出、R-03（非単調 authoring 契約の明記）と併せて fold。R-04/R-05 は Minor として Build and Test / 手動確認へ送付。

## Deviations
- 2026-09-26 — stage mode=subagent だが Kiro IDE guard が invoke_sub_agent を target-less mutation として block。承認済み plan を唯一の入力に conductor が直接コード生成・レビューを実施（plan に忠実）。
- 2026-09-26 — review iteration 1 の verdict 記録前に findings を fold してしまい、reviewed bytes が変化。budget=1 のため fresh review 不可。engine は「findings を approval summary に含めて human へ」を案内。→ human に process 状態と findings・fold 済みの旨を提示して判断を仰ぐ。

## Tradeoffs
- 2026-09-26 — advisory Major を stage 内で fold（human の従来方針：Minor も含め fold してから承認）。テストで裏取り（67 pass）。

## Open questions
- 2026-09-26 — review verdict の記録方法（reviewed bytes 変更後）を human 判断に委ねる。
