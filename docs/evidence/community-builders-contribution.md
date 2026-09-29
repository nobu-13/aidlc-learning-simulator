# Community Contribution Evidence
# AI-DLC Learning Simulator

AWS Community Builders 応募時に Contribution URL として提示できる公開 Evidence です。
検証可能な事実と、Community が再利用できる中身に絞って記述します。

## Problem

Agentic Development では、Agent が成果物を生成すること自体だけでなく、その成果物を人間が

- Human Review
- Gate
- Rework
- Evidence
- Risk Acceptance
- Traceability

の観点でどう扱うかを理解する必要があります。しかし、これらを安全に、繰り返し体験できる教材は
まだ限られています。

## Contribution

AWS / AI-DLC を学ぶ開発者向けに、ブラウザから体験できる open-source の Learning Simulator を
公開しました。バックエンドも runtime AI も必要とせず、URL を開くだけで Human-in-the-loop の判断を
体験できます。

- Repository: <https://github.com/nobu-13/aidlc-learning-simulator>
- Release: <https://github.com/nobu-13/aidlc-learning-simulator/releases/tag/v1.0.0>
- Live Preview: <https://d1s9ig7adbe2qs.cloudfront.net>

## What the Community Can Reuse

- source code（React + TypeScript + Vite、MIT-0）
- deterministic state model
- Artifact review flow
- rework / revision model
- propagation model
- root finding / manifestation model
- Conditional Approval model
- Completion / Release separation
- Adoption Review outputs
- Training Gym（練習サーフェス）
- deployment IaC（CloudFront + private S3 の CloudFormation とスクリプト）
- validation methodology（[`validation-methodology.md`](validation-methodology.md)）

## Technical Depth

- **deterministic Artifact Generator** — 同じ Context から同じ Artifact を決定的に生成する。
- **versioned Artifact identity** — Artifact 全体の version (`artifactVersion`) と工程ローカルの改訂回数
  (`localRevision`) を区別し、content が変わるたびに version が進む。
- **root finding / downstream manifestation** — 見逃しが後工程で別の形として顕在化する構造。
- **direct lifecycle propagation** — 上流の解決/未解決が直接隣接する下流工程 (1-hop) の Artifact に伝播する。
- **Conditional Approval persistence** — 条件付き承認を first-class に保持し、下流・Completion・Release・Result まで引き回す。
- **Effective Scenario State** — 「今この Journey が到達している実効的な scenario 状態」を 1 箇所に集約した派生モデル。
- **structured Simulation Ground Truth** — 自由記述ではなく構造化入力（データ機密度・可用性・可逆性・承認要件など）が Ground Truth を決める。
- **local persistence** — 学習進捗をブラウザ localStorage に保存（外部送信なし）。
- **release / readiness model** — Completion と Release を別ゲートとして扱う。
- **Journey Outcome / Learner Evaluation separation** — 配送の帰結と学習者の判断品質を分離する。

## Validation

公開してよい事実のみ:

- 500 release-checkpoint tests（54 test files）が pass。
- typecheck / lint / build すべて PASS。
- 実装コンテキストと分離した blind product validation を実施。
- 意見が割れた finding は isolated-browser の targeted reproduction で裁定。
- live Preview の実 HTTP response でセキュリティヘッダーを検証。

（RC ごとの score 推移などの内部評価はこの公開 Evidence には含めません。）

## Community Value

Community Member は次のことができます。

- AI-DLC の Human Gate を体験しながら学べる。
- ブラウザで（インストール不要で）試せる。
- source を読める（MIT-0）。
- ローカルで再現できる（install / test / build）。
- state model を自分のプロジェクトに再利用できる。
- validation methodology を再利用できる。

## Why This Is More Than a Demo

「Kiro でアプリを作った」だけではありません。Product 自体に、

decision / state / rework / traceability / risk / evidence / release gate

がモデル化されており、Human-in-the-loop の意思決定そのものを学習・再現・拡張できる構造になっています。

## Links

- Repository: <https://github.com/nobu-13/aidlc-learning-simulator>
- Release: <https://github.com/nobu-13/aidlc-learning-simulator/releases/tag/v1.0.0>
- Live Preview: <https://d1s9ig7adbe2qs.cloudfront.net>
- Release Evidence: [`v1.0.0-release-evidence.md`](v1.0.0-release-evidence.md)
- Validation Methodology: [`validation-methodology.md`](validation-methodology.md)
