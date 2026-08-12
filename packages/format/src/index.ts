/**
 * @olai/format — the outline format, and the only place it is enforced.
 *
 * The package is the bottom of the layering (docs/architecture.md): it knows
 * about records, files and rules, and nothing about disks, servers or
 * browsers. Everything above it — the store's codec, the server, the web
 * client — reads the format through this one surface.
 *
 * Seven things are exported, and that is the whole contract:
 *
 *   - the codec, `parseOutline` (per file) and `validate` (per set);
 *   - what they produce, `OutlineSet` and the records inside it;
 *   - what a set MEANS, `derive` with `rowsOf`, `zoom`, `withoutDone`, the
 *     date derivations (`datedDays`, `datedOn`, and the daily-note pair
 *     `dailyNoteDays` / `dailyNotesOn`) and the document rules (`docOf`,
 *     `isPicture`, `documentOf`) — so a reader and the validator agree on
 *     sibling order, mirror expansion, one node's ancestry, what is standing in
 *     its way, what is on a day, which document that day's note is, and where a
 *     `doc` or a relative link lands, computing all of it with the same code;
 *   - how a set is WRITTEN back, `serializeOutline`, `ordBetween` and
 *     `stampOf` — the canonical bytes, the sibling order and the one way an
 *     instant becomes a date value, held here for the same reason the rules
 *     are: a writer with its own copy of any of them is a second format;
 *   - what went wrong, `OutlineError` and the two things a view does with it —
 *     plus the two ways a message NAMES something, `didYouMean` for an id
 *     nothing declares and `chainOf` for a loop, held here because the ops layer
 *     refuses the same unknown target and the same cycle one moment earlier, at
 *     the plan, and two spellings would let a write and a load disagree;
 *   - what a write says when it refuses, `OpFailure` and its four kinds;
 *   - what two readings of a set DIFFER by, `changesOf` and the vocabulary a
 *     pending commit is spoken in — pure, with no git in it, because it is a
 *     statement about records and this package is the floor both the ops layer
 *     and the wire spec stand on.
 *
 * Everything else in `src/` is internal. The spellings a rule happens to use —
 * the id regex, the edge-field list, the path resolver — are not contract; a
 * consumer reaching for one of them would be re-implementing a rule that lives
 * here.
 */

export { parseOutline } from "./parse.ts"
export { validate } from "./validate.ts"

export { assemble, BrokenFile, fileKind, OutlineSet } from "./set.ts"
export type { DecodedFile, Outline } from "./set.ts"
export {
  docOf,
  Document,
  documentOf,
  isPicture,
  PICTURE_EXTENSIONS,
  pictureOf,
} from "./documents.ts"
export { ARCHIVE, isArchived, isMirror, Located, MARKS, targetsOf } from "./node.ts"
export type { FileKind, LocatedRegular, MirrorNode, Node, RegularNode } from "./node.ts"

export {
  ancestorsOf,
  byOrd,
  countedChildren,
  derive,
  /** The containment graph: what drawing a record leads to drawing. Exported
   *  because two rules read it — the validator's mirror-cycle check, and the
   *  ops layer refusing the placement that would close one before it is
   *  written. */
  drawnFrom,
  follow,
  nodeNamed,
  progressOf,
  rowsOf,
  rowsUnder,
  siblingsOf,
  storedMarker,
  titleParts,
  titleTagRe,
  unfinishedUnder,
  withoutDone,
} from "./derive.ts"
export type {
  Derived,
  InTheWay,
  Progress,
  Row,
  Situated,
  Status,
  TitlePart,
} from "./derive.ts"
export { zoom } from "./zoom.ts"
export type { Zoomed } from "./zoom.ts"
export { dailyNoteDays, dailyNotesOn, datedDays, datedOn } from "./dates.ts"
export type { DayEntry, DayGroup, Occasion } from "./dates.ts"
export { stampOf } from "./stamp.ts"

export { biggestOf, changesOf, Field, NodeChange, Sort } from "./changes.ts"
export type { Records } from "./changes.ts"

export {
  CommitRequest,
  CommitResult,
  How,
  isPossible,
  isReady,
  LastCommit,
  NOTHING_PENDING,
  DirtyOutline,
  Other,
  Pending,
  PushResult,
  Reason,
  RepoState,
  samePending,
  Unpushed,
  Writer,
  Wrote,
} from "./committing.ts"

/** The words a commit gets when nobody wrote any. Here rather than in the ops
 *  layer because the message is now a function of a SELECTION, and the
 *  selection is made in a browser — see `./message.ts`. */
export { composed, MESSAGE_PREFIX } from "./message.ts"

/** The typo rule AND the clause it produces, exported for one reason: the ops
 *  layer refuses an unknown `mirror` / `after` / `see` target at the PLAN, and
 *  the validator refuses the same id on load. One question at two moments — a
 *  second copy of the budget, or of the sentence, would let the two disagree
 *  about what a misspelling is. `nearestId` is the rule for a caller that wants
 *  the candidate rather than the wording. */
export { didYouMean, nearestId } from "./suggest.ts"

export { ordBetween } from "./ord.ts"
export { nodesOf, serializeOutline } from "./write.ts"

export {
  BusyFailure,
  isOpFailure,
  kindOf,
  NotFoundFailure,
  OpFailure,
  UsageFailure,
  ValidationFailure,
} from "./failure.ts"
export type { FailureKind } from "./failure.ts"

export {
  /** How a loop is named — the validator's, and the ops layer's when it refuses
   *  the write that would close one. */
  chainOf,
  compareErrors,
  errorLine,
  hasLine,
  isCrossFile,
  OutlineError,
  reportStage,
  stageOf,
} from "./errors.ts"
export type { ErrorCode, Stage } from "./errors.ts"
