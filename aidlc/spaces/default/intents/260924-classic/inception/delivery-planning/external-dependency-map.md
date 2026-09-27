# External Dependency Map — AI-DLC Learning Simulator

> チーム外・system 外で進行を止めうる要因（外部 API・データ availability・承認 lead time・他チーム引き渡し）を、それを消費する Bolt に対応づける。self-contained な static SPA のため軽量。

## Runtime 外部依存

**なし。** backend / API / DB / 外部 AI API / runtime generative AI を持たない（C2 / C3 / OOS1 / OOS2 / NFR6）。Scenario JSON と locale は build-time 同梱で runtime fetch しない。したがって runtime の外部ブロッカーは存在しない。

## Build/Deploy 時の外部依存

> 注: **Construction の B9 は deployment readiness / evidence preparation まで**。実際の AWS への deployment execution は **Operation フェーズ（Deployment Execution）へ handoff**。下表の依存は主に「Operation での実配信」と「B9 での readiness/preflight」に関わる。

| 依存 | 所有者 | 概要 | 関わる slice / フェーズ | 遅延・不可時の対応 |
|---|---|---|---|---|
| AWS account / credential 利用可否 | 開発者（人間） | AWS へデプロイするための資格情報が利用可能な状態 | B9 preflight（readiness）／実配信は Operation | 利用不可なら readiness を整えたうえで実配信を保留し、審査後配信先の GitHub Pages を暫定代替（同一 bundle、hosting 差異は config のみ） |
| S3 / CloudFront デプロイ権限 | 開発者（人間） | 静的サイトの配信リソースへの作成・更新権限 | B9 preflight／実配信は Operation | 権限不足なら最小権限ポリシーを用意、または GitHub Pages で暫定公開 |
| Kiro から AWS 操作できる状態 | 開発者（人間）／環境 | Kiro セッションから AWS CLI/デプロイ操作が可能 | B9 preflight／実配信は Operation | 不可なら手動デプロイ手順を用意し evidence を別途取得 |
| Hackathon 用 deployment evidence 取得方法 | 開発者（人間） | 公開 URL・デプロイログ等の evidence 取得手段 | B9（capture plan）／取得は Operation | 取得方法が未確定なら B9 preflight で確定させる |

## Preflight（Construction 序盤に確認・実 deployment 前倒しではない）

上記 Build/Deploy 依存は、後段で「初めて発覚」するのを避けるため、**Construction 序盤に preflight 確認のみ**を行う（AWS account/credential・S3/CloudFront 権限・Kiro からの操作可否・evidence 取得方法）。これは B9 readiness slice の前倒しでも実 deployment でもなく、実行可能性の事前確認に限る。

## Construction → Operation の handoff（重要）

- Construction の **B9 = AWS Deployment Readiness & Evidence Preparation**（production build・config/IaC・CloudFront+S3 readiness・smoke-test plan・preflight・evidence capture plan・secrets 非露出確認）。
- **実際の AWS への deployment execution は Operation フェーズ（Deployment Execution）へ handoff** する。公開後 smoke・公開 URL 確定も Operation。

## 承認境界（重要）

- **AI-DLC Completion Approval**（このワークフローの各 gate/Construction 完了）と **AWS Release Approval**（本番公開の判断）は **別物**として扱う（C6）。B9 readiness の完了は前者であり、後者（実配信・公開判断）を自動的に意味しない。

## secrets 取り扱い

- credential/secrets は repo にも evidence にも含めない。evidence は公開 URL・ログ等の非機微情報に限る。
