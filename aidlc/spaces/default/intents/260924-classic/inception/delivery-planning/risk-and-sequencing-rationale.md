# Risk & Sequencing Rationale — AI-DLC Learning Simulator

> Bolt（= planning / delivery slice）順序の「なぜ」を記録する。順序付けは economic/risk-first（価値・リスク・依存の人間判断）であり、topology だけからは導けない。本プロジェクトは **U1 が唯一の AI-DLC Unit of Work**・`depends_on: []`（単一ノード DAG）のため、Units Generation の topological order と矛盾する逸脱は存在しない（順序は U1 内部の planned implementation slices 間の economic 判断）。**Bolt は engine の runtime 実行境界ではなく**、正式な walk order は `unit-of-work-dependency.md` と Construction stage semantics に従う。**unit-major** = Unit を Construction stages 3.1〜3.5 へ通す walk mode。

## 採用したヒューリスティック

**Walking-skeleton-first（Cockburn）＋ risk-first の軽量順序付け**。形式的スコアリング（WSJF / Reinertsen CD3 / SAFe）は **不採用**。理由: 単一 unit・solo build・MVP のため重量級スコアリングは過剰で、dependency + risk reduction + learning value + skeleton-first の定性判断で十分に順序が定まる。

## 順序の根拠

1. **B1 Walking Skeleton を最優先**: 最大リスク（決定性・データ/ロジック分離＝リスク A）の**配線と基本決定性**を最初に潰す。layer 間接続・semantic/presentation 分離・deterministic progression/evaluation・stable-ID flow が成立しないと後続 slice 全体に手戻りが波及するため、最も早く証明する。**リスク A は単一 slice で閉じず B1 / B2 / B4 にまたがって段階的に close する**（B1=配線と基本決定性・stable-ID・時刻乱数排除・ScenarioLoader 境界・domain/UI 分離、B2=評価が data/rule で完結し UI 非評価、B4=ja/en invariance と mode invariance）。
2. **B2 で評価を本体化**: リスク A の核である決定的・非単調な 9 Dimension 評価を skeleton の直後に確立。UI に評価ロジックを漏らさない契約をここで固める。
3. **B3 で provenance（リスク B）**: 教育的正確性（4 区分 provenance）は MVP 完成後に後回しにせず評価が意味を持った直後に導入。AI-DLC v2.10.0 仕様と Simulator 独自解釈の混同防止は本プロダクトの信頼性に直結。
4. **B4→B5→B6→B7 で体験を厚くする**: Guided/i18n → Result/永続化 → Adoption Sheet → Focus/Simulation の順で、各 Bolt 終了時にユーザーから見て動く vertical slice を維持しながら価値を積み上げる。
5. **B8 で accessibility（リスク C）を仕上げ**: a11y は B1 から semantic HTML/keyboard/focus を組み込み済みで、ここで WCAG 2.2 AA 観点の完成度と JSON fixture 健全性を担保する（終盤専任で「初めて着手」する意味ではない）。
6. **B9 で AWS deployment readiness**: 外部依存（AWS ホスティング）に紐づくため最終。B9 は Construction 内で **readiness / evidence preparation まで**（production build・config/IaC・smoke-test plan・preflight・evidence capture plan）。**実 deployment execution は Operation の Deployment Execution へ handoff**。「最後に初めて問題が分かる」ことを避けるため Construction 序盤に preflight のみ実施。

## リスク優先順（早期に潰す順）

| 優先 | リスク | 早期対応 | 主な Bolt |
|---|---|---|---|
| 1 | 決定性・データ/ロジック分離（A） | B1=同一入力→同一結果・stable-ID・時刻乱数排除・validation 境界閉塞・domain/UI 分離、B2=data/rule で完結し UI 非評価、B4=ja/en 不変・mode 不変（段階 close） | B1, B2, B4 |
| 2 | provenance / 教育的正確性（B） | 最初の Scenario から 4 区分の最小実装、spec と独自解釈の分離 | B3（B1 で最小フック） |
| 3 | accessibility（C） | B1 から semantic HTML/keyboard/focus/logical order/通知設計、以降で完成度向上 | B8（B1 から着手） |

優先度は **A > B > C** だが、B・C とも最後まで無視しない（B は最初の Scenario から最小実装、C は Bolt 1 から基本を遵守）。

## Topological order との関係

- Units Generation の DAG は単一ノード（U1、`depends_on: []`）。unit 間の topological 制約は自明に空。
- したがって Bolt 順序は topological order から **逸脱していない**（矛盾しうる unit 間辺が存在しない）。順序は U1 内部の vertical slice 間の economic 判断で決めており、その根拠を本書に記録した。

## 外部依存に関するリスク

- runtime 外部依存なし（backend/API/DB/外部 AI API を持たない self-contained static SPA）。
- 唯一の外部要素は AWS ホスティング（B9）。詳細は `external-dependency-map.md`。Construction 序盤に preflight 確認を行い、最終 Bolt で「初めて発覚」するリスクを下げる。
- AI-DLC 工程完了承認と AWS Release Approval は分離（C6）。
