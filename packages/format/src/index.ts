/**
 * @olai/format — the outline format, and the only place it is enforced.
 *
 * The package is the bottom of the layering (docs/architecture.md): it knows
 * about records, files and rules, and nothing about disks, servers or
 * browsers. Everything above it — the store's codec, the server, the web
 * client — reads the format through this one surface.
 *
 * Four things are exported, and that is the whole contract:
 *
 *   - the codec, `parseOutline` (per file) and `validate` (per set);
 *   - what they produce, `OutlineSet` and the records inside it;
 *   - what a set MEANS, `derive` and `rowsOf` — so a reader and the validator
 *     compute status, order and mirror expansion with the same code;
 *   - what went wrong, `OutlineError` and the two things a view does with it.
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

export { derive, rowsOf, titleParts } from "./derive.ts"
export type { Derived, Row, Status, TitlePart } from "./derive.ts"

export {
  compareErrors,
  isCrossFile,
  OutlineError,
  reportStage,
  stageOf,
} from "./errors.ts"
export type { ErrorCode, Stage } from "./errors.ts"
