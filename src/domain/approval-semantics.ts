// ApprovalSemantics — AI-DLC 工程完了承認と（AWS）Release Approval を別概念として区別する（BR7.3 / C6 / FR2.2）。
// これは学習題材上の意味区別であり、UI 表示や Adoption Sheet が両者を混同しないための canonical 定義。
// pure・決定的（time/random 非依存）。

export type ApprovalKind = "completion-approval" | "release-approval";

export interface ApprovalConcept {
  readonly kind: ApprovalKind;
  /** 表示用 locale key。 */
  readonly labelKey: string;
  /** 説明 locale key。 */
  readonly descriptionKey: string;
}

export const COMPLETION_APPROVAL: ApprovalConcept = {
  kind: "completion-approval",
  labelKey: "approval.completion.label",
  descriptionKey: "approval.completion.description",
};

export const RELEASE_APPROVAL: ApprovalConcept = {
  kind: "release-approval",
  labelKey: "approval.release.label",
  descriptionKey: "approval.release.description",
};

/**
 * 2 概念が同一かどうか。常に false（別概念）。学習・表示・Sheet 生成で
 * 「AI-DLC 完了承認 = Release Approval」と扱うことを禁じるためのガード（C6）。
 */
export function isSameApproval(a: ApprovalConcept, b: ApprovalConcept): boolean {
  return a.kind === b.kind;
}
