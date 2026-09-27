# Team Allocation — AI-DLC Learning Simulator

> **Bolt** = planning / delivery slice（engine の runtime 実行境界ではない。正式な walk order は `unit-of-work-dependency.md` と Construction stage semantics に従う）。**mob** = 1 つの slice を所有して build する担当（ここでは AI エージェント）。**U1 = 唯一の AI-DLC Unit of Work**、**B1〜B8 は U1 内部の planned implementation slices**。**unit-major** = Unit を Construction stages 3.1〜3.5 へ通す walk mode（Bolt-major ではない）。team formation（1.5）は classic scope では SKIP のため、複数チームの割り当て（Program Board）は発生しない。

## 割り当て方針

- team formation（1.5）は **SKIP**（classic）。したがって Program Board（複数チーム間の割り当て board）は該当なし。
- **全 Bolt を aidlc-developer-agent（AI）が solo build** する。
- **Construction iteration = unit-major**、**staffing = solo**、**execution = sequential**、**strategy = skeleton-first**。
- check-in（承認）は **各 required approval gate** で実施（per-stage、cascade で最後にまとめない）。

## Bolt → Owner

| Bolt | Name | Owner (mob) | 実行 |
|---|---|---|---|
| B1 | Walking Skeleton | aidlc-developer-agent | sequential（先頭） |
| B2 | Deterministic Evaluation 拡充 | aidlc-developer-agent | sequential |
| B3 | Provenance & 教育的正確性 | aidlc-developer-agent | sequential |
| B4 | Guided Learning 体験 & i18n | aidlc-developer-agent | sequential |
| B5 | Result / Reflection & 永続化 | aidlc-developer-agent | sequential |
| B6 | Adoption Review & Discussion Sheet | aidlc-developer-agent | sequential |
| B7 | Focus Scenario Library & Simulation モード | aidlc-developer-agent | sequential |
| B8 | Accessibility 仕上げ & JSON fixture 健全性 | aidlc-developer-agent | sequential |
| B9 | AWS Deployment Readiness & Evidence Preparation | aidlc-developer-agent | sequential（最終・実 deployment は Operation へ handoff） |

## 運用ノート

- 唯一の AI-DLC Unit（U1）を **unit-major** で Construction する。unit-major は「全部まとめて巨大実装」ではなく、U1 を Construction stages 3.1〜3.5 へ通す walk mode。U1 内部は上記 planned implementation slices（B1〜B8）として段階的に build する。
- B1〜B8 は engine 上の独立 runtime boundary ではない（planning slice）。runtime walk source は `unit-of-work-dependency.md`。
- B9 は AWS Deployment **Readiness** & Evidence Preparation まで。実 deployment execution は Operation の Deployment Execution へ handoff。
- 複数チーム所有（team ownership）は選択しない（solo）。よって unit-gate-rhythm の team 設定は該当なし。
- autonomous Construction swarm は unit-major/solo のため発火しない（walk が code-generation を serial 所有）。
- **Coverage != Verification** を維持。
