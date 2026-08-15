/**
 * The things a writer may ask for — `@olai/format`'s declaration, under the
 * names this package's own answers use.
 *
 * A RE-EXPORT and nothing else. The schemas moved to `@olai/format`'s
 * `writing.ts` when the writes went onto the surface (`mcp-bridge`), for the
 * reason `searching.ts` and `reading.ts` moved before them: `@olai/surface`
 * carries these payloads now, it may not import this package, and this package
 * may not import it — so the one home a shared vocabulary has is the floor
 * underneath both. That module's header is where the argument lives; there is
 * deliberately nothing of it repeated here.
 *
 * TWO NAMES DIFFER, and they differ here rather than there. `WriteRequest` is
 * `Request` to this layer — the ops layer knows exactly one kind of request, so
 * the qualifier that earns its keep among the floor's five would be noise among
 * this package's one — and `WriteResult` is `Applied`, which is the word every
 * caller of `ops.run` already speaks and the word the planner's own vocabulary
 * is built around. Same two values, two vantage points, and the aliasing is
 * `committing.ts`'s precedent (`Pending`, `CommitRequest`) rather than a new
 * idea.
 */

export {
  AddRequest,
  AfterRequest,
  ArchiveRequest,
  type Capture,
  CreateDocumentRequest,
  CreateRequest,
  DateRequest,
  DescRequest,
  MarkRequest,
  MergeRequest,
  type Minted,
  MirrorRequest,
  MoveRequest,
  NESTING,
  SeeRequest,
  SplitRequest,
  TitleRequest,
  UnarchiveRequest,
  UnmirrorRequest,
  WriteDocumentRequest,
  WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
