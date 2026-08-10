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
 *   - what a set MEANS, `derive` with `rowsOf`, `zoom` and `withoutDone` — so
 *     a reader and the validator compute status, order, mirror expansion and
 *     one node's ancestry with the same code;
 *   - how a set is WRITTEN back, `serializeOutline` and `ordBetween` — the
 *     canonical bytes and the sibling order, held here for the same reason the
 *     rules are: a writer with its own copy of either is a second format;
 *   - what went wrong, `OutlineError` and the two things a view does with it;
 *   - what a write says when it refuses, `OpFailure` and its five kinds.
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
export { isMirror, Located } from "./node.ts"
export type { FileKind, LocatedRegular, MirrorNode, Node, RegularNode } from "./node.ts"

export {
  ancestorsOf,
  byOrd,
  countedChildren,
  derive,
  rowsOf,
  rowsUnder,
  siblingsOf,
  storedMarker,
  titleParts,
  withoutDone,
} from "./derive.ts"
export type { Derived, Row, Status, TitlePart } from "./derive.ts"
export { zoom } from "./zoom.ts"
export type { Zoomed } from "./zoom.ts"

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
