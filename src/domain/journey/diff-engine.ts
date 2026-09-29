// DiffEngine — RC4 Phase 3。2 つの Artifact revision を構造的に比較して「何が変わったか」を出す。
//
// pure・決定的（time / random / locale / mode 非参照）。text diff アルゴリズムは使わない。
// slot / item identity（itemId）+ variantKey / contentState / bodyKey ベースの structural diff。
//
// 用途: Rework 後の Review 画面で「Before → After」を人間が読めるようにする（Anti-Fake Diff:
// revision 番号比較や "updated" ラベルだけにしない。実 before/after 本文 key を出す）。
import type { GeneratedArtifact, ArtifactItem } from "./journey-entities.ts";

export type DiffChangeType = "added" | "changed" | "removed";

/** 1 項目の変更。表示文言は locale key（bodyKey/labelKey）で、UI が解決する。 */
export interface ArtifactItemChange {
  readonly changeType: DiffChangeType;
  readonly slotId: string;
  readonly itemId: string;
  /** 変更前の本文 key（added では undefined）。 */
  readonly beforeBodyKey?: string | undefined;
  /** 変更後の本文 key（removed では undefined）。 */
  readonly afterBodyKey?: string | undefined;
  /** item のラベル key（表示見出し）。 */
  readonly labelKey?: string | undefined;
  /** この変更の原因 defect id（corrected 化した slot なら after item の defectId）。 */
  readonly reasonDefectId?: string | undefined;
  /** 変更サマリ locale key（after artifact の changeSummaryKeys 由来・あれば）。 */
  readonly changeSummaryKey?: string | undefined;
  /** before/after の contentState（"defective" → "corrected" 等）。 */
  readonly beforeContentState?: ArtifactItem["contentState"] | undefined;
  readonly afterContentState?: ArtifactItem["contentState"] | undefined;
}

export interface ArtifactDiff {
  readonly artifactIdBefore: string;
  readonly artifactIdAfter: string;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly journeyStepId: string;
  /** unchanged を含まない変更のみ（決定的順序: after の item 定義順、removed は before 順で末尾）。 */
  readonly changes: readonly ArtifactItemChange[];
  /** 変更が 1 件でもあるか（UI が What changed card を出すか判定）。 */
  readonly hasChanges: boolean;
}

/** item 比較の identity。RC4 では itemId が slot と 1:1（artifact-generator-v2）。 */
function itemKey(it: ArtifactItem): string {
  return it.itemId;
}

/**
 * item の「本文が変わったか」を判定する。variantKey があればそれで、無ければ bodyKey で比較（決定的）。
 * variantKey は `slotId::state`（baseline/defective/corrected）なので content-state 変化を確実に捉える。
 */
function itemContentChanged(before: ArtifactItem, after: ArtifactItem): boolean {
  const beforeVariant = before.variantKey ?? before.bodyKey;
  const afterVariant = after.variantKey ?? after.bodyKey;
  return beforeVariant !== afterVariant;
}

/**
 * before/after Artifact を構造的に比較して ArtifactDiff を返す。決定的。
 *
 * - changed: 同一 itemId が両方に存在し、variantKey/bodyKey が変化。
 * - added:   after にのみ存在する itemId。
 * - removed: before にのみ存在する itemId。
 * - unchanged: diff.changes に含めない（要件 3）。
 *
 * reasonDefectId は after item の defectId（corrected 化した slot の原因 defect）。
 * changeSummaryKey は after.changeSummaryKeys のうち、その slot 由来のもの（本文 key の照合で近似）。
 */
export function diffArtifacts(before: GeneratedArtifact, after: GeneratedArtifact): ArtifactDiff {
  const beforeById = new Map<string, ArtifactItem>();
  for (const it of before.items) beforeById.set(itemKey(it), it);
  const afterById = new Map<string, ArtifactItem>();
  for (const it of after.items) afterById.set(itemKey(it), it);

  const changes: ArtifactItemChange[] = [];

  // after の定義順で added / changed を検出（決定的順序）。
  for (const aItem of after.items) {
    const id = itemKey(aItem);
    const bItem = beforeById.get(id);
    if (bItem === undefined) {
      changes.push({
        changeType: "added",
        slotId: id,
        itemId: id,
        afterBodyKey: aItem.bodyKey,
        labelKey: aItem.labelKey,
        reasonDefectId: aItem.defectId,
        afterContentState: aItem.contentState,
      });
      continue;
    }
    if (itemContentChanged(bItem, aItem)) {
      // RC6 P2: reason は after item 自身の changeSummaryKey（finding 単位）を最優先で使う。
      // これにより別 finding の理由を reuse しない。無い場合のみ step 全体からの近似 fallback。
      const reasonKey = aItem.changeSummaryKey ?? pickChangeSummary(after, id);
      changes.push({
        changeType: "changed",
        slotId: id,
        itemId: id,
        beforeBodyKey: bItem.bodyKey,
        afterBodyKey: aItem.bodyKey,
        labelKey: aItem.labelKey,
        reasonDefectId: aItem.defectId ?? bItem.defectId,
        ...(reasonKey !== undefined ? { changeSummaryKey: reasonKey } : {}),
        beforeContentState: bItem.contentState,
        afterContentState: aItem.contentState,
      });
    }
  }

  // before にのみ存在する item = removed（before 定義順）。
  for (const bItem of before.items) {
    const id = itemKey(bItem);
    if (!afterById.has(id)) {
      changes.push({
        changeType: "removed",
        slotId: id,
        itemId: id,
        beforeBodyKey: bItem.bodyKey,
        labelKey: bItem.labelKey,
        reasonDefectId: bItem.defectId,
        beforeContentState: bItem.contentState,
      });
    }
  }

  return {
    artifactIdBefore: before.artifactId,
    artifactIdAfter: after.artifactId,
    revisionBefore: before.revision,
    revisionAfter: after.revision,
    journeyStepId: after.journeyStepId,
    changes,
    hasChanges: changes.length > 0,
  };
}

/**
 * after artifact の changeSummaryKeys から、指定 slot（itemId）に対応するサマリ key を選ぶ。
 * changeSummaryKey は content-template で slot ごとに定義されており、命名規約上 slot を含むため
 * 「その slot に対応する summary」を決定的に近似できる。1 件も無ければ undefined。
 *
 * Phase 3 では厳密な slot→summary マップを content-loader が持たないため、
 * 「changeSummaryKeys が 1 件だけならそれ、複数なら slotId 断片一致」で選ぶ（決定的・保守的）。
 */
function pickChangeSummary(after: GeneratedArtifact, itemId: string): string | undefined {
  const keys = after.changeSummaryKeys;
  if (keys.length === 0) return undefined;
  if (keys.length === 1) return keys[0];
  // slotId の末尾トークン（例 missing-nfr）を含む summary を優先。
  const token = itemId.replace(/^.*-item-/, "").replace(/^design-item-/, "");
  const matched = keys.find((k) => k.toLowerCase().includes(token.toLowerCase()));
  return matched ?? keys[0];
}
