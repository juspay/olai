# Search

One search, three doors. An agent asks `search_nodes` over MCP; a person types
into the **search box in the header**, or into the `⌘K` palette — and on a
phone, where the bar has no room for a box, taps the magnifier, which opens
that same palette. Every one of them is a caller of the same function over the
same snapshot (`@olai/ops`' `Query.search`), so what an agent finds and what a
person finds cannot drift: the browser holds every node and could grep them
itself, and deliberately does not.

One matcher was never quite the whole of it, because the question and the
answer are SPELLED twice — once as the wire spec a browser compiles against
(`@olai/surface`), once as the reader the ops layer answers with — and neither
package may import the other. What a hit says is now checked identical at the
one place both spellings are in scope (`@olai/server`'s `search.ts`), so a
field added to a hit reaches both doors or neither. It used to reach the
agent's and be dropped on the way to the person's, silently.

## What matches

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

## Not yet: finding a note you cannot name

Searching by MEANING — "the first page load is too heavy" finding a note that
never uses those words — is parked rather than shipped. The implementation
that was written for it needed a model server (Ollama) running on the reader's
machine, and olai requires no dependency outside Nix itself (HACKING.md). It
returns when it can be nix-native.
