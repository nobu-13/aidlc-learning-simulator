<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-25T23:10:00Z — performance NFR は「数値を置くだけ」でなく再現可能な測定条件（production build・同一 Lighthouse preset・固定環境の interaction latency・複数回代表値）を伴わせる。bundle size は budget target とし、環境ノイズだけで CI を不安定にする厳格 performance gate にはしない（regression 監視主体）。
- 2026-09-25T23:10:00Z — 「PII なし」と単純化しない。アプリは PII 入力を要求しないが、自由入力（DecisionRecord.note / Adoption memo）にユーザーが任意情報を書きうる。ゆえに security 要件は「外部送信しない・localStorage を機密保存先扱いしない・reset 可能」を明文化する。
- 2026-09-25T23:10:00Z — time/random 静的排除は domain/evaluation/semantic-ID 生成に限定（UI/perf 測定/test まで禁止しない、directory-specific ESLint override）。portability contract は byte-identical bundle ではなく「same application source + hosting-specific configuration」。
- 2026-09-25T23:10:00Z — service reliability artifact（N/A: backend なし）と client-side resilience requirement（存在: malformed fail-fast/partial invalid isolation/PersistenceError safe reset/deterministic error/application shell survival）を区別する。scalability/service observability は N/A。

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-09-25T23:30:00Z — advisory review iteration1=READY（Minor 3）を Request-Changes で反映。R-01 NFR7.5 の reset を NFR7.5（localStorage 非機密扱い）と NFR7.5a（user-triggered reset=本ステージ追加の privacy 要件、rationale=NFR7.3）に分離し BR6.x safe reset（error-recovery）と別概念化。R-02 traceability の NFR3/NFR4/NFR8 target を「functional-design 対応 BR で担保、本ステージは per-unit NFR として参照・検証条件を具体化」へ正確化。R-03 dependency 例外の記録先(repo 内 security/dependency exception 記録)・判断責任(maintainer/owner)・必須記録項目(package/advisory・severity・production impact・fix availability・理由・review/expiry)を明記（過剰 approval workflow は追加しない）。NFR1-9 全 coverage 維持。

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
