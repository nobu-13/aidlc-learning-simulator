**Collaborator:** aidlc-developer-agent

## Contribution

lead draft の 5 セクションは方向として妥当で、trunk-based / squash-merge、
test-after + Vitest、GitHub Pages on merge、Prettier + ESLint + TS strict の
選択に異論はない。ただし developer レンズ（命名、レイヤー境界、error handling、
ファイル構成、code-style）で見ると、tech-stack が要求する「ロジックと Scenario
データの分離」が **原則の宣言に留まり、実装可能な境界として具体化されていない**。
決定性・テスト容易性・malformed JSON 耐性を担保するには以下を追記すべき。
いずれも Code Style / Testing Posture セクション、または discovered-rules への
反映を想定している。

### 1. フォルダ構成（`## Code Style` に追記）

feature ではなくレイヤー境界を可視化する構成が、この規模と「データ分離」要件に
最も適する。提案する既定レイアウト（相対パスは workspace root からのアプリコード）:

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

要点は「`/scenarios/*.json` はデータだけ」「`/domain` は
`/scenarios` も React も知らない」「JSON → ドメイン型の変換は `/data` の一箇所に
集約する」の 3 点。これにより tech-stack の分離原則が grep で検証できる境界になる。

### 2. JSON の型付きロード / 検証を trust boundary として明文化（`## Code Style` + Testing）

lead draft は「JSON をハードコードしない」までしか述べていないが、developer 観点の
核心は **JSON は untrusted な外部入力であり、境界で 1 回だけ検証してドメイン型に
変換する** という契約。これを明記したい:

- `import scenario from './x.json'` の型（TS の `resolveJsonModule` が付ける型）を
  そのまま信頼しない。`/data/schema.ts` で **実行時バリデーション**（推奨: `zod`。
  依存を増やしたくなければ手書きの type guard）を通し、成功時のみ `/domain` の型
  （`Scenario`）へ変換する。
- 境界を通過した後の `/domain` 内では再検証しない（boundary を信頼する）。これが
  scoring を純粋・小さく保つ前提になる。
- TS strict の含意: `strict: true` 下では `any` 由来の JSON を暗黙に受け入れられない
  ため、この境界変換は「あれば良い」ではなく **strict を満たすために事実上必須**。
  併せて `noUncheckedIndexedAccess` の有効化を推奨（Scenario の配列/選択肢アクセスで
  undefined 取りこぼしを型で防げる）。

### 3. 決定性を守るレイヤー境界（`## Testing Posture` の補強）

quality rules の「決定的 scoring」を **アーキテクチャで保証**する規約を足す:

- `/domain`（scoring・進行）は **純関数**とする。`Date.now()` / `Math.random()` /
  グローバル可変状態 / ネットワークを一切参照しない。時刻や乱数が必要なら
  呼び出し側から引数で注入する（dependency injection）。
- 入力の列挙順に結果が依存しないこと（順序非依存）を明示。
- これは Testing Posture の「同一入力→同一スコアを検証する unit test」を
  **実装側の制約として裏打ち**するもので、テストだけに依存しない。discovered-rules の
  `ALWAYS Scenario scoring を決定的にする` に対応する実装規約として evidence に
  記録すると traceability が閉じる。

### 4. malformed scenario JSON の error handling（現状ギャップ / interview 項目）

lead draft・discovered-rules のどちらも **不正な Scenario JSON をどう扱うか**を
規定していない。backend が無く外部 AI API も使わないため、実行時の主要な失敗モードは
「壊れた／スキーマ不一致の Scenario JSON」に集約される。方針を決めておくべき:

- 検証失敗は **fail fast / fail loud**。`/data/schema.ts` が `Result<Scenario,
  ScenarioValidationError>` を返すか、境界で明示的に throw し、UI 境界で捕捉して
  「この Scenario を読み込めません」と **可読なメッセージ**（どの Scenario / どの
  フィールドが不正か）を表示する。例外を握り潰さない（quality の精神に一致）。
- スコア計算中に不正値へ到達させない（境界検証済みが前提なので、domain 内での
  防御的コードは不要）。
- Scenario は教材データでビルド時同梱のため、CI に **全 `/scenarios/*.json` を
  schema で検証する軽量チェック**（Vitest で JSON をロードして検証）を入れると、
  壊れた教材が本番へ出るのを防げる。これは既存の CI ゲート方針に自然に乗る。

### 5. 命名・code-style の追記提案（`## Code Style`）

- ファイル名は kebab-case（`scenario-loader.ts`）、型は PascalCase
  （`Scenario`, `ScoreResult`）、関数は verb+noun（`calculateScore`,
  `advanceScenario`）、boolean は `is/has/can`（`isComplete`）。
- `data-testid` を主要インタラクティブ要素に付与（accessibility テストと将来の
  操作テストの安定化。lead draft の a11y 方針と整合）。命名は
  `{component}-{role}` の kebab-case。
- barrel/index の乱用を避け、公開 API 再エクスポート用途に限定する。

## Positions

- AGREE: trunk-based + squash-merge。小規模静的 SPA に長命ブランチは不要で妥当。
- AGREE: test-after + Vitest + 80% floor。仕様先行を義務づける根拠が rules に無く、org 既定に沿う。
- AGREE: GitHub Pages on merge、単一環境で手動承認ゲート無し。backend が無いため org の production 手動承認は非該当。
- AGREE: TS strict / Prettier / ESLint / jsx-a11y。
- OBJECT: 「ロジックとデータの分離」が原則宣言のみで、フォルダ境界・JSON の境界検証・domain 純関数化の実装規約が欠けている。§1〜3 の具体化を team-practices（Code Style / Testing）に反映すべき。
- OBJECT: malformed scenario JSON の error handling 方針が未定義。fail-fast + 可読メッセージ + CI での全 JSON schema 検証を規約化し、interview で扱い方（表示 UX・部分読み込みの可否）を確認すべき（§4）。
