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
 *     COUNTED rather than compared (`weekdayOf`, `shiftDay`, `daysOf`,
 *     `daysBetween`), which is here because the query's relative words, the
 *     browser's calendar grid and the agenda's felt distances must not each own
 *     a Monday — or a subtraction;
 *   - what a QUERY means, `parseFilter` with `matchOf` / `matching` and the row
 *     transform `keeping` — the grammar (`is:`, `has:`, `date:`, `created:`,
 *     `changed:`, `prop:`, `-`, and the substring terms around them), which
 *     nodes it selects, and what a tree
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
 *  leave. It is `patch` PLUS the disagreement check, which is what a caller
 *  holding a set needs and the browser's own fold does not (see `patch`
 *  below). */
export { reading } from "./validate.ts"

export {
  apart,
  assemble,
  BrokenFile,
  brokenBy,
  bodiedIn,
  brokenIn,
  documentAt,
  markdownAt,
  markdownIn,
  nodesIn,
  OutlineSet,
  outlinePaths,
  outlinesIn,
} from "./set.ts"
/** WHICH FILE COMES FIRST — the order a directory is read in, and the one
 *  spelling of it: the set is assembled in it, the patcher places an arriving
 *  file by it, and the browser folds and draws in it. Exported because the
 *  browser is one of those three (slice 4 of `model-indices`), and a client
 *  ordering paths its own way would be the same directory read two ways. */
export {
  /** What a file is CALLED — its last path segment, for the readers that draw
   *  a name rather than a path. One spelling, beside the order rule. */
  basenameOf,
  byPath,
} from "./paths.ts"
/** THE SUM the set serves, and the whole world of it: the three arms, their
 *  shared face, the constructors a decode calls and the narrowings a reader
 *  asks for. `Document` is what a served file IS
 *  (docs/brainstorming/first-class-documents.md, PR 2); the nodes are the
 *  substructure of one arm rather than a collection beside it. */
export {
  bodiedDocument,
  bodyOf,
  Document,
  Face,
  faceOf,
  Hypertext,
  isOutline,
  Markdown,
  Outline,
  outlineDocument,
} from "./document.ts"
/** A heading's derived id, and the headings of a body — the element half of
 *  the address grammar. Exported because the BROWSER assigns the same ids as
 *  it renders (`/web`'s `markdown/slugs.ts`), and a slug spelled twice is
 *  an address this app writes and cannot open. */
export { claim, slugOf, slugsIn } from "./slug.ts"
/** The view PATCHED rather than rebuilt, and what a delta says: files upserted,
 *  files gone — Surface's own collection-delta frame, which is the vocabulary
 *  "what changed" already travels this system in.
 *
 *  `patch` is exported because THE BROWSER JOINED IN (slice 4 of
 *  `model-indices`): the client folds the frames it is already receiving into
 *  the view it is already holding, with the function the validator uses. Two
 *  patchers would be the counterexample to `derive`'s own argument — that the
 *  validator and the view share one interpretation of the format — so there is
 *  one, and both ends call it.
 *
 *  IT IS STILL NOT THE DOOR FOR A CALLER HOLDING A SET, and `olai-batch-verbs`
 *  is why that distinction is worth keeping now that the export exists. The
 *  browser folds frames into a view and has no set to hold the result against;
 *  `@olai/ops`' batch fold assembles a real `OutlineSet` per op and plans the
 *  next one against it, which is exactly the shape {@link viewOf}'s
 *  disagreement check exists for — a delta that missed a file makes every
 *  record look like a duplicate of itself. So that caller reaches `reading`
 *  below, which is this function AND that check, and the two consumers differ
 *  by what they are holding rather than by what they remembered. */
export { patch } from "./patch.ts"
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
export type { Split } from "./address.ts"
/** WHAT A PLACE IS CALLED — `[document]#[element]`, the one grammar every
 *  feature that has to name something trades in
 *  (docs/brainstorming/first-class-documents.md). Exported whole, primitives
 *  included, because the point of it is that a consumer does not re-derive
 *  what an address is: the browser's URLs are `/` plus one of these, a pin
 *  holds one, and the parse and the print are a bijection with a test standing
 *  over it. */
export {
  Address,
  AtDocument,
  AtHeading,
  AtNode,
  addressOf,
  DocumentPath,
  /** The address a TITLE carries, and the two halves of the one link it may be
   *  written as — the shape a NAMED pin takes, read by the shelf reading down
   *  here and by the browser drawing the same title (docs/format.md's Pins).
   *  One spelling, because two readers cut it. */
  addressWritten,
  linkedTitle,
  /** ...and the other direction: the title a pin carries for a name somebody
   *  typed, refused rather than mangled when the words cannot go in a link.
   *  Two writers cut this too — the server resolving a `pin`, the browser
   *  renaming one. */
  PIN_NAME_UNWRITABLE,
  pinTitle,
  NodeId,
  parseAddress,
  printAddress,
  Slug,
  /** Path, query and fragment of an address, cut the way this app writes one —
   *  the URL's own punctuation, read on both sides of the wire. What the halves
   *  MEAN stays the browser's. */
  splitAddress,
  Tag,
  writtenAddress,
} from "./address.ts"
export {
  bodiedOf,
  bytesOf,
  docOf,
  firstLine,
  isAsset,
  isPicture,
  PICTURE_EXTENSIONS,
  pictureOf,
  retargetRelative,
} from "./documents.ts"
export {
  INBOX,
  inboxIn,
  isTrashed,
  isLeftoverArchive,
  isMirror,
  /** ...and the two of them as the one question every reading of the LIVE set
   *  actually asks. Exported beside them rather than instead of them: the
   *  writer half still names the trash on its own, and the sidebar still tells
   *  a dormant Archive from it — what nobody has ever wanted is one without the
   *  other in a READING (`./node.ts`). */
  isPutAway,
  Located,
  MARKS,
  /** Where olai mints a file it named itself, and the directory it puts them
   *  in — a MINT rather than a home: what a directory already has is found
   *  where it sits (`./node.ts`). */
  mintedInto,
  OLAI_DIR,
  /** The one trash — the filename, the path it is minted at, and the
   *  predicate a reading asks (`./node.ts`). Leftover `Archive.olai` is a
   *  different question (`isLeftoverArchive`): parsed, openable, not trash. */
  TRASH,
  TRASH_FILE,
  /** The shelf's own filename, and the walk that finds a directory's — the
   *  pin convention, read the way the inbox one is (`./node.ts`). */
  PINS,
  pinsIn,
  /** A place in the loaded set — `{file, line}`, as a schema, so an error's
   *  site, a record in the set, a read's answer and a mirror's location are one
   *  derivation of "where" rather than four spellings of it. */
  Site,
  /** What a node's checkbox shows — one of the MARKS, as a schema, so the
   *  request that writes one, the keystroke that toggles one and the read that
   *  answers with one are one derivation of that list rather than five. */
  Status,
  /** What a record CLAIMS about itself, which is its status — read off the
   *  MARKS list beside it, so the checkbox, the journal and the planner all ask
   *  one question about a record rather than three (`./node.ts`). */
  storedMarker,
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
  /** The crumbs' titles, outermost first — what every reader of an ancestry
   *  actually draws, said once. */
  ancestorTitles,
  /** What one node is WAITING ON — the reading side of `Derived.blocked`, so no
   *  caller has to know that absence is how that index spells "nothing".
   *
   *  On the surface because the answer left the package: every drawing of
   *  blockedness in the browser rides a reading that already carries it (a
   *  `Row`'s `blocked`, a `Zoomed`'s), and `read_node` answers it about ONE id
   *  that is not a page — so the ops layer asks for it directly. Exported for
   *  `standingBefore`'s reason below, arrived at from the other end of the same
   *  arrow: the row a person sees dimmed and the `blockedBy` an agent is handed
   *  must be one reading, and a second walk over `after` up there would be free
   *  to disagree with this one about what unfinished work is. */
  blockersOf,
  byOrd,
  countedChildren,
  derive,
  /** The containment graph: what drawing a record leads to drawing. Exported
   *  because two rules read it — the validator's mirror-cycle check, and the
   *  ops layer refusing the placement that would close one before it is
   *  written. */
  drawnFrom,
  /** …and the WALK over it, naming the chain: the same question asked at three
   *  moments — on load (the validator), at the write (the ops layer, for a new
   *  placement and for a move that carries one into what it shows) and at the
   *  aim (the move-to picker, before the key). Three rules, one walk, or they
   *  are three answers about one graph. */
  drawingPath,
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
   *  blockedness and they must agree. The rows a page draws and `read_node`'s
   *  `blockedBy` both come off `blockersOf` above, and the search grammar's
   *  `is:blocked` asks the same index for the yes-or-no (`isBlocked`, one file
   *  over), so an agent's answer and the drawn row are one reading; the ops
   *  layer refuses `set_doing` with THIS one, which is the same reading from
   *  the other end of the arrow. */
  standingBefore,
  isTagName,
  mayHoldTag,
  TAG_SIGILS,
  tagOpensAt,
  tagPart,
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
  TitleTag,
} from "./derive.ts"
export { zoom } from "./zoom.ts"
export type { Zoomed } from "./zoom.ts"
/** What REFERS to a node: the `see` edges that land on it and the notes and
 *  titles that write its `@id`, out of the two reverse indexes `derive` keeps.
 *  The reading rather than the indexes, because every question about what a
 *  reference MEANS — whether a placement is one, whether the archive counts, and
 *  which ids this node answers to — is asked there. `WAYS` is the closed list of
 *  how one record can refer to another, in the order a referrer says them, and
 *  `Way` is the SCHEMA read off it — which is what the answer vocabulary
 *  carries (`Reference`) and what a browser keys its rows by, rather than
 *  either of them being a second spelling of the list. */
export { backlinksOf, referrersTo, Way, WAYS } from "./backlinks.ts"
export type { Backlink, Referrer } from "./backlinks.ts"
/** The query: `parseFilter` reads text into one, `matching` says which nodes it
 *  selects, `ranked` puts them in the order a door shows them in, `keeping` and
 *  `matchedIn` are what a TREE narrowed to them looks like and how many rows of
 *  it are hits, and `shownRecord` is the record
 *  a row draws — the rule a fold already follows, said once. The grammar's own
 *  vocabulary (the operator names, the field weights, the per-node predicate)
 *  stays inside: a consumer reaching for one of them would be re-implementing
 *  the rule this module exists to be the only copy of. */
export {
  keeping,
  keepingDated,
  /** Where a query's words LAND in a piece of text, in the fold the matcher
   *  folded them with — what a filtered row lights up so the reader can see
   *  why it is in front of them, rather than a second case rule in the view. */
  litBy,
  matchedIn,
  matching,
  /** The other arm: which DOCUMENTS a query selects, and both kinds put in one
   *  order. A body is text the way a note is, and a query that could only ask
   *  about records is the shape this arc replaced. */
  matchingDocuments,
  /** The words a query looks for, folded and deduped — {@link litBy}'s other
   *  half, and the only thing a view needs off a parsed query. */
  needlesOf,
  parseFilter,
  rankedTogether,
  /** Both halves of "3 of 41" over a tree: {@link matchedIn} counts the rows a
   *  query selected and `rowsIn` counts the rows there are, so the two cannot
   *  come to disagree about what a row is — the pairing the flat pages have in
   *  `datedIn` and `owedIn`. */
  rowsIn,
  /** A token the grammar knows the name of and not the value. A SCHEMA, not an
   *  interface: it rides `SearchAnswer.refusals` to a browser and to an agent,
   *  so it is one declaration like the hit it travels beside. */
  Refusal,
  SEARCH_FIELDS,
  /** Best first — the rest of the score the matcher starts, which two doors now
   *  need and neither may respell. The cap is each door's own. */
  ranked,
  shownRecord,
} from "./filter.ts"
export type { Filter, Lit, Match, Matched, Scope, SearchField, Selected } from "./filter.ts"
export {
  dailyNoteDays,
  dailyNotePathFor,
  dailyNotesOn,
  /** WHAT THE CALENDAR'S DOTS ASK AND ARE ANSWERED WITH, as schemas: since
   *  `vault-in-browser`'s PR 4 the month's dots are walked on the server and
   *  drawn in a browser, so the pair crosses a wire and is declared here — on
   *  the floor `@olai/ops` and `@olai/surface` both stand on — rather than
   *  twice. `sameDated` is what keeps a revision that moved no dot quiet. */
  DatedAnswer,
  datedAnswer,
  DatedRequest,
  datedIn,
  datedOn,
  isDay,
  sameDated,
} from "./dates.ts"
export type { DayEntry, DayGroup } from "./dates.ts"
/** THE DAY an ISO value falls on (./occasion.ts, which is where the two fields
 *  that put a node on a day are read and the derivation's day index is folded).
 *  Public because a browser compares days it was handed against the one its own
 *  clock says, and a date somebody typed is a datetime as often as not — one
 *  slicing rule, or two that disagree about half past two. Its neighbours
 *  `monthOf` and `timeOf` stay inside: what asks about a month asks
 *  `datedAnswer`, and the only reader of a TIME is the pill `owedFact` already
 *  prints. */
export { dayOf } from "./occasion.ts"
export type { Occasion } from "./occasion.ts"
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
  /** How many whole days lie between two of them. The third question the
   *  counting exists for, and the agenda's spine is what asked it: "in 6 days"
   *  and "1 day late" are a subtraction, and it happens where the calendar is. */
  daysBetween,
  daysOf,
  isMonth,
  isoDate,
  isRealDay,
  monthOfDay,
  comingWeekday,
  shiftDay,
  shiftDayByMonth,
  shiftMonth,
  /** The seven names, in the order `weekdayOf` counts them. Beside the count
   *  because they ARE that count named — the repeat grammar reads them here,
   *  and the browser's month grid takes its headings and its capitals off the
   *  same list rather than keeping a second Monday. */
  WEEKDAYS,
  weekdayOf,
  /** The twelve names, on the same journey the seven made: a second layer needed
   *  them (the agenda's spine says "Aug"), so the list came down to the floor
   *  both stand on rather than being written twice. */
  MONTHS,
} from "./calendar.ts"
export {
  agendaOf,
  isOverdue,
  keepingOwed,
  nothingDue,
  /** What a reader ASKS to be told what is owed, and the counts they are
   *  answered with — the pair above's other half, on the wire for its reason. */
  Owed,
  owedIn,
  owedOf,
  OwedRequest,
  sameOwed,
  /** THE SPINE'S OWN ARITHMETIC (`agenda-spine`, 2026-08-18). The agenda draws
   *  one line of time, and everything it says about a day past the day itself is
   *  counted here rather than in a component: where a day sits and how far away
   *  it feels ({@link feltOn}), how long the silence before it is
   *  ({@link quietBetween}), and what a row's date pill still has to say
   *  ({@link owedFact}). Public for the reason `isOverdue` is — the words on
   *  the page are this package's reading of the files, and a badge doing its own
   *  date arithmetic would be a second reading of them. */
  feltOn,
  owedFact,
  quietBetween,
} from "./agenda.ts"
export type {
  Agenda,
  AgendaDay,
  Felt,
  Quiet,
  Standing,
  Tone,
} from "./agenda.ts"
/**
 * The repeat grammar (./repeat.ts): the small closed vocabulary a dated node
 * says it comes back in, and the arithmetic that says when the next one is.
 *
 * FOUR NAMES, and they are exactly the four somebody outside this package
 * asks — what a rule's words come to (`canonicalRepeat`, which answers both
 * "is this a rule" and "spelled how", because those are one question),
 * `REPEAT_GRAMMAR` for the refusal that quotes the vocabulary, the answer a
 * completion needs (`nextOccurrence`), and the vocabulary itself for the one
 * surface that offers it as a list (`REPEAT_RULES`). The module's insides — `parseRepeat`,
 * `printRepeat`, `nextAfter`, the `Repeat` union — are how those four are
 * built and are reached only by the tests beside them, which import the file
 * rather than the package. This package's rule is that a spelling a rule
 * happens to use is not contract, and a grammar with a parser on its surface
 * is an invitation to a second reading of it.
 */
export { canonicalRepeat, nextOccurrence, REPEAT_GRAMMAR, REPEAT_RULES } from "./repeat.ts"
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
 *  answer is built out of. `Found` is the atom of the four NODE reads; the
 *  other three are the directory, one node, and a node with everything under
 *  it. The two DOCUMENT reads are the same division over the other kind of
 *  file — the listing and one body — and share no atom with them, because a
 *  document has no identity below the file to be found by. The
 *  ops layer produces these, the wire spec may carry them, a browser and an
 *  agent read the identical value; the walks stay where the walks are.
 *
 *  {@link NamedAnswer} is the fifth and is a BATCH of the second — which of
 *  these ids the set declares, and what each one names — asked by a panel
 *  holding a paragraph full of backticks rather than by somebody reading one
 *  node.
 *
 *  {@link HomesAnswer} is the sixth and is a batch of a smaller question still:
 *  WHERE these ids are, and whether the set has anything from these files —
 *  asked by a reader holding a memory of records it saw earlier and needing to
 *  tell a node that MOVED from one that is gone. */

export {
  DEFAULT_SUBTREE_DEPTH,
  Detail,
  DocumentAnswer,
  DocumentBody,
  DocumentRequest,
  DocumentSummary,
  Found,
  HomesAnswer,
  HomesRequest,
  NamedAnswer,
  NamedRequest,
  NodeAnswer,
  NodeRequest,
  OutlineAnswer,
  OutlineSummary,
  Placed,
  Placement,
  Reference,
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
  TrashRequest,
  BATCH_AT_MOST,
  type BatchedRequest,
  type Capture,
  CreateDocumentRequest,
  CreateRequest,
  DateRequest,
  DescRequest,
  DuplicateRequest,
  EmptyRequest,
  MarkRequest,
  MergeRequest,
  Minted,
  MirrorRequest,
  MoveRequest,
  NESTING,
  PropRequest,
  RepeatRequest,
  SeeRequest,
  SplitRequest,
  TitleRequest,
  UntrashRequest,
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
  DocumentHit,
  isNodeHit,
  MatchedNode,
  MatchingAnswer,
  MatchingRequest,
  NodeHit,
  SearchAnswer,
  SearchHit,
  SearchRequest,
} from "./searching.ts"

/** The set's own WORDS — every tag written down, counted, and which of them one
 *  prefix under one sigil means. The reading over `Derived.taggedBy` rather than
 *  the index, for `./backlinks.ts`'s reason: what a tag's COUNT means (one vote
 *  per record, nothing the trash draws) is a decision, and it is made there. It
 *  ran in the browser until `vault-in-browser`'s PR 2 took the vault out of it —
 *  see `./vocabulary.ts`. ONE function, not the enumeration and the match as two
 *  for a caller to compose: the composition is the primitive. */
export { completingTags, TagCompletion, TagsAnswer, TagsRequest } from "./vocabulary.ts"

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

/**
 * THE PINNED SHELF, as a reading of the set rather than of a browser's copy of
 * it (./shelf.ts): the rows of the directory's `Pins.olai` and the live name of
 * whatever node each one addresses.
 *
 * Public because it crosses — the server answers it per revision and the
 * sidebar draws it (`@olai/surface`'s `pins` cell). `pinTargetIn` is public
 * beside the reading because the browser holds it up against its own address
 * parser, which is what keeps one title from having two answers.
 */
export { NO_PINS, pinTargetIn, sameShelf, Shelf, shelfOf } from "./shelf.ts"
export type { Pinned } from "./shelf.ts"

/**
 * WHAT ONE PAGE SHOWS (./page.ts) — the reading the browser is handed in place
 * of the vault it used to walk, and the request that asks for one.
 *
 * Public because it crosses, which is the whole of what PR 10 of
 * `docs/brainstorming/vault-in-browser.md` is: the server computes this per
 * open page per published revision and sends it when it changed by value, and
 * every page in the app is drawn out of it.
 */
export {
  Named,
  PageReading,
  PageRequest,
  /** WHAT ONE PAGE SHOWS, over one revision of one set. */
  pageOf,
  samePageReading,
  samePageRequest,
  Shown,
  TrashGroup,
} from "./page.ts"

/**
 * WHETHER A ROW CAN GO WHERE SOMEBODY IS POINTING (./moving.ts) — the move-to
 * picker's preview of the planner's verdict, and the law it quotes.
 *
 * Public for the reason above: the picker judges an arbitrary node of the
 * directory against another one, which is a question about the SET and not
 * about any page, so it is asked over the wire and re-answered per revision.
 * `SAME_FILE` comes through the same door because the app's other cross-file
 * gesture — a row dragged over another outline's pane — reads it in the
 * browser, and two copies of a sentence is how two faces of one rule start
 * disagreeing in the small words.
 */
export { Moved, MovingAnswer, MovingRequest, movingOf, SAME_FILE, sameMoving } from "./moving.ts"
