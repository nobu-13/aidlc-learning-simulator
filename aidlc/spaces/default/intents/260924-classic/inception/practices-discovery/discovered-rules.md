# Discovered Rules

> interview（`practices-discovery-questions.md` の `[Answer]:` と
> "Requested Changes Feedback"）で人が確定した **ハードな制約のみ** を列挙します。
> `## Mandated` は `ALWAYS ...`、`## Forbidden` は `NEVER ...` の形で記述します。
> 実践（working practice）は `team-practices.md` に記載し、ここには含めません。

## Mandated

- ALWAYS TypeScript strict を維持する。
- ALWAYS 日本語・英語の 2 言語を必須とする。
- ALWAYS Scenario data / domain logic / UI を分離する。
- ALWAYS 外部 Scenario JSON を境界で runtime validation する。
- ALWAYS Scenario scoring を決定的にする（同一入力は同一スコアを返し、乱数・時刻・順序に依存しない）。

## Forbidden

- NEVER 翻訳欠落を undefined や片言語混在のまま表示しない。
- NEVER 未実行テストを成功として報告しない。
- NEVER 教育用 simulation 値を実測値として表現しない。
- NEVER Secret / Credential / Token を Repository や Evidence へ保存しない。
- NEVER AI-DLC 工程完了承認と AWS Release Approval を同一視しない。
- NEVER Hackathon 用 AWS 接続 Evidence に機密情報を含める（Evidence から機密情報を除外する）。
- NEVER AWS 版と GitHub Pages 版で別実装を作る（同一の Source Code / Application を維持し、AWS 用と GitHub Pages 用に別実装を作らない。Deployment 設定や Hosting 固有設定の差異は許容する）。
- NEVER backend / DB / ユーザー登録 / 外部 AI API を追加する。
- NEVER MVP でゲーム性・演出を過剰に作り込む（学習価値を優先する）。
