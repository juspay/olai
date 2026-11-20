import type { Claims } from "./kinds.ts"
import { fileKind } from "./kinds.ts"
import { Schema } from "effect"

import { AtDocument, AtOutline, AtNode, NodeId } from "./address.ts"
import { Face } from "./document.ts"
import { DOCUMENT_FIELDS, DURATION_TEACHING, Refusal, SEARCH_FIELDS } from "./filter.ts"
import { RegularNode } from "./node.ts"
import { Found } from "./reading.ts"

export const NodeHit = Schema.Struct({
  at: AtNode,
  ...Found.fields,
  matched: Schema.optionalKey(Schema.Literals(SEARCH_FIELDS)),
  matchedProps: Schema.optionalKey(Schema.Array(Schema.String)),
  pathIds: Schema.Array(Schema.String),
  desc: RegularNode.fields.desc,
})
export type NodeHit = typeof NodeHit.Type

export const DocumentHit = Schema.Struct({
  at: AtDocument,
  line: Schema.optionalKey(Schema.Int),
  title: Schema.String,
  matched: Schema.optionalKey(Schema.Literals(DOCUMENT_FIELDS)),
  props: Schema.optionalKey(Face.fields.props),
  matchedProps: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type DocumentHit = typeof DocumentHit.Type

export const OutlineHit = Schema.Struct({
  at: AtOutline,
  title: Schema.String,
  matched: Schema.optionalKey(Schema.Literals(["title", "path"])),
})
export type OutlineHit = typeof OutlineHit.Type
export const isOutlineHit = (claims: Claims, hit: SearchHit): hit is OutlineHit =>
  hit.at.kind === "document" && claims.byKind.get(fileKind(claims, hit.at.path) ?? "")?.holds === "nodes"

export const SearchHit = Schema.Union([NodeHit, DocumentHit, OutlineHit])
export type SearchHit = typeof SearchHit.Type

export const isNodeHit = (hit: SearchHit): hit is NodeHit => hit.at.kind === "node"

export const SearchAnswer = Schema.Struct({
  hits: Schema.Array(SearchHit),
  total: Schema.Int,
  totals: Schema.optionalKey(Schema.Struct({ node: Schema.Int, file: Schema.Int })),
  refusals: Schema.optionalKey(Schema.Array(Refusal)),
})
export type SearchAnswer = typeof SearchAnswer.Type

export const DEFAULT_SEARCH_LIMIT = 12

export const SearchRequest = Schema.Struct({
  text: Schema.String.annotate({
    description:
      "What to look for. Case-folded substring WORDS — every word must appear somewhere in the same node, unless `OR` joins it to an alternative (below), where either one will do — composed with OPERATORS:\n" +
      "- `is:done` / `is:doing` / `is:todo` — the mark the node stores (never a derived one). `is:marked` is any of the three; `is:trashed` reaches what was put away.\n" +
      "- `is:mirrored` — the node is DRAWN SOMEWHERE ELSE as well: some placement shows it (chains followed), which is what `outlines_read` answers as `mirrors` and what putting a node on a curated list does to it. Asked of the NODE, never of the placement — a search never returns a placement. A copy filed in an `_olai/Trash.olai` still counts, since it is still where the node is drawn on the trash page.\n" +
      "- `is:blocked` — the node is WAITING: something it must come after is a task that is not finished. Derived, and the same derivation the app draws a blocked row with, so it reads the ORDERING GRAPH rather than the field — an edge spelled `blocks` on the other record counts, and a node can be blocked while carrying no `after` of its own (`has:after` is the question about the field). A node with no mark is not blocked (a bullet is not work), a target with no mark blocks nothing, and put-away work is out of it at both ends. `-is:blocked` takes the waiting ones back out.\n" +
      "- `has:desc` / `has:date` / `has:created` / `has:changed` / `has:see` / `has:after` / `has:repeat` — a field the record carries. `has:repeat` is what COMES BACK: a repeat rule needs a date to repeat from, so it selects inside `has:date`, and `has:date -has:repeat` is everything dated once. `has:created -has:changed` is a node nothing has been written to since it was captured.\n" +
      "- `date:2026-08-10`, `date:2026-08`, `date:2026`, `date:2026-08-01..2026-08-14`, `date:..2026-08-10`, `date:2026-08-10..` — the two dates a journal reads: what the node is scheduled for, and when it was finished.\n" +
      "- `date:today`, `date:yesterday`, `date:tomorrow`, and `this-` / `last-` / `next-` with `week`, `month` or `year` (`date:last-week`) — the same operator, counted from the day the query is asked on, in the server's own time zone. A week runs MONDAY to Sunday. They go at either end of a range like any other value: `date:last-week..`, `date:..today`, `date:last-month..yesterday`.\n" +
      `- \`changed:1h\`, \`created:30m\`, \`changed:2d\`, \`created:1w\` — ${DURATION_TEACHING}, counted from the moment the query is asked. \`1mo\` and \`1y\` are REFUSED (month and year recency is already \`last-month..\` or \`2026\`), and values are case-folded, so \`1M\` is one minute. A bare duration is WITHIN THE LAST N — \`created:1h\` is \`created:1h..\`. At a range's END it is the moment itself: \`created:..1h\` is older than an hour, \`changed:2h..30m\` is a window (older bound first), and the ends mix with everything else (\`created:yesterday..3h\`). There are no comparison operators and no \`ago()\`; inequalities are spelled as ranges.\n` +
      "- A duration is ROLLING where a day word is CALENDAR, and both are worth having: `created:1d` is the last twenty-four hours, `created:today` is since midnight; `changed:1w` is the last seven days, `changed:this-week` starts on Monday. Durations reach the stamps exactly, since those carry seconds. Under `date:` they compare against whatever precision the node wrote: a bare `date:` day sorts before every moment on that day, so `date:1h` effectively selects work FINISHED inside the hour rather than the day's plans.\n" +
      "- `created:…` / `changed:…` — the STAMPS, and they take every value `date:` takes above, absolute, relative or a duration, with or without a range. `created` is when olai captured the node; `changed` is when olai last wrote to it. Neither is the same question as `date:`: one node can be scheduled for the 10th, captured on the 1st and last written today. Use them to find recent work (`changed:today`, `changed:1h`), what arrived in a stretch (`created:last-week`), or what has gone untouched (`-changed:last-month`, `-changed:1d`).\n" +
      "- ABSENCE IS NOT A PAST. The stamps arrived after the format did, so a node written before them carries NEITHER, and nothing invents one: such a node is found by NO `created:` span however wide (`created:2000..` does not reach it), and IS found by the negation `-created:2000..` — the same reading that makes `-has:date` answer with the undated. If you need to know when an unstamped node was really written, that is `git log`, not this.\n" +
      "- `prop:pr` / `prop:agent=claude-opus` — a CUSTOM property the node carries, by key or by key and value. Reads the `custom` map only: a field is not a property, so `prop:done` and `prop:date=…` match nothing. A list value matches on any member.\n" +
      "- `prop:records=190..200` / `prop:dispatched=2026-08-20..` — a SPAN, on a key the vault DECLARES `int` or `date` in `_olai/Properties.olai`. The values are `date:`'s own, whole: days, months, years, the relative words, durations, and any of them at either end of a range. An `int` compares as a NUMBER, which is what declaring it bought — `prop:records=9..200` does not answer `1000` the way a string comparison would. A range on any other key is REFUSED, naming what the key is: comparing text as if it were a date is the lie types exist to prevent. Equality on a `ref` is unchanged, and a ref's value is the variant's ID (`prop:merge=auto`), never its title.\n" +
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
  withDesc: Schema.optionalKey(
    Schema.Boolean.annotate({
      description:
        "Carry each node hit's `desc` — its note, whole — so a selection arrives WITH its notes in one call. Off by default: a note is unbounded prose, and a query that will not read one should not pay for it. Documents are unaffected; a `.md`'s prose is `markdown_read`.",
    }),
  ),
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
  kind: Schema.optionalKey(
    Schema.Literals(["node", "document", "outline", "file"]).annotate({
      description:
        "Only records (`node`), non-outline files (`document`), outlines (`outline`), or all files (`file`). All kinds when omitted.",
    }),
  ),
})
export type SearchRequest = typeof SearchRequest.Type

export const MatchedNode = Schema.Struct({
  id: NodeId,
  matched: Schema.optionalKey(Schema.Literals(SEARCH_FIELDS)),
})
export type MatchedNode = typeof MatchedNode.Type
