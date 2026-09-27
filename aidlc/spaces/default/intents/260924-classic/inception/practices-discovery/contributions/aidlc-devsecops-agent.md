**Collaborator:** aidlc-devsecops-agent

## Contribution

DevSecOps の観点でリードのドラフトを独立にレビューしました。対象は backend・DB・
認証・シークレット・外部 AI API を持たない静的クライアントサイト SPA（React +
TypeScript + Vite / GitHub Pages）です。この形態では攻撃面の大半（サーバ側の
認可、データ層、シークレット管理、DAST 対象のランタイム）が存在しないため、
セキュリティは **サプライチェーンと CI パイプラインの健全性** に集約されます。
教育用 MVP なので過剰装備は避け、低コストで効果の高い項目のみを推奨します。

ドラフトは lint/format/strict/CI ゲートの骨格は妥当です。以下は主に欠落項目の
追加提案で、リードが `team-practices.md` の該当セクションへ直接統合できる形で
記述します。

### 1. 依存関係の脆弱性スキャン（欠落 — 追加を推奨）

現状のドラフトには dependency scanning への言及がありません。静的サイトでも
npm 依存ツリー（React・Vite・ビルドツールチェーン）が唯一かつ最大のリスク源です。
proportionate な最小構成として次を推奨します。

- **`npm audit` を CI に組み込む**（`vite build` の前段、lint/test と同列）。
  `npm audit --audit-level=high` とし、High/Critical を検出したらジョブを失敗
  させる。Low/Moderate は警告に留め、教育 MVP の速度を落とさない。
- **Dependabot を有効化**（`.github/dependabot.yml`）。`npm` エコシステム対象、
  週次更新、GitHub 標準の脆弱性アラートを利用。GitHub Pages リポジトリなら
  追加コストゼロで導入可能。
- SBOM 生成やコンテナスキャンはこの形態（コンテナ無し）では **不要**。導入しない
  ことを明記して過剰装備を避ける。

`team-practices.md` の `## Deployment` の CI ステップ列（`npm ci` → lint → test →
`vite build`）に `→ npm audit (high/critical でブロック)` を挿入することを提案します。

### 2. Lockfile 規律と再現可能ビルド（部分的に有り — 明文化を推奨）

ドラフトは CI ステップで `npm ci` を使っており、これは正しい選択です（lockfile
に忠実で、意図しない依存ドリフトを防ぐ）。ただし方針として明文化されていない
ため、`## Deployment` または `## Code Style` に次を追記することを提案します。

- **ALWAYS `package-lock.json` をコミットし、CI では `npm install` ではなく
  `npm ci` を使用する**（lockfile 逸脱時に失敗させる）。
- ローカル開発でも lockfile を更新目的以外で書き換えない。

### 3. 依存バージョンの固定（tech-stack rule と整合 — 明文化を推奨）

供給網リスクとビルド再現性のため、直接依存は範囲指定（`^`/`~`）ではなく
**exact version でのピン止め**を推奨します。lockfile があれば推移的依存は固定
されますが、直接依存の exact pin は「意図しないメジャー/マイナー取り込み」を
`package.json` レベルで防ぎ、教育コンテンツとしての再現性も高めます。
`## Code Style`（依存管理方針）へ 1 行追加を提案します。

### 4. Typosquatting / 供給網の最小防御（interview 確認事項）

新規パッケージ追加時に **正規のパッケージ名・publisher・週間ダウンロード数を
確認する**という軽量な運用ルールを推奨します。ツール導入は不要で、レビュー
観点として `evidence.md` の運用メモに残す程度で十分です。

### 5. GitHub Actions の最小権限（欠落 — セキュリティ上重要）

Deployment セクションは GitHub Actions で Pages へ公開する方針ですが、
**ワークフローの `permissions` が未指定**です。デフォルトの広い write 権限は
供給網侵害時の被害を拡大させるため、明示的な最小権限を必須とすることを強く
推奨します。`## Deployment` に次を追記してください。

- ワークフロー先頭で最小権限を宣言する:
  ```yaml
  permissions:
    contents: read
    pages: write
    id-token: write   # actions/deploy-pages の OIDC に必要
  ```
- Pages デプロイは公式 `actions/deploy-pages` を使用し、`GITHUB_TOKEN` の
  自動発行トークンのみで完結させる。**PAT やカスタムシークレットは作らない**。

### 6. シークレット管理（該当なし — 明記を推奨）

このプロジェクトは backend・API キー・DB 資格情報を持たないため、シークレット
ストア（Secrets Manager 等）は **不要**です。ただし「クライアントに配信される
バンドルへ機密値を埋め込まない（静的 SPA では全てが公開される前提）」という
原則は明記すべきです。加えて **secret scanning を軽量な backstop として有効化**
することを推奨します。

- GitHub の **secret scanning / push protection**（public repo は無料）を有効化。
- もしくは pre-commit の `gitleaks` を任意導入（MVP では push protection のみで可）。

### 7. SAST / DAST の位置づけ（proportionate な判断）

- **DAST は不要**。サーバ側ランタイムが無く、テスト対象の動的エンドポイントが
  存在しないため。導入しないことを明記して過剰装備を避ける。
- **SAST は ESLint で十分**。`eslint-plugin-jsx-a11y` に加え、任意で
  `eslint-plugin-security` 相当の観点を持てるが、教育 MVP では必須化しない。
  重量級 SAST（SonarQube/CodeGuru）は不要。

### interview で確認すべきギャップ

- CI に `npm audit` ゲートを入れる場合の閾値（High 以上でブロックで良いか、
  Moderate も含めるか）。
- Dependabot の更新頻度（週次で良いか）と自動マージの可否。
- GitHub Pages が repo サブパス公開か user/org サイトかで、Actions の権限や
  `base` 設定に差が出るため確定が必要（evidence.md の未解決点と重複）。
- 直接依存を exact pin にする方針をチームが受け入れるか（更新運用の手間との
  トレードオフ）。

## Positions

- AGREE: CI で `npm ci` を使う選択は lockfile 規律として正しい（明文化のみ追加）。
- AGREE: 単一の静的環境で production 手動承認ゲートを設けない判断は妥当（backend
  配信前提の org 既定は該当しない）。
- AGREE: DAST 無し・重量級 SAST 無しの暗黙の方針は形態に対して proportionate。
- OBJECT: dependency scanning（`npm audit` + Dependabot）の欠落。静的サイトでも
  npm 依存が唯一最大のリスク源であり、最小コストで導入できるため MVP でも必須と
  すべき。
- OBJECT: GitHub Actions ワークフローの `permissions` 未指定。最小権限
  （`contents: read` / `pages: write` / `id-token: write`）を明示すべき。
- OBJECT: 直接依存の exact-version ピン止め方針が未記載。tech-stack のロジック/
  データ分離・再現性の意図と整合するため明文化を推奨。
