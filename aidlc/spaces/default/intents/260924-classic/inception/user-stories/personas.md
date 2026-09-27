# Personas — AI-DLC Learning Simulator

> 主 persona = P1 / P2、副 persona = P3 / P4。Story 優先は P1/P2 中心。Learning Target = AI-DLC v2.10.0。

## P1. AI-DLC 未経験の学習者（主）

- **役割**: ソフトウェア開発者・エンジニアリングマネージャー等で、AI-DLC を初めて学ぶ人。
- **ゴール**: 5〜10 分で AI-DLC の全体像と主要判断を体験し、「なぜその判断が必要か」を自分の言葉で説明できるようになる。
- **Pain Points**: Stage 名や用語の暗記になりがち。Human/Agent の境界や承認の意味が抽象的で腹落ちしない。読むだけでは判断の感覚がつかめない。
- **Context**: 事前知識を前提にできない。短時間で全体像を掴みたい。日本語または英語。
- **優先度**: 最高（Core End-to-End と Guided Learning の主対象）。

## P2. 実業務導入の評価者（主）

- **役割**: テックリード / アーキテクト / EM で、チームへの AI-DLC 導入を検討している。
- **ゴール**: 体験を通じて、自チームの Delegation / Approval / Evidence / Change Control をどう設計するか議論する材料を持ち帰る。
- **Pain Points**: 導入判断に足る具体性が欲しい。教材の「正解」が仕様由来か教材独自の推奨かを区別したい。誇張された効果主張を信用しない。
- **Context**: Adoption Review モードと Adoption Discussion Sheet の主対象。provenance と実測値/教育値の区別を重視。
- **優先度**: 最高（Practical Adoption Value の主対象）。

## P3. Hackathon 審査者（副）

- **役割**: 短時間で本 Simulator の価値を判断する審査者。
- **ゴール**: 英語でも滞りなく Core End-to-End を完走し、教育的価値と技術的正確性を素早く把握する。
- **Pain Points**: 時間が限られる。片言語混在や破綻があると評価が下がる。
- **Context**: 英語既定で利用しうる。補助的 persona——P1/P2 の価値を犠牲にしない範囲で配慮。
- **優先度**: 中（補助。i18n・完走性・明快さで間接的に満たす）。

## P4. Scenario 保守者・貢献者（副。ただし明示的に Story 化）

- **役割**: Focus Scenario を JSON で追加・保守する開発者 / 教材作成者。
- **ゴール**: domain logic を原則変更せず Scenario を JSON で追加でき、provenance を維持し、AI-DLC 一次情報と Simulator 独自解釈を区別でき、不正な Scenario を validation で検出できる。
- **Pain Points**: データとロジックが混ざると拡張が難しい。壊れた教材が黙って動くと学習の信頼性が落ちる。教材の正確性（spec vs 独自解釈）が曖昧だと保守判断ができない。
- **Context**: NFR5（Maintainability/Data-driven）・FR3・FR6・FR12 の主対象。
- **優先度**: 中〜高（副 persona だが保守性・正確性・provenance の要として明示的に Story 化）。

## Persona 関係と優先順位

1. **P1 / P2 を中心**に Story を構成する（Educational Value / Practical Adoption Value 最優先）。
2. **P3** は主に i18n・完走性・明快さで間接的に満たす（審査者向け専用最適化で主 persona の価値を下げない）。
3. **P4** は保守性・provenance・不正データ処理の担保として明示的に Story 化する。
