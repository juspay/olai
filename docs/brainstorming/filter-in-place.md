# Filter in place, and the operator language

Status: design, written 2026-08-14 ahead of the third part of the `search` roadmap item. The first two parts shipped the substring UI (#149) and semantic recall (#165, open). This is the part that keeps the outline on screen and takes rows away from it.

Reference model is Workflowy, as read in [viewing-web.md](viewing-web.md): "results render as matching nodes *with their ancestors*, live as you type", "clicking a `#tag` filters the current view to items carrying it, ancestors kept for context, scoped to the current subtree", and a real operator language (`is:complete`, `has:note`, dates, `-not`, `OR`, `>`). That file's Open section says the direction is settled and the grammar is a design of its own. This is that design.

## What is being added

1. A **filter** over the tree on screen: a query keeps the nodes that match, plus every ancestor that leads to one, and drops everything else.
2. A **tag click** is a filter by that tag.
3. An **operator language** — `is:`, `has:`, `date:`, and `-` — composing with the substring terms that already exist.
4. Archived nodes are out of it unless asked for.

## The first decision: one matcher, and where it lives

The standing rule is HACKING.md's — *MCP and Web ops must be consistent; never deviate* — and [search.md](../search.md) already reads it one layer in: the browser holds every node and could grep them itself, and deliberately does not, because a client-side matcher would be a second implementation of what a query means. `Query.search` in `@olai/ops` is the one reading, and the palette, the header box and `search_nodes` are three doors to it.

A filter cannot be a fourth door to that procedure, and the reason is not taste:

- it runs on **every keystroke over a tree that is already in the browser** — a 200 ms debounce plus a round trip is the wrong shape for a view that is supposed to narrow as you type;
- it needs **every** match, not twelve — the cap `Query.search` exists to apply is exactly wrong here;
- and it needs the answer as a **set of ids to test rows against**, not a ranked list of situated hits.

So the matcher moves DOWN rather than being copied sideways. `@olai/format` is the package both the validator and the view already read the format through — `derive`, `rowsOf`, `zoom`, `withoutDone`, the date derivations — and "does this node match this query" is a derivation of exactly that kind. It becomes `format/src/filter.ts`:

- `parseFilter(text)` — the grammar below, into a value;
- `matching(derived, filter, scope)` — the nodes it selects, each with which field carried it and what the words scored;
- `keeping(rows, matched)` / `matchedIn(rows, matched)` — the row transform, ancestors kept, and how many rows of it are hits.

`@olai/ops`' `Query.search` then calls that as its GATE and keeps what is about showing a stranger a SHORTLIST: the penalty a finished node takes, the cap, the uncapped total, and carrying the refusal to whoever asked.

The per-node score is the format's, and that is the one line worth defending rather than asserting: which field carried a match and how much it is worth are one table (a title hit outranks a note hit *because* of the weights), and splitting them would mean handing the ops layer a per-word hit list to re-fold. Everything that is about a LIST rather than a node stayed up there.

What this buys, structurally rather than aspirationally: `is:done` means one thing to an agent calling `search_nodes`, to the ⌘K palette, to the header box and to the filter over the tree, because there is one function and four callers. The rejected alternative — a client-side filter predicate written against the same paragraph — is precisely the drift `search.md` was written to forbid.

**Cost, stated:** the ops layer's search is no longer self-contained; a reader asking "what matches?" is sent one package down. That is the same trip `rowsOf` and `withoutDone` already make, and the layering table already says `format` holds the derivations both the validator and the view read.

## The grammar

```
query   := token (WS token)*
token   := ["-"] (clause | term)
clause  := name ":" value        name ∈ { is, has, date }
term    := a word — case-folded substring over title, id, tag, note
```

Every token must hold. Terms are ANDed as they already are ("every word must appear somewhere in the same node"), and clauses join the same conjunction. A leading `-` negates whichever it is in front of.

### `is:` — the stored mark

`is:done`, `is:doing`, `is:todo`, `is:marked`, `is:archived`.

The mark is STORED and never derived (`not-every-node-a-task`, `todo-mark`), so this operator is a field test and nothing more: `is:done` is a node somebody ticked, not a node whose children happen all to be ticked. `is:marked` is any of the three, which is what makes `is:marked -is:done` sayable — "work, unfinished" — where `-is:done` alone also brings back every plain bullet in the file.

`is:archived` is the one that opens a door rather than narrowing one: see "Archived", below.

### `has:` — a field the node carries

`has:desc`, `has:date`, `has:see`, `has:after`, `has:doc`.

One table, one row per optional field a node record can carry that a reader might want to select on. Workflowy's `has:note` is `has:desc` in our vocabulary (the format calls a note `desc`; the UI calls it a note; the operator follows the format, as `is:done` does).

Not in the table: `has:children`, `has:mirror`, `has:tag`. The first two are questions about the SET rather than about the record — a node does not carry its children — and `titleParts` already makes a bare `#` term do the third badly enough that a fourth spelling would be a trap. Named as deferred rather than forgotten.

### `date:` — the two dates a journal reads

`date:2026-08-10` (that day), `date:2026-08` (that month), `date:2026` (that year), and ranges: `date:2026-08-01..2026-08-14`, `date:..2026-08-10` (on or before), `date:2026-08-10..` (on or after). Bounds are inclusive.

WHICH dates: the same two `datesOf` reads for the journal — the node's `date` (what it is scheduled for) and a dated `done` (when it was finished). A dated `doing` or `todo` is on no day here for the reason `dates.ts` argues at length: "this was filed on Tuesday" is a fact about a task's paperwork, and reading it as a day buries the day's real answer. A filter that disagreed with the day page and the calendar about what `2026-08-11` holds would be a third answer to a question that already has one.

Comparison is TEXT, as everywhere else in the format: dates are validated ISO and stored verbatim, so a day is a ten-character prefix, a month is seven, and a range is two string comparisons. Nothing is parsed into an instant — a date-only value put through one comes back a datetime, and this is not the place to be the first code in the tree that risks it.

Deferred, explicitly: **relative dates** (`date:today`, `date:7d`, Workflowy's `changed:`). `parseFilter` is pure and has no clock, and routes.ts already argues why a clock must not get into a thing that parses an address. Giving it one means threading `today` through the parse, and the value of that is worth its own decision.

### Negation

`-` in front of any token: `-is:done`, `-#home`, `-kitchen`. A node matches when the negated half does NOT. Cheap, and it is what makes the operator language worth typing at all — `#home -is:done` is the query somebody actually wants.

### What is not in the grammar, and why

- **Quoted phrases** (`"pick the hinges"`) — deferred. Every word already has to appear in the same node, which covers most of what quoting is for, and the tokenizer that supports quoting is a different tokenizer.
- **`OR`** — deferred. A grammar with one binding level is a grammar a reader can hold; adding disjunction without parentheses is a trap and adding parentheses is a parser.
- **`>` (nested ancestry)** — deferred, and `>` is already spoken for: the ⌘K palette reads a leading `>` as an ask rather than a lookup.
- **`is:blocked`** — deferred here, **landed since** ([search.md](../search.md)), and the deferral's stated cost is worth reading against what it actually was. It was: every clause is a test of the RECORD, so the predicate takes a located node and nothing else; a derived-fact operator is the first one that needs the whole set, and that is a signature change rather than a new row in a table. That is exactly what it cost — `matchOf` and `holds` take the `Derived` every caller of `matching` was already handing over, and the clause is one lookup in the index the views draw blockedness from. Nothing was paid in advance.

### Refusals reach every door

The filter parses for itself, so it draws its own. The other three ask the server — and a refusal generated at the bottom and dropped in the middle would make `is:open` an empty list with no reason in exactly the three places a person is least able to guess why. So the answer carries `refusals`: through `Query.search`, onto the wire, and into a row of its own in the ⌘K palette and under the header box. That row is separate from the "the call failed" row for the reason that one is separate from the palette's `>` ask: a refused CALL and a refused QUERY are two pieces of news.

### Refusals — a colon is not always an operator

Two rules, and the split is the whole of it:

- a token whose left side is one of the three operator NAMES and whose value is not understood — `is:open` (a mark this format stopped having), `date:soon`, `date:2026-13` — is a **refusal**. It is reported, the reader is shown what the operator takes, and the filter matches nothing. Never silently downgraded to a substring term: a query that quietly finds nothing is the silent-error the HACKING doctrine forbids;
- a token with a colon whose left side is anything else — `TODO:`, `note:x`, `http://example.com` — is an ordinary **substring term**. Colons occur in prose, and refusing them would break searching for the words people write.

A refusal quotes the token **as typed**. The words and the operator values are compared case-folded, so `IS:DONE` works — but `is:OPEN` refused as "you typed `is:open`" is the refusal misquoting the reader, which is the defect it exists to prevent, one turn in. So the fold is per token and for matching only.

An **impossible date** is refused on the same terms, and it needed saying because the shape regex alone accepts it: `date:2026-13` is well-formed and can never contain a validated day. It is also the worst kind to swallow, since it sorts between December and January and so reads as a window. The bound is 1–12 and 1–31 — what is impossible in ANY month. `date:2026-02-30` is accepted and matches nothing, and that is the deliberate line: telling it from `2026-01-30` needs a calendar, and the whole date stance here (the same one that makes a month's upper bound `-31`) is that a comparison over text answers without inventing one.

**One leading `-` negates; a second is a character.** `--is:done` is a term, and looks for that literal text. Refusing it would need a second refusal rule, and that rule would refuse `--force` — a word people genuinely write in notes. The behaviour is documented in [search.md](../search.md)'s negation row rather than legislated against.

## Where the filter lives: the address

The filter rides the URL as `?q=<text>` on the two tree pages, `/o/<file>` and `/n/<id>`. Three things follow, and each is the reason:

- a filtered view is a **link somebody can send** — which is the same argument `/n/<id>` is made of, and the reason there is no router library here;
- the **back button** works, because history is the browser's;
- and nothing else in this client has to own it. A signal beside the route would be a second answer to "what is on screen", free to disagree with the address after a `popstate`.

Typing in the box **replaces** the history entry rather than pushing one — a filter typed one character at a time would otherwise put fourteen entries between the reader and the page they came from. So Back leaves the filter, rather than un-typing it. A tag click also replaces the entry: it is the same act, performed with the mouse.

### A tag click REPLACES the query rather than composing with it

This is a real fork and the doc owed it an argument. Pressing `#home` while the box holds `cabinets` leaves `#home`, not `cabinets #home`.

The case for composing is good: the gesture reads as "and also narrow by this", the box is right there showing what you would be adding to, and it is what "narrow the view you are looking at" suggests.

Replace wins on two counts. **A click that ANDs can produce nothing, and the reason is off-screen behind the pill you just pressed** — the commonest outcome of composing two filters is zero rows, and the reader who pressed a tag was asking to see that tag, not to be told the intersection is empty. And **composing has no gesture for its own inverse**: with replace, a tag press and a typed query mean the same thing and either replaces the other, so the way back is to type or to press `×`. With compose, replacing means clearing first — a second gesture to reach the commoner intent.

The narrowing a composing click would give you is still available, and it is the one the operators are for: type `#home is:todo`. What the click is for is the cheap common case, and cheap means the whole query.

Recorded as reversible: it is one line in `App.tsx`'s `narrow`, and the e2e that pins it (`Pressing a #tag filters the page by it`) would be the thing to change.

`routes.ts` grows a `filter?: string` on those two arms only, and `routeOf` takes the address rather than the pathname, so the bijection its test holds covers the query string. The other five routes do not carry one: a document is prose, `/trash` is read-only, and `/agenda` / `/d/` / `/today` are date questions whose filter would be a second date question. Deferred, and it is a real gap — filtering a day page is a sensible thing to want.

## The filter and the two things it composes with

### Zoom

The filter is scoped to the rows the page draws: an outline's roots, or a zoomed node's children. That IS Workflowy's "downstream" scoping, and it falls out of the address rather than being implemented — the page decides its own rows, the filter prunes them.

**Zooming clears the filter**, because a zoom is a navigation and `router.go` builds the route for the page being asked for. Clicking a bullet means "show me that node", not "show me that node, still narrowed by what I typed on the last page". Back returns to the filtered address, which is where the filter is kept rather than lost.

### Done-hidden

`doneHidden` is a preference about the READER — "I do not want to look at finished work" — and the filter is a question about the PAGE. The preference goes first: `withoutDone` prunes, and the filter reads what is left.

The consequence is that `is:done` under a done-hiding preference draws nothing, and the answer to that is to SAY so rather than to special-case it: the bar reports `no matches — 4 done matches are hidden (Prefs)`. Two numbers, one sentence, and the reader learns the model instead of meeting a mystery. The alternative — letting an explicit `is:done` override the preference — makes the preference mean two things depending on what else is typed, and is exactly the kind of rule nobody remembers a year later.

### Folds

**While a filter is on, folds are suspended and the pruned tree draws expanded.** A fold is a claim about a tree the reader was reading; a filter produces a different tree, and honouring a collapse inside it would hide the match that the filter's entire purpose is to have found. Nothing is written: the fold memory is untouched, and clearing the filter restores every collapse exactly as it was.

It is ONE accessor (`fold/reading.ts`) rather than a condition where the tree draws, because four things read the folds and only one of them draws: the editor for where `↑`/`↓` go, the selection for what a shift-click spans, the drag for where a drop can land. A tree that suspended its folds while those three did not is a page whose arrow keys walk rows nobody can see.

## Archived

Archived nodes are OUT of every reading the matcher gates — the filter, the palette, the header box, `search_nodes` — unless the query says `is:archived`.

For the tree this is nearly automatic (an archive is its own file, and `/o/Archive.jsonl` opens the trash rather than an editable tree), but for `search_nodes` it is a change: search used to return archived nodes silently mixed in with live ones. That was never argued anywhere; it is the same defect `/` skipping the archives fixed for the front page. What was put away should stay put away until somebody asks, and now there is a way to ask.

## The MCP face

HACKING.md: MCP and Web ops must be consistent; never deviate. So the question to answer out loud is *can an agent express what the web's filter expresses?*

- **The query** — yes, and by construction: `search_nodes` and the filter call one `parseFilter` / `matchOf`. Every operator here works over MCP the day it works in the browser.
- **The ancestors** — yes. A hit already carries `path`, the canonical ancestor titles. "Keep the ancestors" is a rendering decision about a tree, and the tree is what a browser has; an agent has `read_subtree`.
- **The scope** — this is the gap, and it is closed rather than noted. `search_nodes` grows two optional arguments, `under` (a node id) and `file` (an outline path), which are the two scopes a tree page can BE. Without them an agent could ask the query but not the question — "what under `install` is unfinished" had no spelling.

`under` and `file` join the surface's `search.nodes` request too, so the two doors keep the one schema even though the browser's filter does not need them (it prunes rows it already holds).

## Composing with semantic recall (#165)

Position, stated ahead of the merge: **a filter constrains the candidate set; recall ranks within it.**

Concretely, once recall's merge lands in `Query.search`, the clause half of a query is a GATE on both kinds of hit. A paraphrase neighbour that is archived, or that is `done` under an `-is:done` query, is not a hit — it is not "a semantic result that happens to disagree with the filter". Anything else makes `is:done` mean one thing for an exact match and another for a paraphrase one, which is the drift the shared matcher exists to prevent.

The one real difference is which HALF each kind of hit satisfies. An exact hit satisfies the terms by substring; a paraphrase hit is what stands IN for the terms — meaning is the term-matching, so a recall hit need not contain the words. The clauses (`is:`, `has:`, `date:`, and their negations) apply to both, unchanged. In one line: **recall replaces the terms; it never relaxes the clauses.**

## What is drawn

A bar above the tree on the two tree pages: the input, a count, a clear `×`, and — when the query holds one — the refusal line. The count is the honest version: how many rows matched, of how many the page draws, and how many matches the done-preference is holding back.

It is NOT the header's search box. Those are two different questions — "take me to a node anywhere in the directory" and "narrow what is in front of me" — and one box answering both would have to guess which was meant. The header box gains the operators anyway, because it is a caller of the same reading.

A `#tag` in a title becomes a real affordance: a pill that says it is pressable, and pressing it sets this page's filter to that tag. The pill is drawn into HTML by `markdown/tags.ts` and reaches the page through `innerHTML`, so the press is answered by ONE delegated listener on the main pane — the same placement, and for the same reason, as the listener that answers a link inside rendered markdown (`router.tsx`'s `followed`). The row's own title click must therefore decline a click that landed on a pill, or one press would both filter the page and open an editor on the row.

**Only where the press has somewhere to go.** Titles are drawn on pages that cannot carry a filter — a day, the agenda, a document — and the pill there is the same markup, because `markdown/tags.ts` is handed a string and knows nothing about the route. So the PANE says whether a tag in it is live (`data-narrowable`), the stylesheet draws the cursor and the hover from that, and the listener declines on the same condition: one fact, read by the thing that promises and by the thing that answers, rather than a pill that looks pressable and a press that is swallowed.

## Deferred, named

- Relative and changed-since dates (`date:today`, `changed:7d`).
- Quoted phrases, `OR`, and the `>` ancestry operator.
- ~~`is:blocked`~~ — **landed**, and the entry is struck rather than removed so the list still says what this design deferred (the cost it named, and what it turned out to be, is above).
- Filtering the day, agenda and trash pages.
- Starred / saved searches and named shortcuts (viewing-web.md's own Open list).
- A keyboard chord that focuses the filter box.
