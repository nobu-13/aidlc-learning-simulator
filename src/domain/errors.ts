// Domain / boundary errors — 境界別に型区別する（ADR-011）。
//
//  - ScenarioValidationError : ScenarioLoader（raw JSON validation 境界）が所有。load 境界に閉じる。
//  - DomainInvariantError    : ScenarioProgression / DimensionEvaluator（runtime）が所有。
//                              lifecycle の errored はこれのみ（silent partial 進行/score をしない）。
//  - PersistenceError        : ProgressStore が所有。復元時の破損/非互換を safe reset の起点にする。
//
// load 境界と runtime lifecycle の error を混在させない。

/** raw Scenario JSON の検証境界エラー（ScenarioLoader 所有）。 */
export class ScenarioValidationError extends Error {
  /** どの Scenario / source を読めなかったか判別するための識別子（FR12）。 */
  readonly ref: string;
  constructor(message: string, ref: string) {
    super(message);
    this.name = "ScenarioValidationError";
    this.ref = ref;
  }
}

/** runtime の不整合（ScenarioProgression / DimensionEvaluator 所有）。握り潰さない。 */
export class DomainInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainInvariantError";
  }
}

/** localStorage 永続の破損 / 非互換（ProgressStore 所有）。domain へ渡さず safe reset の起点。 */
export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceError";
  }
}
