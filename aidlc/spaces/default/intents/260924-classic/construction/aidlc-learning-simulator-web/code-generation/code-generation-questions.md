# Code Generation Questions — U1: aidlc-learning-simulator-web

## Plan Approval

このシナリオの Code Generation plan（`code-generation-plan.md`、その埋め込み Testing Contract を含む）と unit test instructions（`unit-test-instructions.md`）を承認しますか。

対象 plan の要点:
- static React + TypeScript(strict) + Vite SPA。`/src` を domain(pure) / data(境界 validation・localStorage) / scenarios(JSON data) / i18n / app(結線) / ui(React) に分離。
- 14 step（test-after baseline、deterministic core は test-first/concurrent）。Vitest + coverage-v8 + Testing Library/user-event + jest-axe + zod + ESLint(jsx-a11y, time/random 排除) + Prettier。
- 決定的評価（9 Dimension・非単調 3 軸・golden・順序不変・note 採点除外）、provenance 4 区分表示、i18n 不変性・欠落検出、localStorage safe reset / user reset、不正 Scenario の可視エラー（無言停止しない）。
- **AWS/Kiro preflight（Option B・§3）**: Approve Plan の**直後・かつ Step 1 以降のコード生成の前**に、READ-ONLY preflight PF1–PF6 を **AWS MCP Server + Agent Toolkit for AWS**（primary AWS development interface）経由で実行し、全 PF PASS を prerequisite とする（PASS まで Step 1 に進まない）。AWS Documentation MCP は公式 documentation 参照専用に役割限定。development-time capability は Simulator の runtime dependency にしない（runtime は client-only static SPA を維持）。secret 非露出・prod resource 作成なし・CFN/deploy は Operation・AWS live は Hackathon Release blocker、の方針は不変。

選択肢:
- "Approve Plan" — code generation へ進む（承認直後に preflight を実行）
- "Request Changes" — plan を修正する

[Approval Fingerprint]: sha256:v3:dc5e85cb96bf65f758b3f2a744a154faaf64309030ea5e97769766bd85eaf902
[Planned Source]: ffbe40b4ecc28b9bc7ddf3f943e8b6d722cc6878ed76f913726639d77628c66b

[Answer]: Approve Plan
