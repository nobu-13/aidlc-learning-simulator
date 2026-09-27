# Team Practices — AI-DLC Learning Simulator

> interview で確定した **working practice** をまとめます（ハード制約は
> `discovered-rules.md`）。対象は backend を持たない静的 React + TypeScript +
> Vite の SPA で、Hackathon 審査中は AWS CloudFront を Official Live Application
> とし、審査終了後に GitHub Pages（リポジトリのサブパス
> `aidlc-learning-simulator`）で公開します。AWS 版と GitHub Pages 版は同一の
> Source Code / Application を使用し、Vite `base` 等の差異により build artifact
> が異なることは許容します（同一 build artifact であることは要求しません）。

## Way of Working

私たちは **trunk-based development** を採用します。すべての作業は短命な
feature branch を経由し、PR を開いて `main` へ **squash-merge** します。
個人開発であっても `main` への直接コミットは原則避けます。理由は、Hackathon
提出時に履歴・レビュー・変更理由を追いやすくするためです。

`main` は常にデプロイ可能な唯一のトランクであり、staging／production を分ける
ための長命なリリースブランチは持ちません。squash-merge により各作業単位が
`main` 上の 1 コミットになり、delivery-planning の作業単位系列に 1:1 で対応する
線形な履歴を保ちます。必要ならタグで版を記録します。

## Walking Skeleton

この scope（classic）は skeleton ceremony を前提としません。儀式化はせず、
最初の Bolt の中で **「Scenario JSON分離 → 1 Scenario完走 → Decision反映 →
結果表示」** の薄い縦切りを最初に通すことを実装順序の指針とします。これにより
tech-stack が要求するデータとロジックの分離を早期に検証できます。最初から全
Scenario や演出を作り込まず、薄い end-to-end のスライスを先に通します。

## Testing Posture

- **Methodology**: test-after
- **Ordering**: 純粋ロジックと UI は実装後にテストするが、deterministic core（scoring/evaluation・scenario transition・requirement coverage・approval boundary 判定・markdown 生成）はテストを実装と同時または先行して書く。
- **Test runner**: Vitest を使用します（Vite に対する慣用的なテストランナーで設定コストが最小）。カバレッジは `@vitest/coverage-v8` を用います。
- **Coverage**: 一律の line-coverage floor は置きません。コアの deterministic ロジックは **branch coverage を高めに維持し、コアの未検証分岐を残さない**ことを優先します。UI は主要 User Flow を重視し、行カバレッジ達成だけを目的としたテスト追加はしません。
- **決定性検証**: 「同一入力→同一スコア」に留めず、(a) 同一 Scenario 入力を反復実行しても同一スコアになること、(b) 入力配列の順序を入れ替えても結果が不変であること（順序不変性）、(c) scoring ロジック内の `Math.random` / `Date` / `performance.now` などランダム・時刻依存を ESLint（`no-restricted-globals` / `no-restricted-properties`）で静的排除すること、(d) 代表 Scenario ごとに意味のある golden 期待値を固定することを検証します（無検証の snapshot 更新はしない）。
- **JSON fixture 健全性テスト**: 同梱する全 `/scenarios/*.json` を境界の schema で実際にロード・検証するパラメタライズドテストを 1 本置き、データ追加時の壊れを CI で捕捉します。妥当な Scenario が通ること、必須フィールド欠落・型不一致・スコア重み範囲外が可読なエラーで弾かれることを検証します。
- **CI ゲート**: マージ前に CI で test / lint を実行し、失敗はマージをブロックします。Vitest は `--passWithNoTests=false` で運用し（テスト 0 件をグリーンにしない）、ログの目視ではなく `test` ステップの exit code をゲートにします。`.skip` / `.todo` 件数を可視化し恒常的な skip を放置しません。未実行テストを成功として報告しません。
- **テスト量**: `Test Strategy=Standard` の範囲（component あたり 5〜8 本の Unit + Integration、合計 ~20〜50 本）に収め、MVP では e2e を持ちません（ice cream cone を避ける）。

**Accessibility（working practice）**: WCAG 2.2 AA は「目標」として扱い、検証なしに準拠を主張しません。keyboard 操作・focus 表示・十分な contrast・色のみに依存しない表現・semantic HTML を基本方針とします。補助として主要画面のレンダリングテストに axe（axe-core ラッパー）を組み込み critical/serious 違反ゼロをアサートし、`@testing-library/user-event` で Tab 順・Enter/Space 起動・フォーカスを確認します。静的チェックとして `eslint-plugin-jsx-a11y` を併用します。ただし自動チェックは準拠の一部にすぎず、完全な準拠検証にはスクリーンリーダー等の手動確認が必要である旨を明記します。

## Deployment

CI として **GitHub Actions で install / lint / typecheck / test / build** を実行します。少なくとも test + lint の失敗はマージをブロックします。

サプライチェーンの最小防御を敷きます。

- `npm audit`（`--audit-level=high`）を CI に組み込み、High/Critical でジョブを失敗させる。Low/Moderate は警告に留める。
- Dependabot を週次で有効化（`npm` エコシステム対象）。
- GitHub Actions は最小権限で宣言し、CI とデプロイで権限を分離する:
  - 通常の CI（lint / typecheck / test / build。Pages へは公開しない）:
    ```yaml
    permissions:
      contents: read
    ```
  - GitHub Pages deployment（審査終了後の公開時のみ）:
    ```yaml
    permissions:
      contents: read
      pages: write
      id-token: write   # actions/deploy-pages の OIDC に必要
    ```
  Hackathon 審査中は GitHub Pages を公開しないため、通常 CI へ Pages deployment 権限（`pages: write` / `id-token: write`）を付与しない。最小権限を CI とデプロイで分離する。
- `package-lock.json` を commit し、CI では `npm ci` を使う（lockfile 逸脱時に失敗）。ローカルでも更新目的以外で lockfile を書き換えない。
- 直接依存の version を意図せず広げない（範囲の拡大やメジャー/マイナーの暗黙取り込みを避ける）。
- Secret / Credential / Token を Repository へ保存しない。静的 SPA は配信バンドルが全て公開される前提で、機密値を埋め込まない。GitHub の secret scanning / push protection を backstop として有効化する。

過剰な security tooling は追加しません（SBOM 生成・コンテナスキャン・DAST・重量級 SAST は本形態では不要と明記。SAST は ESLint で足りる）。

公開形態は次のとおりです。Hackathon 審査中の **Official Live Application は AWS CloudFront**、GitHub Pages は審査終了後に公開します。Vite の `base` はリポジトリのサブパス `aidlc-learning-simulator`（`https://<user>.github.io/aidlc-learning-simulator/`）に合わせます。AWS 版と GitHub Pages 版は **同一の Source Code / Application** を使用します。Hosting 固有設定や Deployment 設定の差異は許容し、Vite `base` 等の差異により **build artifact が異なることを許容します**（同一 build artifact であることは要求しません）。ただし AWS 用と GitHub Pages 用に **Application 本体を別実装することは禁止します**。ロールバックは `main` の以前のコミットへ戻して再デプロイします。

Hackathon 要件との分離を明記します。**AI-DLC の工程完了記録と AWS release approval は分離して記録**します。AWS 接続・Deployment 時には Hackathon 要件「coding agent connected to AWS console」の Evidence を必ず取得し、その Evidence に機密情報は含めません。

## Code Style

- **レイヤー境界**: feature ではなくレイヤーで分離します。
  ```
  /src
    /domain            # 純粋ロジックのみ。React も I/O も import しない
      scoring.ts       # スコア計算（純関数）
      scenario.ts      # Scenario 進行の状態遷移（純関数）
      types.ts         # Scenario / Question / Score などの型定義
    /data
      schema.ts        # JSON を検証しドメイン型へ変換する境界（唯一の入口）
      loader.ts        # JSON import + schema 検証を束ねる
    /scenarios         # Scenario データ（JSON のみ。ロジックを持たない）
      *.json
    /ui                # React コンポーネント。domain を呼ぶだけ
    /app               # 画面組み立て・ルーティング
  ```
  要点は「`/scenarios/*.json` はデータだけ」「`/domain` は `/scenarios` も React も知らない純関数」「JSON → ドメイン型の変換は `/data` の一箇所に集約」の 3 点で、分離原則を grep で検証できる境界にします。
- **JSON の境界検証**: `import scenario from './x.json'` の型（`resolveJsonModule` 由来）を信頼せず、`/data/schema.ts` で **境界で一度だけ runtime validation**（推奨: zod。増やしたくなければ手書き type guard）を通し、成功時のみ `/domain` の型へ変換します。境界通過後の `/domain` 内では再検証しません。TS strict 下では `any` 由来 JSON を暗黙に受け入れられないため、この境界変換は事実上必須です。`noUncheckedIndexedAccess` の有効化を推奨します。
- **malformed Scenario の扱い**: 検証失敗は fail-fast / fail-loud。どの Scenario / どのフィールドが不正かを示す可読なエラーを UI 境界で表示し、例外を握り潰しません。domain 内の防御的コードは不要（境界検証済みが前提）。
- **決定性の実装規約**: `/domain`（scoring・進行）は純関数とし、`Date.now()` / `Math.random()` / グローバル可変状態 / ネットワークを参照しません。時刻・乱数は呼び出し側から引数で注入（DI）します。入力の列挙順に結果が依存しないことを保証します。
- **Formatter / Linter**: Prettier をリポジトリ root で設定し、ESLint を CI でブロックゲートとして実行します。
- **TypeScript**: strict mode（`strict: true`）を有効にします。
- **命名**: ファイルは kebab-case（`scenario-loader.ts`）、型は PascalCase（`Scenario`, `ScoreResult`）、関数は verb+noun（`calculateScore`, `advanceScenario`）、boolean は `is`/`has`/`can`（`isComplete`）。主要インタラクティブ要素に `data-testid`（`{component}-{role}` の kebab-case）を付与します。barrel/index は公開 API の再エクスポート用途に限定します。
- **i18n**: 日本語・英語の 2 言語を必須とし、翻訳欠落による undefined 表示や片言語混在をしません。Scenario 内容と UI 文言を分離します。
- **教育値と実測値の区別**: educational simulation value と実測値を UI・データ上で明確に区別します。
- **監査可能性**: AI-DLC audit / artifacts / Git 履歴 / development log を後から分析可能な形で残します。
