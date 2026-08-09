/**
 * @olai/format — the outline format, and the only place it is enforced.
 *
 * The package is the bottom of the layering (docs/architecture.md): it knows
 * about records, files and rules, and nothing about disks, servers or
 * browsers. Everything above it — the store's codec, the server, the web
 * client — reads the format through this one surface.
 *
 * The two halves of the codec are {@link parseOutline} (per file) and
 * {@link validate} (per set). Together they are the whole of "is this legal";
 * {@link ./derive.ts} is the whole of "what does it mean".
 */

export {
  compareErrors,
  ErrorCode,
  isCrossFile,
  kindOf,
  OutlineError,
  OutlineInvalid,
  Related,
  Site,
  stageOf,
} from "./errors.ts"
export type { ErrorKind } from "./errors.ts"

export { EDGE_FIELDS, ID_SHAPE, isMirror, Located, MIRROR_FIELDS, Node } from "./node.ts"
export type { EdgeField } from "./node.ts"

export { Document, Outline, OutlineSet } from "./set.ts"

export { parseOutline } from "./parse.ts"
export { resolveRelative, validate } from "./validate.ts"

export {
  childIndex,
  countedChildren,
  rootsOf,
  statusIndex,
  tagsOf,
  titleParts,
} from "./derive.ts"
export type { Status, TitlePart } from "./derive.ts"
