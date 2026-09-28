// Practice の provenance 定義（scenario とは独立に practice が参照する）。
// category は simulator-interpretation（教材化した解釈）で、ai-dlc-spec の一次情報を reference で示す。
import type { ProvenanceEntry } from "../entities.ts";

const ENTRIES: readonly ProvenanceEntry[] = [
  {
    provenanceId: "pv-practice-req",
    category: "simulator-interpretation",
    reference: "AI-DLC v2.10.0 — Requirements & Acceptance Criteria",
    noteKey: "practice.pv.req",
  },
  {
    provenanceId: "pv-practice-ev",
    category: "simulator-interpretation",
    reference: "AI-DLC v2.10.0 — Testing Contract & Executed vs Passed",
    noteKey: "practice.pv.ev",
  },
  {
    provenanceId: "pv-practice-cls",
    category: "simulator-interpretation",
    reference: "AI-DLC v2.10.0 — Human/Agent Boundary & Approval Gate",
    noteKey: "practice.pv.cls",
  },
  {
    provenanceId: "pv-practice-tr",
    category: "simulator-interpretation",
    reference: "AI-DLC v2.10.0 — Traceability",
    noteKey: "practice.pv.tr",
  },
  {
    provenanceId: "pv-practice-cc",
    category: "simulator-interpretation",
    reference: "AI-DLC v2.10.0 — Change Control",
    noteKey: "practice.pv.cc",
  },
];

const BY_ID = new Map<string, ProvenanceEntry>(ENTRIES.map((e) => [e.provenanceId, e]));

export function getPracticeProvenance(provenanceId: string): ProvenanceEntry | undefined {
  return BY_ID.get(provenanceId);
}
