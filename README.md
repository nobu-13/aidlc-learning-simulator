# AI-DLC Learning Simulator

AI-DLC (AI-Driven Development Life Cycle) を 5〜10 分で体験的に学習できる、教育用の
決定的 (deterministic) Simulator です。ブラウザだけで完結します。

## Purpose

AI-DLC の意思決定プロセスを、シナリオ形式で疑似体験しながら学ぶための教材です。
ゲーム性や演出よりも「判断理由を説明でき、実業務への導入を議論できる」学習価値を優先しています。

## Current Status

**Pre-RC2 Baseline** — 最初の公開ベースラインです。今後 RC2 で学習体験と UI/UX の
再設計を予定しています。このリポジトリはその改修前の状態を記録したものです。

## Highlights

- **Deterministic scoring**: 同じ入力に対して常に同じ評価結果を返します（乱数・外部 AI 非依存）。
- **バックエンド / ランタイム AI なし**: すべてクライアントサイドで完結。ユーザー登録・DB・外部 AI API を使用しません。
- **ja / en 対応**: 日本語・英語の両方で学習できます。
- **公開実績**: AWS CloudFront + プライベート S3 (OAC) 構成で静的サイトとして配信した実績があります。

## Tech Stack

- React 18 / TypeScript (strict mode)
- Vite (静的 SPA ビルド)
- Zod (シナリオデータのスキーマ検証)
- Vitest / Testing Library (ユニットテスト)

Scenario は JSON で管理し、アプリケーションロジックとデータを分離しています。

## Local Setup

前提: Node.js 20 系

```bash
npm install      # 依存関係のインストール
npm run dev      # 開発サーバー起動 (Vite)
```

## Test / Build

```bash
npm test         # ユニットテスト (vitest run src/)
npm run lint     # ESLint (a11y ルール含む)
npm run typecheck # TypeScript 型チェック (tsc --noEmit)
npm run build    # 型チェック + プロダクションビルド
```

## Built with AI-DLC

このプロジェクトは AI-DLC (AI-Driven Development Life Cycle) ワークフローで開発しました。

- **AI-DLC version**: v2.9.0
- **Harness**: Kiro IDE

AI-DLC のフレームワーク一式 (agents / skills / tools などの runtime) は公式 AI-DLC から
再生成できるため、このリポジトリには vendor していません。開発の意思決定・成果物 (requirements /
design / traceability など) は `aidlc/spaces/default/` 配下に Evidence として保持しています。

本プロジェクト固有の Kiro Steering を公開しています。開発方針の参考にどうぞ:

- [`.kiro/steering/product.md`](.kiro/steering/product.md) — プロダクト方針
- [`.kiro/steering/quality.md`](.kiro/steering/quality.md) — 品質方針
- [`.kiro/steering/tech-stack.md`](.kiro/steering/tech-stack.md) — 技術スタック方針

## Learning Content

シナリオと学習コンテンツの棚卸しは
[`evidence/product-review/learning-content-inventory.md`](evidence/product-review/learning-content-inventory.md)
を参照してください。

> 詳細な RC2 Motivation / redesign history は、後続の `docs/rc2-baseline-audit` の
> Pull Request で追加します。

## License

[MIT-0 (MIT No Attribution)](LICENSE) — Community から再利用しやすい OSS 成果物として公開しています。
サンプル・シナリオ・実装を自由に再利用できます。
