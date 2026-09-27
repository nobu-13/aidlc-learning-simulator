**Collaborator:** aidlc-quality-agent

## Contribution

quality の観点から lead ドラフトの Testing Posture・CI ゲート・テスト種別・カバレッジ運用を精査しました。全体としてドラフトは妥当ですが、決定性検証の厳密化、カバレッジ運用の現実性、テスト種別の具体化、CI ゲートの整合性で補強と修正が必要です。以下は lead がそのまま統合できる形で記述します。

### 1. Methodology は test-after で妥当。ただし決定的 scoring だけは test-first を推奨（Ordering の明示強化）

quality rules は仕様先行を義務づけておらず、org 既定の test-after を採用する判断は正しい。決定的 scoring があるからといって全面 TDD を強制する根拠にはならない。ただし **Scenario scoring だけは例外的に test-first（またはテストと実装を同時）を推奨**したい。理由は次の通り。

- scoring は「決定的であること」が明示的なハード制約（discovered-rules の `ALWAYS Scenario scoring を決定的にする`）であり、決定性は後付けテストで担保しにくい（乱数・`Date.now()`・`Map`/オブジェクトキー順・浮動小数の累積順序など、実装後に混入すると検知が遅れる）。
- 期待スコアを golden value として先に固定しておくと、リファクタや Scenario 追加時のリグレッションを確実に捕捉できる。

Ordering 文を次のように具体化することを提案する（Methodology は `test-after` のまま、scoring の例外を Ordering に一文追加）:

> **Ordering**: 純粋ロジック（Scenario scoring・進行判定）を実装し、そのレイヤーのテストを書いて実行してから UI に進む。ただし scoring については決定性・期待スコアを検証するテストを実装と同時（可能なら先行）に用意する。

Methodology を `custom` に変える必要はない（cadence の主軸は test-after で一貫しており、scoring 例外は Ordering の一文で表現できる）。この点は interview で「scoring だけ先にテストを固定してよいか」を一問確認すれば足りる。

### 2. 決定性テストの検証内容が「同一入力→同一スコア」だけでは弱い（補強）

ドラフトの Deterministic scoring 項は「同一入力に対して同一スコアを返す」検証にとどまる。同一プロセス内の再実行が同じ値を返すのは当然で、非決定性の実際の混入源を突けない。次の観点を Testing Posture に追記することを推奨する。

- **禁止依存の静的排除**: scoring ロジック内で `Math.random` / `Date` / `performance.now` を禁止し、ESLint ルール（`no-restricted-globals` / `no-restricted-properties`）または純粋関数への外部注入で担保する。
- **反復・順序不変性**: 同一 Scenario 入力を N 回、および入力配列の順序を入れ替えて実行しても同一スコアになることを検証する（`Object.keys` 順やイベント適用順への依存を検出）。
- **golden / snapshot**: 代表 Scenario ごとに期待スコアを固定値としてテストに埋め込む（Vitest の `toMatchInlineSnapshot` ではなく、意味のある固定期待値を推奨。snapshot の無検証更新は決定性の検証を骨抜きにする）。

### 3. JSON schema validation はランタイム検証とテストの両方が必要（テスト種別の具体化）

ドラフトは「JSON バリデーション」に unit test を挙げるが、Scenario がデータ／ロジック分離の中核である以上、検証戦略を具体化したい。

- **ランタイム/ビルド時スキーマ検証**: Scenario JSON を型付きでロードする境界に schema 検証（Zod / Ajv 等）を置き、不正な Scenario を早期に弾く。決定するのは interview 事項だが、quality の推奨は「実行時に一度だけ検証する軽量なもの」。
- **テスト**: (a) 妥当な Scenario が通ること、(b) 各必須フィールド欠落・型不一致・スコア重み範囲外が明確なエラーで弾かれること。同梱する全 Scenario JSON をパラメタライズドテストで実際にロード・検証する「fixture 健全性テスト」を 1 本入れると、データ追加時の壊れを CI で捕捉できる。

### 4. accessibility テストは静的 lint だけでは不十分（補強）

Code Style 側で `eslint-plugin-jsx-a11y` を挙げているのは良いが、これは静的解析で WCAG 全体は検証できない。Testing Posture に次を追記することを推奨する。

- **自動 a11y アサーション**: 主要画面のレンダリングテストに `vitest-axe`（axe-core ラッパー）を組み込み、深刻度 critical/serious の違反ゼロをアサートする。
- **キーボード操作テスト**: ドラフトの「キーボード操作とラベル付け」観点を、`@testing-library/user-event` による Tab 順・Enter/Space 起動・フォーカストラップの明示テストとして具体化する。
- **限界の明記**: 自動チェックは WCAG 準拠の一部に過ぎず、完全な準拠検証にはスクリーンリーダー等の手動確認が必要である旨を evidence に残す（`quality` rule と accessibility 配慮の誠実な範囲宣言）。interview で「狙う WCAG レベル（A / AA）」と「MVP 内の必須範囲」を確定させたい（evidence の未解決点と一致）。

### 5. 80% line-coverage floor は MVP に対して過大かつ指標として弱い（修正提案）

`Test Strategy=Standard` の小規模教育用 MVP に対し、org classic 既定の **80% line-coverage floor をそのまま「緩められない」と固定するのは過大**であり、product rule の「学習価値優先・過剰な作り込みを避ける」と緊張する。加えて line coverage は指標として弱い。提案は次の通り。

- **リスクベースの二段カバレッジ**にする。scoring・Scenario 進行・JSON 検証などのコアロジックは高め（例: branch 90%）を必達とし、UI/配線層はより低い line floor（例: 60〜70%）に留める。単一の 80% line floor よりも学習価値と労力配分が合う。
- floor の主指標を **line ではなく branch coverage** に寄せる（scoring の分岐が本質的リスク）。
- 「緩められない（この floor は緩められません）」という断定は、affirmation で人が決めるべき事項を先取りしている。**interview で floor 値と対象範囲を確定する**未解決点として明示すべき（現ドラフトはこれを既定として固定してしまっている）。

いずれにせよ Vitest の `coverage`（`@vitest/coverage-v8`）を使い、CI で閾値をゲート化する運用自体は妥当。

### 6. CI ゲートが state のスコープと矛盾（重要・要整合）

`aidlc-state.md` では `ci-pipeline (3.7)` および Operation フェーズ全体が **SKIP** されている。にもかかわらず team-practices の Testing Posture・Deployment・Code Style は「CI でテスト／lint を実行しマージをブロック」「GitHub Actions で `npm ci → lint → test → vite build → Pages 公開`」と、実質的な CI/CD パイプラインを規定している。これは実践の記述としては正しい方向だが、**このワークフローでは ci-pipeline / deployment-pipeline ステージが動かないため、パイプラインを構築する実装ステージが存在しない**という不整合になる。

- lead は Deployment/CI の記述を「チームの意図する実践」として team-practices に残すのは適切。ただし evidence に「ci-pipeline と Operation が scope=classic で SKIP のため、CI/Pages ワークフローの実装は本ワークフローの対象外であり、別途手動整備が前提」である旨を明記すべき。
- あるいは interview で「CI ゲートと Pages デプロイを MVP スコープ内で実際に構築するか」を確認し、必要なら scope 調整（`--stage` 追加）を人に委ねる。quality としては CI ゲート（少なくとも test + lint のマージブロック）は決定性・「未実行を成功と報告しない」制約を機械的に守る唯一の手段なので、**何らかの形で自動ゲートを持つこと**を強く推奨する。

### 7. 「未実行テストを成功と報告しない」を CI で機械的に担保する具体策（追記提案）

これはハード制約（discovered-rules `NEVER 未実行のテストを成功として報告する`）だが、ドラフトは方針表明のみ。次の機械的担保を Testing Posture に足すと制約が実効化する。

- Vitest 実行を `--passWithNoTests=false`（既定でテスト 0 件を失敗扱い）で運用し、テスト未検出＝グリーンを禁止する。
- CI ではテスト結果とカバレッジの成果物を必ず出力し、`test` ステップの exit code に対してのみマージ可否を判定する（ログの目視ではなく exit code をゲートにする）。
- スキップ済みテスト（`.skip`/`todo`）の件数を CI で可視化し、恒常的な skip を放置しない。

### 8. 軽微

- Testing Posture の「UI コンポーネントには最小限のレンダリング／操作テスト」は方向として妥当。テスト量は `Test Strategy=Standard`（component あたり 5〜8、Unit+Integration、~20〜50 本）の範囲に収め、e2e は MVP では持たない（ice cream cone 回避）という上限を一文添えると、過剰作り込み回避の product rule とも整合する。
- テストランナー既定 Vitest は Vite プロジェクトとして妥当。interwith での選好確認は残してよいが、既定として問題ない。

## Positions

- AGREE: Methodology=test-after の採用（quality rules は仕様先行を義務づけておらず、org 既定に従うのが正しい）。
- AGREE: Scenario scoring の決定性を unit test で検証する方針（ハード制約に直結する中核テスト）。
- AGREE: Vitest を既定ランナーにする判断（Vite への慣用ランナーで設定コスト最小）。
- AGREE: マージ前 CI でテスト実行・失敗ブロック、未実行を成功と報告しない方針（自動ゲート化を強く支持）。
- OBJECT: 80% line-coverage floor を「緩められない」既定として固定している点 — 小規模教育 MVP には過大かつ line は指標として弱い。branch 主指標＋コア/UI の二段閾値にし、floor 値は interview で確定すべき（人の判断事項の先取り）。
- OBJECT: 決定性テストが「同一入力→同一スコア」検証のみに留まる点 — 反復・順序不変性、禁止依存（random/time）の静的排除、golden 期待値を欠くと非決定性の実混入を捕捉できない。
- OBJECT: CI/Pages パイプラインを実践として規定しながら、state で ci-pipeline と Operation が SKIP である不整合が未記載 — evidence への明記か、scope 調整の interview 確認が必要。
- OBJECT: accessibility テストが静的 lint（jsx-a11y）中心で、自動 a11y アサーション（axe）とキーボード操作テスト、および自動検証の限界宣言が欠けている点。
