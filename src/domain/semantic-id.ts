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

// ---------- RC6 P2: opaque DOM id（answer semantic を露出しない） ----------
//
// 監査所見: review item の DOM id / data-testid に slotId をそのまま使っており、
// "-omission" / "-distractor" / "-valid" / "-mismatch" / "-scope-creep" / "-gap" / "-insufficient" 等の
// answer semantic が User-facing DOM に漏れていた（DOM を見れば defect 項目が分かる）。
//
// 対策: slotId（internal domain id）を決定的な opaque token へ写像する。
//  - 決定的: 同一 slotId → 同一 token（stable。テスト/hydration で安定）。
//  - opaque: answer semantic 語（omission/distractor/valid...）を含まない 16 進 hash。
//  - 衝突回避: slotId は artifact 内で一意なので token も一意（FNV-1a 32bit で十分）。
// これにより DOM を観察しても「どの項目が defect か」を推測できない。

/** FNV-1a 32bit（決定的・非暗号）。answer semantic を含まない opaque token 生成に使う。 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32bit 乗算（決定的）。
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * slot/item id を answer semantic を含まない opaque な安定 DOM token へ写像する。
 * 例: "req-item-omission" → "itm_1a2b3c4d"（内部語彙を含まない）。
 * User-facing DOM identifier（id / data-testid）に使う。
 */
export function opaqueItemToken(itemId: string): string {
  return `itm_${fnv1a32(itemId).toString(16).padStart(8, "0")}`;
}
