/**
 * What a search ASKS and what one hit SAYS.
 *
 * Data, and nothing but: there is no matcher in this file and no way to reach
 * one from it. It is here for the reason `./committing.ts` is, and the argument
 * is that file's word for word — this package is the floor both the ops layer
 * and the wire spec stand on, and a vocabulary spelled in either of those would
 * have to be spelled again in the other. `@olai/ops` PRODUCES these values
 * (`Query.search`, over one reading of one snapshot), `@olai/surface` CARRIES
 * them (the `search.nodes` procedure the ⌘K palette calls), the browser DRAWS
 * them, an agent reads the identical value off `search_nodes`, and none of the
 * four has to agree with the others by memory.
 *
 * **It was spelled twice, and the two were free to drift.** The ops layer had
 * `Found`/`Hit`/`Search` as TypeScript, the wire spec had
 * `SearchHit`/`SearchAnswer` as Effect Schema, and `@olai/surface`'s own header
 * claimed a field added to one was a compile error on the other. It was not:
 * adding a field to the ops-side `Found` and producing it type-checked clean
 * across every package, after which `search_nodes` answered an agent with it
 * and the palette's procedure — encoding against a schema that had never heard
 * of it — dropped it. An agent and a person searching the same words in the
 * same directory, looking at different rows. One declaration is the fix; a
 * fence over two declarations was the fallback, and this package existing is
 * why it was not needed.
 *
 * **Why the SHAPE lives here and the SITUATING does not.** Every field of a hit
 * is a statement about records in this package's own vocabulary — an id, a
 * title, a `file:line`, a {@link Status}, the ancestor titles `ancestorsOf`
 * walks, the edge lists a record carries. What `@olai/ops` keeps is the act of
 * BUILDING one out of a set: the same division `./committing.ts` makes, where
 * the shape of what is pending is here and the survey that produces one is not.
 *
 * This paragraph used to say the ranking stayed up there too, "where the
 * matcher is". The matcher came down in the filter-in-place change and the
 * ranking followed it one door later (`./filter.ts`'s `ranked`), for the
 * same reason both times: a browser cannot call a procedure per keystroke, and
 * a second spelling of a rule is a second answer to it.
 *
 * **{@link Found} is next door**, in `./reading.ts`, and started here. It is
 * the atom of EVERY read — the node a detail, a subtree and a curated list's
 * row are each built out of, not only a hit — so the module named for the read
 * vocabulary is where it belongs, and this one imports it like any other
 * caller. What is left here is exactly what a QUERY adds to it.
 */

import { Schema } from "effect"

import { AtDocument, AtNode, NodeId } from "./address.ts"
import { Face } from "./document.ts"
import { DOCUMENT_FIELDS, Refusal, SEARCH_FIELDS } from "./filter.ts"
import { RegularNode } from "./node.ts"
import { Found } from "./reading.ts"

/**
 * ONE HIT ON A NODE: a situated record, its ADDRESS, and the only thing about
 * it that is a fact about the QUERY rather than about the record — which field
 * carried the strongest match, so a caller can say why this came back instead
 * of leaving a reader to guess.
 *
 * `at` is what a hit is FOR, once a search answers with two kinds of thing:
 * somewhere to go. It is the bare `#id` this format's node addresses are — the
 * id is global and outlives every move, so the address is right about where the
 * node is even after the file it is in has been renamed (`./address.ts`).
 */
export const NodeHit = Schema.Struct({
  at: AtNode,
  ...Found.fields,
  /** ABSENT when the query named no words at all: `is:done` selects a node by a
   *  field test, and no title, id, tag or note carried it. Saying one of them
   *  did would be an answer invented to fill a slot — the same rule `status`
   *  above follows, rather than a fifth word meaning "nothing".
   *
   *  The four are `./filter.ts`'s own list, because which fields a word is
   *  looked for in is the matcher's fact and this is only where it is reported. */
  matched: Schema.optionalKey(Schema.Literals(SEARCH_FIELDS)),
  /**
   * The custom keys a `prop:` clause selected this node on, in the node's own
   * spelling. ABSENT for every query that named no property.
   *
   * A SIBLING of `matched` rather than a fifth value of it, ruled on this PR
   * and argued where the matcher produces it (`./filter.ts`'s `Match.props`).
   * The short of it: the two can both be true at once — `cabinets
   * prop:agent=claude-opus` matched on the title AND on the agent — so one slot
   * would have to drop whichever a precedence rule nobody asked for preferred;
   * `matched`'s four values are a CLOSED list of places a word is looked for,
   * weighted against each other, where a property key is an open namespace
   * somebody invented; and `matched` being absent already MEANS "the query
   * named no words", which a fifth value would quietly stop meaning.
   *
   * What it is FOR is the row: a hit carries the whole `custom` map, and this
   * says which of those keys is the answer to "why is this here" — so a reader
   * sees the property they searched by first rather than hunting it in a line
   * of others.
   */
  matchedProps: Schema.optionalKey(Schema.Array(Schema.String)),
  /**
   * The node's NOTE, verbatim — present only when the query ASKED for it
   * ({@link SearchRequest.withDesc}) and the node has one.
   *
   * The one field on a hit that is not carried by default, and the reason is
   * its SIZE rather than its meaning. Every other record field here is bounded
   * like a title — an id, a mark, a handful of edge ids, a map of named facts —
   * so carrying it costs a row about what a row already is. A note is prose
   * with no bound at all: this repository's own roadmap keeps whole forensics
   * under a bug, and twelve of those is an answer many times the size of the
   * question. So it is asked for, once, by the caller that is going to read it.
   *
   * WHOLE OR ABSENT, never cut. `set_desc` and `update`'s `was` both take the
   * note as one text, so a hit carrying a shortened one would be a note an edit
   * gets written against — which is the same reason `read_document` refuses a
   * file it could not read rather than answering it empty. The dial is
   * `withDesc` and `limit`, and both are exact.
   *
   * The RECORD's own declaration, like {@link Found}'s edge fields: what
   * travels is the file's value handed back, so a second spelling here would be
   * free to stop meaning what the file means. It is the same note a walk
   * carries on every row ({@link Subtree}) and a node read carries once
   * ({@link Detail}) — one field, three answers, no reconciling.
   */
  desc: RegularNode.fields.desc,
})
export type NodeHit = typeof NodeHit.Type

/**
 * ONE HIT ON A DOCUMENT — the half of every search this app could not answer.
 *
 * It carries what a row needs and nothing more: where to go, what the document
 * is CALLED, which of its places held the word, and the properties its
 * frontmatter writes. There is no `line`, no `status` and no `path` of
 * ancestors, because a document has none of those — an arm with them filled in
 * with zeroes and empty lists would be exactly the shape this whole arc exists
 * to stop, a document pretending to be a node badly.
 *
 * THE PROPERTIES ARE HERE, though, and that is the one field this arm gained
 * rather than declined: a `.md` writes named facts about itself in its
 * frontmatter (`./frontmatter.ts`), so `prop:agent=claude-opus` selects
 * documents now — and a row that answered a property query with a bare title
 * would make the reader open each hit to find the fact they had just searched
 * by, which is the argument {@link NodeHit}'s `custom` already won.
 *
 * WHAT IT DOES NOT CARRY YET, said rather than left to be noticed: an excerpt
 * of the line a `body` match landed on. `matched` says the word was in the
 * prose, which is enough for a reader to decide to open it, and quoting the
 * line is a design question (how much, from where, how highlighted) that
 * belongs with whatever draws it rather than riding in ahead of a caller.
 */
export const DocumentHit = Schema.Struct({
  at: AtDocument,
  /** What the document is called: its own face's title, so this row, the
   *  palette, `list_documents` and the page's own heading say one name. */
  title: Schema.String,
  /** Which of `./filter.ts`'s three document fields carried the strongest
   *  match — ABSENT for a query that named no words, on {@link NodeHit}'s own
   *  rule. */
  matched: Schema.optionalKey(Schema.Literals(DOCUMENT_FIELDS)),
  /** The named facts the file writes about itself — its frontmatter, read into
   *  the same open map a record's `custom` is (`./frontmatter.ts`). Absent for
   *  a document that carries none, which is the writer's own rule for absence
   *  and is what keeps an empty map off every row of a vault that uses none. */
  props: Schema.optionalKey(Face.fields.props),
  /** The keys a `prop:` clause selected this document on, in the file's own
   *  spelling — {@link NodeHit.matchedProps} over the other arm, and the reason
   *  the row can put the answer to "why is this here" first. ABSENT for every
   *  query that named no property. */
  matchedProps: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type DocumentHit = typeof DocumentHit.Type

/**
 * WHAT A SEARCH ANSWERS WITH — a node or a document, and nothing said about
 * either that is not true of it.
 *
 * A SUM rather than one shape with a `kind` and a run of optional fields, for
 * `./document.ts`'s reason and this file's own: the two arms genuinely differ,
 * and a reader that had to check whether `line` was filled in would be the
 * node-shaped path and the document-shaped path this arc replaced with a type.
 *
 * THE DISCRIMINANT IS THE ADDRESS, which is the grammar doing real work rather
 * than a tag beside it: an address already says whether it names a node or a
 * document, and a second field saying so would be free to disagree with it.
 * {@link isNodeHit} is how a reader narrows — the same move `isMirror` and
 * `isOutline` are, named once rather than spelled as a field test wherever a
 * door only draws one kind.
 */
export const SearchHit = Schema.Union([NodeHit, DocumentHit])
export type SearchHit = typeof SearchHit.Type

/** Whether a hit is on a record. The doors that only ever wanted a node — the
 *  edge panel picking something to `see`, the chat composer's `@` list —
 *  narrow through this, and the type is what makes them say so. */
export const isNodeHit = (hit: SearchHit): hit is NodeHit => hit.at.kind === "node"

export const SearchAnswer = Schema.Struct({
  hits: Schema.Array(SearchHit),
  /** How many nodes matched in all. `hits` is capped; this is not, so "twelve
   *  of ninety" is sayable. */
  total: Schema.Int,
  /** What the grammar could not read, in its own words — a known operator with
   *  an unknown value (`is:open`). ABSENT for every query it could read.
   *
   *  It travels rather than being swallowed because a door that answered
   *  `is:open` with an empty list and no reason is the silent failure
   *  HACKING.md forbids: the reader typed an operator, and the honest answer is
   *  which values it takes. The filter over the tree draws its own because it
   *  parses for itself; these are for the three doors that ask the server. */
  refusals: Schema.optionalKey(Schema.Array(Refusal)),
})
export type SearchAnswer = typeof SearchAnswer.Type

/** How many hits an unasked-for limit means. Here rather than beside the
 *  matcher because it is part of what an absent `limit` MEANS, which is a fact
 *  about the request — and because the sentence below quotes it, so a number
 *  changed in one place would otherwise leave every agent's JSON Schema
 *  advertising the old one. */
export const DEFAULT_SEARCH_LIMIT = 12

/**
 * What a search asks.
 *
 * The field prose is agent-facing — it becomes the JSON Schema `search_nodes`
 * advertises — and it describes the matcher's own rule rather than a wire
 * convention, which is why it can be written once for a caller that is a model
 * and a caller that is a text box. `text` is the whole GRAMMAR
 * ({@link parseFilter}), so the sentence documenting it is the one place the
 * operators are spelled out for a reader who is not looking at the parser.
 */
export const SearchRequest = Schema.Struct({
  text: Schema.String.annotate({
    description:
      "What to look for. Case-folded substring WORDS — every word must appear somewhere in the same node, unless `OR` joins it to an alternative (below), where either one will do — composed with OPERATORS:\n" +
      "- `is:done` / `is:doing` / `is:todo` — the mark the node stores (never a derived one). `is:marked` is any of the three; `is:trashed` reaches what was put away.\n" +
      "- `is:mirrored` — the node is DRAWN SOMEWHERE ELSE as well: some placement shows it (chains followed), which is what `read_node` answers as `mirrors` and what putting a node on a curated list does to it. Asked of the NODE, never of the placement — a search never returns a placement. A copy filed in an `_olai/Trash.olai` still counts, since it is still where the node is drawn on the trash page.\n" +
      "- `is:blocked` — the node is WAITING: something it must come after is a task that is not finished. Derived, and the same derivation the app draws a blocked row with, so it reads the ORDERING GRAPH rather than the field — an edge spelled `blocks` on the other record counts, and a node can be blocked while carrying no `after` of its own (`has:after` is the question about the field). A node with no mark is not blocked (a bullet is not work), a target with no mark blocks nothing, and put-away work is out of it at both ends. `-is:blocked` takes the waiting ones back out.\n" +
      "- `has:desc` / `has:date` / `has:created` / `has:changed` / `has:see` / `has:after` / `has:doc` / `has:repeat` — a field the record carries. `has:repeat` is what COMES BACK: a repeat rule needs a date to repeat from, so it selects inside `has:date`, and `has:date -has:repeat` is everything dated once. `has:created -has:changed` is a node nothing has been written to since it was captured.\n" +
      "- `date:2026-08-10`, `date:2026-08`, `date:2026`, `date:2026-08-01..2026-08-14`, `date:..2026-08-10`, `date:2026-08-10..` — the two dates a journal reads: what the node is scheduled for, and when it was finished.\n" +
      "- `date:today`, `date:yesterday`, `date:tomorrow`, and `this-` / `last-` / `next-` with `week`, `month` or `year` (`date:last-week`) — the same operator, counted from the day the query is asked on, in the server's own time zone. A week runs MONDAY to Sunday. They go at either end of a range like any other value: `date:last-week..`, `date:..today`, `date:last-month..yesterday`.\n" +
      "- `changed:1h`, `created:30m`, `changed:2d`, `created:1w` — a DURATION back from the moment the query is asked, in `m` MINUTES, `h` hours, `d` days or `w` weeks. There are no month or year units (`1mo` and `1y` are refused; `m` is minutes, and month or year recency is already `last-month..` or `2026`), and values are case-folded, so `1M` is one minute. A bare duration is WITHIN THE LAST N — `created:1h` is `created:1h..`. At a range's END it is the moment itself: `created:..1h` is older than an hour, `changed:2h..30m` is a window (older bound first), and the ends mix with everything else (`created:yesterday..3h`). There are no comparison operators and no `ago()`; inequalities are spelled as ranges.\n" +
      "- A duration is ROLLING where a day word is CALENDAR, and both are worth having: `created:1d` is the last twenty-four hours, `created:today` is since midnight; `changed:1w` is the last seven days, `changed:this-week` starts on Monday. Durations reach the stamps exactly, since those carry seconds. Under `date:` they compare against whatever precision the node wrote: a bare `date:` day sorts before every moment on that day, so `date:1h` effectively selects work FINISHED inside the hour rather than the day's plans.\n" +
      "- `created:…` / `changed:…` — the STAMPS, and they take every value `date:` takes above, absolute, relative or a duration, with or without a range. `created` is when olai captured the node; `changed` is when olai last wrote to it. Neither is the same question as `date:`: one node can be scheduled for the 10th, captured on the 1st and last written today. Use them to find recent work (`changed:today`, `changed:1h`), what arrived in a stretch (`created:last-week`), or what has gone untouched (`-changed:last-month`, `-changed:1d`).\n" +
      "- ABSENCE IS NOT A PAST. The stamps arrived after the format did, so a node written before them carries NEITHER, and nothing invents one: such a node is found by NO `created:` span however wide (`created:2000..` does not reach it), and IS found by the negation `-created:2000..` — the same reading that makes `-has:date` answer with the undated. If you need to know when an unstamped node was really written, that is `git log`, not this.\n" +
      "- `prop:pr` / `prop:agent=claude-opus` — a CUSTOM property the node carries, by key or by key and value. Reads the `custom` map only: a field is not a property, so `prop:done` and `prop:date=…` match nothing. A list value matches on any member.\n" +
      "- `-` before any word or operator negates it: `#home -is:done`.\n" +
      "- `\"kitchen remodel\"` — a quoted PHRASE is ONE substring where two words are two, looked for in the same four fields. A quoted token is also TEXT rather than an operator, which is the only way to search for the spelling of one: `\"is:done\"` finds the note that says so. What the FRONT position decides is only that: a quote opens a region wherever it sits and the region must be CLOSED, which is how a value with a space is written (`prop:stage=\"in review\"`) and why `36\"` is refused like any other unclosed quote. REFUSED, never closed on your behalf — as is `\"\"`, or a phrase of nothing but spaces, since an empty needle is in every node ever written.\n" +
      "- `walnut OR birch` — either one. `OR` joins the tokens on either side of it and binds TIGHTER than the space between two tokens, which is the implicit AND: `#home kitchen OR bathroom` is `#home` AND one of the other two, never `(#home and kitchen)` or every bathroom in the directory. A chain is one group, and clauses can be alternatives (`is:todo OR is:doing`, `date:last-week OR is:blocked`). IN CAPITALS — the one token that is not case-folded, because lower-case `or` is an ordinary word to find, and `\"OR\"` is that word in capitals. An `OR` with nothing on one side of it is REFUSED. There are no parentheses and none are needed: `-a -b` is \"neither\" and `-a OR -b` is \"not both\".\n" +
      "A `#tag` or `@mention` is an ordinary word — tags are indexed bare and as written. An unknown value for a known operator is REFUSED rather than searched for as text; a colon after anything else (`TODO:`) is just a word.\n" +
      "TRASHED NODES ARE EXCLUDED unless the query says `is:trashed`.",
  }),
  limit: Schema.optionalKey(
    Schema.Number.annotate({
      description:
        `How many hits to return. Default ${DEFAULT_SEARCH_LIMIT}; the total is reported either way.`,
    }),
  ),
  /**
   * THE NOTES, WITH THE SELECTION — the second dial on an answer's size, and
   * the only field of a record a hit does not carry by default.
   *
   * ASKED FOR RATHER THAN ALWAYS ON, which is the one decision on this request
   * that goes the other way from `custom`'s. The map of named facts rides every
   * hit because a property is a named fact smaller than the title beside it, so
   * "every lane with `pr=…`" is one call. A NOTE is not that shape: it is
   * unbounded prose, and a query that never reads one should not pay for twelve
   * of them. Two callers make that concrete rather than hypothetical — this
   * same request is what the ⌘K palette, the edge panel and the composer's `@`
   * list ask over the wire on every settled keystroke, and none of them draws a
   * note.
   *
   * SO IT IS ONE FLAG AND NOT A FIELD LIST. What a caller is choosing between
   * is a shortlist and a shortlist with the notes in it; a `fields` vocabulary
   * would be a projection language over an answer whose other fields are all
   * cheap, invented for one field.
   *
   * NODES ONLY, and that is the grammar rather than a narrowing chosen here: a
   * document's "note" is its whole body, which `read_document` answers as one
   * text. A document hit is unchanged by this.
   */
  withDesc: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "Carry each node hit's `desc` — its note, whole — so a selection arrives WITH its notes in one call. Off by default: a note is unbounded prose, and a query that will not read one should not pay for it. Documents are unaffected; a `.md`'s prose is `read_document`.",
    }),
  ),
  /**
   * The two scopes a tree page can BE — an AGENT's, now, and the sentence they
   * arrived under is worth correcting rather than deleting.
   *
   * They were put here for the browser's filter, "so a door that could not ask
   * for that narrowing would be answering a smaller question than the other
   * one". The filter is a door on the wire since `search-server-side` and does
   * NOT use them, and could not: a page draws MIRRORS, and a mirror shows a
   * node that lives in another outline, so a page filtered under `file` would
   * lose every row a curated list is made of ({@link MatchingRequest}, and
   * `@olai/ops`' `Query.matches` at length). What is left is what `search_nodes`
   * documents them as — an agent asking exactly the question a person gets by
   * filtering one page — which is why they stay on THIS request and are not
   * spread onto the other: a field nobody sends is a field nobody can be held
   * to.
   */
  file: Schema.optionalKey(
    Schema.String.annotate({
      description: "Only nodes in this outline, by its relative path.",
    }),
  ),
  under: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Only this node and everything beneath it, by id — the same scoping a person gets by filtering a zoomed page.",
    }),
  ),
  /**
   * ONE KIND OF THING, for a caller that can only use one.
   *
   * The third scope, and the one the sum made necessary: a search answers with
   * records AND documents, and a door PICKING A RECORD to point at — the edge
   * panel writing a `see`, the composer's `@` list, the move picker — cannot
   * take a document, because a `see` names a node id and nothing else. Such a
   * door filtering the answer itself would be a door whose list runs short
   * exactly when a query matches enough documents to fill the limit, so the
   * narrowing is on the REQUEST, where the cap is applied.
   *
   * Absent is both, which is what every reading door wants.
   */
  kind: Schema.optionalKey(
    Schema.Literals(["node", "document"]).annotate({
      description:
        "Only records (`node`) or only documents (`document`). Both when it is not given.",
    }),
  ),
})
export type SearchRequest = typeof SearchRequest.Type

// ── the other question a search answers ────────────────────────────────

/**
 * WHAT A PAGE'S FILTER ASKS: not "the best twelve", but "which of them, and
 * why" — every node the query selects, uncapped and unranked.
 *
 * A SECOND SHAPE beside {@link SearchRequest} rather than a flag on it, because
 * the two doors want two different things out of one matcher and neither is the
 * other cut short. A SEARCH is a shortlist somebody reads: it is ranked, it is
 * capped, and every hit carries what a row of results draws — the title, the
 * `file:line`, the ancestors, the properties. A FILTER is a membership test
 * over rows already on a screen: what it needs is the SET of ids, whole,
 * because the page prunes itself by it and counts itself against it ("3 of 41"
 * is a lie if the answer was capped at twelve), and what it needs about each is
 * one fact — which field carried the words, so a row found only behind its ¶
 * can say so. A capped, ranked, situated answer would be the wrong answer with
 * more bytes in it.
 *
 * It is the browser's door and only the browser's: an agent asking "which nodes
 * match" is asking `search_nodes`, which answers with the nodes rather than
 * with a set of ids to look up. Said here because the two live in one file and
 * the difference between them is not the wire's to guess.
 */
export const MatchingRequest = Schema.Struct({
  /** The same grammar, the same words — {@link SearchRequest.text}, and
   *  deliberately not a second spelling of that sentence: what a query MEANS is
   *  one paragraph, and this door reads it with the same `parseFilter`. */
  text: Schema.String,
  /**
   * Whether what was put AWAY is in this corner of the set at all — the
   * matcher's own {@link Scope.trashed} put on the wire, because the caller is
   * the only one who knows.
   *
   * WHAT IT MEANS IS ARGUED WHERE THE MATCHER TAKES IT (`./filter.ts`'s
   * `Scope`) and is deliberately not re-stated here: this package is a monument
   * to a vocabulary that was spelled twice and drifted. The short of it, for a
   * reader of the wire: absent is the grammar's own rule (the trash is reached
   * by `is:trashed` and not otherwise), and `true` is a PAGE saying its own
   * rows are already put-away ones — never a widening of a search of the
   * directory, since the page that sends it is the page that draws it.
   */
  trashed: Schema.optionalKey(Schema.Boolean),
})
export type MatchingRequest = typeof MatchingRequest.Type

/** One node the query selected, and why — the id, and the field that carried
 *  the words. `matched` is ABSENT for a query that named none (`is:done` on its
 *  own), which is {@link NodeHit}'s own rule for absence: nothing carried it,
 *  and saying "title" would be inventing a reason. */
export const MatchedNode = Schema.Struct({
  id: NodeId,
  matched: Schema.optionalKey(Schema.Literals(SEARCH_FIELDS)),
})
export type MatchedNode = typeof MatchedNode.Type

/**
 * Every node the query selects, in the set's own file-then-line order.
 *
 * NO `total`, because the list IS the total — nothing was capped. No hits and
 * no situating: the caller is looking at these rows already, and an ancestor
 * walk per selected node is exactly the cost {@link ranked} was moved below a
 * cap to avoid.
 *
 * NO `refusals` either, and that one is a decision rather than an omission. A
 * refusal is what the GRAMMAR made of the words, and the door that asks this
 * reads the same grammar itself (`parseFilter`, one function, both sides) —
 * so it draws the refusal the moment somebody types it rather than a round trip
 * later, and never asks a question it has already been told is unreadable. The
 * three doors that DO carry refusals on the wire ({@link SearchAnswer}) are the
 * ones that do not parse for themselves.
 */
export const MatchingAnswer = Schema.Struct({
  matches: Schema.Array(MatchedNode),
})
export type MatchingAnswer = typeof MatchingAnswer.Type
