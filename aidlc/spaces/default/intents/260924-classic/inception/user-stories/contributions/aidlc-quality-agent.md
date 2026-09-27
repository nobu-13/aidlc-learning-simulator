**Collaborator:** aidlc-quality-agent

## Contribution

品質（AC の testability）観点でのレビュー。各所見は integrable な粒度で、US/AC ID を参照して記述する。

### 1. 決定性 AC（AC2.2.4 / AC7.4.1 / AC7.4.2） — 概ね良好、契約の明示化を推奨

- **AC7.4.1** は「複数回・入力順を変えて実行 → Dimension 結果は常に同一（random/time 非依存、順序不変）」で、posture の determinism 検証（repeat + order-invariance + no random/time）を Given/When/Then として観測可能な形に落とせている。自動化可能。**追加提案（integrable）**: golden（凍結した期待 Dimension 結果）との一致も検証対象に含めることを AC の観点として明記すると、posture が要求する golden を AC にも接続できる。文言例（AC7.4.1 に追記可）: 「…Then Dimension 結果は常に同一であり、凍結した golden 期待値と一致する」。
- **AC2.2.4** は局所的な決定性（同一 Scenario・同一 Decision sequence を 2 回）で自動化可能だが、「2 回」に限定した表現が repeat 回数・順序不変性の担保として AC7.4.1 より弱い。US2.2 は局所例示、US7.4 が横断契約という役割分担は妥当（traceability.json の NFR2 note と整合）なので、**AC2.2.4 の脚注として「決定性の完全契約は AC7.4.1 で担保」を 1 行添える**とテスト設計の重複/齟齬を避けられる。
- **AC7.4.2**（「Dimension への影響は deterministic な rule/data として表現され、UI に暗黙の評価ロジックが無い」）は FR5.4.2 に対する強い testability 契約で、評価エントリポイントが純関数（UI 非依存）であることを test で assert できる。**この AC は維持を強く推奨**。テスト戦略上、評価ロジックは UI 層から import されない構造テスト（依存方向の検査）で observ 可能。

### 2. provenance-distinction（AC7.3.1 / AC7.3.2 / AC2.2.3 / AC2.4.3 / AC5.2.2 / AC5.3.2） — データ層は testable、UI 層の識別面が曖昧

- **AC7.3.1**（data meta が `learningObjective / concept / sourceRefs / interpretationNote / simulationAssumptions` を持つ）は JSON fixture health test で決定的に自動検証できる。**testable。良好。**
- **AC7.3.2 / AC2.2.3 / AC2.4.3**（「出典を確認できる / 識別できる」「必要に応じて識別できる」）は、**観測可能な assertion 面が未特定**のため現状のままでは自動テスト化しづらい。「識別できる」を検証するには、(i) `sourceRefs` の各エントリが 4 区分（`ai-dlc-spec` / `harness-behavior` / `simulator-interpretation` / `simulation-assumption`）を列挙型（enum）で持つ、または (ii) 重要 Decision Point の Explanation UI に区分ラベルが render される、のいずれかの**チェック可能な surface**が AC 側に必要。**提案（integrable）**: AC7.3.2 を「…Then AI-DLC specification / harness behavior / Simulator Interpretation / Simulation Assumption を表す区分値（enum）を持ち、UI 上で当該区分ラベルが確認できる」と具体化すると、fixture 検証（enum 値の妥当性）+ user-event/axe による UI ラベル存在検証の両方に落とせる。schema 具体は OQ2/domain-design 送りで良いが、「区分は enum で表現し観測可能」という**契約だけは AC に固定**したい。
- 「必要に応じて（as-needed）」という条件語は、どの Decision Point で必須かがテスト時に判定不能。FR6.6/FR6.7 が「重要 Decision Point では**必須**」と定義済みなので、**AC 側でも重要 Decision Point については無条件（必須）と書く**（AC2.4.3/AC5.2.2/AC5.3.2 は既に v2.10.0 一次情報必須で妥当）。

### 3. 「説明される」系 AC のテスト可能性（AC2.1.1 / AC2.2.2 / AC2.4.1 / AC2.4.2 / AC2.5.1 / AC2.5.2 / AC3.1.1）

- これらは「なぜ適切/不適切か…が説明される」等、**説明の内容**を規定するが、自動テストが確認できるのは通常「説明領域が render され、要求された構造スロットが存在するか」まで。文章の教育的妥当性は Early User Test（定性）側の担当で、自動化対象ではない。**この分離自体は正しい**（NFR1 が定性目標）。
- ただし testability を上げるため、**説明 AC には「観測可能な構造スロット」を列挙する**ことを推奨。特に **AC3.1.1** は既に結果画面の提示項目（Decision Timeline / Consequences / Stage 対応 / Concept / Boundary / Approval Boundary / Rework 理由 / Remaining Risks / Better Alternative / Reference / 次の Focus）を列挙しており、**これらは各スロットの存在を DOM/データで assert 可能で良好**。同様に **AC2.2.2** の列挙（Concept・Risk・Evidence・Approval Boundary・Human Intervention 要否理由・委任可否理由）も構造スロット化されており testable。**AC2.4.1/2.4.2/2.5.1/2.5.2 は「説明される」だけで構造スロットが不明**なので、最低限「boundary と gate が別ラベル/別セクションとして提示される」「混同時リスクが専用スロットに提示される」等、**確認可能な要素の粒度に落とす**と自動化可能になる。

### 4. Coverage gap（sad path / edge case）— 追加 AC を提案

- **言語切替 × Decision Outcome 不変（FR10.4）**: AC1.1.3 は「進捗・Decision・結果・メモを失わない」を担保するが、**言語を切り替えても Decision Outcome / Dimension 結果が一致する（FR10.4「意味・結果の一致」）ことを assert する AC が無い**。決定的評価が言語非依存であることは testable な重要契約。**提案**: US1.1 か US7.4 に「Given 同一 Scenario・同一 Decision、When 言語のみ切替、Then Decision Outcome と Dimension 結果は言語間で一致」を追加。
- **言語切替のタイミング（mid-decision / mid-Focus）**: AC1.1.3 は「学習の途中」で概ね網羅するが、Decision 確定直前・Focus Scenario 途中など**状態遷移の途中での切替**を明示するとエッジが締まる（任意）。
- **malformed JSON が mid-scenario で顕在化**: AC8.2.1/8.2.2 は**ロード時**の validation を担保するが、**スキーマは通ったが実行途中で参照する field が欠落/不整合**なケース（部分的破損・遅延検出）への挙動が未規定。FR12.1「無言停止させない」は runtime 全般に及ぶため、**「Given scenario 進行中に不整合を検出、When 続行不能、Then 可読エラーを表示し silent fallback しない」AC を US8.2 に追加**推奨。
- **空の Focus Scenario Library**: AC5.1.1 は「1 つを選ぶ」前提で、**ライブラリが空（MVP で 0 本の状態）**の表示挙動が未規定。OQ5 で初期本数未確定である以上、**空状態の可読な扱い**（クラッシュしない・空である旨提示）を AC 化しておくと edge が塞がる。
- **localStorage の異常系**: AC7.2.1 は正常 reload のみ。**破損した永続化データ / スキーマ不一致 / quota 超過 / 値欠落**時に無言破綻しない挙動が未規定。FR11/FR12 の「無言停止しない」精神に沿い、**「Given 破損/不整合な localStorage、When 起動、Then クラッシュせず安全に初期化 or 可読に通知」AC を US7.2 に追加**推奨。
- **翻訳キーの網羅**: AC1.1.4「翻訳欠落による undefined 表示や混在が無い」は良い契約だが、**検証手段（ja/en のキー集合一致を検証する fixture/parity test）**が AC 上で示唆されると自動化が明確になる（任意の注記）。

### 5. Educational Effectiveness / NFR1 の traceability 誠実性 — 良好

- traceability.json の NFR1 note（「定性目標で単一 Story では検証しない」「coverage の存在は Verification 済みを意味しない」）と、上部 note（`Traceability != Verification`）は **honest**。posture（pass-rate/有意性を要求しない・誇張しない・NFR8）と整合。**この誠実さは維持を強く推奨。**
- Early User Test (a)-(f) の AC/Learning Outcome への traceability は確認でき、追跡可能:
  - (a) Lifecycle → US2.1 / US3.1
  - (b) Human/Agent Boundary → US2.4 / US3.1
  - (c) Human Review と委任の使い分け → US2.2 / US3.2
  - (d) 工程完了承認 vs Release Approval → US2.5
  - (e) Evidence 不足時の確認 → US3.1 / US5.3
  - (f) 導入時の議論項目 → US4.1 / US6.1
  各項目が具体 Story に着地しており、traceable。**ただし (a)-(f) は Given/When/Then で自動化する対象ではなく定性 Early User Test 項目**である旨を、これらを参照する Story の Early User Test 欄が「N/A（自動検証対象外の定性項目）」と明示している点も含め、誤って自動テスト成功として報告しないこと（quality rule「未実行テストを成功と報告しない」）を Build & Test 段で徹底する。

### 6. Determinism-vs-UI（FR5.4.2 違反の混入チェック） — 現状クリーン

- 評価を UI に埋め込む / 非決定に開く AC は**発見されなかった**。AC7.4.2 が明示的に「UI に暗黙の評価ロジックが無い」を assert し、AC2.2.5・AC1.1.3 が「メモは採点に影響しない」を担保。**FR5.4.2 に対する防御は AC レベルで成立している。**
- **Markdown 生成（AC4.1.1）**: posture では markdown 生成も deterministic core。AC4.1.1 は見出し（FR8.2 の順・表記）を列挙し golden-file test 化できるが、**「同一入力に対し同一 Markdown（決定的）」という決定性契約が AC に無い**。**提案**: US4.1 に「Given 同一の完走状態、When Sheet を生成、Then 生成 Markdown は決定的（同一）で、見出しは指定の順・表記」を追加すると、posture の deterministic core カバレッジと AC が一致する。

### 7. 追加の testability 微修正（任意）

- **AC3.2.1**「9 つの Concept/Decision Dimension」は FR5.1 の 9 項目と一致し、個数・名称を assert できる良い具体性。維持推奨。
- **AC1.2.3 / AC2.2.4** の「同一 Engine / Source Data / Evaluation Model を共有（別実装でない）」は、構造テスト（3 モードが同一評価関数へ収束すること）で observ 可能。良い契約。

## Positions

- AGREE: 決定性の横断契約（AC7.4.1）と UI 非埋め込み契約（AC7.4.2）は FR5.4 に対する testable な防御として妥当。維持すべき。
- AGREE: traceability.json の `Traceability != Verification` 表明と NFR1 の定性扱いは honest で、posture（誇張しない・pass-rate 不要）と整合。
- AGREE: provenance のデータ層 AC（AC7.3.1）は fixture health test で決定的に検証可能。
- OBJECT: AC7.3.2 / AC2.4.3 系の「出典を確認できる / 必要に応じて識別できる」は観測可能な assertion 面（enum 区分値 + UI ラベル）が未特定で、現状のままでは自動テスト化が曖昧。区分を enum で表現し観測可能とする契約を AC に固定すべき。
- OBJECT: sad path/edge の AC が不足。特に (i) 言語切替時の Decision Outcome 不変（FR10.4）、(ii) mid-scenario の malformed 検出（FR12.1 の runtime 全般適用）、(iii) 破損 localStorage、(iv) 空 Focus library の 4 点は無言破綻を防ぐ testable AC を追加すべき。
- OBJECT: Markdown 生成（AC4.1.1）に決定性契約が欠落。posture が deterministic core に含めるため「同一入力→同一 Markdown」を AC 化すべき。
- OBJECT: 「説明される」系 AC（AC2.4.1/2.4.2/2.5.1/2.5.2）は観測可能な構造スロットが未特定で自動化しづらい。確認可能な要素粒度（別ラベル/専用スロット等）へ落とすべき。
