# User Stories — Assessment

## Decision
Execute.

## Rationale
本プロジェクトはユーザー向けの教育用 Web アプリケーションであり、複数の明確な利用者像（AI-DLC 未経験の学習者、実業務導入を検討する評価者など）と、学習体験・評価・provenance・3 つの学習モードという複数の利用フローを持つ。要件（requirements.md）は FR1–FR12 / NFR1–NFR9 に整理されているが、「誰が・何のために・どの体験で価値を得るか」を User Story として明示することで、下流の design / functional-design が体験単位で検証可能になる。したがって User Stories は価値を付加する。

## Factors Considered
- Project type: greenfield な user-facing 静的 SPA（教育用 Simulator）。
- User-facing scope: 学習体験そのものが成果物であり、UX と学習成果（説明可能性）が中心。
- 複数 persona: 未経験学習者 / 実業務導入評価者 /（審査者・コンテンツ保守者などの副次 persona）。
- 複雑な体験ロジック: 二層構造（Core End-to-End + Focus Scenarios）、非単調な多次元評価、provenance 追跡、3 学習モード（Guided / Simulation / Adoption Review）。

## Key Areas Where Stories Add Most Value
- Core End-to-End の 5〜10 分体験フロー（未経験者の完走と説明可能性）。
- Focus Scenario による重要判断の深掘り。
- 学習モードごとの体験差（Guided / Simulation / Adoption Review）。
- 評価結果・Decision Timeline・Adoption Discussion Sheet による振り返りと実業務導入議論。
- provenance / 教育値と実測値の区別が学習者にどう見えるか。
- i18n（日英）・accessibility（keyboard 完走）・不正データ時の可読エラーという横断的体験。
- v2.10.0 の必須 Learning Topic（boundary/gate 分離・verified Unit/batch checkpoint review・recovery の next-step）を体験単位で Story 化する価値。

> Note: Learning Target = AI-DLC v2.10.0（Change Control で確定）。Development Workflow Runtime = v2.9.0。本 assessment は v2.10.0 再承認後の User Stories 再入時に再保存。
