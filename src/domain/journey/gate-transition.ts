// GateTransition — Human Gate Decision が「次に許される遷移」を domain level で拘束する（P1-2）。
//
// AI-DLC Simulator の中心 semantic: Human が Return for Rework / Block を選んだのに Product が
// それを無視して「次の工程へ」進めてはいけない。UI で button を隠すだけでは不十分なので、
// 許される遷移を pure・決定的に宣言し、UI と state controller の両方がこれを参照する。
//
// pure（time/random/locale/mode 非参照）。表示は呼び出し側が locale key で行う。
import type { GateDecision, ApprovalDecision } from "./journey-entities.ts";

/**
 * Gate/Approval 決定後に許される遷移種別。
 *  - "advance": 通常の次工程へ進む（Approve 系のみ）。
 *  - "rework": 同一/前工程へ戻して Agent Rework を強制する（Return 系）。
 *  - "blocked": ブロック状態で停止（次工程へは進まない・明示的再検討のみ）。
 */
export type AllowedTransition = "advance" | "rework" | "blocked";

/**
 * Review Gate 決定（J1..J6）に対して許される遷移集合を返す（決定的）。
 *
 *  - approve                : advance のみ（通常の次工程）。
 *  - approve-with-conditions: advance（条件付きで進む・教育上の許容）。
 *  - return-for-rework      : rework のみ（次工程へは絶対に進めない）。
 *  - change-scope           : rework のみ（スコープ変更は再作業として扱う。次工程直行は不可）。
 *  - block                  : blocked のみ（次工程へ進めない）。
 */
export function allowedTransitionsForGate(decision: GateDecision): readonly AllowedTransition[] {
  switch (decision) {
    case "approve":
    case "approve-with-conditions":
      return ["advance"];
    case "return-for-rework":
    case "change-scope":
      return ["rework"];
    case "block":
      return ["blocked"];
  }
}

/**
 * Completion / Release 承認（J7/J8）に対して許される遷移集合を返す（決定的）。
 *  - approve / approve-with-conditions: advance（Completion→Release / Release→完了）。
 *  - return                           : rework のみ（差し戻し。前へ進めない）。
 *  - block                            : blocked のみ。
 */
export function allowedTransitionsForApproval(decision: ApprovalDecision): readonly AllowedTransition[] {
  switch (decision) {
    case "approve":
    case "approve-with-conditions":
      return ["advance"];
    case "return":
      return ["rework"];
    case "block":
      return ["blocked"];
  }
}

/** Gate 決定が「次工程への advance」を許すか（UI の Next 表示可否・state guard 共通判定）。 */
export function gateAllowsAdvance(decision: GateDecision): boolean {
  return allowedTransitionsForGate(decision).includes("advance");
}

/** Gate 決定が rework を要求するか（Return / Change Scope）。 */
export function gateRequiresRework(decision: GateDecision): boolean {
  return allowedTransitionsForGate(decision).includes("rework");
}

/** Gate 決定が blocked（停止）か。 */
export function gateIsBlocked(decision: GateDecision): boolean {
  return allowedTransitionsForGate(decision).includes("blocked");
}

/** Approval 決定が advance を許すか（Completion→Release 等）。 */
export function approvalAllowsAdvance(decision: ApprovalDecision): boolean {
  return allowedTransitionsForApproval(decision).includes("advance");
}
