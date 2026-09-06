/**
 * THE SEARCH ROW'S ONE AGENT VERB — the question two faces ask, on the face an
 * agent reads it from.
 *
 * It was an entry in `@olai/ops`' one closed `TOOLS` table, which meant a
 * general package spelled this row's vocabulary and a serve without this row
 * still advertised `search_nodes` to an agent — which is exactly the tool that
 * then answers no hits AND THE REASON, because core's own door refuses in words
 * when nobody is matching. A tool leaves with the row that owns it now
 * (juspay/olai#546), so a serve minus this row offers no search at all.
 *
 * The reader is one call onto `Asking.search`, the same envelope the ⌘K palette
 * reaches through `search.nodes` — one snapshot, one clock, one vocabulary, so
 * the two faces cannot be told different things. `./tools.test.ts` runs the
 * shared walk with this row's real matcher behind that door.
 */

import { SearchAnswer, SearchRequest } from "@olai/format"
import { read, type Tool } from "@olai/ops"

export const tools: ReadonlyArray<Tool> = [
  read(
    "nodes",
    "Search the directory",
    "Find nodes by title, id, `#tag` or note — and by what they ARE, with the operators `text` documents (`is:`, `has:`, `date:`, `created:`, `changed:`, `prop:`, and `-` to negate), plus `\"quoted phrases\"` and `OR`. `prop:` searches a node's custom properties: `prop:pr` finds every node carrying that key, `prop:agent=claude-opus` every node whose value is that. A key the vault DECLARES `int` or `date` in `_olai/Properties.olai` also takes a SPAN, in `date:`'s own syntax: `prop:records=190..200`, `prop:dispatched=2026-08-20..`. An `int` compares as a number; a range on any other key is REFUSED, naming what the key is. Results carry `file:line`, its ancestor titles, its parent's id (`parent`, absent at a root — `path` is titles, and a write takes the id) and — for a node that is MARKED — that mark, so a hit can be acted on without reading the file. A node with no `status` is a bullet rather than an unstarted task. THE MARKS `is:` SELECTS ON ARE `is:done`, `is:cancelled`, `is:doing` and `is:todo`, with `is:marked` for any of them — so `is:marked -is:done -is:cancelled` is \"work, unsettled\" and `is:cancelled` is what was called off. `is:blocked` reads the ordering graph rather than a mark, and a SETTLED target blocks nothing: anything after a `done` or a `cancelled` node is free to start. A hit also carries the edges the node itself writes, when it has any: `see` (free cross-references) and `after` (what it must come after), which are the ids `outlines_see` and `outlines_after` remove by. AND IT CARRIES `custom`, the whole map, uncut — so selecting by one property answers with the others beside it and \"every lane with `pr=…`\" or \"every node with `source=…`\" is THIS CALL, not this call and a `outlines_read` per hit. Absent for a node carrying no property. WHY a hit is there is TWO fields, because both can be true of one: `matched` says which field carried the WORDS, and is ABSENT for a query that named none (`is:done` on its own); `matchedProps` lists the custom keys a `prop:` clause selected the node on, in the node's OWN spelling (the query is case-folded, the map is not), and is ABSENT for a query that named no property. A NEGATED clause names nothing there — a node found by `-prop:agent` was not found ON `agent`, it carries no such key — so `matchedProps` is only ever keys the node really has, and reads straight into the `custom` map beside it.\n\nASK FOR THE NOTES WITH `withDesc: true` and every node hit carries `desc`, its note, WHOLE — so \"read every bug with what was written under it\" is THIS CALL, not this call and a `outlines_read` per hit. It is OFF by default and that is the only field of a record you have to ask for: a note is unbounded prose where a title, a mark and a property are not, so a query that will not read one does not pay for twelve of them. Absent for a node that has no note, asked for or not. It carries no document's prose either way — a `.md` is one text, and `markdown_read` is how it is read.\n\nSCOPE IT when you know where to look: `file` is one outline, `under` is a node and everything beneath it. That is the same narrowing a person gets by filtering a zoomed page, which is why it is here — the two faces answer one question.\n\nIT ALSO FINDS DOCUMENTS. A hit is a node or a `.md`, and every one of them carries `at`, its ADDRESS — `#a1b2c3` for a node, `notes/plan.md` for a document — which is both where it goes and what tells the two apart. A document is looked for in four places that line up with a node's one for one: its TITLE (its first line, heading marks off), its PATH (what a node's id is — `2026-08-12` finds the day's note whose prose never says the date), the `#tag`/`@mention` in its prose, and the PROSE ITSELF, which is the half of this directory a search could not see before. A document hit carries no `file:line`, no `status` and no ancestors, because a document has none. `prop:` DOES select documents: a `.md` writes named facts about itself in YAML frontmatter — the `---` block at the top of the file — and those are the same open namespace a node's `custom` is, so `prop:pr` and `prop:agent=claude-opus` answer with both kinds in one ranked list. A document hit carries `props` (its whole frontmatter map, absent when it has none) and `matchedProps` (the keys the clause selected it on) exactly as a node hit carries `custom` and `matchedProps`. Values are TEXT or a list of text; a key whose value is a nested map, a block scalar or an anchor is not read and so is not a property the document carries. An operator over a field a document still does not have (`is:done`, `has:date`, `date:`, `created:`, `changed:`) selects NO document — there is nowhere on a `.md` to write a mark, and a file carries neither stamp — and a NEGATED one is satisfied, since a document is indeed not done. A frontmatter `date:` or `done:` is a PROPERTY named that, found by `prop:date` / `prop:done`, and never a day or a mark. A SCOPED query (`file`, `under`) selects no documents either: both are questions about where a record sits in a tree. Ask `kind: \"node\"` or `kind: \"document\"` for one of the two alone. The name of this tool is older than the answer; it searches the whole directory.",
    // `@olai/format`'s, and so is what comes back — ONE declaration behind the
    // JSON Schema this tool advertises and the wire shape the palette's
    // `search.nodes` procedure carries, so the two faces cannot ask for
    // different things or be told different ones. The operator prose above and
    // the per-field prose in that schema are the same grammar described from
    // the two ends a caller reads it from.
    SearchRequest,
    SearchAnswer,
    (asking, args) => asking.search(args),
  ),
]
