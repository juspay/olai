# Search

One search, three doors. An agent asks `search_nodes` over MCP; a person types
into the **search box in the header**, or into the `⌘K` palette — and on a
phone, where the bar has no room for a box, taps the magnifier, which opens
that same palette. Every one of them is a caller of the same function over the
same snapshot (`@olai/ops`' `Query.searchWith`), so what an agent finds and what a
person finds cannot drift: the browser holds every node and could grep them
itself, and deliberately does not.

## What matches

Two readings, and the first one is the whole of it unless a note has to be
found by what it MEANS (below).

Case-folded substring over four fields — title, id, inline tags, note — with
every word of the query somewhere in the same node, and no operators. A tag is
indexed twice, bare and as written, so `alice` finds `@alice` and `@alice` finds
only the one with that sigil.
Title hits outrank id, tag and note; a field that starts with the word beats
one that buries it; a done node loses ties. Hits carry `file:line`, the
ancestor titles, the mark if the node has one, and the node's own `see` /
`after` edges. Mirrors are never hits — a placement is a second view of a
node, not a node.

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

## Finding a note you cannot name

Searching by MEANING — "the first page load is too heavy" finding a note that
never uses those words — happens too, and it is **behind** the substring hits
rather than mixed into them.

Substring hits are **evidence**: the words are in the node, and you can check.
A semantic hit is **resemblance**: the index reads the node as saying the same
thing, and it is sometimes wrong. So the exact matches come first, always, and
paraphrase matches only fill what is left of the answer — a query whose exact
matches already fill it never asks the index at all. A hit that arrived by
meaning wears **`≈`** in front of its place line, because that difference is
the reader's to have rather than to guess at.

It runs on what olai ships and nothing else. The embedder is a `llama-server`
from `pkgs.llama-cpp` and the model is `bge-small-en-v1.5` (33 M parameters,
37 MB), both in the binary's own nix closure; the server is olai's child,
started the first time something needs embedding, spoken to over a unix socket,
and stopped when olai stops. Nothing is installed, nothing is downloaded when
you run it, and nothing on the network is asked. That is the condition this
feature came back on — an earlier version needed an Ollama running on your
machine, which olai's rule forbids (HACKING.md).

The index itself is a **derived reading**: your files stay the only truth. It
lives in `$XDG_CACHE_HOME/olai/recall/`, never in the directory being served,
it is rebuilt from the outlines whenever it is missing, and a node whose title
and note have not changed is never embedded twice. Delete it freely.

Turning it off is `OLAI_RECALL=off` ([running.md](running.md)), and off means
what absent means: the substring reading, unchanged, with nothing anywhere
reporting a missing feature.

Two things it does not do yet. A long note is embedded by its **first 512
tokens**, so a paragraph buried deep in one is findable by the note's opening
rather than by itself. And the similarity floor under which a neighbour is
noise is tuned against one corpus. Both are recorded, with the measurements,
in [brainstorming/semantic-recall.md](brainstorming/semantic-recall.md).
