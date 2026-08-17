/**
 * @olai/format — the outline format, and the only place it is enforced.
 *
 * The package is the bottom of the layering (docs/architecture.md): it knows
 * about records, files and rules, and nothing about disks, servers or
 * browsers. Everything above it — the store's codec, the server, the web
 * client — reads the format through this one surface.
 *
 * These are exported, and that is the whole contract — the list is the claim,
 * never its length, which is what a counted header keeps getting wrong here
 * (it has said Eight over nine bullets once already):
 *
 *   - the codec, `parseOutline` (per file) and `validate` (per set);
 *   - what they produce, `OutlineSet` and the records inside it — each one AT a
 *     `Site`, `{file, line}`, which is also what an error names, what a read's
 *     answer is situated by and where a mirror sits. One declaration, because
 *     four of them was a fact extensible in one place and silent in three;
 *   - what a set MEANS, `derive` with `rowsOf`, `zoom`, `withoutDone`, the
 *     date derivations (`datedDays`, `datedOn`, and the daily-note pair
 *     `dailyNoteDays` / `dailyNotesOn`), the forward reading of those same
 *     dates (`isOverdue`, `agendaOf`) and the document rules (`docOf`,
 *     `isPicture`, `isAsset`, `bodiedOf`) — so a reader and the validator agree on
 *     sibling order, mirror expansion, one node's ancestry, what is standing in
 *     its way, what is on a day, what is overdue on it, which document that
 *     day's note is, and where a `doc` or a relative link lands, computing all
 *     of it with the same code — and, under all of it, the one place a date is
 *     COUNTED rather than compared (`weekdayOf`, `shiftDay`, `daysOf`), which
 *     is here because the query's relative words and the browser's calendar
 *     grid must not each own a Monday;
 *   - what a QUERY means, `parseFilter` with `matchOf` / `matching` and the row
 *     transform `keeping` — the grammar (`is:`, `has:`, `date:`, `-`, and the
 *     substring terms around them), which nodes it selects, and what a tree
 *     narrowed to them looks like with the ancestors kept. Here, and not in the
 *     ops layer where the search procedure is, because a browser filtering rows
 *     it already holds and an agent calling `search_nodes` must not be two
 *     answers to one question (./filter.ts's own header, and
 *     docs/brainstorming/filter-in-place.md);
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
 *     and the wire spec stand on;
 *   - and the other vocabulary that crosses that floor, for the same reason and
 *     with the same division: what a READ of the set asks and what it says back
 *     — `Found` and the four answers built out of it (`OutlineSummary`,
 *     `Detail`, `Subtree`, `SearchHit`), pure, with no index and no matcher in
 *     them. Every field of an answer is a statement about records in the terms
 *     above; which node matches, how hits are ordered and how far a walk
 *     descends are questions about a query, and they stay in `@olai/ops` where
 *     the walks are.
 *
 * Everything else in `src/` is internal. The spellings a rule happens to use —
 * the id regex, the edge-field list, the path resolver — are not contract; a
 * consumer reaching for one of them would be re-implementing a rule that lives
 * here.
 */

export { parseOutline } from "./parse.ts"
export { validate } from "./validate.ts"
/** What a validated set IS: the files that were found, and the one derivation
 *  they were judged against. It is `validate`'s answer rather than a shape
 *  assembled by whoever holds both, so the view a reader reads is the view the
 *  rules ran over — the pairing `Derived` already makes about its own nodes,
 *  made once more one layer up. */
export type { Reading } from "./validate.ts"
/** The last reading and what has moved since it — what `validate` takes to
 *  PATCH its view rather than build one. The store's codec is what holds both
 *  halves; every other caller goes on passing a set and nothing else. */
export type { Previous } from "./validate.ts"
/** The pair WITHOUT the rules — a set and the view of it, patched from a
 *  previous reading where that is exact and rebuilt where it is not. For the
 *  one caller whose reading is speculative and validated later, exactly once:
 *  `@olai/ops`' batch fold, which plans op two against the set op one would
 *  leave. It is what `patch` is reached through, so the disagreement check
 *  `validate` makes cannot be forgotten by a second caller. */
export { reading } from "./validate.ts"

export { apart, assemble, BrokenFile, nodesIn, OutlineSet } from "./set.ts"
export type { DecodedFile, Outline } from "./set.ts"
/** What a delta says: files upserted, files gone — Surface's own
 *  collection-delta frame, which is the vocabulary "what changed" already
 *  travels this system in. `patch` itself is STILL not exported, and the
 *  sentence is the one it always was: applying a delta is `validate`'s
 *  business, and a second caller of it would be a second view free to disagree
 *  with the validated one — and, more concretely, one that has to remember
 *  `viewOf`'s disagreement check. The caller that wanted a patched view
 *  (`@olai/ops`' batch fold) reaches `reading` instead, which is that check and
 *  the patcher together. */
export type { SetDelta } from "./patch.ts"
/** WHICH files a served directory is made of — one table, the two suffixes the
 *  ops layer mints paths with, and every suffix as a list for the one reader that
 *  runs where no function of this package can be called. The table is
 *  exported whole because the surfaces that DRAW a kind hold a `Record` over it,
 *  and the sweep that says nobody spelled a suffix elsewhere has to read the
 *  list itself. */
export {
  bodyKind,
  DOCUMENT_EXT,
  FILE_EXTS,
  FILE_KINDS,
  fileKind,
  holdsText,
  OUTLINE_EXT,
  unkept,
} from "./kinds.ts"
export type { BodyKind, FileKind } from "./kinds.ts"
export {
  bodiedOf,
  docOf,
  Document,
  isAsset,
  isPicture,
  PICTURE_EXTENSIONS,
  pictureOf,
} from "./documents.ts"
export {
  ARCHIVE,
  archiveBeside,
  INBOX,
  inboxIn,
  isArchived,
  isMirror,
  Located,
  MARKS,
  /** A place in the loaded set — `{file, line}`, as a schema, so an error's
   *  site, a record in the set, a read's answer and a mirror's location are one
   *  derivation of "where" rather than four spellings of it. */
  Site,
  /** What a node's checkbox shows — one of the MARKS, as a schema, so the
   *  request that writes one, the keystroke that toggles one and the read that
   *  answers with one are one derivation of that list rather than five. */
  Status,
  /** Which words a `custom` key may not take, and what writes each of them
   *  instead — asked of the record's own field names, so a new field cannot
   *  arrive without one. `set_prop` is its only caller. */
  shadowFor,
  targetsOf,
} from "./node.ts"
export type { LocatedRegular, MirrorNode, Node, RegularNode } from "./node.ts"
/** Which field a record NAMED another record with. On the surface because two
 *  exported shapes already answer in it — `targetsOf` above, and the reverse
 *  index's `Naming` — and a consumer that can use a value but cannot name its
 *  type is a leak rather than a decision. `EdgeField` stays off the surface
 *  because nothing exported speaks it. */
export type { TargetField } from "./node.ts"

/** The one OPEN field on a record: named facts olai gives no meaning to. A
 *  consumer reads a key through these rather than reaching into `node.custom`,
 *  for the reason it asks `targetsOf` rather than reading `after` — where the
 *  map lives is this package's answer, and absence has one spelling. */
export {
  Custom,
  customKeys,
  customOf,
  customText,
  CustomValue,
  withCustom,
} from "./custom.ts"
export type { HasCustom } from "./custom.ts"

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
  /** One file's records, in the order they are written — the reading of
   *  `Derived.byFile` a writer needs, because a write re-emits the whole file
   *  and a reordering would be a diff nobody asked for. */
  nodesOf,
  progressOf,
  rowsOf,
  rowsUnder,
  siblingsOf,
  /** What a node's `after` targets hold up, asked of a node that is not work
   *  yet. Exported for the reason `drawnFrom` above is: two rules read
   *  blockedness and they must agree. The web draws it with `blockersOf` and
   *  the search grammar's `is:blocked` asks the same index for the yes-or-no
   *  (`isBlocked`, one file over), so an agent's answer and the drawn row are
   *  one reading; the ops layer refuses `set_doing` with THIS one, which is
   *  the same reading from the other end of the arrow. */
  standingBefore,
  isTagName,
  mayHoldTag,
  storedMarker,
  TAG_SIGILS,
  tagOpensAt,
  tagText,
  titleParts,
  titleTagRe,
  unfinished,
  unfinishedWithin,
  withoutDone,
} from "./derive.ts"
export { Progress } from "./derive.ts"
export type {
  Derived,
  InTheWay,
  Naming,
  Row,
  Situated,
  TagSigil,
  TitlePart,
} from "./derive.ts"
export { zoom } from "./zoom.ts"
export type { Zoomed } from "./zoom.ts"
/** The query: `parseFilter` reads text into one, `matching` says which nodes it
 *  selects, `keeping` and `matchedIn` are what a TREE narrowed to them looks
 *  like and how many rows of it are hits, and `shownRecord` is the record a row
 *  draws — the rule a fold already follows, said once. The grammar's own
 *  vocabulary (the operator names, the field weights, the per-node predicate)
 *  stays inside: a consumer reaching for one of them would be re-implementing
 *  the rule this module exists to be the only copy of. */
export {
  keeping,
  keepingDated,
  matchedIn,
  matching,
  parseFilter,
  /** A token the grammar knows the name of and not the value. A SCHEMA, not an
   *  interface: it rides `SearchAnswer.refusals` to a browser and to an agent,
   *  so it is one declaration like the hit it travels beside. */
  Refusal,
  SEARCH_FIELDS,
  shownRecord,
} from "./filter.ts"
export type { Filter, Match, Matched, Scope, SearchField } from "./filter.ts"
export {
  dailyNoteDays,
  dailyNotePathFor,
  dailyNotesOn,
  datedDays,
  datedIn,
  datedOn,
  dayOf,
  isDay,
} from "./dates.ts"
export type { DayEntry, DayGroup, Occasion } from "./dates.ts"
/** The one place a date is COUNTED rather than compared (./calendar.ts): which
 *  weekday a day falls on, the day before or after one, the days a month holds.
 *  Public because two packages ask it — the query grammar's relative words are
 *  here, and the browser's calendar grid and its `!` date widget are up there —
 *  and a second copy would be two answers to which day a week starts on.
 *
 *  MOST OF THESE THIS PACKAGE DOES NOT CALL: the grammar needs three
 *  (`weekdayOf`, `shiftDay`, `shiftMonth`) and the rest are the client's, which
 *  is what it costs to have the counting live under both readers rather than
 *  beside one of them. `isRealDay` is not `dates.ts`'s `isDay` — that one asks
 *  what a filename says, this one whether a calendar holds the day. */
export {
  daysOf,
  isMonth,
  isoDate,
  isRealDay,
  monthOfDay,
  shiftDay,
  shiftDayByMonth,
  shiftMonth,
  weekdayOf,
} from "./calendar.ts"
export {
  agendaOf,
  isOverdue,
  keepingOwed,
  nothingDue,
  owedIn,
  owedOf,
} from "./agenda.ts"
export type { Agenda, AgendaDay, Owed } from "./agenda.ts"
export { stampOf } from "./stamp.ts"

export { biggestOf, changesOf, Field, NodeChange, Sort } from "./changes.ts"
export type { Records } from "./changes.ts"

export {
  CommitRequest,
  CommitResult,
  GIT_OFF,
  GitState,
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

/** What a READ of the set asks and what it says back — see `./reading.ts`,
 *  which is `./committing.ts`'s argument applied to the vocabulary every query
 *  answer is built out of. `Found` is the atom of all four reads; the other
 *  three are the directory, one node, and a node with everything under it. The
 *  ops layer produces these, the wire spec may carry them, a browser and an
 *  agent read the identical value; the walks stay where the walks are. */
export {
  DEFAULT_SUBTREE_DEPTH,
  Detail,
  Found,
  NodeAnswer,
  NodeRequest,
  OutlineAnswer,
  OutlineSummary,
  Placed,
  Placement,
  type Stamps,
  Subtree,
  SubtreeAnswer,
  SubtreeRequest,
} from "./reading.ts"

/** What a WRITE asks for and what one that landed says — see `./writing.ts`,
 *  which is the same move again for the other half of the ops vocabulary. The
 *  ops layer produces these, the surface carries them to an agent's door
 *  (`ops.run`), and `@olai/ops` re-exports the union and the answer under its
 *  own names (`Request`, `Applied`). Both are renamed at the move, and the
 *  {@link WriteResult} one is load-bearing: `@olai/surface` has an `Applied` of
 *  its own that is a different type. */
export {
  AddRequest,
  AfterRequest,
  ApplyRequest,
  ArchiveRequest,
  BATCH_AT_MOST,
  type BatchedRequest,
  type Capture,
  CreateDocumentRequest,
  CreateRequest,
  DateRequest,
  DescRequest,
  MarkRequest,
  MergeRequest,
  Minted,
  MirrorRequest,
  MoveRequest,
  NESTING,
  PropRequest,
  SeeRequest,
  SplitRequest,
  TitleRequest,
  UnarchiveRequest,
  UnmirrorRequest,
  UpdateRequest,
  WriteDocumentRequest,
  WriteRequest,
  WriteResult,
} from "./writing.ts"

/** What a search ASKS and what one hit SAYS — `./reading.ts`'s division applied
 *  one level up: a hit is a {@link Found} plus the one thing about it that is a
 *  fact about the QUERY. The matcher stays where the matcher is. */
export {
  DEFAULT_SEARCH_LIMIT,
  SearchAnswer,
  SearchHit,
  SearchRequest,
} from "./searching.ts"

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
/** `nothing` and `heldCustom` are the writer's two rules about absence — one
 *  for a field, one for the field with an inside — on the surface because an
 *  ANSWER asks exactly what a file asks. `./filter.ts` reaches for them from the
 *  query's end for the reason `nothing`'s own header gives; `@olai/ops` reaches
 *  for them from the answer's, so a field left out of a hit is a field left out
 *  of the line on disk, decided once. A reader carrying its own copy answered a
 *  property `prop:` says the node does not carry. */
export { heldCustom, nothing, serializeOutline } from "./write.ts"

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
