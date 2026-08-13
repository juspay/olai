# Associations: things that belong to things

Status: brainstorming, 2026-08-13. Reframed at the human's direction from a
chat-only idea ("chat-subjects"): a chat pinned to a node turned out to be one
case of a general want.

## The general want

olai has three kinds of things: **nodes**, **`.md` notes**, and **chats**.
Again and again we want to say "this is *about* that" — as a fact the app can
act on (draw an icon, follow it, list by it), not as prose:

- **chat ↔ node** — the original itch: start a chat *from* a node, find the
  chat *by* the node.
- **node ↔ note** — a note's home node; a node's document.
- **chat ↔ note** — a chat about `journal/2026-08-12.md`.

One mechanism, if we can get it, beats three ad-hoc ones.

## What makes a good association

- It is keyed by a **stable handle**. Node ids are the gold standard — they
  survive retitles and moves (fold memory keys by them for this reason). File
  paths are the weak handle everywhere: rename the file and every association
  through the path is orphaned.
- It has **one home**, not a copy in each direction that can disagree.

## Where an association can live — three shapes

1. **In the other system's own name** (the chat-subjects trick): a session
   named `olai/<node-id>`. The association is stored in the agent's session
   store — zero new olai state, nothing to go stale. Only works where the
   other side *has* durable names; chats do.
2. **In the outline, as an edge**: like `see`/`after`, a node-level edge
   pointing at a document. The outline is already olai's database — edges are
   visible, git-versioned, and survive exactly as long as the node does.
3. **In a side store**: a mapping olai keeps somewhere. The weakest shape — a
   second copy of truth — reach for it only if the first two cannot express
   the case.

## The elegant collapse

If **node ↔ note** is an outline edge (shape 2), and **chat ↔ node** is a
session name (shape 1), then **chat ↔ note** needs no mechanism at all: a
chat about a note is the chat of its home node. Every association question
reduces to the two primitives.

## The cases

### chat ↔ node (the original "chat-subjects")

The human's proposal: name the session `olai/<node-id>` (claude's `-n` named
conversations). The node's `•••` "Ask agent" **resumes** that session if it
exists, **starts it named** if not — one standing conversation per node. The
outline draws a small chat icon on any node whose named session exists
(derived by scanning session names for the `olai/` prefix). The chats list
gets legible names for free.

Composes with #141: opening a subject chat fresh can arm the composer with
the node, so the first message carries the subject as real context — the name
for finding, the context for the agent.

### node ↔ note

Wanted regardless of chats. The edge shape (2) fits: the app can draw it both
ways — the node shows its document, the document's page shows its home node —
and agenda, search, and chat-subjects all get to use it. To settle: the edge's
name; what a file rename does; whether two nodes may claim one note.

### chat ↔ note

Via the collapse: give the note a home node, chat about that. (The
alternative — naming sessions `olai/md/<path>` — imports the path-rename
problem into chat naming; avoid unless the collapse proves too indirect.)

## Open questions for ratification

1. Is the outline edge the right home for node ↔ note, and what is its word?
   (`see` already exists and is free-form; this one is directed and typed.)
2. One conversation per node forever, or does a subject need history?
   (`olai/<id>/2` is possible but smells like a database in a name.)
3. Gone targets: an archived node behind a named session; a renamed file
   behind an edge. Decided behavior, not discovered — probably ops' own
   not-found words.
4. Adoption after the fact: pinning an *existing* chat to a node needs a
   rename verb on sessions; pointing an existing note at a home node is just
   writing the edge.
5. Does the icon belong on the row, or is the association only visible in the
   chats list and the node's menu?
