// ProgressStore — localStorage 永続の port/adapter（ADR-008 / FR11 / BR6.x）。
//
// stable-ID ベースで保存し表示文言を保存しない（BR6.1）。persistenceSchemaVersion を検証し
// 非互換は safe reset（silent coercion 禁止・BR6.2）。破損は PersistenceError→domain へ渡さず
// safe reset（BR6.3）。加えて user-triggered reset（NFR7.5a、privacy）を提供する。
//
// no-network posture: 保存先は localStorage のみ、外部送信しない（security-design §1）。
import { PersistenceError } from "../domain/errors.ts";
import type {
  AdoptionReviewMemo,
  DecisionRecord,
  ExperienceMode,
  Locale,
  ScenarioSession,
} from "../domain/entities.ts";

/**
 * 永続 schema バージョン（Scenario schemaVersion とは独立・BR6.2）。
 * v2（RC2 Stabilization）: mode / workshopInputs / practiceDrafts を追加。
 * v3（RC3）: journey（RC3 Journey 状態）を追加。
 * v1 → v2 → v3 は「不足フィールドを空で補う」additive migration（既存 scenario 進捗を失わない）。
 * RC2 の in-progress scenario は RC3 Journey へ無理に変換しない（journey は空で開始）。
 *
 * v4（RC4 Final）: PersistedJourney に artifactVersions / materializedSteps を追加（Persistence v4）。
 * RC4 では localRevision と artifactVersion が別軸になり、propagation により
 * revision != artifactVersion が起こり得る。これらは v3 以前には保存されておらず、
 * completed/current/revisions からは正確に復元できない（heuristic migration 禁止）。
 * したがって:
 *  - v4 journey: artifactVersions / materializedSteps を exact restore。
 *  - v1/v2/v3 の非 journey 進捗（scenario 等）: additive に受理（既存挙動を維持）。
 *  - v1/v2/v3 に含まれる journey: safe reset（restore せず null）。journey が存在した場合は
 *    recovered="incompatible" を通知して「新しい Journey として開始した」旨を UI が示せるようにする。
 */
export const PERSISTENCE_SCHEMA_VERSION = 4;

/**
 * 後方互換で受理する旧バージョン（非 journey 進捗の additive migration 対象）。
 * これらの版に含まれる journey は RC4 と非互換なので safe reset する（下記 tryValidate 参照）。
 * v3 を追加: v3 journey も artifactVersions/materializedSteps を持たないため safe reset の対象。
 */
const MIGRATABLE_VERSIONS: readonly number[] = [1, 2, 3];

const STORAGE_KEY = "aidlc-learning-simulator/progress/v1";

/**
 * Practice 下書き（practiceId → 任意 key/value テキスト）。
 * semantic data ではない自由入力なので生テキストを保持する（locale 非依存）。
 */
export type PracticeDrafts = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Adoption Workshop の user-authored 入力（heading slug → text）。locale 非依存。 */
export type WorkshopInputs = Readonly<Record<string, string>>;

/**
 * RC3 Journey の永続 snapshot（stable-ID ベース・表示文言を含まない）。
 * mode / journey position / structured & user-authored inputs / reviews / decisions /
 * rework history / approvals を保持する（Design §19 / Human Decision 11）。
 * 型は JSON 直列化可能な最小構造にとどめ、domain 型に依存しすぎない（migration 安定性）。
 */
export interface PersistedJourney {
  readonly mode: ExperienceMode;
  readonly profileId: string;
  /** RC4: Project Archetype id（additive）。未指定の旧データは復元時に default 補完。 */
  readonly archetypeId?: string | undefined;
  readonly currentStepId: string;
  readonly userAuthored: Readonly<Record<string, string>>;
  readonly structured: Readonly<Record<string, string>>;
  readonly revisions: Readonly<Record<string, number>>;
  readonly completedStepIds: readonly string[];
  readonly reworkHistory: readonly {
    readonly fromStepId: string;
    readonly toStepId: string;
    readonly action: string;
    readonly trigger: string;
    readonly atRevision: number;
    /** RC4 Phase 2: additive。Return で指定された実 defect id。 */
    readonly targetedDefectIds?: readonly string[] | undefined;
    /** RC4 Phase 2: additive。解決済みスナップショット。 */
    readonly resolvedDefectIds?: readonly string[] | undefined;
    /** RC4 Phase 2: additive。残存 defect id。 */
    readonly remainingDefectIds?: readonly string[] | undefined;
    /** RC4 Phase 2 修正: additive。no-op rework 試行（revision を進めなかった）フラグ。 */
    readonly isNoOpAttempt?: boolean | undefined;
    /** RC4 Final: additive。この Return で reviewer が書いた Review note（quote のみ）。 */
    readonly reviewNote?: string | undefined;
  }[];
  /**
   * RC4 Phase 2: step id → 解決済み defect id 集合（additive）。
   * reload / Resume 後に corrected Artifact が defective へ戻らないために保存する。
   * 未指定の旧データは空（= RC3 と同じ全未解決挙動）。
   */
  readonly resolvedDefectIds?: Readonly<Record<string, readonly string[]>> | undefined;
  /**
   * RC4 Final: step id → defectId → 到達済み resolution stageIndex（multi-stage の partial 保持）。
   * additive（v4 内で後方互換・欠落時は空 = 全 defect stage 0 = 従来 binary 挙動）。
   * resolvedDefectIds（terminal）と整合するように exact 保存する。
   */
  readonly defectStages?: Readonly<Record<string, Readonly<Record<string, number>>>> | undefined;
  /**
   * RC4 Persistence v4: step id → artifactVersion（Artifact content 全体の version）。
   * localRevision（revisions）とは別軸。propagation content change でも増えるため exact 保存が必須。
   * v4 で導入。v3 以前には存在しないため、旧 journey は safe reset される（heuristic 補完しない）。
   */
  readonly artifactVersions?: Readonly<Record<string, number>> | undefined;
  /**
   * RC4 Persistence v4: step id → materialize 済みか。
   * 未 materialized の downstream は初回生成で artifactVersion 0、materialized は propagation で +1
   * という semantic の判定に必要。completed/current からは正確に復元できないため exact 保存する。
   * v4 で導入。v3 以前には存在しないため、旧 journey は safe reset される。
   */
  readonly materializedSteps?: Readonly<Record<string, boolean>> | undefined;
  readonly reviews: Readonly<
    Record<
      string,
      {
        readonly findings: readonly { readonly itemId: string; readonly severity?: string }[];
        readonly gateDecision: string;
        readonly noteText?: string;
      }
    >
  >;
  readonly completionDecision?: string | undefined;
  readonly releaseDecision?: string | undefined;
  readonly releaseConflated?: boolean | undefined;
  /**
   * RC5 P1-D: Conditional Approval（構造化条件）の永続化（additive・JSON 最小構造）。
   * approve-with-conditions で記録した条件を reload / Resume 後も保持する。
   */
  readonly conditionalApprovals?:
    | readonly {
        readonly sourceStepId: string;
        readonly findingIds: readonly string[];
        readonly condition: string;
        readonly requiredEvidence?: string | undefined;
        readonly dueGate: string;
        readonly status: string;
        readonly highestSeverity?: string | undefined;
      }[]
    | undefined;
  /** Setup 中の下書き（F1・additive）。beginJourney 前の Simulation/Adoption 入力を保持。 */
  readonly draftUserAuthored?: Readonly<Record<string, string>> | undefined;
  readonly draftStructured?: Readonly<Record<string, string>> | undefined;
  /** 保存時の view（F1/F2 の resume routing 補助・additive）。 */
  readonly savedView?: string | undefined;
  /** journey が完了済みか（F2 resume routing・additive）。 */
  readonly journeyComplete?: boolean | undefined;
  /** finding-level 学習履歴（F3/F4・additive）。JSON 直列化可能な最小構造。 */
  readonly learningHistory?:
    | {
        readonly entries: readonly {
          readonly itemTitleKey: string;
          readonly itemBodyKey: string;
          readonly mistakeType: string;
          readonly severity?: string;
          readonly whyItMattersKey?: string;
          readonly originStepId?: string;
          readonly affectedLaterStepId?: string;
          readonly consequenceKey?: string;
          readonly revisitStepId?: string;
        }[];
        readonly totalMissed: number;
        readonly totalFalse: number;
      }
    | undefined;
  /**
   * 未 submit の Review 下書き（G1・additive）。step ごとに保持。
   * artifactId は復元時の一致判定に使う（revision ずれの誤 hydrate 防止）。
   */
  readonly reviewDrafts?:
    | Readonly<
        Record<
          string,
          {
            readonly artifactId: string;
            readonly findings: readonly { readonly itemId: string; readonly severity?: string }[];
            readonly gateDecision: string;
            readonly noteText?: string;
          }
        >
      >
    | undefined;
}

/** 永続化される snapshot（stable-ID ベース・表示文言を含まない）。 */
export interface PersistedProgress {
  readonly persistenceSchemaVersion: number;
  readonly locale: Locale;
  /** 学習モード（進捗の再開に必要。評価には影響しない）。 */
  readonly mode: ExperienceMode;
  readonly sessions: readonly ScenarioSession[];
  readonly decisionRecords: readonly DecisionRecord[];
  readonly completedScenarioIds: readonly string[];
  readonly adoptionMemos: readonly AdoptionReviewMemo[];
  /** Adoption Workshop の user-authored 入力。 */
  readonly workshopInputs: WorkshopInputs;
  /** Practice ごとの下書き。 */
  readonly practiceDrafts: PracticeDrafts;
  /** RC3 Journey 状態（未開始なら null）。v3 で追加。 */
  readonly journey: PersistedJourney | null;
}

/** 空の初期状態（safe reset の到達点）。 */
export function emptyProgress(locale: Locale): PersistedProgress {
  return {
    persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
    locale,
    mode: "guided",
    sessions: [],
    decisionRecords: [],
    completedScenarioIds: [],
    adoptionMemos: [],
    workshopInputs: {},
    practiceDrafts: {},
    journey: null,
  };
}

/** localStorage 互換の最小 port（テストで in-memory fake を注入するため）。 */
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  readonly progress: PersistedProgress;
  /**
   * 復元時に破損/非互換で safe reset した場合の通知（ユーザー通知に使う）。
   * "corrupt" | "incompatible" | null（正常）。
   */
  readonly recovered: "corrupt" | "incompatible" | null;
}

export class ProgressStore {
  private readonly storage: StoragePort;

  constructor(storage: StoragePort) {
    this.storage = storage;
  }

  /**
   * 復元。破損→PersistenceError を内部で捕捉し safe reset（破損 object を domain へ渡さない・BR6.3）。
   * 非互換 persistenceSchemaVersion→safe reset（silent coercion しない・BR6.2）。
   * どちらも recovered で通知する。
   */
  load(defaultLocale: Locale): LoadResult {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { progress: emptyProgress(defaultLocale), recovered: null };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // 破損 JSON: PersistenceError を起こさず safe reset（domain へ渡さない）。
      return { progress: emptyProgress(defaultLocale), recovered: "corrupt" };
    }
    const validated = this.tryValidate(parsed);
    if (validated === "corrupt") {
      return { progress: emptyProgress(defaultLocale), recovered: "corrupt" };
    }
    if (validated === "incompatible") {
      return { progress: emptyProgress(defaultLocale), recovered: "incompatible" };
    }
    // 非 journey 進捗は受理しつつ、旧版の journey を RC4 非互換として safe reset した場合は
    // recovered="incompatible" を通知する（scenario 進捗は失わない・journey だけ new clean）。
    return { progress: validated.progress, recovered: validated.journeyWasReset ? "incompatible" : null };
  }

  /** 保存。書き込み失敗は PersistenceError（呼び出し側が扱う）。 */
  save(progress: PersistedProgress): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      throw new PersistenceError(`進捗の保存に失敗しました: ${String(e)}`);
    }
  }

  /** user-triggered reset（NFR7.5a）: localStorage をクリアする。BR6.x の safe reset とは別概念。 */
  userReset(): void {
    this.storage.removeItem(STORAGE_KEY);
  }

  /**
   * 構造検証。破損（型不一致）は "corrupt"、非互換バージョンは "incompatible"、
   * 妥当なら PersistedProgress を返す。silent coercion しない。
   * v1（MIGRATABLE_VERSIONS）は「不足フィールドを空で補う」additive migration で受理する
   * （既存の scenario 進捗を失わないため。意味変換は伴わない）。
   */
  private tryValidate(
    value: unknown,
  ): { progress: PersistedProgress; journeyWasReset: boolean } | "corrupt" | "incompatible" {
    if (typeof value !== "object" || value === null) return "corrupt";
    const v = value as Record<string, unknown>;
    if (typeof v.persistenceSchemaVersion !== "number") return "corrupt";
    const version = v.persistenceSchemaVersion;
    const isCurrent = version === PERSISTENCE_SCHEMA_VERSION;
    const isMigratable = MIGRATABLE_VERSIONS.includes(version);
    if (!isCurrent && !isMigratable) return "incompatible";
    if (v.locale !== "ja" && v.locale !== "en") return "corrupt";
    if (
      !Array.isArray(v.sessions) ||
      !Array.isArray(v.decisionRecords) ||
      !Array.isArray(v.completedScenarioIds) ||
      !Array.isArray(v.adoptionMemos)
    ) {
      return "corrupt";
    }
    // shallow shape check（過度に厳密でなくてよいが、明確な型不一致は corrupt 扱い）。
    for (const s of v.sessions) {
      if (typeof s !== "object" || s === null) return "corrupt";
      const sess = s as Record<string, unknown>;
      if (typeof sess.sessionId !== "string" || typeof sess.scenarioId !== "string") return "corrupt";
    }
    for (const id of v.completedScenarioIds) {
      if (typeof id !== "string") return "corrupt";
    }

    // v2 で追加したフィールド。v1 からの migration では空で補う（additive・意味変換なし）。
    const mode = v.mode === "guided" || v.mode === "simulation" || v.mode === "adoption-review"
      ? (v.mode as ExperienceMode)
      : "guided";
    const workshopInputs = isStringRecord(v.workshopInputs) ? (v.workshopInputs as WorkshopInputs) : {};
    const practiceDrafts = isNestedStringRecord(v.practiceDrafts) ? (v.practiceDrafts as PracticeDrafts) : {};

    // Journey の版互換ポリシー（Persistence v4）:
    //  - current（v4）: journey を additive 検証で受理（artifactVersions/materializedSteps を exact 保持）。
    //  - migratable 旧版（v1/v2/v3）に journey が含まれる: RC4 非互換なので safe reset（null）。
    //    heuristic migration（artifactVersions=revisions 等）は行わない。journey が存在したことだけ
    //    journeyWasReset で通知する（UI が「新しい Journey として開始した」旨を出せる）。
    let journey: PersistedJourney | null;
    let journeyWasReset = false;
    if (isCurrent) {
      journey = isValidJourney(v.journey) ? (v.journey as PersistedJourney) : null;
    } else {
      // migratable 旧版: 非 journey 進捗は保持しつつ journey は捨てる。
      journey = null;
      // 旧版に「復元しようとしていた journey」があったかどうか（あったら通知する）。
      journeyWasReset = v.journey !== null && v.journey !== undefined && typeof v.journey === "object";
    }

    return {
      progress: {
        persistenceSchemaVersion: PERSISTENCE_SCHEMA_VERSION,
        locale: v.locale,
        mode,
        sessions: v.sessions as PersistedProgress["sessions"],
        decisionRecords: v.decisionRecords as PersistedProgress["decisionRecords"],
        completedScenarioIds: v.completedScenarioIds as readonly string[],
        adoptionMemos: v.adoptionMemos as PersistedProgress["adoptionMemos"],
        workshopInputs,
        practiceDrafts,
        journey,
      },
      journeyWasReset,
    };
  }
}

/** value が Record<string,string> 形状か（Workshop 入力の防御的検証）。 */
function isStringRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}

/** value が Record<string, Record<string,string>> 形状か（Practice 下書きの防御的検証）。 */
function isNestedStringRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every((v) => isStringRecord(v));
}

/**
 * PersistedJourney の防御的検証（v4）。
 *
 * v4 では artifactVersions / materializedSteps を **必須**とする（RC4 Final Integrity）。
 * これらは Artifact identity（__v{artifactVersion}）と materialization state の再現に必要で、
 * 欠落を default（{}）補完すると propagation 由来の artifactVersion increment を復元できず
 * 「同一 state」を保証できない。したがって:
 *  - field が欠落（undefined）→ invalid → journey safe reset（heuristic 補完しない）。
 *  - field が存在する空 record（{}）→ valid（new Journey の初期状態と同じ・exact restore）。
 * missing field ≠ empty field を明確に区別する。
 * 不正なら呼び出し側が null にして「journey 未開始」として扱う（RC2 state は壊さない）。
 */
function isValidJourney(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  const j = value as Record<string, unknown>;
  if (typeof j.mode !== "string" || typeof j.profileId !== "string") return false;
  if (typeof j.currentStepId !== "string") return false;
  if (typeof j.userAuthored !== "object" || j.userAuthored === null) return false;
  if (typeof j.structured !== "object" || j.structured === null) return false;
  if (typeof j.reviews !== "object" || j.reviews === null) return false;
  if (!Array.isArray(j.completedStepIds)) return false;
  if (!Array.isArray(j.reworkHistory)) return false;
  // v4 必須 field: 存在（object）を要求。missing（undefined）や配列/null は invalid。
  // 空 record {} は valid（初期 Journey 状態と同じ）。
  if (!isPlainRecord(j.artifactVersions)) return false;
  if (!isPlainRecord(j.materializedSteps)) return false;
  return true;
}

/** value が「存在する plain object（配列/null でない）」か。空 record {} も true。 */
function isPlainRecord(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** ブラウザ localStorage を StoragePort として包む（実行時 adapter）。 */
export function browserStorage(): StoragePort {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, val) => window.localStorage.setItem(k, val),
    removeItem: (k) => window.localStorage.removeItem(k),
  };
}
