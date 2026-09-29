// JourneyDiff — RC4 Phase 3 Step 6。Journey state から 2 種類の Diff を **derived**（永続しない）に構築する。
//
// pure・決定的（time / random / locale / mode 非参照）。structural diff の突合は diff-engine に委譲する。
//
// 2 種類を明確に分離する（混ぜない・要件）:
//  A. Local Rework Diff  — 同一 step の「前 Artifact Version → 現 Artifact Version」。
//       原因: local Human Return → Agent Rework。
//  B. Propagation Diff   — direct downstream step の「upstream unresolved 下 → upstream resolved 下」。
//       原因: upstream の Decision / defect resolution。
//
// どちらも diffArtifacts が返す構造 diff（changeType / identity / before body / after body）を持つ。
// Anti-Fake: Propagation Diff は実際に content が変わる（before≠after）ときだけ hasChanges=true。
// content 変化が無ければ空 diff を返す（「影響しました」を捏造しない）。
import type { GeneratedArtifact, JourneyStepId } from "./journey-entities.ts";
import { buildArtifactForStep, type JourneyRunInput } from "./journey-engine.ts";
import { diffArtifacts, type ArtifactDiff } from "./diff-engine.ts";
import { directUpstreamStepOf } from "./propagation-engine.ts";
import {
  revisionOf,
  artifactVersionOf,
  resolvedDefectIdsOf,
  defectStagesOf,
  type JourneyProgress,
} from "./rework-state-machine.ts";

/** Local Rework Diff の結果（原因 = local rework）。before が無い（未 rework）なら diff は undefined。 */
export interface LocalReworkDiffResult {
  readonly stepId: JourneyStepId;
  /** before = 前 Artifact Version（revision-1）、after = 現 Artifact Version。未 rework なら undefined。 */
  readonly diff: ArtifactDiff | undefined;
  readonly before: GeneratedArtifact | undefined;
  readonly after: GeneratedArtifact;
}

/** Propagation Diff の結果（原因 = upstream defect resolution）。伝播が無ければ diff は undefined。 */
export interface PropagationDiffResult {
  readonly targetStepId: JourneyStepId;
  /** この伝播の起点（direct upstream step）。upstream が無い step では undefined。 */
  readonly originStepId: JourneyStepId | undefined;
  /** before = upstream unresolved 下の downstream、after = upstream resolved 下の downstream。 */
  readonly diff: ArtifactDiff | undefined;
  readonly before: GeneratedArtifact | undefined;
  readonly after: GeneratedArtifact | undefined;
}

/**
 * 指定 progress の「その step の直前 Artifact Version」を再現するための progress を作る（決定的）。
 *
 * local rework は revision と artifactVersion を同時に +1 し、resolvedDefectIds をその Return の
 * targetedDefectIds ぶん単調追加する。よって「前バージョン」は:
 *  - resolvedDefectIds[step] から「最後にこの step を対象にした Return の targetedDefectIds」を除いたもの
 *  - revisions[step] = 現在 -1
 *  - artifactVersions[step] = 現在 -1（Phase 3 state のときのみ）
 * で決定的に再構築できる。未 rework（revision 0）なら null。
 */
function previousLocalVersionProgress(
  progress: JourneyProgress,
  stepId: JourneyStepId,
): JourneyProgress | null {
  const currentRevision = revisionOf(progress, stepId);
  if (currentRevision <= 0) return null; // 前バージョンが存在しない。

  // 最後にこの step を対象にした実 rework（no-op でない）entry の targetedDefectIds を引く。
  let lastTargeted: readonly string[] | undefined;
  for (const e of progress.reworkHistory) {
    if (e.toStepId === stepId && e.isNoOpAttempt !== true) lastTargeted = e.targetedDefectIds ?? [];
  }
  const currentResolved = new Set(resolvedDefectIdsOf(progress, stepId));
  for (const id of lastTargeted ?? []) currentResolved.delete(id);

  const revisions = { ...progress.revisions, [stepId]: currentRevision - 1 };
  const resolvedDefectIds = { ...progress.resolvedDefectIds, [stepId]: [...currentResolved] };

  // RC4 Final: 前バージョンでは最後の Return で進めた defect stage を 1 段階戻す
  // （multi-stage の partial → 前 stage を正しく再現するため）。resolved から外れたものも
  // stage を巻き戻すことで、before 本文（defective / 前の partial）が正しく生成される。
  const prevStages = { ...defectStagesOf(progress, stepId) };
  for (const id of lastTargeted ?? []) {
    const cur = prevStages[id] ?? 0;
    if (cur > 0) prevStages[id] = cur - 1;
    else delete prevStages[id];
  }
  const defectStages = { ...(progress.defectStages ?? {}), [stepId]: prevStages };

  // artifactVersions は Phase 3 state のときだけ巻き戻す（legacy は触らない）。
  const av = artifactVersionOf(progress, stepId);
  const artifactVersions =
    progress.artifactVersions === undefined || av === undefined
      ? progress.artifactVersions
      : { ...progress.artifactVersions, [stepId]: Math.max(0, av - 1) };

  return {
    ...progress,
    revisions,
    resolvedDefectIds,
    defectStages,
    ...(artifactVersions !== undefined ? { artifactVersions } : {}),
  };
}

/**
 * A. Local Rework Diff を構築する（決定的）。
 * after = 現在の Artifact、before = 直前 Artifact Version（1 つ前の local rework 時点）。
 * 未 rework（revision 0）のときは before なし・diff undefined（変更点表示を出さない）。
 *
 * この Diff は「同一 step の local Human Return → Agent Rework で何が corrected 化したか」を示す。
 * Propagation（upstream 由来）とは混ぜない。
 */
export function localReworkDiff(input: JourneyRunInput, stepId: JourneyStepId): LocalReworkDiffResult {
  const after = buildArtifactForStep(input, stepId);
  const prevProgress = previousLocalVersionProgress(input.progress, stepId);
  if (prevProgress === null) {
    return { stepId, diff: undefined, before: undefined, after };
  }
  const before = buildArtifactForStep({ ...input, progress: prevProgress }, stepId);
  return { stepId, diff: diffArtifacts(before, after), before, after };
}

/**
 * B. Propagation Diff を構築する（決定的）。
 * target step の direct upstream で resolved になった defect による content 変化を示す。
 * after = 現在（upstream resolved を含む）の downstream Artifact、
 * before = 同じ downstream を「その upstream resolved を無かったことにした」state で生成したもの。
 *
 * Anti-Fake: 実際に content が変わる（before≠after）ときだけ diff.hasChanges=true。
 * upstream に resolved defect が無い / 伝播で content が変わらないなら空 diff（捏造しない）。
 */
export function propagationDiff(input: JourneyRunInput, targetStepId: JourneyStepId): PropagationDiffResult {
  const originStepId = directUpstreamStepOf(targetStepId);
  const after = buildArtifactForStep(input, targetStepId);

  if (originStepId === undefined) {
    return { targetStepId, originStepId: undefined, diff: undefined, before: after, after };
  }

  // upstream(origin) の resolved を「無かったことにした」before-state を作る。
  const upstreamResolved = resolvedDefectIdsOf(input.progress, originStepId);
  if (upstreamResolved.length === 0) {
    // resolved が無ければ propagation improvement は起きない → before/after は同一。
    return { targetStepId, originStepId, diff: undefined, before: after, after };
  }
  const beforeResolved = { ...input.progress.resolvedDefectIds };
  delete beforeResolved[originStepId];
  const beforeProgress: JourneyProgress = { ...input.progress, resolvedDefectIds: beforeResolved };
  const before = buildArtifactForStep({ ...input, progress: beforeProgress }, targetStepId);

  const diff = diffArtifacts(before, after);
  // 実際に変化が無ければ diff を undefined にして「影響しました」を出さない。
  return {
    targetStepId,
    originStepId,
    diff: diff.hasChanges ? diff : undefined,
    before,
    after,
  };
}
