**Collaborator:** aidlc-design-agent

## Contribution

UX/persona の観点でレビューした。personas.md（P1–P4）と stories.md（US1.1–US8.2）は主 persona 中心の縦切りとして概ね良好。以下は統合可能な UX/persona 上の findings（US/AC ID 参照）。

### A. Persona fidelity — 概ね良好、1 点の視点ずれ
- **P1–P4 は well-formed**。role / goal / pain / context / priority が揃い、Story 優先（P1/P2 中心）とも整合。特に P2 の「誇張された効果主張を信用しない」「spec 由来か教材独自かを区別したい」は US7.3・US4.1 の provenance AC に正しく写像されている。
- **視点ずれ（US2.1）**: US2.1 の Persona は `P1, P2` だが、User Story 本文が「AI-DLC 未経験者として」の一人称で P1 単独視点。P2（評価者）は「導入判断に足る具体性」を Context に求めるため、AC2.1.1 に *P2 が Context から自チームの前提へ引ける具体性がある* という観点を 1 つ足すか、本文を「学習者として」に一般化するのが persona 忠実。**軽微・統合可能**。
- **US1.1 の Persona に P4 が無い**のは妥当（保守者は i18n UI の主対象でない）。P3 が入っているのは審査完走性の観点で正しい。

### B. UX flow — first-timer が 5〜10 分で通せるか
- **オンボーディング/最初の一歩が Story 化されていない（UX gap）**。US1.1（言語）→US1.2（モード選択）→US2.1（Context）と繋がるが、「初回起動時に *何が始まるのか*・所要時間の目安・Core End-to-End という二層構造の入口」を伝える first-run の説明が AC に無い。P1 は事前知識ゼロ前提（A2）なので、モード選択（AC1.2.1）の前に「これは約5〜10分で AI-DLC を一周体験するものだ」を示す onboarding/empty-entry state が必要。**US1.2 の AC に first-run オリエンテーション観点を追加**することを提案（例: AC1.2.x「初回はモードの意味と所要時間の目安が理解でき、迷わず開始できる」）。
- **モード選択の意思決定支援**: AC1.2.1 は「各モードの目的が1行で説明される」とあり良い。ただし P1 は初回どれを選ぶべきか判断材料が無い。1行説明に加え **推奨初期モード（Guided）の明示**があると first-timer が詰まらない（recognition rather than recall）。**AC 追加候補**。
- **「なぜ」をネタバレせず出す設計は Story 化できている**: AC2.1.2（Decision 前に正解を明示しない）+ AC2.2.2（判断後に理由）は progressive disclosure として正しい。良い。
- **モード遷移の UX が未カバー（gap）**: FR3.2/AC1.2.3 で「同一 Engine/Data の共有」は保証されるが、*学習者が Guided を終えて Simulation/Adoption Review へ移る導線* が Story に無い。US6.1（Adoption Review）→US4.1（Sheet）の接続（AC6.1.2）はあるが、Guided→Simulation→Adoption Review の Learn→Practice→Apply ループを *ユーザーがどう辿るか* の遷移 Story/AC が欠けている。**横断 UX として US1.2 か新 AC で「モード間を進捗を保ったまま移動でき、次に何をすべきかが示される」観点を補う**ことを提案。
- **empty/loading/error state の UX が結果画面に薄い**: US8.2（不正 JSON エラー）は sad path を良くカバー。一方、US3.1 の結果画面や US5.1 の Focus Library には empty state（まだ完走していない / Focus 未着手）の観点が無い。Focus Library を開いたが未完走、という初期状態の guidance が欲しい。**US5.1 の AC に empty/初期状態観点を追加**候補（wireframing-guide の 5 states のうち empty が未表現）。

### C. Accessibility as UX（NFR で終わらせない）
- **US7.1（keyboard 完走）+ AC7.1.2 は良い**: focus 視認・色のみ非依存・contrast・semantic HTML・「自動検証のみで準拠は主張しない」まで含み NFR4/quality と整合。honest な姿勢も良い。
- **ただし accessibility が US7.1 に隔離されすぎ（UX gap）**: WCAG は横断品質だが、体験に効くのは *各インタラクションでの* focus 管理と announce。特に (1) US2.2 の Decision 選択（radio/button 群の keyboard パターンと選択状態の announce）、(2) US2.2/AC2.2.2 の判断後 Explanation が動的に出る際の `aria-live` 告知（screen reader ユーザーが結果に気づけるか）、(3) US8.2 のエラー表示の告知（AC8.2.1 のエラーは視覚だけでなく announce されるべき）。これらは US7.1 の1本に押し込めず、**該当 Story の AC に「動的コンテンツ（Explanation/エラー）は screen reader に告知される」観点を最低限置く**ことを提案。統合は AC 1 行追加で足りる。
- **`prefers-reduced-motion`**: マイクロインタラクションを入れる場合の配慮は design/functional-design 送りで良いが、accessibility Story のスコープに「motion 配慮」を一言残すと下流で漏れない。**任意・軽微**。

### D. i18n as UX
- **US1.1 は強い**: AC1.1.3（切替で進捗/Decision/結果/メモを保持）と AC1.1.4（undefined 表示・日英混在なし）で「mid-flow 言語切替」と「missing-translation 非表示」を両方カバー。FR10.3/FR10.5 と整合し、P3（審査者）の pain（片言語混在で評価が下がる）にも効く。**良い、変更不要**。
- **軽微**: AC1.1.4 は「翻訳欠落による undefined 表示や日英混在が無い」を保証するが、*欠落時のフォールバック挙動*（English へ落ちる）が UX として明示されると P3 に安心。FR10.2 の fallback と繋げて AC に1語添えるのは任意。

### E. その他（統合可能な軽微点）
- **US2.2 の Decision 選択肢が7つ（AC2.2.1）**: keyboard/認知負荷の観点で、7 択を1画面に平置きすると P1 に重い。functional-design 送りだが、Story の User Value を損なわないよう「選択肢は文脈に応じて提示（全7つを常時全部見せるとは限らない）」の含みを AC か注記に残すと UX 設計の自由度が保たれる。**任意**。
- **判断メモ（AC2.2.5）の可視性**: メモが「保存されるが採点に影響しない」は良いが、*メモが結果/Adoption Sheet で再確認できるか* が UX 上の学習価値になる。US3.1/US4.1 でメモを振り返れると P2 の「持ち帰り」に効く。**AC 追加候補（任意）**。

## Positions

- AGREE: persona P1–P4 の粒度と主/副の優先付けは適切で、Story 優先（P1/P2 中心・P4 明示 Story 化）と整合している。
- AGREE: 「Decision 前に正解を出さず、判断後に理由を出す」progressive disclosure（AC2.1.2 + AC2.2.2）は UX として正しい。
- AGREE: US1.1 の i18n Story（mid-flow 切替で進捗保持・undefined/混在なし）は UX 要件を十分に満たす。
- AGREE: US7.1/AC7.1.2 の accessibility 記述（keyboard 完走・色非依存・「準拠を主張しない」）は honest かつ NFR4 と整合。
- AGREE: US8.2 の不正 JSON sad path は empty/error state を良くカバーしている。
- OBJECT: first-run オンボーディング（何が始まるか・所要時間・二層構造の入口）が Story/AC に無く、事前知識ゼロの P1 が 5〜10 分ジャーニーに入る導線が欠ける。US1.2 に AC 追加を要望。
- OBJECT: モード間遷移（Guided→Simulation→Adoption Review の Learn→Practice→Apply 導線）の UX が Story に欠落。進捗を保ったモード移動と「次に何をすべきか」の提示を横断 AC で補うことを要望。
- OBJECT: accessibility が US7.1 に隔離され、動的コンテンツ（Explanation/エラー）の screen reader 告知（`aria-live`）が該当 Story（US2.2・US8.2）の AC に無い。最低限の告知観点を該当 AC に置くことを要望。
