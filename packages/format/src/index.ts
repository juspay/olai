/**
 * @olai/format — the outline format, and the only place it is enforced.
 *
 * The package is the bottom of the layering (docs/architecture.md): it knows
 * about records, files and rules, and nothing about disks, servers or
 * browsers. Everything above it — the store's codec, the server, the web
 * client — reads the format through this one surface.
 *
 * Six things are exported, and that is the whole contract:
 *
 *   - the codec, `parseOutline` (per file) and `validate` (per set);
 *   - what they produce, `OutlineSet` and the records inside it;
 *   - what a set MEANS, `derive` with `rowsOf`, `zoom`, `withoutDone`, the
 *     date derivations (`datedDays`, `datedOn`) and the document rules
 *     (`docOf`, `isPicture`) — so a reader and the validator agree on sibling
 *     order, mirror expansion, one node's ancestry, what is standing in its
 *     way, what is on a day and where a `doc` lands, computing all of it with
 *     the same code;
 *   - how a set is WRITTEN back, `serializeOutline`, `ordBetween` and
 *     `stampOf` — the canonical bytes, the sibling order and the one way an
 *     instant becomes a date value, held here for the same reason the rules
 *     are: a writer with its own copy of any of them is a second format;
 *   - what went wrong, `OutlineError` and the two things a view does with it;
 *   - what a write says when it refuses, `OpFailure` and its four kinds.
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
export { ARCHIVE, isArchived, isMirror, Located, MARKS } from "./node.ts"
export type { FileKind, LocatedRegular, MirrorNode, Node, RegularNode } from "./node.ts"

export {
  ancestorsOf,
  byOrd,
  countedChildren,
  derive,
  follow,
  nodeNamed,
  progressOf,
  rowsOf,
  rowsUnder,
  siblingsOf,
  storedMarker,
  titleParts,
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
export { datedDays, datedOn } from "./dates.ts"
export type { DayEntry, DayGroup, Occasion } from "./dates.ts"
export { stampOf } from "./stamp.ts"

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
  compareErrors,
  errorLine,
  isCrossFile,
  OutlineError,
  reportStage,
  stageOf,
} from "./errors.ts"
export type { ErrorCode, Stage } from "./errors.ts"
