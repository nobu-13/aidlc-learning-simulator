<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-24T08:10:00Z — 教育目的を「体験してフローを覚える」より「判断理由を説明でき、実業務導入を議論できる」水準に引き上げた。要求は単なる操作機能ではなく学習成果（説明可能性）と provenance 追跡性を第一級の要件として扱う。
- 2026-09-24T08:10:00Z — 「良い進め方」を単一スコアで測らず、9 つの Concept/Decision Dimension で説明する評価モデルに解釈。Human Intervention 過多も High Risk の過剰委任も「悪い」側に振れる非単調な評価が必要。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-25T01:05:00Z — 承認済み requirements を Change Control（strict）で再入・改訂。AI-DLC v2.10.0 リリースに伴い Learning Target baseline を v2.9.0→v2.10.0 へ。Dev Workflow Runtime は v2.9.0 維持。version の二重管理（教材基準 vs 実行環境）を A1 で明示分離した。
- 2026-09-25T01:05:00Z — v2.10.0 の差分はモデル知識で断定せず、公式 Release Notes を一次情報として影響分析。Release Notes に無い意味は補完しない方針を貫いた（provenance ルールに整合）。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-24T08:10:00Z — 5〜10 分の短時間体験 vs 教育的深さの緊張を、二層構造（Core End-to-End は時間内、Deep Dive は時間制限なし）で解消。短時間性を犠牲にせず深さを別レイヤーへ逃がす設計。

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-09-24T08:10:00Z — AI-DLC v2.9.0 の一次情報の参照形式（URL / doc パス / セクション ID）をどう sourceRefs スキーマに落とすかは domain-design で確定。
- 2026-09-24T08:10:00Z — Scenario / Decision / Score dimension の JSON スキーマ具体化は domain-design 以降。
- 2026-09-24T08:10:00Z — Adoption Discussion Sheet の Markdown 生成をクライアントのみで行う際のダウンロード/コピー UX は design で確定。
