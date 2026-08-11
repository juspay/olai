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
 *     date derivations (`datedDays`, `datedOn`) and the document rules
 *     (`docOf`, `isPicture`) — so a reader and the validator compute status,
 *     order, mirror expansion, one node's ancestry, what is on a day and where
 *     a `doc` lands with the same code;
 *   - how a set is WRITTEN back, `serializeOutline` and `ordBetween` — the
 *     canonical bytes and the sibling order, held here for the same reason the
 *     rules are: a writer with its own copy of either is a second format;
 *   - what went wrong, `OutlineError` and the two things a view does with it;
 *   - what a write says when it refuses, `OpFailure` and its five kinds;
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
export { docOf, Document, isPicture, pictureOf } from "./documents.ts"
export { ARCHIVE, isMirror, Located } from "./node.ts"
export type { FileKind, LocatedRegular, MirrorNode, Node, RegularNode } from "./node.ts"

export {
  ancestorsOf,
  byOrd,
  countedChildren,
  derive,
  follow,
  fromChildren,
  rowsOf,
  rowsUnder,
  siblingsOf,
  storedMarker,
  titleParts,
  withoutDone,
} from "./derive.ts"
export type { Derived, FromChildren, Row, Situated, Status, TitlePart } from "./derive.ts"
export { zoom } from "./zoom.ts"
export type { Zoomed } from "./zoom.ts"
export { datedDays, datedOn } from "./dates.ts"
export type { DayGroup } from "./dates.ts"

export { biggestOf, changesOf, Field, NodeChange, Sort } from "./changes.ts"
export type { Records } from "./changes.ts"

export {
  CommitRequest,
  CommitResult,
  isPossible,
  isReady,
  LastCommit,
  NOTHING_PENDING,
  Pending,
  Reason,
  RepoState,
  samePending,
  Writer,
  Wrote,
} from "./committing.ts"

export { ordBetween } from "./ord.ts"
export { nodesOf, serializeOutline } from "./write.ts"

export {
  BusyFailure,
  DerivedFailure,
  isOpFailure,
  kindOf,
  NotFoundFailure,
  OpFailure,
  Unfinished,
  UsageFailure,
  ValidationFailure,
} from "./failure.ts"
export type { FailureKind } from "./failure.ts"

export {
  compareErrors,
  errorLine,
  isCrossFile,
  OutlineError,
  reportStage,
  stageOf,
} from "./errors.ts"
export type { ErrorCode, Stage } from "./errors.ts"
