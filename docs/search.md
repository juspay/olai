# Search

One query language, four doors. An agent asks `search_nodes` over MCP; a person
types into the **search box in the header**, or into the `⌘K` palette — and on a
phone, where the bar has no room for a box, taps the magnifier, which opens that
same palette. The fourth is different in kind and the same in meaning: the
**filter over the page**, which takes rows away from the outline in front of you
instead of listing hits somewhere else.

The first three are callers of one function over one snapshot (`@olai/ops`'
`Query.search`). All four are gated by one matcher, `@olai/format`'s
`parseFilter` / `matching` — so what an agent finds and what a person finds
cannot drift, and `is:done` means one thing everywhere. The browser holds every
node and could grep them itself; it deliberately does not.

One matcher was never quite the whole of it, because the question and the answer
were SPELLED twice — once as the wire spec a browser compiles against
(`@olai/surface`), once as the reader the ops layer answers with — and neither
package may import the other. They are now one declaration on the floor both
stand on (`@olai/format`'s `searching.ts`), so a field added to a hit reaches
every door or none. It used to reach the agent's and be dropped on the way to
the person's, silently.

## What matches

**Words** are case-folded substrings over four fields — title, id, inline tags,
note — with every word of the query somewhere in the same node. A tag is indexed
twice, bare and as written, so `alice` finds `@alice` and `@alice` finds only the
one with that sigil.

**Operators** narrow by what a node IS, and compose with the words around them:

| written | selects |
|---|---|
| `is:done` `is:doing` `is:todo` | the mark the node STORES — never a derived one, so a parent whose children are all ticked is not `is:done` unless somebody ticked it |
| `is:marked` | any of the three; `is:marked -is:done` is "work, unfinished" |
| `is:archived` | what was put away — see below |
| `has:desc` `has:see` `has:after` `has:doc` | a field the record carries (an empty edge list is no edge) |
| `has:date` | on any day at all — the unbounded `date:`, so the two cannot disagree |
| `date:2026-08-10` `date:2026-08` `date:2026` | a day, a month, a year |
| `date:a..b` `date:..b` `date:a..` | an inclusive span, either end optional |
| `-anything` | takes that word or operator back out — ONE leading dash. A second one is a character, not a second negation: `--force` is a word people write, so `--is:done` looks for that text and finds it wherever somebody typed it |

`date:` reads the two dates a journal reads — what the node is scheduled for,
and when it was finished. A dated `doing` or `todo` is on no day here, exactly
as on the day page ([format.md](format.md)).

**A known operator with an unknown value is refused**, in the grammar's own
words, and the query selects nothing: `is:blocked` says which values `is:` takes
rather than quietly searching for that text and finding none. A colon after
anything else (`TODO:`, `http://…`) is an ordinary word — colons occur in prose.

A date that no calendar could hold is refused on the same terms:
`date:2026-13`, `date:2026-08-32`. Month 13 is the reader's mistake exactly as
`date:soon` is, and the worse of the two to swallow — it *sorts* between
December and January, so an empty answer reads as a window rather than as
nonsense. The line is what is impossible in **any** month: `date:2026-02-30` is
accepted and finds nothing, because telling that from `2026-01-30` needs a
calendar, and nothing here parses a date into one.

**A refusal quotes what you typed**, case and all: the words are matched folded,
so `IS:DONE` works, but a refusal for `is:BLOCKED` says `is:BLOCKED`.

The refusal reaches **every door**. The filter parses for itself and draws its
own; the other three ask the server, so the answer carries `refusals` and the
palette and the header box draw them beside their rows. A door that answered
`is:blocked` with an empty list and no reason would be the one place a typo
looks exactly like an empty directory.

**Archived nodes are out of every reading unless the query says `is:archived`.**
What was put away should stay put away until somebody asks, and now there is a
way to ask.

Title hits outrank id, tag and note; a field that starts with the word beats
one that buries it; a done node loses ties. Hits carry `file:line`, the
ancestor titles, the mark if the node has one, and the node's own `see` /
`after` edges — plus `matched`, which field carried the words, absent for a
query that named none. Mirrors are never hits — a placement is a second view of
a node, not a node.

`search_nodes` also takes a SCOPE: `file` is one outline, `under` is a node and
everything beneath it. Those are the two scopes a page can be, so an agent can
ask exactly the question a person asks by filtering one.

## Filtering the page in place

On an outline (`/o/<file>`) and on a zoomed node (`/n/<id>`) there is a filter
box above the tree. It is not the header's search box, and the difference is the
question: the header takes you TO a node anywhere in the directory, this narrows
what is already in front of you.

- **Matches keep their ancestors.** A matching row is drawn with the chain that
  leads to it and with its own subtree; everything else goes. The context is
  what makes a bare title like "order" mean something.
- **Clicking a `#tag` or `@mention` filters by it**, ancestors kept, scoped to
  the page you are on.
- **The filter is in the address** — `?q=…` — so a narrowed page is a link you
  can send and the back button works. Typing REPLACES the history entry rather
  than pushing one, so Back leaves the filter rather than un-typing it. Zooming
  is a navigation and starts unfiltered; Back returns to the narrowed page.
- **Folds are suspended while a filter is on.** A collapse is a claim about the
  tree you were reading, and honouring it inside a filtered one would hide the
  match you typed for. Nothing is written: clearing the filter brings every
  collapse back.
- **Hiding finished work happens first.** The Prefs switch is a standing claim
  about the reader; the filter is a question about the page. So `is:done` under
  a done-hiding preference draws nothing — and the bar says how many matches are
  being held back, rather than leaving it a mystery.
- The bar reports **"3 of 41"**: how many drawn rows are matches, of how many
  rows the page draws.

The design, and the alternatives that lost, is
[brainstorming/filter-in-place.md](brainstorming/filter-in-place.md).

## What a result row looks like

Two lines. The title first, on its own full-width line, cut with an ellipsis
if it is long. Underneath, smaller and quieter, where the node lives —
written **nearest ancestor first**, because a line that has to be shortened
loses its end, and the nearest ancestor is the crumb that answers "which
`pick the hinges`?". A node at the top level of its file names the file
instead.

They are two lines rather than one because a place is somebody's prose. Side
by side, the title and the place fight over one row's width: the title loses,
wraps to a word per line, and the row ends up five lines tall — and when even
that is not enough, the panel scrolls sideways, which a popover must never do.

## Where searching happens on each face

- **Header box** — desktop and up. It sits first in the right-hand cluster and
  is the one control there that may shrink to nothing, so the connection and
  commit pills never lose a character to it. Type, arrow up and down, Enter to
  open, Escape to clear.
- **Phone** — a magnifier in the same place, opening the `⌘K` palette, which is
  a full-width modal built for exactly this. The bar at 390pt has no room for
  a box and a phone has no chord to press.
- **`⌘K` palette** — the shell's commands, node results underneath them, and
  the two things it WRITES: the zoomed node's own verbs, and quick capture on a
  `+` prefix ([editing.md](editing.md)). Neither is a search — a query carrying
  `>` or `+` is a line being typed rather than a lookup, and nothing is asked
  of the server for it.
- **`search_nodes`** — the same answer for an agent, over MCP.

## Not yet: finding a note you cannot name

Searching by MEANING — "the first page load is too heavy" finding a note that
never uses those words — is parked rather than shipped. The implementation
that was written for it needed a model server (Ollama) running on the reader's
machine, and olai requires no dependency outside Nix itself (HACKING.md). It
returns when it can be nix-native.
