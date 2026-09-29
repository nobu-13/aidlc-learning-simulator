# Validation Methodology for Agentic Applications

これは AI-DLC Learning Simulator の内部監査記録そのものではなく、「Agentic Application を
どう検証するか」という、Community が再利用できる方法論として書いた公開 Evidence です。
特定 RC の score は掲載しません。

## Why Blind Validation

実装コンテキストを持つ Agent だけで検証すると、confirmation bias（自分が作ったものは正しいと
みなしやすい傾向）が入り込む余地があります。そこで工程を分離しました。

```
implementation → automated verification → blind product audit → disagreement adjudication
```

生成した本人（の文脈）とは別の立場から製品を触ることで、実装意図に引きずられない検証を狙います。

## Validation Layers

- **Layer 1 — Unit / Integration / E2E**: 決定的なドメインロジックと UI を自動テストで固定する。
- **Layer 2 — Independent blind product audit**: source / tests / known issues を見ずに live を操作する。
- **Layer 3 — Multi-reviewer blind audit**: 複数の独立 reviewer が別々に blind audit する。
- **Layer 4 — Targeted browser adjudication**: 意見が割れた点を実ブラウザ再現で裁定する。

## Blind Audit Principles

- source を先に読まない。
- tests を先に読まない。
- known issues を知らない状態で臨む。
- browser experience を source of truth にする。
- fresh browser context（クリーンなプロファイル）で操作する。
- 実際の画面表示を Evidence にする。
- reproducible な minority finding を多数決で無視しない。

## Adjudication Principles

audit 間で意見が割れたときは、

```
vote count では決めない → Reproduction → Browser Evidence → PASS / FAIL
```

再現できるかどうかとブラウザ上の実証を基準に判断します。少数意見でも再現できれば有効、
多数意見でも再現できなければ棄却、という扱いです。

## What We Learned

特定 RC の score を出さずに、一般化できる範囲での学びを記します。

- **tests green ≠ product semantics perfect** — 500 テストが通っても、blind product audit では
  自動テストが捉えていない体験上の問題が見つかりうる。
- **UI wording も state integrity の一部** — 内部 ID や生の enum が UI に出ることは、状態の
  正しさの問題として扱う。
- **finding identity と manifestation identity を分ける** — 根本の見逃しと、その後工程での
  顕在化を同一視しない。
- **Artifact existence と Evidence sufficiency を分ける** — 成果物が存在することと、
  それが十分な証跡であることは別。
- **Completion と Release を分ける** — 工程完了とリリース可否は別のゲート。
- **human decision と delivery outcome を混同しない** — 正しく止めた判断は、配送が止まっても
  良い判断でありうる。

## Limitations

正直な制約:

- reviewers は AI システムであり、人間の usability study ではない。
- browser automation の環境差が結果に影響しうる。
- exhaustive な branch coverage ではない。
- 対象は deterministic simulator であり、runtime の非決定性は検証範囲外。
- independent な human usability study は実施していない。

これらの限界があるため、本方法論は「品質を保証するもの」ではなく、
confirmation bias を減らすための **追加の independent verification** として位置づけています。
