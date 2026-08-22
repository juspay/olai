# One search box

*Ruled by the human, 2026-08-21 (roadmap `one-search-box`). This is the design
behind the four rulings, not a second opinion about them.*

The complaint was concrete. `#next` was tagged on five nodes in three outlines
and **nothing in this app would list them together**. The filter box, `?q=` and
clicking a tag all narrow ONE page; the two doors that could see the whole
directory — the header's search box and the ⌘K palette's node hits — were
shortlists for jumping TO a node: capped at eight, no address, not pinnable, and
gone the moment the box lost the caret. Two entry points, two scopes, two answer
shapes, one grammar.

So there is one box now — **the page's filter box** — and it widens.

## The gesture

Typing narrows the page in front of you, exactly as before. What is new is one
line under the count:

```
3 of 41 · 12 more elsewhere — search everywhere
```

That line is the door. It says the truth the bar was missing — the query you
typed matches things you cannot see — and pressing it widens the SAME query to
`/search?q=…`. **The query text is never retyped.**

**Widening PUSHES, where typing replaces.** The two look alike and are not: a
keystroke narrows the page you are standing on, so Back should leave the filter
rather than un-type it a letter at a time — but widening goes to a DIFFERENT
PAGE, and Back is the inverse of going somewhere. Replaced, Back from `/search`
skipped the narrowed page it was opened from, which is the one place a reader
would expect to land.

**Enter widens too**, and that is the shortcut. The filter box is the one search
box in this app with no list under it, so `Enter` there was free; it now means
*and now everywhere*. A hand that typed a query, read "12 more elsewhere"
and pressed Enter is on the everywhere page with the words still in the box.
Escape still empties the box and gives the page the caret back.

On `/search` itself Enter does nothing: there is nowhere wider to go.

## What the bar says at each scope

| scope | the bar |
|---|---|
| a page, matches elsewhere | `3 of 41` · `12 more elsewhere — search everywhere` |
| a page, nothing elsewhere | `3 of 41` — and no second line at all |
| a page, nothing answered yet | `filtering…` — the widen line waits with it |
| a page, the count could not be taken | `3 of 41` · `could not count the rest — search everywhere` |
| `/search`, matches | `12 matches in 3 files` |
| `/search`, matches and documents | `12 matches in 3 files · 2 documents` |
| `/search`, nothing | `no matches` |
| `/search`, more than the page draws | `200 of 1340 matches in 37 files — narrow the query` |

The nothing-elsewhere silence is this app's own rule about a zero, kept rather
than excepted (`filter/count.ts`: *a part that is zero is a part the reader does
not need*). It costs nothing: the page in front of you IS the whole answer, and
Enter still widens onto a `/search` page that says so.

`no matches of 41` keeps its denominator on a page and drops it on `/search`,
because the two sentences are about different things: a page holds 41 rows and
your query emptied it; the directory holds no answer at all.

### Where the "12 more" comes from

**The COMPLEMENT: every match this page does not draw.** Not "in other files",
not "in the directory" — and the word matters, because the first version of
this shipped as a subtraction and both reviewers of #334 constructed pages where
it was wrong:

- **The trash.** Its rows are ARCHIVED nodes; a directory-wide search leaves
  those out unless the query says `is:trashed`. The two sets are disjoint, so
  `|directory| − |page|` took live matches away for archived ones — ten archived
  and three live read as `max(0, 3 − 10) = 0`, and the bar went silent while
  `/search` would have shown the three.
- **A zoom.** Matches in the SAME file outside the subtree are not on the page
  and are not in another file either.
- **A day, and the agenda.** Their rows come from several files already, so a
  match in one of those files can still be one the page is not showing.

A browser cannot fix any of that: it holds the page's ids and a total, and never
the intersection. So the question is asked where both sets are — `search.elsewhere`
(`@olai/format`'s `elsewhere.ts`), which reads the page, asks the corpus the same
question under **the page's own archive rule**, and counts what the page does not
put on screen. That last phrase is exact: a zoom's own node is its heading rather
than a row, and it counts as shown.

**It is a CALL and not a subscription, and that is the one trade this design
makes deliberately.** The page's narrowing rides the revision pulse
([filter-rides-the-page.md](filter-rides-the-page.md)) because it is bounded by
the page; this number is bounded by the corpus, so a stream would put a
whole-vault match behind every published revision of every narrowed page — which
is precisely the nine-walks-per-bulk-gesture defect that design removed. So it
is asked once per settled keystroke, behind the same 200ms settle, and it does
not move again until the words do. A hint that is a few seconds old is honest;
a regression that walks the vault nine times for a bulk edit is not.

**And a count that could not be taken says so.** A refused call used to draw the
same nothing as "not yet" and "nothing more", which hid the door and read like a
page that was the whole answer — the silent failure HACKING.md's error rule is
about. The line reads `· could not count the rest — search everywhere` and is
still pressable: not knowing how much is elsewhere is no reason not to go and
look.

## `/search?q=…` is a real page

A computed page beside `/today`, `/agenda` and `/trash` (`routes.ts`'s `NAMED`
table) — it spells no file, it is an address, it has a back button, and it is
**pinnable like any `?q=` page**. `/search?q=%23next` on the shelf is a saved
cross-vault search, and it is a pin rather than a fourth kind of thing, exactly
as `/agenda?q=is%3Atodo` already was.

It is a `PageRequest` arm and a `Shown` arm — the server answers it like every
other page, on the same stream, re-read on the same revision pulse. Which means
`is:trashed`, the [one-page rule](../search.md#the-one-page-rule) and the
grammar's refusals all apply here because they apply everywhere, not because
this page reimplemented them.

**The words ride on the request**, which is the one thing `PageRequest`
deliberately does not carry for any other page (a `?q=` re-opening the page
stream per keystroke would re-send every row of a page it is already drawing).
Here it is not a narrowing of a page — it IS the page: there is no `/search`
without a query, and re-sending its rows when the words change is re-sending the
answer. The debounce moves with it: `/search`'s request carries the words *once
a pair of hands has stopped moving*, which is the same settle the filter already
had, lifted into a primitive both now use (`filter/typed.ts`).

### The row shape

Rows are **grouped by the outline they live in**, in path order, and inside each
group they are the file's own tree pruned to the matches — **ancestry kept**,
subtrees kept, exactly what `keeping` does on any filtered page. So a match
reads in the context that makes a bare title like `order` mean something, and
the crumb is real structure rather than a line of prose glued under a hit.

**Every row says why it is drawn**, out of the same `filter/why.ts` every other
surface uses: a matched row lights its needles, a kept ancestor wears the
context dim, and a row selected on a `prop:` clause puts that key first in the
reading ink. The answer that DREW the rows carries which of them matched (below),
so there is no second highlighter and no second reading here.

**A node is drawn once, where it lives.** A mirror of a match in some other file
is not a row here — the node itself is already on the page — which is the same
sentence `search_nodes` has always made about its own hits.

Enter or a click on a row goes to that node's page (`/#<id>`) — the thing the
shortlist could never be: a row you can come back to, link to, and read in
place.

**Documents are hits here** ([search.md](../search.md)'s *…and documents*),
under the node groups, drawn with the sidebar's own glyph and their path — and
they are still NOT rows on a page filter, which stays true because a filter
selects nodes and the one page made of prose is the one page with no box.

### It is uncapped, and where it is not, it says so

No silent cap — and TWO bounds, because one of them is not one. `EVERYWHERE_LIMIT`
(200) is matched NODES; `EVERYWHERE_ROWS` (2,000) is the rows those matches
bring with them, since a match keeps its whole subtree and a single hit on a
file's root would otherwise put that file's every node on the wire. Both are
applied file by file in the set's own path order, so what is dropped is the tail
of the directory rather than a sample of each file.

They are applied differently, and the difference is the one thing about the caps
that is easy to get wrong. The MATCH bound **cuts** a file: a first outline
holding five hundred hits draws two hundred of them, because skipping it outright
would be a page with nothing on it and exempting it would be no bound at all
(the first version did exempt it, and both reviewers of #334 read that as
accidental). The ROW bound is the one with a carve-out, and only for the FIRST
group: a match keeps its subtree, so a hit on a big file's root would draw
nothing under a hard cap, and one big answer beats none.

Neither is silent: `matches` is the uncapped number and `drawn` is what the
groups hold, so whichever bound bit, the bar reads
`200 of 1340 matches in 37 files — narrow the query`. Documents are uncapped:
the list is bounded by the number of served files, which the sidebar already
draws in full.

Two hundred is a number, not a principle. It is there because a query matching
ninety thousand nodes would otherwise put ninety thousand rows on one wire
frame, and "page it" is a second navigation vocabulary for an answer whose real
fix is another word in the query.

### And the reading it does NOT ask twice

The page's `matched` list — which of its rows the query selected, and why —
**rides on the reading that drew them**. Every other page asks a second reading
for that (`filter/asking.ts`), because a page and its narrowing move on
different clocks: the page on the directory, the narrowing on the directory AND
a pair of hands. Here they are one clock, because the page IS the query — so a
narrowing beside it would be `everywhereOf` run a second time, per revision, to
re-derive a match that pass already had in hand. The browser opens no narrowing
stream for `/search` at all and lights its rows out of the answer that drew
them.

Two more things fall out of the same observation. A file that holds no match is
never walked, because `matching` says which file every match is in — where a
naive pass materialises a row per node of the whole directory to throw nearly
all of it away. And **a mirror of a match is not a row here**: the node itself
is already on the page in the file it lives in, so a placement of it elsewhere
would be the same node twice — which is the very reason `matching` answers with
no mirrors either.

## ⌘K keeps its commands and hands the query off

The palette keeps everything it is good at — the shell commands, the zoomed
node's verbs, the pin row, `>` ask and `+` capture. What goes is its **node-hit
half**: the eight rows it drew from the server per keystroke.

Type a word that is not a command and the last row is the handoff:

- on a page that takes a filter — `Search this page for “rails”`, which closes
  the palette, puts the words in that pane's `?q=` and **focuses the one box**,
  with the widen line under it;
- on a page that takes none (a document) — `Search everywhere for “rails”`,
  which goes straight to `/search?q=rails`.

So ⌘K is still a way to search; it is a way to the one box rather than a second
box. Nothing is asked of the server for it — the row is minted from what is
typed, and the ONE search request happens once the query is in the address.

**The chat composer's `@` list keeps its bounded shortlist**, and the panels
under a row keep theirs (the edge panel's `see`/`after`, the move-to picker).
Those are not search doors: each of them **names one node into something** — a
message, an edge, a destination — and the question there is whether what you are
spelling is in the list, not how much of the directory answers to it
([search.md](../search.md) already draws that line and it is unchanged).

## On a phone

The magnifier stays where it is, and it is now what its glyph always promised:
it **focuses the one box** on the page you are looking at. On a page with no box
— a document — it opens `/search`, which always has one. A phone has no chord
and the bar has no room for an input; one 44px target that lands the caret in
the page's own search box is the whole door.

## What dies

- `search/HeaderSearch.tsx` — the desktop box in the bar and its portalled
  panel. The bar keeps the magnifier and nothing else.
- `search/count.ts` / `search/Count.tsx` — *"8 of 90 matches"*, the line a
  shortlist drew about what it could not show. Both its doors are gone; a page
  that draws its answer needs no apology for the part it left out.
- `palette/items.ts`'s `hitItems` / `hitItem`, and the palette's `createSearch`,
  its search-failure line and its search refusals.
- `search/nodes.ts`'s `total` — the uncapped count only the deleted line read.

**`search/Shortlist.tsx` STAYS**, and that is a deliberate reading of ruling 4
rather than an omission — see the PR's Assumptions. It is not the palette's
shortlist; it is the box the edge panel and the move-to picker are made of, and
both are pickers of exactly the kind the same ruling protects one sentence
later.

## What did not change

One matcher, one grammar, one clock. `@olai/format`'s `parseFilter` and
`matching` answer the page, the everywhere page, the pickers, the composer and
an agent's `search_nodes`; the relative words count from the server's day at
every door. The refusal line is still the browser's own parse, drawn with the
keystroke rather than after a round trip. The in-place narrowing still rides the
page's revision pulse. What this work moved is where a reader can STAND, not
what a query means.
