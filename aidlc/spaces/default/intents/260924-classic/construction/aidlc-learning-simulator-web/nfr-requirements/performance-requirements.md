# Performance Requirements — U1: aidlc-learning-simulator-web

> static SPA（UI unit）の performance NFR。上流 NFR9（light performance）/ NFR1（体験時間）を per-unit `NFRx.y` へ具体化。数値だけでなく**再現可能な測定条件**を伴わせる。教育用途で厳密性は求めず、CI は可視化＋regression 監視を主体とし、環境ノイズだけで不安定になる厳格 gate にはしない。

## 要件（NFRx.y）

| ID | 要件 | Target | 測定条件 | 運用 | source |
|---|---|---|---|---|---|
| NFR9.1 | 初回 cold load → Home 表示 | ≤ 3 秒 | production build・通常ブロードバンド相当・同一 Lighthouse preset/条件・cold（cache 無効）・複数回測定の代表値 | Lighthouse 値を CI で可視化＋regression 監視 | NFR9, NFR1 |
| NFR9.2 | Scenario 開始 → 最初の DecisionPoint 表示 | ≤ 1 秒 | production build・固定環境・build-time 同梱データ（runtime fetch なし）・複数回代表値 | 可視化＋regression 監視 | NFR9, NFR1 |
| NFR9.3 | Decision 選択 → Feedback 表示 | ≤ 200ms | 自動テスト可能な固定環境で interaction latency 測定・決定的評価は同期純関数で軽量・複数回代表値 | 自動テスト＋regression 監視 | NFR9, FR4 |
| NFR9.4 | production 初期 JS bundle（gzip 後） | budget ≤ 300KB | production build の初期ロード対象バンドルの gzip サイズ | **budget target**（超過は即 fail でなく、依存追加/bundle 増加の理由を確認する運用も可）。CI で bundle size を可視化 | NFR9, NFR5 |

## 測定・検証方針

- **再現可能性を最優先**: すべての数値は「どの build・どの preset・どの環境・何回測定の代表値か」を明記した条件下で測定する。単発値を根拠にしない。
- **production build 対象**: dev サーバの数値は参考。合否判断は production build。
- **interaction latency（NFR9.3）** は自動テスト可能な固定環境で測る（決定的評価が同期・純関数のため、UI レンダリングを除けば安定）。
- **CI 運用**: Lighthouse スコアと bundle size を CI で可視化し、**regression（悪化）を監視**する。環境ノイズだけで CI を落とす厳格 performance gate は設けない。NFR9.4 は budget target であり、超過時は原因確認プロセス（依存追加・分割の要否）に載せる。
- **Determinism との関係**: performance 測定は評価の決定性に影響しない（測定は UI/計測レイヤー。scoring は time/random 非依存 = NFR2）。

## Non-goals（本 unit）

- サーバ throughput / 同時接続 / スループット SLA は該当なし（backend なし、C2）→ scalability 参照。
- 大規模データ処理性能は対象外（Scenario は少数の build-time asset）。

## Sources
- consumes: `../functional-design/functional-spec.md`（UC1/評価の同期性）, `../functional-design/rules.md`（BR3.x 決定的評価）, `../../../inception/requirements-analysis/requirements.md`（NFR9, NFR1）。
