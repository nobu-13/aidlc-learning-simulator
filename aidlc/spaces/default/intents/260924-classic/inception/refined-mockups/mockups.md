# Refined Mockups — AI-DLC Learning Simulator

> Learning Target = AI-DLC v2.10.0 / Dev Workflow Runtime = v2.9.0。classic は rough-mockups を skip するため、user-stories（US1.1〜US8.2）と requirements（FR/NFR）から直接設計。
> SVG は Information Architecture / hierarchy / interaction / progressive disclosure の確認用（視覚完成度が目的ではない）。状態・interaction・a11y・responsive・provenance の詳細は本 Markdown 注釈と `interaction-spec.md` を正とする。
> reading order = DOM order を responsive の基本契約とする。boundary（実行 Zone）と approval gate（承認停止点）は色以外でも区別。

## 画面インベントリと US 対応

| # | 画面 | 主対応 US | 備考 |
|---|------|-----------|------|
| S1 | Home / Onboarding / Language / Mode Selection | US1.1, US1.2 | 5〜10 分 Core への入口。初回オリエンテーション |
| S2 | Core Scenario 進行（Shell） | US2.1, US2.2, US2.3, US2.4, US2.5, US2.6 | 縦 1 カラム progressive disclosure。Focus 個別も同一 Shell 再利用 |
| S3 | Result / Reflection | US3.1, US3.2 | 9 Dimension 俯瞰・Decision Timeline |
| S4 | Adoption Review（Apply 専用ビュー） | US6.1 | 自分の判断を実業務 boundary 設計へ |
| S5 | Adoption Discussion Sheet | US4.1 | Markdown 生成・プレビュー・コピー/DL |
| S6 | Focus Scenario Library | US5.1, US5.2, US5.3 | 一覧・empty state。個別は S2 Shell 再利用 |
| （非UI） | Scenario JSON 保守 | US8.1, US8.2 | Developer Experience 扱い（アプリ UI にしない） |

共通シェル要素: ヘッダ（アプリ名 / 言語切替 / 現在モード表示）、メインコンテンツ、（体験中のみ）進捗インジケータ。ヘッダは全画面で一貫配置。

---

## S1. Home / Onboarding / Language / Mode Selection

対応: US1.1（言語自動判定・切替）、US1.2（モード選択・オンボーディング・Guided 推奨）。

![S1 Home / Mode Selection wireframe](kiro-artifact://placeholder-s1)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="460" viewBox="0 0 760 460" font-family="sans-serif" font-size="13">
  <rect x="0" y="0" width="760" height="460" fill="#ffffff" stroke="#cccccc"/>
  <!-- header -->
  <rect x="0" y="0" width="760" height="44" fill="#f4f5f7" stroke="#dddddd"/>
  <text x="16" y="27" font-weight="bold">AI-DLC Learning Simulator</text>
  <rect x="600" y="10" width="140" height="24" rx="4" fill="#ffffff" stroke="#999999"/>
  <text x="612" y="27">🌐 日本語 ▾ (ja/en)</text>
  <!-- onboarding -->
  <text x="24" y="80" font-size="18" font-weight="bold">AI-DLC を約 5〜10 分で体験する</text>
  <text x="24" y="104" fill="#444444">全体像を一周してから、必要な論点を Focus で深掘りできます。所要: 約 5〜10 分（Core）</text>
  <text x="24" y="124" fill="#444444">1) 学ぶ (Guided) → 2) 試す (Simulation) → 3) 導入を考える (Adoption Review)</text>
  <!-- mode cards -->
  <rect x="24" y="150" width="228" height="150" rx="8" fill="#eef4ff" stroke="#3366cc" stroke-width="2"/>
  <text x="40" y="178" font-weight="bold">Guided Learning</text>
  <text x="40" y="200" fill="#555555">概念と判断理由を提示。</text>
  <text x="40" y="218" fill="#555555">初めての方におすすめ。</text>
  <rect x="40" y="236" width="150" height="16" rx="8" fill="#3366cc"/>
  <text x="52" y="248" fill="#ffffff" font-size="11">★ 推奨（初回）</text>
  <rect x="40" y="262" width="196" height="28" rx="4" fill="#3366cc"/>
  <text x="104" y="281" fill="#ffffff">この モードで開始 →</text>
  <rect x="266" y="150" width="228" height="150" rx="8" fill="#ffffff" stroke="#999999"/>
  <text x="282" y="178" font-weight="bold">Simulation</text>
  <text x="282" y="200" fill="#555555">ヒントを減らし自力判断。</text>
  <text x="282" y="218" fill="#555555">理解度を確認。</text>
  <rect x="282" y="262" width="196" height="28" rx="4" fill="#ffffff" stroke="#3366cc"/>
  <text x="346" y="281" fill="#3366cc">開始 →</text>
  <rect x="508" y="150" width="228" height="150" rx="8" fill="#ffffff" stroke="#999999"/>
  <text x="524" y="178" font-weight="bold">Adoption Review</text>
  <text x="524" y="200" fill="#555555">自分の判断を振り返り</text>
  <text x="524" y="218" fill="#555555">実業務導入を検討。</text>
  <rect x="524" y="262" width="196" height="28" rx="4" fill="#ffffff" stroke="#3366cc"/>
  <text x="588" y="281" fill="#3366cc">開始 →</text>
  <!-- resume / continue -->
  <text x="24" y="340" fill="#666666">前回の続き: (localStorage に進捗がある場合のみ表示) ▸ 続きから再開</text>
  <text x="24" y="380" fill="#888888" font-size="11">言語はいつでも切替可能。切替で進捗・判断・結果は失われません。</text>
</svg>
```

**レイアウト意図**: Z 型（ロゴ左上、言語切替右上、主要 CTA は Guided カード）。オンボーディング文で「何が始まるか・所要時間・二層構造・Learn→Practice→Apply」を提示（AC1.2.4）。Guided を推奨として明示（AC1.2.1）。
**状態**: initial（進捗なし: 「前回の続き」非表示）/ populated（localStorage に進捗あり: 「続きから再開」表示）/ empty（Focus Library 未着手は S6 側）/ error（localStorage 破損時は復帰通知バナー、AC7.2.3）。
**responsive**: mobile では 3 モードカードを縦積み（Guided → Simulation → Adoption Review の順＝推奨/学習順を DOM order で維持）。
**provenance**: この画面には根拠区分は出さない（学習判断が無いため）。

---

## S2. Core Scenario 進行（Shell）— Focus 個別も再利用

対応: US2.1（Context/Concept）、US2.2（Decision→Consequence/Explanation）、US2.3（手戻り）、US2.4（boundary/gate）、US2.5（完了承認 vs Release）、US2.6（Simulation）。

縦 1 カラム progressive disclosure。判断前は正解を出さず、確定後に理由・Risk・Evidence・Boundary・provenance を段階開示。

![S2 Scenario progression wireframe](kiro-artifact://placeholder-s2)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="810" viewBox="0 0 760 810" font-family="sans-serif" font-size="13">
  <rect x="0" y="0" width="760" height="810" fill="#ffffff" stroke="#cccccc"/>
  <!-- header + progress -->
  <rect x="0" y="0" width="760" height="44" fill="#f4f5f7" stroke="#dddddd"/>
  <text x="16" y="27" font-weight="bold">AI-DLC Learning Simulator</text>
  <text x="470" y="27" fill="#555555">モード: Guided</text>
  <rect x="600" y="10" width="140" height="24" rx="4" fill="#ffffff" stroke="#999999"/><text x="612" y="27">🌐 日本語 ▾</text>
  <!-- stage/decision timeline (boundary Zone vs approval Gate distinct) -->
  <text x="16" y="66" font-weight="bold">進行タイムライン</text>
  <rect x="16" y="76" width="120" height="26" rx="4" fill="#e8f0e8" stroke="#2e7d32" stroke-dasharray="4 2"/>
  <text x="24" y="93" font-size="11">▷ Agent 実行 Zone</text>
  <polygon points="150,76 176,89 150,102" fill="#fff3e0" stroke="#e65100"/>
  <text x="150" y="118" font-size="10" fill="#e65100">⬢ 承認 Gate</text>
  <rect x="196" y="76" width="120" height="26" rx="4" fill="#e8f0e8" stroke="#2e7d32" stroke-dasharray="4 2"/>
  <text x="204" y="93" font-size="11">▷ Agent 実行 Zone</text>
  <circle cx="340" cy="89" r="7" fill="#cccccc"/><text x="332" y="118" font-size="10" fill="#888">現在</text>
  <text x="430" y="93" font-size="10" fill="#888">Zone=枠+破線+▷、Gate=六角+実線+⬢（色以外でも区別）</text>
  <!-- Context -->
  <rect x="16" y="140" width="728" height="96" rx="8" fill="#f7f9fc" stroke="#c9d6e5"/>
  <text x="30" y="164" font-weight="bold">Context / Concept</text>
  <text x="30" y="188" fill="#333333">状況: 要求が曖昧なまま Agent へ実装を委任するか、人が承認境界を引くかを判断します。</text>
  <text x="30" y="208" fill="#333333">関連 Concept: Human/Agent Boundary, Approval Gate（この段では正解は示しません）</text>
  <text x="30" y="226" fill="#3366cc" font-size="11">［概念をもっと読む ▸］（Disclosure。任意）</text>
  <!-- Decision -->
  <text x="16" y="266" font-weight="bold">あなたの判断（Decision）</text>
  <rect x="16" y="278" width="356" height="34" rx="4" fill="#ffffff" stroke="#3366cc" stroke-width="2"/>
  <text x="28" y="299">◉ Require Human Approval</text>
  <rect x="384" y="278" width="356" height="34" rx="4" fill="#ffffff" stroke="#999999"/>
  <text x="396" y="299">○ Delegate to Agent</text>
  <rect x="16" y="318" width="356" height="34" rx="4" fill="#ffffff" stroke="#999999"/>
  <text x="28" y="339">○ Request More Evidence</text>
  <rect x="384" y="318" width="356" height="34" rx="4" fill="#ffffff" stroke="#999999"/>
  <text x="396" y="339">○ Approve / ○ Reject / ○ Change Scope … （Scenario 依存）</text>
  <text x="16" y="358" font-size="10" fill="#888888">※ 選択肢は Scenario / Decision Point ごとに data から提示される subset（7 種別から）。固定 4 択ではない。</text>
  <rect x="16" y="364" width="728" height="28" rx="4" fill="#f0f0f0" stroke="#bbbbbb"/>
  <text x="28" y="383" fill="#666666">任意の判断メモ（採点に影響しません）…</text>
  <rect x="600" y="398" width="144" height="30" rx="4" fill="#3366cc"/><text x="628" y="418" fill="#ffffff">判断を確定 →</text>
  <!-- Consequence / Explanation (revealed AFTER confirm) -->
  <rect x="16" y="440" width="728" height="350" rx="8" fill="#fbfbf5" stroke="#d8d2a8"/>
  <text x="30" y="462" font-weight="bold">結果と理由（判断後に表示）</text>
  <text x="30" y="482" fill="#333333">Consequence: 承認境界を引いたため、低リスクな部分の委任が滞り Rework が一部発生。</text>
  <text x="30" y="500" fill="#333333">なぜ: Reversible かつ Low Risk な変更は Agent 委任が妥当な場面でした。</text>
  <text x="30" y="518" fill="#555555">関係: Approval Boundary / Delegation Quality / Risk Handling（この Decision で関係した Dimension のみ軽く表示）</text>
  <!-- R-01: dedicated confusion-risk slots (distinct structural slots) -->
  <rect x="30" y="528" width="350" height="52" rx="6" fill="#fff3e0" stroke="#e65100"/>
  <text x="40" y="546" font-size="11" font-weight="bold" fill="#e65100">⚠ 境界を混同した場合のリスク</text>
  <text x="40" y="564" font-size="10" fill="#7a4a10">実行 Zone と承認 Gate を同一視すると、承認不要の実行を止め／要承認を素通りさせる。</text>
  <rect x="392" y="528" width="352" height="52" rx="6" fill="#ede7f6" stroke="#4527a0"/>
  <text x="402" y="546" font-size="11" font-weight="bold" fill="#4527a0">⚠ 工程完了承認 ≠ Release Approval</text>
  <text x="402" y="564" font-size="10" fill="#3a2a6a">AI-DLC 工程完了を承認しても、Release Approval は自動的には成立しない。</text>
  <!-- R-02: distinct approval steps -->
  <text x="30" y="600" font-size="11" font-weight="bold">承認の種類（別ステップ）</text>
  <rect x="30" y="606" width="340" height="26" rx="4" fill="#e8eaf6" stroke="#3949ab"/>
  <text x="40" y="623" font-size="10" fill="#283593">① AI-DLC Workflow / Stage Completion Approval（この工程の完了）</text>
  <rect x="392" y="606" width="352" height="26" rx="4" fill="#fce4ec" stroke="#ad1457"/>
  <text x="402" y="623" font-size="10" fill="#880e4f">② AWS / Production Release Approval（別途・人が別に判断）</text>
  <!-- provenance labels always visible (all 4 shown), non-color border styles per design-system-mapping -->
  <!-- ai-dlc-spec = solid border (仕様) -->
  <rect x="30" y="644" width="110" height="22" rx="6" fill="#e3f2fd" stroke="#1565c0" stroke-width="1.5"/><text x="38" y="659" font-size="9" fill="#1565c0">▣仕様 ai-dlc-spec</text>
  <!-- simulator-interpretation = dotted border (解釈) -->
  <rect x="146" y="644" width="170" height="22" rx="6" fill="#f3e5f5" stroke="#6a1b9a" stroke-width="1.5" stroke-dasharray="1 3"/><text x="154" y="659" font-size="9" fill="#6a1b9a">◍解釈 simulator-interpretation</text>
  <!-- harness-behavior = dashed border (環境, only-when-applicable) -->
  <rect x="322" y="644" width="150" height="22" rx="6" fill="#e8f5e9" stroke="#2e7d32" stroke-width="1.5" stroke-dasharray="5 3"/><text x="330" y="659" font-size="9" fill="#2e7d32">▤環境 harness-behavior*</text>
  <!-- simulation-assumption = double border (前提): outer + inner rect -->
  <rect x="478" y="642" width="176" height="26" rx="7" fill="#fffde7" stroke="#8a6d00" stroke-width="1.5"/><rect x="481" y="645" width="170" height="20" rx="5" fill="none" stroke="#8a6d00" stroke-width="1"/><text x="488" y="659" font-size="9" fill="#8a6d00">▨前提 simulation-assumption</text>
  <text x="30" y="684" fill="#888888" font-size="9">枠種で区分（実線=仕様 / 点線=解釈 / 破線=環境 / 二重=前提）。色は補助。label + border + アイコン相当で色なしでも識別可。</text>
  <text x="30" y="696" fill="#888888" font-size="9">* harness-behavior は該当 Decision でのみ表示（例では 4 区分すべての見え方を提示）</text>
  <text x="30" y="714" fill="#3366cc" font-size="11">［根拠の詳細と Reference を見る ▸］（既定は閉。開くと出典 URL/セクション）</text>
  <text x="30" y="736" fill="#333333">Better Alternative: Low Risk 部分は Delegate、境界のみ Human Approval とする分割。</text>
  <rect x="600" y="748" width="144" height="30" rx="4" fill="#3366cc"/><text x="648" y="768" fill="#ffffff">次へ →</text>
  <text x="30" y="768" fill="#888888" font-size="11">◂ 前の Stage へ戻る（手戻りも学び）</text>
</svg>
```

> S2 SVG の height は上記追加スロットに合わせ 810 に拡張。上のブロックはすべて **Decision 確定後** に progressive disclosure で出現し、Decision 前には表示しない（正解漏洩なし）。

**progressive disclosure**: Context と Decision のみ最初に見える。`判断を確定` 後に「結果と理由」ブロックが出現（AC2.2.2）。判断前に正解や Better Alternative は出さない（AC2.1.2）。
**9 Dimension（体験中）**: この Decision で関係した Dimension だけを軽く表示（AC3.x への布石。全 9 は出さない）。
**provenance**: 各 Explanation に 4 区分ラベルを常時小表示（例: `ai-dlc-spec` / `simulator-interpretation`）。詳細と Reference は Disclosure で開く（AC2.2.3 / AC7.3.x）。`harness-behavior` は該当時のみ表示し `ai-dlc-spec` と区別。
**boundary vs gate**: タイムライン上で Zone（枠+破線+▷）と Gate（六角+実線+⬢）を別記号で描く。画面内でも別セクション/別ラベル（US2.4）。色のみに依存しない。
**混同リスク専用スロット（R-01, AC2.4.2/AC2.5.2）**: Explanation 内に独立した構造スロットとして「⚠ 境界を混同した場合のリスク」と「⚠ 工程完了承認 ≠ Release Approval」を配置。通常本文へ埋め込まず、ユーザーが明確に認識できる別領域。Decision 確定後の progressive disclosure の一部。
**承認の別ステップ（R-02, AC2.5.1）**: 「① AI-DLC Workflow / Stage Completion Approval」と「② AWS / Production Release Approval」を別ラベル・別ステップ（別要素）として可視化。文章補足でなく構造で「工程完了を承認 → Release が自動成立」という誤解を防ぐ。S3 タイムラインにも別項目として反映。
**Decision 選択肢の可変性（R-04, AC2.2.1）**: 選択肢は固定 4 択ではなく、Scenario / Decision Point ごとに data から提示される subset（7 種別: Delegate to Agent / Approve / Reject / Request More Evidence / Require Human Approval / Return to Previous Stage / Change Scope）。SVG では Approve/Reject を含む例と「Scenario 依存」注記を明示。
**provenance（4 区分の見え方, R-03）**: 例として 4 区分すべての Badge（ai-dlc-spec / simulator-interpretation / harness-behavior* / simulation-assumption）を提示し、色以外（実線/点線/破線/二重枠 + アイコン + ラベル）で判別可能なことを示す。`harness-behavior` は該当 Decision でのみ表示（* 注記）。1 Decision に 4 区分すべてを強制しない。
**Simulation モード（US2.6）**: 同一 Shell。Context の概念提示と Decision 前ヒントを Guided より減らし、確定後に Reflection を出す（AC2.6.1）。評価は Guided と同一（AC2.6.5）。
**手戻り（US2.3）**: 「前の Stage へ戻る」を常時提供。
**状態**: initial（Context 表示・Decision 未選択・確定ボタン disabled）/ selected（選択肢 1 つ選択・確定 enabled）/ in-progress（確定処理・非同期が無ければ loading 不要）/ completed（結果表示済み・次へ enabled）/ error（Scenario データ不整合時は可読エラー、AC8.2.3）/ empty（該当なし）。
**responsive**: 縦積みのまま。reading order = Context → Decision → Consequence → Next を DOM order と一致。タイムラインは mobile で横スクロールまたは簡易縦リスト化するが Zone/Gate の区別記号は保持。

---

## S3. Result / Reflection

対応: US3.1（結果提示・Decision Timeline・各種スロット）、US3.2（9 Dimension 非単調）。

![S3 Result wireframe](kiro-artifact://placeholder-s3)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="560" viewBox="0 0 760 560" font-family="sans-serif" font-size="13">
  <rect x="0" y="0" width="760" height="560" fill="#ffffff" stroke="#cccccc"/>
  <rect x="0" y="0" width="760" height="44" fill="#f4f5f7" stroke="#dddddd"/>
  <text x="16" y="27" font-weight="bold">結果 / ふりかえり</text>
  <!-- edu-value banner -->
  <rect x="16" y="56" width="728" height="28" rx="4" fill="#fff8e1" stroke="#f9a825"/>
  <text x="28" y="75" fill="#795548">ℹ これは学習用のシミュレーション値です（実測値ではありません）。</text>
  <!-- decision timeline -->
  <text x="16" y="108" font-weight="bold">Decision Timeline</text>
  <rect x="16" y="118" width="728" height="64" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/>
  <text x="28" y="138" font-size="11">Stage1 承認境界 ⬢ → Stage2 委任 ▷ → Stage3 Evidence 要求 → 完了へ</text>
  <rect x="28" y="146" width="300" height="26" rx="4" fill="#e8eaf6" stroke="#3949ab"/>
  <text x="36" y="163" font-size="10" fill="#283593">✔ AI-DLC Completion Approval（工程完了）</text>
  <rect x="340" y="146" width="360" height="26" rx="4" fill="#fce4ec" stroke="#ad1457"/>
  <text x="348" y="163" font-size="10" fill="#880e4f">▢ Release Approval: separate / not granted（別途・未承認）</text>
  <!-- 9 dimensions overview -->
  <text x="16" y="188" font-weight="bold">Concept / Decision Dimension（9）— 展開で詳細</text>
  <g font-size="11">
   <rect x="16" y="200" width="234" height="30" rx="4" fill="#eef4ff" stroke="#3366cc"/><text x="24" y="220">Requirement Clarity ▸</text>
   <rect x="263" y="200" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="271" y="220">Acceptance Criteria Coverage ▸</text>
   <rect x="510" y="200" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="518" y="220">Evidence Quality ▸</text>
   <rect x="16" y="236" width="234" height="30" rx="4" fill="#fff3e0" stroke="#e65100"/><text x="24" y="256">Approval Boundary ▸ (要改善)</text>
   <rect x="263" y="236" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="271" y="256">Delegation Quality ▸</text>
   <rect x="510" y="236" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="518" y="256">Risk Handling ▸</text>
   <rect x="16" y="272" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="24" y="292">Traceability ▸</text>
   <rect x="263" y="272" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="271" y="292">Rework ▸</text>
   <rect x="510" y="272" width="234" height="30" rx="4" fill="#f7f9fc" stroke="#c9d6e5"/><text x="518" y="292">Remaining Risks ▸</text>
  </g>
  <!-- expanded dimension example -->
  <rect x="16" y="314" width="728" height="120" rx="8" fill="#fbfbf5" stroke="#d8d2a8"/>
  <text x="30" y="338" font-weight="bold">Approval Boundary（展開例）</text>
  <text x="30" y="360" fill="#333333">contributing Decisions: Stage1「Require Human Approval」/ Stage2「Delegate」</text>
  <text x="30" y="380" fill="#333333">なぜ影響したか: 低リスク変更まで人承認にし、非単調評価で減点方向。</text>
  <text x="30" y="400" fill="#333333">Better Alternative: 境界のみ人承認、Reversible 部分は委任。</text>
  <text x="30" y="420" fill="#333333">Remaining Risk: 承認の遅延がボトルネックになりうる。</text>
  <rect x="30" y="416" width="96" height="16" rx="8" fill="#e3f2fd" stroke="#1565c0"/><text x="40" y="428" font-size="10" fill="#1565c0">ai-dlc-spec</text>
  <!-- actions -->
  <rect x="16" y="452" width="230" height="32" rx="4" fill="#3366cc"/><text x="40" y="473" fill="#ffffff">Adoption Discussion Sheet を作成 →</text>
  <rect x="262" y="452" width="220" height="32" rx="4" fill="#ffffff" stroke="#3366cc"/><text x="286" y="473" fill="#3366cc">次に学ぶ Focus Scenario →</text>
  <rect x="498" y="452" width="200" height="32" rx="4" fill="#ffffff" stroke="#3366cc"/><text x="522" y="473" fill="#3366cc">Adoption Review へ →</text>
  <text x="16" y="512" fill="#888888" font-size="11">スコアは学習用の相対指標であり、「介入が多い＝良い」ではありません。</text>
</svg>
```

**9 Dimension（結果）**: ここで初めて 9 全体を俯瞰。各 Dimension を展開すると contributing Decisions / なぜ影響 / Better Alternative / Remaining Risk（AC3.1.2）。非単調（AC3.2.2）。
**教育値の明示**: 上部バナーと各数値に「学習用シミュレーション値」ラベル（AC3.1.3 / NFR8）。
**状態**: empty（未完走で開いた場合: 「まだ完走していません」+ Core へ誘導、AC3.1.4）/ populated（通常）。
**responsive**: 9 Dimension グリッドは mobile で 1 列に縦積み。Timeline は簡易縦リスト。

---

## S4. Adoption Review（Apply 専用ビュー）

対応: US6.1。自分の Decision を Human/Agent Boundary・Approval Boundary・Evidence・Risk・Remaining Risks・Team Discussion Points の観点で振り返り、「自分の実業務ではどう設計するか」を考える。

![S4 Adoption Review wireframe](kiro-artifact://placeholder-s4)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="440" viewBox="0 0 760 440" font-family="sans-serif" font-size="13">
  <rect x="0" y="0" width="760" height="440" fill="#ffffff" stroke="#cccccc"/>
  <rect x="0" y="0" width="760" height="44" fill="#f4f5f7" stroke="#dddddd"/>
  <text x="16" y="27" font-weight="bold">Adoption Review — 実業務への適用を考える</text>
  <text x="16" y="72" fill="#444444">あなたの判断を、自分のチームならどう設計するかの観点で振り返ります。</text>
  <!-- reflection prompts -->
  <rect x="16" y="88" width="728" height="60" rx="8" fill="#f7f9fc" stroke="#c9d6e5"/>
  <text x="30" y="112" font-weight="bold">Human / Agent Boundary</text>
  <text x="30" y="134" fill="#333333">あなたはここで人承認にしました。自チームではどの範囲を Agent に任せますか？（自由記述メモ）</text>
  <rect x="16" y="156" width="728" height="52" rx="8" fill="#f7f9fc" stroke="#c9d6e5"/>
  <text x="30" y="180" font-weight="bold">Approval Boundary / Evidence</text>
  <text x="30" y="200" fill="#333333">どの Evidence があれば承認しますか？実業務で必要な Evidence は？</text>
  <rect x="16" y="216" width="728" height="52" rx="8" fill="#f7f9fc" stroke="#c9d6e5"/>
  <text x="30" y="240" font-weight="bold">Risk / Remaining Risks</text>
  <text x="30" y="260" fill="#333333">残るリスクは何か。実チームでどう監視しますか？</text>
  <rect x="16" y="276" width="728" height="52" rx="8" fill="#f7f9fc" stroke="#c9d6e5"/>
  <text x="30" y="300" font-weight="bold">Team Discussion Points</text>
  <text x="30" y="320" fill="#333333">チームで議論すべき点を 1 つ以上挙げてください。</text>
  <rect x="16" y="348" width="300" height="34" rx="4" fill="#3366cc"/><text x="40" y="370" fill="#ffffff">Adoption Discussion Sheet に反映 →</text>
  <text x="16" y="410" fill="#888888" font-size="11">メモは localStorage に保存され、Sheet で再確認できます（採点対象外）。</text>
</svg>
```

**意図**: Scenario 内の正解確認に留めず、実業務 boundary 設計まで考えさせる（AC6.1.1）。完了後 S5 へ接続（AC6.1.2）。
**状態**: initial（メモ未入力）/ in-progress（入力中・autosave 状態表示「保存済み」）/ completed（Sheet へ反映可能）。
**responsive**: 縦積み。各 prompt は full width。

---

## S5. Adoption Discussion Sheet

対応: US4.1。指定見出しの Markdown を生成・プレビュー・コピー/ダウンロード。

![S5 Adoption Discussion Sheet wireframe](kiro-artifact://placeholder-s5)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="420" viewBox="0 0 760 420" font-family="sans-serif" font-size="13">
  <rect x="0" y="0" width="760" height="420" fill="#ffffff" stroke="#cccccc"/>
  <rect x="0" y="0" width="760" height="44" fill="#f4f5f7" stroke="#dddddd"/>
  <text x="16" y="27" font-weight="bold">AI-DLC Adoption Discussion Sheet</text>
  <rect x="16" y="56" width="728" height="26" rx="4" fill="#fff8e1" stroke="#f9a825"/>
  <text x="28" y="74" fill="#795548">ℹ これは導入設計を確定するものではなく、チームで議論するための Educational Output です。</text>
  <!-- markdown preview -->
  <rect x="16" y="94" width="728" height="256" rx="6" fill="#fcfcfc" stroke="#dddddd"/>
  <text x="30" y="116" font-family="monospace" font-size="11"># AI-DLC Adoption Discussion Sheet</text>
  <text x="30" y="136" font-family="monospace" font-size="11">## Project Context …</text>
  <text x="30" y="154" font-family="monospace" font-size="11">## Requirements / ## Acceptance Criteria …</text>
  <text x="30" y="172" font-family="monospace" font-size="11">## Agent Delegation Boundary / ## Human Approval Boundary …</text>
  <text x="30" y="190" font-family="monospace" font-size="11">## Evidence Required / ## Testing Expectations …</text>
  <text x="30" y="208" font-family="monospace" font-size="11">## Remaining Risks / ## Team Discussion Points …</text>
  <text x="30" y="226" font-family="monospace" font-size="11">## Questions to Resolve Before Adoption …</text>
  <rect x="16" y="366" width="180" height="34" rx="4" fill="#3366cc"/><text x="44" y="388" fill="#ffffff">Markdown をコピー</text>
  <rect x="208" y="366" width="180" height="34" rx="4" fill="#ffffff" stroke="#3366cc"/><text x="236" y="388" fill="#3366cc">ダウンロード (.md)</text>
</svg>
```

**見出し**: 指定順・表記どおり（AC4.1.1）。決定性（同一履歴→同一 Markdown、AC4.1.3）。導入用 Educational Output の明示（AC4.1.2）。コピー/DL UX の詳細は OQ3/design。
**状態**: empty（未完走: 生成不可の説明）/ populated（生成済み）/ copied（コピー成功のトースト）。

---

## S6. Focus Scenario Library

対応: US5.1（一覧・時間制限なし）、US5.2（checkpoint review）、US5.3（recovery next-step）。個別は S2 Shell を再利用。

![S6 Focus Library wireframe](kiro-artifact://placeholder-s6)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="360" viewBox="0 0 760 360" font-family="sans-serif" font-size="13">
  <rect x="0" y="0" width="760" height="360" fill="#ffffff" stroke="#cccccc"/>
  <rect x="0" y="0" width="760" height="44" fill="#f4f5f7" stroke="#dddddd"/>
  <text x="16" y="27" font-weight="bold">Focus Scenario Library（時間制限なし）</text>
  <g font-size="12">
   <rect x="16" y="60" width="356" height="70" rx="8" fill="#ffffff" stroke="#999999"/>
   <text x="30" y="84" font-weight="bold">承認後の Requirement 変更</text>
   <text x="30" y="104" fill="#555555">Change Control を深掘り</text>
   <rect x="392" y="60" width="352" height="70" rx="8" fill="#ffffff" stroke="#999999"/>
   <text x="406" y="84" font-weight="bold">verified Unit / batch checkpoint review</text>
   <text x="406" y="104" fill="#555555">v2.10.0 の checkpoint（US5.2）</text>
   <rect x="16" y="142" width="356" height="70" rx="8" fill="#ffffff" stroke="#999999"/>
   <text x="30" y="166" font-weight="bold">失敗からの recovery（次の一手）</text>
   <text x="30" y="186" fill="#555555">refusal/recovery next-step（US5.3）</text>
   <rect x="392" y="142" width="352" height="70" rx="8" fill="#ffffff" stroke="#999999"/>
   <text x="406" y="166" font-weight="bold">Evidence 不足 / 過剰委任 …</text>
   <text x="406" y="186" fill="#555555">その他の Focus 論点</text>
  </g>
  <!-- empty state note -->
  <rect x="16" y="230" width="728" height="60" rx="8" fill="#f7f9fc" stroke="#c9d6e5" stroke-dasharray="4 3"/>
  <text x="30" y="256" font-weight="bold">（empty state）</text>
  <text x="30" y="278" fill="#555555">Focus Scenario がまだありません。Core End-to-End を先に体験するか、後で追加された Scenario をお試しください。</text>
</svg>
```

**empty state**: ライブラリが空（初期本数未確定・0 本）でもクラッシュせず、空の旨と代替導線を表示（AC5.1.3）。
**個別 Focus**: 選択すると S2 Shell を再利用して進行（別 UI にしない）。
**responsive**: カードグリッドは mobile で 1 列。

---

## 横断: エラー / empty / loading の共通方針

- **error**: 不正 Scenario JSON（ロード時 US8.2 / 進行中 AC8.2.3）は「どの Scenario/フィールドが不正か」を可読表示し silent fallback しない。screen reader へ告知（`role="alert"`）。
- **empty**: 結果未完走（S3）、Focus 空（S6）は説明＋次アクション。
- **loading**: 教材はビルド時同梱で基本同期。実際に非同期が無い箇所では loading 状態を作らない（過剰演出回避）。
- **localStorage 異常**（AC7.2.3）: 破損時は安全に初期化し、必要なら復帰通知。

## Sources
- consumes: `../user-stories/stories.md`（US1.1〜US8.2）, `../user-stories/personas.md`, `../requirements-analysis/requirements.md`（FR/NFR, v2.10.0）, `../practices-discovery/team-practices.md`（Accessibility / Code Style）。
- design knowledge: wireframing-guide（5 states）, interaction-design-patterns（progressive disclosure, modal rules）, accessibility-wcag。
- 承認ガイダンス（2026-09-25）: 5〜10 分導線 / Learn→Practice→Apply / 正解を漏らさない / boundary vs gate 視覚分離 / provenance 情報過多回避 / 9 Dimension 段階提示 / keyboard・focus・aria-live・empty/error。

## Assumptions & Open Questions
- OQ（design 送り）: SVG は IA 確認用の中フィデリティ。最終ビジュアル・具体 primitive ライブラリ選定は functional-design。sourceRefs schema の具体は OQ2/domain-design。Adoption Sheet の DL/コピー UX は OQ3。
- None（本ステージで未解決の設計判断は上記委譲のみ）。
