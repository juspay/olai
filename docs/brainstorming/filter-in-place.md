# Filter in place, and the operator language

Status: design, written 2026-08-14 ahead of the third part of the `search` roadmap item. The first two parts shipped the substring UI (#149) and semantic recall (#165, open). This is the part that keeps the outline on screen and takes rows away from it.

> **One half of this design has since been REVERSED, knowingly** (the human's ruling, 2026-08-19; roadmap `search-server-side`, the first step of [vault-in-browser.md](vault-in-browser.md)). "The filter cannot be a door to that procedure, because a round trip per keystroke is the wrong shape for a view that narrows as you type" was true while the browser held the whole vault. It no longer may: a tab keeps at most the page in front of somebody, so the filter and the chat composer's `@` list ARE round trips now, behind a debounce and a rule that a stale answer never lands over a newer query. What the reversal did NOT touch is the reason the matcher moved down: it stayed in `@olai/format`, one definition for every door — and the second and third bullets below turned out to be the shape of the new wire member rather than an argument against one (`Query.matches` answers every match, uncapped, as ids to test rows against). Everything else here — the grammar, the archive rule, the prunes, what a filtered row says about itself — stands as written.

> **And the reversal itself was revised once more** (roadmap `filter-ask-carries-revision`, [filter-rides-the-page.md](filter-rides-the-page.md)). The round trip stands; what was wrong was that it was a CALL. A filter is a standing view of a page, so a procedure had to be re-asked once per published revision, and every ask walked the whole vault for an answer whose every reader was a membership test against a row the page already draws. It is a subscription over the PAGE now, on the revision pulse — which is what the bullet below about "the whole membership" always described, with the corpus swapped for the page.

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

> **Read the three bullets against the banner above.** The first is the one that was reversed: the tree is not in the browser any more, so the round trip is what a filter costs, with the debounce as its price (`@olai/web`'s `filter/asking.ts`). The other two were never objections — they are the SHAPE of the member the reversal added: it answers every match, uncapped and unranked, as ids to test rows against. And one thing the bullets do not say, which the move made load-bearing: a filter is a STANDING view of a page. That was first paid for by carrying the set's own generation on the question and re-asking per revision, and it is the member's own shape now — a stream keyed on the page and the words, re-read on the pulse and silent when nothing it selects has moved.

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
query   := group (WS group)*
group   := token (WS "OR" WS token)*
token   := ["-"] (clause | term | phrase)
clause  := name ":" value        name ∈ { is, has, date }
term    := a word — case-folded substring over title, id, tag, note
phrase  := '"' text '"' — the same substring, spaces and all
```

Every group must hold, and a group holds when ANY of its tokens does. Terms are ANDed as they already were — "every word must appear somewhere in the same node" is now every GROUP, since `OR` is what joins two tokens into one — and clauses join the same conjunction. A leading `-` negates whichever it is in front of.

The `group` line and the `phrase` line are `search-quoting-or`'s, and they are the whole of what it added: `OR` binds TIGHTER than the space, so the conjunction on the first line is the one that was always there and a token nobody joined is a group of one. The argument for that way round, and for the quoting rules, is under "What is not in the grammar" below, where both were deferred.

### `is:` — the stored mark

`is:done`, `is:doing`, `is:todo`, `is:marked`, `is:archived`.

The mark is STORED and never derived (`not-every-node-a-task`, `todo-mark`), so this operator is a field test and nothing more: `is:done` is a node somebody ticked, not a node whose children happen all to be ticked. `is:marked` is any of the three, which is what makes `is:marked -is:done` sayable — "work, unfinished" — where `-is:done` alone also brings back every plain bullet in the file.

`is:archived` is the one that opens a door rather than narrowing one: see "Archived", below.

### `has:` — a field the node carries

`has:desc`, `has:date`, `has:see`, `has:after`, `has:doc`.

One table, one row per optional field a node record can carry that a reader might want to select on. Workflowy's `has:note` is `has:desc` in our vocabulary (the format calls a note `desc`; the UI calls it a note; the operator follows the format, as `is:done` does).

Not in the table: `has:children`, `has:mirror`, `has:tag`. The first two are questions about the SET rather than about the record — a node does not carry its children — and `titleParts` already makes a bare `#` term do the third badly enough that a fourth spelling would be a trap. Named as deferred rather than forgotten.

**The mirror one is answered since** (`search-stamp-operators`), and not as a `has:` row: the "set rather than record" line stopped being the whole reason the day `is:blocked` shipped, since that is a set question too and it is in the grammar because the derivation already holds the answer. What was actually wrong was the DIRECTION. A placement is never a hit, so "does this record carry a `mirror`" has no subject worth asking about; "is this NODE drawn somewhere else" does, it is what a curated list does to a node, and it is one lookup in `Derived.mirrorsOf` — the same index `read_node` answers `mirrors` from. So it is `is:mirrored`, beside the other derived value rather than in the field table. `has:children` and `has:tag` stand as deferred.

### `date:` — the two dates a journal reads

`date:2026-08-10` (that day), `date:2026-08` (that month), `date:2026` (that year), and ranges: `date:2026-08-01..2026-08-14`, `date:..2026-08-10` (on or before), `date:2026-08-10..` (on or after). Bounds are inclusive.

WHICH dates: the same two `datesOf` reads for the journal — the node's `date` (what it is scheduled for) and a dated `done` (when it was finished). A dated `doing` or `todo` is on no day here for the reason `dates.ts` argues at length: "this was filed on Tuesday" is a fact about a task's paperwork, and reading it as a day buries the day's real answer. A filter that disagreed with the day page and the calendar about what `2026-08-11` holds would be a third answer to a question that already has one.

Comparison is TEXT, as everywhere else in the format: dates are validated ISO and stored verbatim, so a day is a ten-character prefix, a month is seven, and a range is two string comparisons. Nothing is parsed into an instant — a date-only value put through one comes back a datetime, and this is not the place to be the first code in the tree that risks it.

Deferred, explicitly: **relative dates** (`date:today`, `date:7d`, Workflowy's `changed:`). `parseFilter` is pure and has no clock, and routes.ts already argues why a clock must not get into a thing that parses an address. Giving it one means threading `today` through the parse, and the value of that is worth its own decision.

**Landed** (`search-relative-dates`), and the deferral's price was exactly what it said: `parseFilter` takes the day as an argument. It never reads a clock — the day is a fact about WHO IS ASKING, so each door hands over the one it already has (the tab's `clock.ts` for the filter it parses itself; the ops layer's `Context.now`, the clock a `done` is stamped with, for the three that ask the server), and the resolution stays a pure function of a word and a day that a test can pin. `date:7d` and `changed:` are still deferred: the first is a second spelling of a span the words already say, and the second is a question about history that nothing in the format answers.

**Two clocks, and they are allowed to disagree.** A tab across a time-zone boundary from the server has its own local day, so for a few hours `date:today` in the filter over the page and `date:today` in the header box name different days. The alternative was considered and declined: putting the asker's day on `SearchRequest` makes the day a thing the wire has to be trusted about, grows a field an agent has to fill in to get today, and makes the server's answer depend on whichever browser asked last. Each door counting from its own reader's clock is the rule the format already keeps — `stampOf` writes a local instant with its offset because a mark belongs to the day the person marking it is having — and the gap is one day at most, in the one operator that reads a clock at all. Recorded rather than papered over, in search.md's own words.

The vocabulary is TWELVE words and it is a spelling of a `date:` VALUE rather than a second operator — `today` / `yesterday` / `tomorrow`, and `this-` / `last-` / `next-` in front of `week`, `month` and `year`. Three shapes fell out of that decision rather than being designed: a relative word composes with a range wherever a written date does (`date:last-week..`), because both are read into the same span before they are two string comparisons; a month and a year resolve to exactly what `date:2026-08` and `date:2026` resolve to, `-31` upper bound and all, so there is one answer rather than two; and a word the vocabulary does not hold is REFUSED, taught the way the words are built rather than as a list of twelve, because it is a known operator with an unknown value like every other one. The day words are three rather than a `this-day` family because English already has them; the week is in the list precisely because the written grammar cannot spell one at all.

A WEEK RUNS MONDAY TO SUNDAY, read off the same `weekdayOf` the calendar grid lays its columns out with. That function moved down to `@olai/format` (`calendar.ts`) to make it possible: it was the browser's, and its own header called it the one place in the codebase that does date arithmetic, which is precisely the claim a second copy underneath the grammar would have broken. The grid, the headings and the month names stayed up in the client, where drawing a month belongs.

### Negation

`-` in front of any token: `-is:done`, `-#home`, `-kitchen`. A node matches when the negated half does NOT. Cheap, and it is what makes the operator language worth typing at all — `#home -is:done` is the query somebody actually wants.

### What is not in the grammar, and why

- **Quoted phrases** (`"pick the hinges"`) — deferred here, **landed since** (`search-quoting-or`), and the stated cost was exactly right: the tokenizer that supports quoting IS a different tokenizer, and it is the only thing that changed. One `split(/\s+/)` became a scan that a quote can tell not to end a token, and the substring scan — already looking for a case-folded substring — was not touched at all: a phrase is a term whose word holds a space. What the deferral did not see is the second thing quoting buys, which turned out to be the reason to ship it with `OR` rather than after it. A grammar that claims spellings needs a way to ask for the TEXT of one, and there was none: `"is:done"` finds the note in which somebody wrote that down, and `"OR"` is the word in capitals for a note that shouts it. The rule is a quote at the FRONT of the token, and that is all the front decides: a quote opens a region wherever it sits and the region must be closed, which is how `prop:stage="in review"` writes a value that has a space — and why `36"` is refused rather than read as an inch mark, one term this costs and names.
- **`OR`** — deferred here on the trap, **landed since** with the trap avoided rather than accepted. The deferral was right that parentheses are a parser and that one binding level is what a reader can hold. What it missed is that there are two ways to add disjunction without them, and only ONE of them is the trap: `OR` binding LOOSER than the implicit AND is the reading where `#home kitchen OR bathroom` quietly widens to every bathroom in the directory, arriving with no `#home` about it. Binding TIGHTER — `OR` joins the tokens on either side of it, the groups are ANDed exactly as adjacent tokens always were — is the reading somebody typing that line means, and it leaves the grammar with the same one conjunction it had, over groups instead of tokens. A token nobody joined is a group of one, which is why nothing else in the parse or the matcher moved. Negation stayed a TOKEN's, and that plus a second binding level turns out to be exactly enough for both of De Morgan's readings without a parenthesis anywhere: `-a -b` is "neither" (`NOT (a OR b)`, two groups that must both hold) and `-a OR -b` is "not both" (`NOT (a AND b)`, one group either half satisfies). A group-level `-` would have been a second spelling of one of the two.
- **Three refusals came with them**, and they are one contract: `"pick the` is not closed at the end of the line on the reader's behalf (that would be picking one of two different queries), `kitchen OR` is a joiner missing one of its two sides, and `""` is refused for `prop:stage=`'s reason from the other end — an empty needle is inside every node ever written, so the query that silently finds none has a twin that loudly finds all.
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

**Landed** (`search-everywhere`), and the two reasons given here did not survive being written down. A day and the agenda ARE date questions, and a filter over one is not a second one: it is "which of the things on this day", a narrowing of the answer rather than another way to ask for it — and the operators people actually type there (`is:blocked`, `#home`, a word) have nothing to do with dates. `/trash` being read-only is a fact about its VERBS, of which it has one; looking through a pile is not editing it. So the rule inverted, and `narrowable` is now the one exclusion rather than a list of two: **a document is the only page this grammar has nothing to say about**, because it selects nodes and a document is prose.

What it cost, against what the deferral implied. `routes.ts` was one line (`route.kind !== "document"`) plus a `filter?` on four more arms. The reading (`filter/narrowing.ts`) took one switch instead of a second implementation, over a new value in the page model — `Drawn`, what the open page has PUT ON THE SCREEN, which is a different question from `Page` (what the address turned out to name) and the one a filter actually asks. Four shapes, because there are four: a tree, a day's groups, an agenda's three sections, an archive's trees. The format grew two prunes beside `keeping` (`keepingDated`, `keepingOwed`) and one count (`datedIn`, which `owedOf` then stopped spelling for itself).

Three decisions were the whole of the design work, and each is where a per-page rule would have crept in:

- **The archive.** `matching` excludes archived nodes unless the query says `is:archived`, and on the trash that rule would have taken away every row on the page — the matcher overruling a page about what the page is showing. So `Scope` grew `archived`, and the filter is the one door that passes it. THREE pages need it, which is exactly the three this format already puts an archived node on: the trash (it is the archive), a day (`dates.ts` decided that archived work stays on the day it happened) and the agenda (`agenda.ts` reads those same dates forward, so work put away after it was scheduled is still owed). It was passed unconditionally for a day, on the argument that the page has already decided and a page showing none pays nothing for the flag — which was half wrong, and the review caught it: `true` puts the whole archive in front of the matcher, so every keystroke on an ORDINARY OUTLINE was scanning the one file in a directory that only ever grows. It is read off the page's own headings and roots now: no drift with what is on screen, a zoom onto an archived node answering for itself, and the cost paid only by the pages that draw one. What it does not buy is a cheaper scan for those pages — the candidate set is the whole set there, which is what already lets a mirror of a node in another file stay drawn where it is placed. **Amended the next day** (`archived-only-in-trash`, ruled 2026-08-17): THREE pages became one. The human ruled that what is archived is drawn on the trash and nowhere else, so `dates.ts` took the archive out of the walk a day, the calendar and the agenda are all read from — and the exception this bullet designed collapsed with them. What is left is the trash, plus a tree that is a zoom onto an archived node, which is where an `is:archived` hit lands; the reading off the page's own rows survives unchanged and is now doing less work.
- **A day's note.** It goes while a filter is on. A note is a document, which is exactly the page kind that takes no filter, so it can never be a match; drawing it beside no rows would be answering a question nobody asked.
- **Which sentence a page says when it is empty.** "Nothing is on this day", "Nothing is due.", "The Trash is empty." are claims about the day, the agenda and the archive; "no matches" is a claim about the query. The pages keep the first and the bar keeps the second, which is the division `OutlinePage`'s "write its first line" already had.

And one thing that did NOT move: what is owed. The mark beside Agenda in the column counts the unnarrowed reading, because a filter is a question about the open page and late work is a fact about the directory.

## The filter and the two things it composes with

### Zoom

The filter is scoped to the rows the page draws: an outline's roots, or a zoomed node's children. That IS Workflowy's "downstream" scoping, and it falls out of the address rather than being implemented — the page decides its own rows, the filter prunes them. (Which is also why the filter reached the other three pages for a switch rather than a rewrite: the page has always decided, and every page here is a query already.)

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

(Since `search-everywhere`: above every page that draws nodes, and the condition it is drawn on is what the page DRAWS rather than which route is open — `Drawn`'s `none` arm is a page a query has nothing to narrow, which is a document, a file that would not parse, or an address that named nothing. So the box appears exactly where it can do something.)

It is NOT the header's search box. Those are two different questions — "take me to a node anywhere in the directory" and "narrow what is in front of me" — and one box answering both would have to guess which was meant. The header box gains the operators anyway, because it is a caller of the same reading.

A `#tag` in a title becomes a real affordance: a pill that says it is pressable, and pressing it sets this page's filter to that tag. The pill is drawn into HTML by `markdown/tags.ts` and reaches the page through `innerHTML`, so the press is answered by ONE delegated listener on the main pane — the same placement, and for the same reason, as the listener that answers a link inside rendered markdown (`router.tsx`'s `followed`). The row's own title click must therefore decline a click that landed on a pill, or one press would both filter the page and open an editor on the row.

**Only where the press has somewhere to go.** Titles are drawn on pages that cannot carry a filter — a day, the agenda, a document — and the pill there is the same markup, because `markdown/tags.ts` is handed a string and knows nothing about the route. So the PANE says whether a tag in it is live (`data-narrowable`), the stylesheet draws the cursor and the hover from that, and the listener declines on the same condition: one fact, read by the thing that promises and by the thing that answers, rather than a pill that looks pressable and a press that is swallowed.

(Since `search-everywhere` the list of such pages is down to the document, which draws no pills at all — `markdown/tags.ts` styles TITLES, and a document is a body. The machinery stays, because the condition is still a real one and is still read in two places; what changed is that a tag in a title is now live wherever a title is drawn. A tag inside an ancestry crumb is the one that still does not filter, and for the reason it never did: the crumb is a link, the tag walk skips anchors, and one press is one act.)

## Every row says why it is drawn (2026-08-18)

Ruled with the human from one screenshot: a `#deferral` tag-click over this repository's own roadmap. Every number and every row was **correct**, and the page was still confusing — because a filtered page never said why any given row was in front of the reader. Three cases, all present in that one screenshot:

1. **A match did not show its needle.** `ir-deferral-tag`'s title merely *talks about* the tag ("a deferral node wears #deferral") and matched exactly like a row that wears it as a label. The format cannot tell use from mention — a `#word` in a title IS a tag, deliberately — so the UI's job is not to distinguish them but to make the reason visible: show WHERE the query landed, and the reader resolves the ambiguity themselves.
2. **A kept ancestor looked like a match.** `instructions-reconcile` carried the tag nowhere; it was drawn only as the chain leading to a match. Nothing marked it as context rather than result — the distinction already existed in the model (membership in the `matched` set vs merely surviving `keeping`'s prune, which `matchedIn` counts) and the row simply never drew it.
3. **A note-only match showed no reason at all.** A row whose hit is behind the ¶ drew a title containing nothing the query said.

The fix is three things, all view-time — nothing is stored, nothing is re-matched:

- **The words are lit where they sit.** `needlesOf` hands a parsed query's positive words to the view and `litBy` says where each lands in a text; both are in `@olai/format`'s `filter.ts`, beside the fold they use, which is the whole point — an offset found under some other case rule would light up a stretch of title the matcher never looked at. The two title paths that are already held byte-for-byte to each other (`markdown/plain.ts`'s fast path and the HAST walk) take the needles through one split (`filter/lit.ts`), so a tag pill lights inside itself rather than instead of itself, and `plain.test.ts` sweeps both readings.
- **A row that did not match is dim** — the same utility a row that cannot be started yet already wears (`blocked.ts`'s `WAITING_DIM`), deliberately the same value rather than a second number, since a row can be both at once. On the LINE and the body, never on the `<li>`: opacity compounds through a subtree, and an item would dim the very match the context leads to.
- **A note-only match draws one clamped line** of its note, opening at the hit's own line, with the word lit (`note/excerpt.ts`, beside `note/preview.ts` — one concept, two selectors). It replaces the density preference's top-of-note preview on that row rather than sitting beside it.

**Auto-expanding a matched note lost, and it was the obvious alternative.** Notes here run to ~1.5KB paragraphs; the filter re-evaluates as somebody types, so a page of open notes would reflow violently under them; and it would trample the reader's own open/closed state, which would then need saving and restoring to put back. A clamped window is the same idea with a bounded cost.

**What it cost the format:** `matching`'s answer was already `Matched` (the node and WHY); it was the browser that reduced it to a `Set` of ids. It now keeps the map, and the prunes take the one question they ever asked of it (`Selected`, "does this hold that id") rather than a concrete `Set` — so nothing has to hold two structures that could disagree by a frame.

**What review found (grok, opencode, 2026-08-18), and where it landed.** Both do-not-object; three things changed. A needle covering only PART of a multi-unit fold character mapped to an empty source span — `İ` folds to `i` plus a combining dot, so a query of `i` was a real hit that drew a highlight of nothing beside a letter the reader can see; a run now rounds out to whole source characters, and an empty run is unrepresentable rather than elided downstream. The query is looked for ONCE per title rather than once per part, which is one fold instead of several and is also what lets a phrase light across a tag boundary (`"remodel #home"` was inside neither piece it crossed). Two shapes named there later landed: a needle living only inside a title's `code` span or link now lights (#254), and a phrase spanning two pieces of rendered markdown lights both (`filter-highlight-cross-piece`).

~~**Out of scope, filed separately if wanted:** the count line's mixed denominators ("8 of 57 — 17 more matches hidden as done" reads as 8+17≠57; the 57 is page rows, the 17 is matches).~~ — **landed**, and the section below is what it turned out to be.

## The count line says three truths, in one set (2026-08-18)

The deferral above, taken. The line was never wrong about any single number and was still not honest, because the numbers were counted in two different universes: the denominator was the rows the page had LEFT after the done preference took finished work off it, and the held-back matches were held back precisely because they were not among those rows. A reader who added them up got a total larger than the whole.

So the denominator is now what the page **holds** — every place it could draw, before any preference of this reader's takes something off the screen — and everything else is counted inside it. Three truths, and each said only where it applies:

1. how many rows MATCHED and are drawn;
2. of how many the page HOLDS;
3. how many matched rows are NOT drawn, and WHY — done-hiding being the one hider there is.

**A part that is zero is not said.** A page with nothing held back says nothing about holding anything back; a page with nothing found still says the denominator, because "no matches of 57" and a directory with nothing in it are two different pieces of news and used to read identically.

**"More" is dropped when nothing is drawn.** `is:done` typed by somebody who hides finished work is the page this line exists for, and "no matches of 57 — 3 more matches hidden" contradicts itself in eight words.

**The counts come off the same three readings the page is drawn from** (`filter/narrowing.ts`: what the page holds, what the preference left, what the query left of that) — never a recount over the set, which is free to disagree with the very prune it is counting. The one number that moved is the denominator, from `visible()` to `all()`, and it is one line with the argument beside it.

**The wording is a function** (`filter/count.ts`), taking three numbers and returning the sentence, because a sentence assembled in a JSX binding is a sentence no test can ask about. The plural, the dropped word and the unsaid zeroes are `count.test.ts`; that the three numbers are the page's own is `narrowing.test.ts`; that a reader looking at a real page sees it is `filter_in_place.feature`.

**Still silent, and named rather than fixed:** the ⌘K palette and the header's box draw at most eight hits and say nothing about a ninth. That is the same defect one door over — `SearchAnswer.total` has ridden the wire uncounted since the matcher was split out, so "8 of 90" is sayable today — but it is a different surface, a different denominator (the directory, not a page), and a different hider (a cap, not a preference), so it is deferred rather than smuggled in here.

## Deferred, named

- ~~Changed-since dates (`changed:7d`)~~ — **landed** (`search-stamp-operators`), struck rather than removed so the list still says what this design deferred. The reasoning here was right about HISTORY and wrong about the format: a question about history is still a different one and is still `git log`'s, but the format grew two STAMPS in the meantime — `created` when the ops layer captures a node, `changed` when it writes to one — and those are facts on the RECORD, so asking about them is a clause like any other. What it cost was nothing new: `created:` and `changed:` share `date:`'s whole value grammar, read by one `spanOf` before anything knows which operator asked, so the spelling is `changed:last-week` rather than the `7d` sketched here. The honest half is that a node written before the stamps existed carries neither, and no span reaches it — the operators do not invent a past, which is exactly the limit "nothing in the format answers it" was pointing at.
- ~~Quoted phrases~~ and ~~`OR`~~ — **landed** (`search-quoting-or`), struck rather than removed so the list still says what this design deferred; what each cost is above. The `>` ancestry operator is still deferred, and `>` is still spoken for by the palette.
- ~~`is:blocked`~~ — **landed**, and the entry is struck rather than removed so the list still says what this design deferred (the cost it named, and what it turned out to be, is above).
- ~~Filtering the day, agenda and trash pages.~~ — **landed** (`search-everywhere`), struck rather than removed so the list still says what this design deferred; what it cost, and which of the two reasons for deferring it were wrong, is under "Where the filter lives: the address" above.
- Starred / saved searches and named shortcuts (viewing-web.md's own Open list).
- A keyboard chord that focuses the filter box.
- The count line on the two doors that ASK THE SERVER (the ⌘K palette, the header's box): eight hits drawn out of however many matched, with nothing said about the rest. `SearchAnswer.total` is already on the wire and drawn nowhere.
