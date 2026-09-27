# Monitoring Design — U1: aidlc-learning-simulator-web

> observability-design（NFR）を実装する platform-specific monitoring。**no-network posture** のため runtime telemetry/APM は持たず、外部送信しない。監視は (1) client 内の error visibility（アプリ内完結・外部送信なし）、(2) CloudFront/S3 の標準メトリクス（AWS 側で確認可能な範囲）、(3) CI の Lighthouse/bundle regression、(4) deploy 後の smoke verification に限定。MVP のため厳密な SLO/alert は設定しない。

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| CloudFront リクエスト数 | CloudFront 標準メトリクス（AWS Console/CloudWatch） | 目安（閾値監視は必須にしない） | 配信が到達しているかの基本確認 |
| 4xx エラー率 | CloudFront 標準メトリクス | 顕著な上昇を目視確認 | 参照切れ/権限誤設定（OAC/bucket policy）の兆候 |
| 5xx エラー率 | CloudFront 標準メトリクス | 顕著な上昇を目視確認 | origin/配信障害の兆候 |
| cache hit rate | CloudFront 標準メトリクス | 目安 | 配信効率（性能の間接指標） |
| 初回ロード/インタラクション性能 | CI の Lighthouse（NFR9.1〜9.3） | budget（regression 監視） | 体験性能の regression 検知 |
| 初期 JS bundle gzip | CI の bundle 分析（NFR9.4） | ≤300KB budget | bundle 肥大の regression 検知 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| （MVP: 常時 alert 設定なし） | — | — | — |
| deploy smoke failure | post-deploy smoke verification が失敗（root≠200 等） | blocking（deploy を成功としない） | deploy 実行者（Operation） |
| CI quality gate failure | lint/typecheck/test/build のいずれか失敗 | blocking（merge をブロック） | PR 作成者（GitHub Actions） |
| 4xx/5xx 顕著上昇（任意・手動確認） | CloudFront メトリクスの目視 | advisory | 運用者（手動） |

> 注: 常時稼働の real-time alert / on-call は MVP では設定しない（教育用・低トラフィック・no-network）。必要になれば Operation/後続で追加。

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| 公開 URL 可用性（応答するか） | 「公開 URL が HTTP 200 で応答する」の軽い確認（数値 SLO は MVP 未設定） | deploy 後 smoke ＋ 任意の手動確認 |
| 体験性能（load/interaction） | NFR9 の budget（regression 監視） | CI 実行時 |

厳密な availability SLO/error budget は MVP では設けない（NFR8 の honesty: 未計測の数値を掲げない）。

## Logs & Tracing

- **runtime のアプリログ/トレースを外部へ送らない**（no-network posture）。分散トレーシング/相関 ID 伝播は該当なし（外部呼び出しがない）。
- **client の error visibility**（アプリ内）: ErrorView（domain/application error の可読表示）・A11yLiveRegion（assistive technology への通知）・ErrorBoundary（想定外 render exception）。dev/test では console/test 出力で確認、production では外部送信しない。
- **配信ログ**: 必要に応じて CloudFront standard/access log を S3 に出力可能（PII を含めない・secret を残さない）。MVP では必須にしない。
- **Dashboard**: 専用 dashboard は MVP 不要。CloudFront 標準メトリクス画面と CI の Lighthouse/bundle レポートで代替。

## Deploy 後 smoke verification（Operation で実施）

| 確認項目 | 期待 |
|---|---|
| CloudFront root URL | HTTP 200 |
| index.html 取得 | 成功 |
| JS/CSS static asset 取得 | 成功 |
| Core Scenario 開始 | 可能 |
| security headers（CSP 等）存在 | 付与されている |
| SPA fallback（deep link/path routing を採用した場合のみ） | navigation route は 200 で index.html を返す。**static asset（.js/.css/.json/画像等）の 404 は 404 のまま**（200 に丸めない） |

Hackathon Evidence: CloudFront public URL・deployment 成功ログ・AWS 上で稼働が分かる画面（secret/account 情報は不要ならマスク）。

## Sources
- consumes: `../nfr-design/logical-components.md`（error visibility）, `../nfr-requirements/performance-requirements.md`（NFR9 測定条件）, `../nfr-design/security-design.md`（no-network posture）。
