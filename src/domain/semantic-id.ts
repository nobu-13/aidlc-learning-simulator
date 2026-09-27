// runtime semantic ID の決定的導出（BR8.2 / NFR2）。
// semantic key（scenarioId / decisionPointId / orderIndex 等）から決定的に導出し、
// Date / Math.random / performance.now を使わない（ESLint で静的排除される）。
//
// 実装は純粋な文字列連結ベース。衝突は semantic key の一意性で回避する
// （同一 session 内で decisionPoint/order の組は一意）。

export function deriveSessionId(scenarioId: string): string {
  return `sess__${scenarioId}`;
}

export function deriveDecisionRecordId(sessionId: string, decisionPointId: string, orderIndex: number): string {
  return `dr__${sessionId}__${decisionPointId}__${orderIndex}`;
}

export function deriveDimensionOutcomeId(sessionId: string, dimensionId: string): string {
  return `do__${sessionId}__${dimensionId}`;
}

export function deriveLearningResultId(sessionId: string): string {
  return `lr__${sessionId}`;
}
