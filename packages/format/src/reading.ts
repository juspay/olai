/**
 * What a READ of the set asks, and what it says back.
 *
 * Data, and nothing but: there is no index in this file and nothing here walks
 * anything. It DOES reach `./derive.ts`, `./node.ts` and `./backlinks.ts`, for
 * five shapes each of them declares beside the thing that produces it —
 * {@link Progress}, {@link Status}, the record's own mark fields, {@link Site},
 * the `{file, line}` every answer here is situated by, and {@link Way}, the two
 * ways one record can refer to another — which is the same
 * borrowing `./committing.ts` does from `@olai/git/state`: the shape travels,
 * so it is declared once at its source rather than copied to the module that
 * carries it.
 *
 * It is here for the reason `./committing.ts` and `./searching.ts` are, and the
 * argument is those files' word for word — this package is the floor both the
 * ops layer and the wire spec stand on, and a vocabulary spelled in either of
 * those would have to be spelled again in the other.
 *
 * `./searching.ts` moved ONE of the four reads down here and argued it from a
 * drift that was live. These are the other three — the directory
 * (`list_outlines`), one node in full (`read_node`), and a node with everything
 * under it (`read_subtree`) — and they were **the last query answers with no
 * wire shape at all**: TypeScript interfaces in `@olai/ops`' `query.ts`, which
 * no surface can declare and no browser can be handed. They are moved BEFORE
 * anything carries them rather than after, which is the whole lesson of the
 * search case: that one was found the other way round, live on the wire, with
 * an agent reading a field the palette's encoder silently dropped
 * (docs/brainstorming/surface-mcp-positions.md, position (a)).
 *
 * **Three things this move had to get right, and all three were written down
 * before it was made** (that document, position (c)):
 *
 * *Here, and not `@olai/ops`.* The obvious phrasing — declare them in the
 * producing package and re-export from `@olai/surface` — is wrong in its
 * load-bearing half: it makes the wire spec depend on the ops layer, which is
 * the ban that made the duplication structural in the first place
 * (`packages/ops/package.json`: "`@olai/surface` is deliberately absent"). No
 * more than `CommitRequest` and `Pending` are re-exported from their producer.
 * The floor is the floor.
 *
 * *`Applied` is NOT one of them.* The ops layer's `Applied` and
 * `@olai/surface`'s are genuinely DIFFERENT types — the editor's adds `undo`
 * and drops `summary`, `sort`, `captured` and `rev` — and that narrowing is a
 * design argued at length in `packages/surface/src/edit.ts`. Two things spelled
 * once each, not one thing spelled twice, so there is nothing here for a shared
 * declaration to say. A vocabulary crossing a floor and a keyboard's answer are
 * not the same kind of value.
 *
 * *The summary is renamed on the way.* {@link OutlineSummary} arrives from
 * `@olai/ops` as `Outline`, and this package already exports an `Outline` —
 * one file's decoded nodes (`./set.ts`). Both carry `file` and both carry
 * `nodes`, where `nodes` is a node LIST on one and a COUNT on the other, so the
 * collision is the nastier kind: the shapes look compatible at a glance. A
 * rename away from a plausible bug rather than from a compile error, which is
 * why it is done here and not left to whoever meets it.
 *
 * **What stays in `@olai/ops`** is the same division `./committing.ts` and
 * `./searching.ts` keep. Nearly every field below is a statement about records
 * in this package's own vocabulary — an id, a `file:line`, a {@link Status},
 * the ancestor titles `ancestorsOf` walks, the mark a record stores. WHICH node
 * a read is about, which mirrors resolve to it, how far a walk descends and
 * what a broken file leaves sayable are questions about the SET, and they stay
 * with the derivations that answer them. The shape is the floor's; the walk is
 * the ops layer's.
 *
 * `truncated` on {@link Subtree} is the one exception and is named as one, the
 * way `./searching.ts` names `matched`: it is a fact about the WALK rather than
 * about the record — that it stopped where it was told to. It belongs here
 * anyway, because it is a field of an ANSWER and the answers are the floor's;
 * what it must not become is a licence to read the sentence above loosely for
 * the next field somebody proposes.
 */

import { Schema } from "effect"

import { Way } from "./backlinks.ts"
import { Progress } from "./derive.ts"
import { RegularNode, Site, STAMPED, Status } from "./node.ts"

/**
 * One node, SITUATED — the shape every read of the set answers with.
 *
 * Flattened on purpose, and not a {@link Located}: a caller of a read wants the
 * node's facts beside where it lives, not a record nested under a file and a
 * line. The two are the same {@link Site} carrying different things — the
 * record verbatim on one, what a reader needs to see on the other — which is
 * why they stay two declarations and the PLACE stays one. `@olai/ops` builds
 * one with `foundOf` and every other answer in this
 * file hangs off it — {@link Detail}, {@link Subtree}, {@link Placed}, and one
 * level up the search hit in `./searching.ts`. It is the atom of the whole read
 * vocabulary, which is why it sits at the top of the module named for that
 * vocabulary rather than inside the one named for a query.
 */
export const Found = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  /** Where a person is pointed — `./node.ts`'s {@link Site}, the same pair an
   *  error names and a record in the set carries. Spread rather than respelled
   *  for the reason the mark fields below are: what it means to be somewhere in
   *  the loaded set is one declaration's to say. */
  ...Site.fields,
  /** The mark the node carries — a mirror's being its target's, since that is
   *  what it shows. ABSENT when it carries none: nobody marked it, so it is a
   *  bullet rather than a task nobody has started. */
  status: Schema.optionalKey(Status),
  /** The canonical ancestor titles, outermost first. What makes a bare title
   *  like "order" mean something in a list of strangers. */
  path: Schema.Array(Schema.String),
  /** Free cross-references this node carries, as target ids. Absent when the
   *  node has none — so a reader can traverse without a second read, and a node
   *  that does not point anywhere does not pretend to.
   *
   *  The RECORD'S OWN declaration, and so are the three below it: what these
   *  fields carry is the file's value handed back verbatim, so a second
   *  spelling of them here would be free to stop meaning what the file means.
   *  The prose differs because what is worth saying about a field on an ANSWER
   *  is not what is worth saying about it on disk. */
  see: RegularNode.fields.see,
  /** What this node must come AFTER, as target ids — the edges it carries
   *  itself, exactly as they are written.
   *
   *  Here for the same reason `see` is, and now for a second one: `set_after`
   *  removes a target BY ID, so a reader that could not see the list could only
   *  change it by guessing. Not the derived blockedness — what is standing in
   *  the way right now is a question about marks, and this is what the record
   *  says. A node read answers both, and {@link Detail.blockedBy} is the other
   *  one; a hit answers this half alone, which is the half `set_after` takes. */
  after: RegularNode.fields.after,
  /**
   * The named facts this node carries that olai gives no meaning to — the
   * record's own map, handed back VERBATIM, and what `set_prop` writes into.
   * Absent for a node carrying none, which is the writer's own rule for
   * absence rather than an empty map on every bullet in the vault.
   *
   * Here rather than on {@link Detail} alone, which is the whole of the change:
   * a search hit is a {@link Found}, so a property answered only by `read_node`
   * made "every lane at review" a query PLUS one read per hit — and an agent
   * that has to read each hit to see the fact it searched by is doing by hand
   * what the query already knew. `prop:agent=claude-opus` now answers with the
   * `pr` beside it, in one call. Same for a child in a node's list and a row of
   * a subtree, for the reason `see` and `after` are read there: an answer that
   * situates a node says what that node carries.
   *
   * **The values travel WHOLE — not truncated, not reduced to their keys** —
   * and that is a decision about wire cost, not an omission of one. A cut value
   * is a value a reader cannot tell from a short one, and the first thing it
   * would cut is the half of a URL that makes it a link; keys alone would hand
   * back the question rather than the answer, and would make `custom` a list on
   * one answer and a map on another, which is precisely the drift
   * `./searching.ts`'s header exists to refuse. The size of an answer is the
   * REQUEST'S dial — `limit` — and that one is exact, where a cut inside a
   * value is a guess every reader has to second-guess. What a hit carries is
   * already unbounded prose the reader wrote: `title`, and `path`, which is
   * every ancestor's title. A property is a named fact and is smaller than
   * both.
   */
  custom: RegularNode.fields.custom,
})
export type Found = typeof Found.Type

// ── the directory ──────────────────────────────────────────────────────

/**
 * One outline FILE, as a listing says it — a count and the titles at the top,
 * never the nodes.
 *
 * RENAMED at the move, for the reason the module header gives: `Outline` is
 * taken here and means one file's decoded NODES. This is the summary
 * `list_outlines` answers with, and the summary is what a map is: enough to
 * choose a file, nothing that would make listing a directory cost what reading
 * it does.
 *
 * **The torn-file row is a FLAT shape, and knowingly so.** A file that did not
 * parse carries `unreadable` beside a `nodes` and a `roots` filled in with `0`
 * and `[]` — a count nobody counted, and a claim that the outline is about
 * nothing, on the one file where neither could be known. Each field reads
 * honestly alone; what is untrue is the combination, held apart by a convention
 * a reader has to know: *if `unreadable` is here, disbelieve the two above it.*
 *
 * Splitting it into two arms — so the dependent facts exist only on the arm
 * that grounds them, which is what {@link NodeAnswer} already does for an id
 * the set does not hold — was written, reviewed and then REVERTED on this
 * branch, because it changes what `list_outlines` answers and that is a ruling
 * the human has not made. It is a roadmap question, not a defect, and this
 * comment is here so the next reader does not rediscover it as one.
 */
export const OutlineSummary = Schema.Struct({
  file: Schema.String,
  /** Regular nodes in it. Mirrors are placements, not nodes, so they do not
   *  inflate the count. */
  nodes: Schema.Int,
  /** Its top-level titles, in order — what the outline is ABOUT, in the space
   *  a listing has. */
  roots: Schema.Array(Schema.String),
  /** Present, and the whole of what can be said about it, when the file did
   *  not parse: its nodes are not loaded, so it has neither count nor roots. */
  unreadable: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type OutlineSummary = typeof OutlineSummary.Type

/**
 * The whole listing, in the envelope it travels in.
 *
 * The field earns itself twice. A bare array is not a JSON object, and the MCP
 * face wraps anything that is not one under a `value` key it invented — so the
 * choice is a name that says what the list is or a name that says nothing. And
 * an envelope is where a second fact about the listing would go if the
 * directory ever grew one; an array has nowhere to put it.
 */
export const OutlineAnswer = Schema.Struct({
  outlines: Schema.Array(OutlineSummary),
})
export type OutlineAnswer = typeof OutlineAnswer.Type

// ── the documents ──────────────────────────────────────────────────────

/**
 * One DOCUMENT of the served directory, as a listing says it — its path, the
 * line it opens with, and how much text is under that.
 *
 * The outline listing's twin ({@link OutlineSummary}), and deliberately the
 * same shape of answer: enough to choose a file, nothing that would make
 * listing a directory cost what reading it does. What differs is what a `.md`
 * HAS. An outline is records, so its summary counts them and names its roots;
 * a document is one text with no structure below the file, so what can be said
 * about it is the line it opens with and its size.
 *
 * `title` is a DERIVATION and not a field — `firstLine` (`./documents.ts`),
 * the same rule the web draws under a `doc`-carrying row — because a document
 * has no record for a name to be written on. That is the whole of the
 * `md-second-class` asymmetry in one field, and it is answered here rather
 * than left out: a listing of twenty paths says which directory an agent is
 * in, and a listing of twenty paths with their opening lines says which file
 * to read.
 *
 * **The unreadable row is a FLAT shape, exactly as {@link OutlineSummary}'s
 * is**, and knowingly so for the same reason: a document the set could not
 * read carries `unreadable` beside a `title` and a `bytes` filled in with `""`
 * and `0` — a name nobody read and a size nobody measured. The convention a
 * reader has to know is the one next door: *if `unreadable` is here,
 * disbelieve the two above it.* It is written to MATCH rather than to improve
 * on it, because the two-arm shape is a ruling the human has not made
 * ({@link OutlineSummary} records where that stands), and one listing answering
 * a torn file one way and the other listing answering it another would be the
 * inconsistency that ruling is waiting to remove from both at once.
 */
export const DocumentSummary = Schema.Struct({
  file: Schema.String,
  /** What the document is CALLED — its first line with the heading marks off,
   *  and its filename when the body has no line to be named by. The document's
   *  own face answers it (`./document.ts`), so this listing, the browser's rows
   *  and a search hit all say the same name. */
  title: Schema.String,
  /** Its text's size in bytes, as UTF-8 — what a caller decides with before
   *  asking for the whole of it. It is the size of the text `read_document`
   *  would answer with, which is the file's own size for a file that is valid
   *  UTF-8 and every `.md` anything here wrote. A file that is NOT can read
   *  larger than it is on disk, because the bytes the decoder could not read
   *  became replacement characters before this counted them — the number stays
   *  true to the text you will be handed, which is the one this field is for. */
  bytes: Schema.Int,
  /** Present, and the whole of what can be said about it, when the file could
   *  not be read: its text is not loaded, so it has neither a line to be named
   *  by nor a size that was measured. */
  unreadable: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type DocumentSummary = typeof DocumentSummary.Type

/** The whole listing, in the envelope it travels in — {@link OutlineAnswer}'s
 *  twin, and the field earns itself the same two ways: a bare array is not a
 *  JSON object, and an envelope is where a second fact about the listing would
 *  go. */
export const DocumentAnswer = Schema.Struct({
  documents: Schema.Array(DocumentSummary),
})
export type DocumentAnswer = typeof DocumentAnswer.Type

/** Asking for one document. A node read names an id because a node HAS one; a
 *  document has no identity below the file, so this names the path — the same
 *  spelling the listing answers with and `write_document` takes. */
export const DocumentRequest = Schema.Struct({
  file: Schema.String.annotate({
    description:
      "Path of a document (`.md`) under the served directory, exactly as `list_documents` lists it.",
  }),
})
export type DocumentRequest = typeof DocumentRequest.Type

/**
 * One document, whole: the path that was asked for and the text under it.
 *
 * NO `{ missing }` ARM, which is where this parts company with
 * {@link NodeAnswer} and {@link SubtreeAnswer}, and the difference is real
 * rather than a style choice. A node read answers the id it does not hold
 * because "is there a node called this?" is a question worth an answer — ids
 * are minted, guessed at and carried around in prose. A path is not guessed
 * at: it was listed, or a caller typed it, and the useful answer to a typo is
 * the near miss, which only a refusal carries (`NotFoundFailure`, with
 * `didYouMean`'s closest path). That is also the voice `write_document`
 * already refuses a missing path in, and the two reaching for one path should
 * not be told two different things about it.
 *
 * The `file` rides back for the reason it rides back on a write's answer: an
 * agent holding several reads in flight needs each body to say which path it
 * is, and the caller's own argument is the only spelling that can.
 */
export const DocumentBody = Schema.Struct({
  file: Schema.String,
  /** Verbatim, exactly as on disk. Markdown, interpreted only at view time —
   *  never `null` here, unlike the set's own `Document`: what the set does not
   *  keep the body of is not a document this read answers (`./documents.ts`
   *  holds that split, and the tool refuses the other kinds by name). */
  text: Schema.String,
})
export type DocumentBody = typeof DocumentBody.Type

// ── one node ───────────────────────────────────────────────────────────

/** Asking for one node. The whole request: a read names an id, and everything
 *  else about the answer is the set's to decide. */
export const NodeRequest = Schema.Struct({
  id: Schema.String.annotate({ description: "The node's `id`." }),
})
export type NodeRequest = typeof NodeRequest.Type

/**
 * One PLACEMENT of a node: a mirror record that shows it, and where that line
 * sits.
 *
 * Not a {@link Found} — a placement has no title, no mark and no ancestry of
 * its own; it draws the node's. What it does have is an id, and that id is the
 * only thing `remove_mirror` takes, which is why a node's own read is where the
 * placements of it are answered. A search never returns one: a mirror is a
 * second location of a node, and a hit for it would be the same node twice,
 * once at a place no write lands.
 */
export const Placement = Schema.Struct({
  id: Schema.String,
  /** Where the MIRROR RECORD sits — the line `remove_mirror` takes away, never
   *  the line the node it shows lives on. The narrowing is this declaration's;
   *  the pair is {@link Site}'s. */
  ...Site.fields,
  /** The node it is placed under. Absent at the top level of its file. */
  parent: Schema.optionalKey(Schema.String),
})
export type Placement = typeof Placement.Type

/**
 * A placement read from the OTHER end: one row of a curated list, and the node
 * standing at it.
 *
 * {@link Placement} answers "where else is this node drawn"; this answers "what
 * is on this list" — the two halves of the same fact, from whichever end the
 * caller happens to be holding. A Now section is a node whose children are
 * placements, so without this half an agent can retire an entry it already
 * knows about and can never ask what is on the list at all.
 *
 * `shows` is the node itself, situated the way every other answer here situates
 * one — id, title, mark, `file:line`, ancestry — because that is what the list
 * is FOR: the reader wants the items, and the placement id is what lets it take
 * one off.
 */
export const Placed = Schema.Struct({
  ...Placement.fields,
  shows: Found,
})
export type Placed = typeof Placed.Type

/**
 * One record that REFERS to a node, and how — a {@link Found} like every other
 * situated answer, plus the ways.
 *
 * A `Found` rather than a bare id for {@link Placed}'s reason: a reader given a
 * list of referrers wants to know what they ARE — their titles, where they sit,
 * whether they are finished — and a list of ids is a list of second reads.
 *
 * `ways` is `./backlinks.ts`'s own {@link Way}, imported rather than respelled:
 * that module is where the list is CLOSED — the argument that a `see` counts
 * and a placement does not is its header — and a `Schema.Literals` here would
 * be that closure written where nothing argues it. The same arrangement
 * {@link Progress} has with `./derive.ts`. Two entries for one record would be
 * one record said twice, so a record doing both says both in one entry.
 */
export const Reference = Schema.Struct({
  ...Found.fields,
  ways: Schema.Array(Way),
})
export type Reference = typeof Reference.Type

/**
 * What one node's page would say, plus the record itself.
 *
 * The stamps are `./node.ts`'s {@link STAMPED} — the record's own three mark
 * fields, spread here as they are spread into the record — because `status` on
 * {@link Found} says WHICH mark and only these say when, and what they carry is
 * the file's value handed back verbatim. Same for `date` and `desc`. One
 * declaration each, in the module that says what a record holds.
 */
export const Detail = Schema.Struct({
  ...Found.fields,
  ...STAMPED,
  date: RegularNode.fields.date,
  /** The repeat rule, as the record spells it — the node's own text, handed
   *  back for the writer that is about to change it. Present only on the
   *  occurrence that is NEXT, which is where the rule lives (./repeat.ts). */
  repeat: RegularNode.fields.repeat,
  desc: RegularNode.fields.desc,
  // `custom` arrives with {@link Found}'s fields above, where it moved when
  // hits were given it: one declaration, so a read of a node and a hit for the
  // same node cannot answer different maps.
  /** The two STAMPS, when the node has them: when it was captured, and when it
   *  was last written. Both absent on a node written before olai stamped
   *  anything — nothing invents a past it did not see. */
  created: RegularNode.fields.created,
  changed: RegularNode.fields.changed,
  /** The `#topic` and `@person` tags in the title, AS WRITTEN, sigil and all —
   *  a list that dropped the character that started them could not tell a
   *  reader which of the two namespaces this node carries. */
  tags: Schema.Array(Schema.String),
  /** How many of its child tasks are done, when any of them is a task. An
   *  ANNOTATION: it decides nothing, and in particular the node's own status is
   *  `status` above whatever this says. */
  progress: Schema.optionalKey(Progress),
  children: Schema.Array(Found),
  /** Everywhere else this node is drawn — the mirrors that show it, chains
   *  included. Absent when nothing does, which is nearly every node.
   *
   *  It is here because a placement is otherwise UNFINDABLE: mirrors are left
   *  out of search and out of every child list on purpose, so without this the
   *  only id `remove_mirror` could ever be given is one the same session had
   *  just created. Asked of the node rather than answered as a node, which is
   *  the same shape every refusal about mirrors takes — a mirror is not a node,
   *  so you ask the node where it is placed. */
  mirrors: Schema.optionalKey(Schema.Array(Placement)),
  /** The placements sitting UNDER this node, in sibling order, each with the
   *  node it shows — what a curated list holds. Absent when none do.
   *
   *  `children` above is the node's own children and never a mirror, because
   *  that list is about what hangs off it; this one is about what it POINTS at,
   *  and the two are different questions with different answers. A Now section
   *  is exactly a node of the second kind: without this, "what is on Now?" is a
   *  question the ops layer could not answer at all, and the ledger it was built
   *  for is read by hand again (the 2026-08-11 review). */
  placed: Schema.optionalKey(Schema.Array(Placed)),
  /** What REFERS to this node — every record whose `see` lands on it and every
   *  record whose title or note writes its `@id`, each with the ways it does.
   *  Absent when nothing does, which is most nodes.
   *
   *  It is here for {@link Detail.mirrors}' reason read one relation over: a
   *  reference points ONE way on disk, so without this the only way to find
   *  what talks about a node is to read the whole directory — and the browser
   *  draws exactly this list under a zoomed node, which would make it a fact a
   *  person could see and an agent could not. */
  referencedBy: Schema.optionalKey(Schema.Array(Reference)),
  /**
   * What is standing in this node's WAY right now — the derived blockedness,
   * each blocker situated the way every other list here situates a node.
   * Absent when nothing is, which is nearly every node.
   *
   * NOT `after` read back. That field above is the record's own, verbatim:
   * every target the line names, whether or not any of them is still work. This
   * is which of them are — and it is a different SET at both ends. An edge
   * spelled `blocks` on the OTHER record resolves into the same graph, so a
   * node carrying no `after` at all can be waiting; and a target that is
   * `done`, a target with no mark, and anything put away in an
   * `_olai/Trash.olai` stand in nobody's way, so an `after` of three can show
   * nothing here. Two fields because they answer two questions — "what does
   * this record declare" is what `set_after` edits, "can this start" is what a
   * reader is deciding on.
   *
   * ONE derivation, `./derive.ts`'s `blockersOf`, which is also what the app
   * dims a row with and what `is:blocked` selects on. Nothing about it is
   * spelled again here: what this declaration adds is the SHAPE the answer
   * travels in, which is {@link Found} for {@link Reference}'s reason — a
   * reader told only the ids of what it is waiting on is a reader making one
   * more read per blocker to learn whether any of them has moved.
   *
   * A `Found` and not a narrower shape, and that choice is worth its sentence
   * because two things pull the other way. Every entry here does carry a
   * `status`, and it is `todo` or `doing` — what is in the way is unfinished
   * WORK, which `InTheWay` says in its own type (`Exclude<Status, "done">`) —
   * so `Found`'s OPTIONAL status is one notch wider than what this list can
   * hold; and each blocker arrives with its `see`, its `after` and its whole
   * `custom` map, none of which the "can this start" question has a use for.
   * Both are paid deliberately. A struct that narrowed the mark would be the
   * unfinished predicate spelled a SECOND time, in a module that argues none of
   * it — the one duplication blockedness is most written against — and a struct
   * that dropped the record's fields would be a second situated vocabulary for
   * a list that is one or two entries long. Consistency with every other list
   * on this shape costs less than either.
   *
   * A HIT does not carry this, and that is not the `custom` oversight read
   * again: `custom` is the RECORD'S, so answering it only here made a query
   * plus a read per row out of one query. This is DERIVED, like `progress`
   * above it — and derived rollups wait for the node read, because a
   * {@link Found} holding an array of `Found` is a recursive shape that would
   * nest a blocker's blockers into every child list and every subtree row. What
   * a hit answers instead is the question rather than the list: `is:blocked`
   * selects on this same index, and the situated names are this read.
   */
  blockedBy: Schema.optionalKey(Schema.Array(Found)),
})
export type Detail = typeof Detail.Type

/**
 * The stamps alone, for a reading that produces them before it has an answer to
 * put them on.
 *
 * DERIVED from {@link Detail} rather than declared beside it, which is the
 * whole of why it exists: `@olai/ops`' `stampsOf` spelled
 * `Partial<Record<Status, string | true>>` for itself, and that is this shape
 * written a second time — same fields, same rule, nothing holding the two
 * together but whoever remembers to change both. A `Pick` cannot disagree with
 * what it picks from.
 */
export type Stamps = Pick<Detail, Status>

// ── a node and everything under it ─────────────────────────────────────

/** How deep an unasked-for walk goes. Here rather than beside the walk for the
 *  reason {@link DEFAULT_SEARCH_LIMIT} is beside its request: it is part of
 *  what an absent `depth` MEANS, and the sentence below quotes it — a number
 *  changed in one place would otherwise leave every agent's JSON Schema
 *  advertising the old one. */
export const DEFAULT_SUBTREE_DEPTH = 3

/**
 * Asking for a node and what hangs off it — or for a whole OUTLINE and
 * everything in it.
 *
 * TWO WAYS IN, AND EXACTLY ONE PER CALL. A node is named by `id` and a file by
 * `file`, and the second is what makes an outline of N top-level roots one call
 * rather than N: `list_outlines` already says which files there are and what
 * each one's roots are CALLED, and until this there was no read that could
 * descend into more than one of them at a time.
 *
 * BOTH ARE OPTIONAL HERE AND THE PAIR IS CHECKED BY THE READER, which is a
 * limit of this seam rather than an oversight. A union of two structs is the
 * type-level spelling of "exactly one", and it is not available here: the tool
 * table takes a schema apart by its `.fields` (`@olai/ops`' `Arguments`, and
 * `@olai/server`'s `argsOf`), and the JSON Schema an MCP host reads is an
 * object with properties rather than an `anyOf` it may or may not honour — the
 * same constraint that unrolls `add_node`'s capture. So the shape advertises
 * both, the prose says the rule, and the reader refuses either mistake in its
 * own words: naming neither, or naming both.
 *
 * `depth` means one thing on both arms — how far to descend, from the node, or
 * from EACH of the file's roots.
 */
export const SubtreeRequest = Schema.Struct({
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The node to read from. Give this or `file` — never both, never neither.",
    }),
  ),
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "An outline (`.olai`) under the served directory, exactly as `list_outlines` lists it. Reads the WHOLE file: every top-level node in it, each walked to `depth`. Give this or `id` — never both, never neither.",
    }),
  ),
  depth: Schema.optionalKey(
    Schema.Number.annotate({
      description:
        `How many levels of children to include — from the node, or from each of a file's roots. Default ${DEFAULT_SUBTREE_DEPTH}.`,
    }),
  ),
})
export type SubtreeRequest = typeof SubtreeRequest.Type

/**
 * A node and everything under it, nested — the shape a reader draws.
 *
 * The interface is written by hand and the schema suspends into it, which is
 * the documented way to spell a genuinely recursive Effect schema. It costs
 * nothing here and would have cost something one file over: a recursive schema
 * compiles to a `$ref`, and the MCP projection inlines local refs and strips
 * the pool — which is why `add_node`'s capture is UNROLLED to a fixed depth
 * (`@olai/ops`' `NESTING`). That constraint is about a schema an agent READS as
 * JSON Schema. This one is an answer, advertised to nobody, so the recursion
 * can be honest.
 */
export interface Subtree extends Found {
  readonly date?: string | undefined
  readonly desc?: string | undefined
  readonly children: ReadonlyArray<Subtree>
  /** True when the walk stopped at the depth it was given and this node has
   *  children it did not descend into. Said out loud, because a subtree that
   *  quietly ended would read as a leaf. */
  readonly truncated?: true
}

export const Subtree = Schema.Struct({
  ...Found.fields,
  date: RegularNode.fields.date,
  desc: RegularNode.fields.desc,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Subtree> => Subtree)),
  truncated: Schema.optionalKey(Schema.Literal(true)),
})

// ── an id that is not there ────────────────────────────────────────────

/**
 * What the two per-node reads answer when the set does not hold that id.
 *
 * A VALUE and not a refusal, and the difference is deliberate: asking about a
 * node that is gone is a fair question with a true answer, so it comes back as
 * data an agent can branch on rather than as an error it has to parse. The id
 * is echoed because the answer is otherwise indistinguishable from an empty
 * one — "which id did you not find" is the whole of what there is to say.
 *
 * Not on the package's surface, and it is the only shape in this file that is
 * not: a consumer holding a {@link NodeAnswer} narrows it with `"missing" in`,
 * which needs no name. It is exported the day something wants to say the arm
 * out loud.
 */
const Missing = Schema.Struct({ missing: Schema.String })

/** What `read_node` says: the node, or the id it does not hold. */
export const NodeAnswer = Schema.Union([Detail, Missing])
export type NodeAnswer = typeof NodeAnswer.Type

/**
 * A WHOLE OUTLINE, walked — what `read_subtree` answers a `file` with.
 *
 * ROOTS AND NOT ONE TREE, because a file is not a node. An outline has as many
 * top-level nodes as somebody wrote, and a synthetic parent standing for the
 * file would be a record no id names, no op can edit and no page draws. So the
 * answer is the LIST, in the sibling order a reader sees them in, each root
 * walked exactly as an `id` walk walks the node it was handed — `truncated` and
 * all, per root, since one root can bottom out at a leaf while its neighbour is
 * cut at the depth.
 *
 * A MIRROR AT THE TOP LEVEL IS NOT A ROOT, which is the walk's own rule read
 * one level up: `read_subtree` does not walk placements, and {@link
 * OutlineSummary}'s `roots` does not name one either. The node a placement
 * shows lives somewhere, and where it lives is where this read answers it.
 *
 * The `file` rides back for {@link DocumentBody}'s reason: an agent holding
 * several reads in flight needs each answer to say which file it is about, and
 * the caller's own argument is the only spelling that can.
 */
export const OutlineRoots = Schema.Struct({
  file: Schema.String,
  roots: Schema.Array(Subtree),
})
export type OutlineRoots = typeof OutlineRoots.Type

/** What `read_subtree` says: the node, the whole outline, or the id the set
 *  does not hold. A `file` that is not one is REFUSED rather than answered —
 *  a path is not an id, and the useful answer to a typo is the near miss, which
 *  is the split {@link DocumentBody} argues one read over. */
export const SubtreeAnswer = Schema.Union([Subtree, OutlineRoots, Missing])
export type SubtreeAnswer = typeof SubtreeAnswer.Type

// ── which ids the set declares ─────────────────────────────────────────

/**
 * WHICH OF THESE IDS THE SET DECLARES — a batch of {@link NodeRequest}, asked
 * about a handful of strings somebody has in front of them rather than about
 * one node they mean to read.
 *
 * The caller is the chat transcript (`@olai/web`'s `chat/refs.ts`): an agent
 * spells every id in BACKTICKS, so a message arrives holding a dozen code
 * spans of which some name nodes and the rest are flags, file names and words,
 * and the whole of what the panel needs is which is which. That used to be a
 * lookup in the browser's own copy of the set, which is the copy
 * `docs/brainstorming/vault-in-browser.md` is taking away.
 *
 * A BATCH, and that is the whole reason this is not the read next door: one
 * message is one question. A `read_node` per span would be a dozen round trips
 * to draw one paragraph, each carrying a node in full where the answer needed
 * is a yes with an id on it.
 *
 * IT IS NOT A SEARCH, either, and the distinction is what keeps it small: a
 * search reads a grammar over the words of a query and ranks what it finds,
 * where this asks about ids EXACTLY — the same lookup an edge target and a
 * `see` link already are ({@link nodeNamed}), spelled for many at once.
 */
export const NamedRequest = Schema.Struct({
  /** The ids to ask about, exactly as they are written. Nothing is trimmed or
   *  folded here: what an id looks like is the caller's fact (a code span's
   *  text is what somebody typed between two backticks), and a lookup that
   *  normalised on the way in would answer about an id the caller never asked
   *  about. */
  ids: Schema.Array(Schema.String),
})
export type NamedRequest = typeof NamedRequest.Type

/**
 * One id the set declares, and the NODE it names.
 *
 * The two are not always the same string, which is the reason this answers with
 * a pair rather than with a list of the ids that exist: an id may address a
 * MIRROR, and the node standing at that placement is what a reader can be shown
 * ({@link nodeNamed} follows the chain). A caller handed back only its own
 * spelling would point at a placement no row in the tree carries.
 *
 * Not on the package's surface, for {@link Missing}'s reason and by its
 * precedent: a consumer holds a {@link NamedAnswer} and reads its rows, which
 * needs no name. It is exported the day something wants to say the row out
 * loud.
 */
const NamedNode = Schema.Struct({
  /** The id as asked — the caller's own spelling, echoed so an answer can be
   *  looked up by the thing that was asked about. */
  asked: Schema.String,
  /** The node that id names: the record at the end of whatever mirror chain it
   *  addresses. */
  id: Schema.String,
  /**
   * ...and what that node is CALLED, right now.
   *
   * The transcript's marking does not read it — a code span is drawn as the
   * words the agent wrote — and it is here for the OTHER caller of this lookup:
   * the chat composer's strip of armed nodes, which draws a chip per node the
   * message is about and has nothing but the id to draw one from
   * (`@olai/web`'s `chat/Composer.tsx`). It was a lookup in the browser's own
   * copy of every record until PR 10 of
   * `docs/brainstorming/vault-in-browser.md`.
   *
   * ONE FIELD rather than a second member, because it is one more fact about
   * the node this row already names: a lookup that answered "which ids are
   * real" and a lookup that answered "and what is each called" would be two
   * calls over one `nodeNamed`.
   */
  title: Schema.String,
})

/**
 * The ones the set declares, and NOTHING about the rest.
 *
 * ABSENCE IS THE ANSWER for an id nothing declares, and for a placement whose
 * chain is dead — there is nothing to point at either way, which is exactly
 * what {@link nodeNamed} says by answering `undefined`. A per-id arm saying so
 * would be a list the length of every backtick an agent ever wrote, mostly
 * carrying the word "no".
 *
 * A LIST OF PAIRS rather than an object keyed by the asked id: a key of an
 * object is a name in a namespace that already has `constructor` and
 * `toString` in it, and a lookup built on one would answer about ids the set
 * never declared. The caller builds the map it wants, and can build a `Map`.
 *
 * At most one entry per id asked about, whatever the request repeated: this is
 * a lookup, and a lookup has one answer per key.
 */
export const NamedAnswer = Schema.Struct({
  named: Schema.Array(NamedNode),
})
export type NamedAnswer = typeof NamedAnswer.Type

/**
 * WHERE THESE IDS NOW LIVE, and WHICH OF THESE FILES the set has anything from
 * — one question, asked by a reader holding a memory of things it saw earlier.
 *
 * The caller is the browser's fold memory (`@olai/web`'s `fold/memory.ts`),
 * which remembers collapsed node ids grouped by the file each node is DEFINED
 * in, and has to keep that memory honest as the directory moves under it: a
 * node that was archived is the same node in another file and keeps its fold,
 * a node somebody deleted should stop being remembered, and a file that has
 * stopped parsing says nothing at all about its nodes. It answered all three
 * out of the whole id→file map of its own copy of the set, which is the copy
 * `docs/brainstorming/vault-in-browser.md` is taking away.
 *
 * TWO LISTS, ANSWERED INDEPENDENTLY, and that is the shape rather than an
 * accident: nothing here pairs an id with a file. Which of them was filed under
 * which is the caller's own bookkeeping, and a request that carried the pairing
 * would be asking this layer to hold an opinion about a browser's storage. What
 * is asked here is two facts about the SET — where a record with this id is,
 * and whether the set has this file LOADED at all.
 *
 * THEY TRAVEL TOGETHER BECAUSE THEY ARE READ TOGETHER, and that is the reason
 * rather than the other one that suggests itself: the second half is not a
 * secret — which files a directory serves, and which of them would not parse,
 * are already on the wire as a key set and an error list. It rides here because
 * an id's absence means "deleted" ONLY beside the fact that its file was read,
 * and asking the two separately would leave a window in which the halves are
 * about two different revisions.
 *
 * NOT {@link NamedRequest}, one door over, and the difference is exact:
 * {@link nodeNamed} FOLLOWS a mirror chain, because a backtick in a paragraph
 * means the node a reader would be shown. A fold is of a RECORD — including
 * the record of a mirror whose chain has died, which shows nothing and folds by
 * its own id — so this is the plain lookup in `Derived.byId` and no chain is
 * walked. Asked through `named`, a fold on a dangling placement would read as a
 * node that is gone while its record is sitting in the file.
 */
export const HomesRequest = Schema.Struct({
  /** The ids to place, exactly as the caller has them. */
  ids: Schema.Array(Schema.String),
  /** The files to ask about — for the caller above, the ones its memory is
   *  grouped by. Independent of {@link ids}: see the header. */
  files: Schema.Array(Schema.String),
})
export type HomesRequest = typeof HomesRequest.Type

/** One id, and the file the record carrying it is written in. */
const Home = Schema.Struct({
  id: Schema.String,
  /** Root-relative, `/`-spelled — every `file` in this vocabulary. */
  file: Schema.String,
})

/**
 * Where the set has them, and which of the asked files it has anything from.
 *
 * ABSENCE IS THE ANSWER for an id no record carries, exactly as it is for
 * {@link NamedAnswer}: a per-id arm saying "no" would be a list as long as
 * whatever the caller happened to remember, mostly carrying the word "no". What
 * absence MEANS is the caller's to decide, and it needs {@link loaded} to
 * decide it.
 *
 * A LIST OF PAIRS rather than an object keyed by id, for {@link NamedAnswer}'s
 * reason word for word: a key of an object is a name in a namespace that
 * already holds `constructor`, and a lookup built on one would answer about ids
 * the set never declared.
 *
 * At most one entry per id asked about, whatever the request repeated.
 */
export const HomesAnswer = Schema.Struct({
  /** The asked ids the set declares a record for, each with its file. */
  homes: Schema.Array(Home),
  /**
   * The asked files this directory SERVES AND HAS READ — served, and not among
   * the ones that would not parse.
   *
   * The other half of the decision, and the half that cannot be inferred from
   * {@link homes}: a file whose every remembered id has gone away is
   * indistinguishable, from the ids alone, from a file that stopped parsing —
   * and reading the second as the first is how a reader loses every fold in an
   * outline that has a typo in it for a minute.
   *
   * READ, and not "declares a record", which is the near miss worth naming: an
   * outline that is served, parses, and has had its last node deleted declares
   * nothing, and answering it as unreadable would keep a fold for every node
   * that was in it — for good, since nothing about that file would ever change
   * the answer again. What is being asked is whether the set KNOWS about the
   * file, which is what makes its silence about an id mean something.
   */
  loaded: Schema.Array(Schema.String),
})
export type HomesAnswer = typeof HomesAnswer.Type
