# Build Instructions — aidlc-learning-simulator

> 単一 deployable unit（U1 = aidlc-learning-simulator-web）の static React + TypeScript + Vite SPA。backend なし。ローカルサービス不要。

## 依存関係のインストール

- Node.js（Vite 5 / Vitest 2 が動作する版。開発機は Node 20+ を想定）。
- lockfile を尊重してインストール（team Deployment 方針: `package-lock.json` を commit し CI では `npm ci`）:
  ```bash
  npm ci
  ```
  ローカルで依存を更新する目的が無い限り lockfile を書き換えない。

## 環境設定

- 環境変数・config ファイル・ローカルサービスは**不要**（no-network posture: application data/user input を外部送信しない）。
- hosting 差異は deployment configuration として `VITE_BASE` 環境変数で吸収（既定 `/`、GitHub Pages 等 subpath 配信時は `VITE_BASE=/<repo>/`）。AWS 用と Pages 用で別実装は作らない（NFR6）。Scenario / locale は build-time 同梱（runtime fetch なし）。

## ビルドコマンド

- 型チェック + production build（`build` script が `tsc --noEmit && vite build`）:
  ```bash
  npm run build
  ```
- 型チェック単体:
  ```bash
  npm run typecheck
  ```
- Lint（CI ブロックゲート）:
  ```bash
  npm run lint
  ```
- ローカルプレビュー（production build の確認）:
  ```bash
  npm run preview
  ```

## ビルド検証

- `npm run build` が exit 0 で、`dist/` に `index.html` + `assets/*.js` + `assets/*.css` が生成されること。
- 初期 JS bundle（gzip）が NFR9.4 の budget（≤300KB）内であること。現状 **~74KB gzip**。
- `dist/` の JS に inline script が無いこと（Vite production build・CSP 厳格化のため `assetsInlineLimit: 0`）。

## よくあるビルド問題のトラブルシューティング

- **`tsc` が strict エラー**: `exactOptionalPropertyTypes` により optional プロパティへ `undefined` を明示代入する箇所は型に `| undefined` を含める。`noUncheckedIndexedAccess` により配列添字アクセスは `undefined` ガードを入れる。
- **`vite build` で JSON import の型エラー**: `resolveJsonModule` が tsconfig で有効か確認。Scenario JSON は `/data/schema.ts` の zod 境界で runtime validation するため、import 型は信頼しない。
- **lockfile 逸脱で `npm ci` 失敗**: `package.json` と `package-lock.json` の整合を確認（意図的更新時のみ `npm install` で lockfile を更新）。

## Sources
- consumes: `../aidlc-learning-simulator-web/code-generation/code-summary.md`, `../aidlc-learning-simulator-web/code-generation/code-generation-plan.md`, `../aidlc-learning-simulator-web/nfr-design/performance-design.md`（NFR9 budget）, `../../inception/infrastructure`…（VITE_BASE / hosting 方針）。
- team Deployment（npm ci / lockfile / 最小権限 CI）, project Forbidden（AWS版/Pages版 別実装しない）。
