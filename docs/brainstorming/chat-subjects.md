# Chat subjects: a chat that belongs to a thing

Status: brainstorming, opened 2026-08-13 by the human. Nothing here is ratified yet.

## The itch

The chats list is a flat pile of titles ("cheap", "actualism", …). A chat is
often *about* one thing — an olai node, or a `.md` note — and the app doesn't
know it. We want: start a chat *from* the thing, and later find the chat *by*
the thing.

## The proposal on the table (the human's)

**The session name carries the subject.** Claude supports named conversations
(the `-n` option). Name the session `olai/<node-id>` and the association needs
no new storage at all:

- The node's `•••` menu ("Ask agent") asks: does a session named
  `olai/<node-id>` exist? **Resume it.** Doesn't exist? **Start it**, named.
  One standing conversation per node, picked up where it left off.
- The outline shows a small **chat icon on any node whose named session
  exists** — derived by scanning session names for the `olai/` prefix. Press
  it, the panel opens on that conversation.
- The chats list gets this for free: the name itself says what the chat is
  about.

Why this shape is attractive:

- **No second copy of the truth.** The agent's own session store (already how
  transcripts persist — see `acp.md`: sessions are Claude's, resumable from a
  terminal too) holds the association. Nothing in olai can go stale.
- **Node ids are the right handle.** They are unique across the set and
  survive retitles and moves — the same reason fold memory keys by id.
- It composes with what just shipped: #141's armed context stays per-message;
  the subject is per-conversation. A subject chat can still arm any node for a
  specific question.

## The wrinkle: where does this leave `.md` files?

Notes deserve the same treatment — a chat pinned to `journal/2026-08-12.md`.
Two ways to go:

1. **Name them too**: `olai/md/<path>` beside `olai/<node-id>`. Simple, but a
   file path is a worse handle than a node id — rename the file and the chat
   is orphaned. (Nodes don't have this problem; that's what ids are for.)
2. **Route through a node.** Which surfaces the second want below: if a `.md`
   file can be *associated with a node*, then "chat about this file" is just
   "chat about its node", and there is exactly one pinning mechanism in the
   whole design. The file-rename problem then lives where it already lives —
   in the node↔file association — instead of leaking into chat naming.

## The second want: associating nodes with `.md` files

Named independently by the human: we want node ↔ `.md` association anyway,
chats or no chats. Shapes to weigh:

- **A wikilink in the node's note** — zero new schema; already half-true of
  how notes reference documents today; but it's prose, not a fact the app can
  act on.
- **A first-class edge** — like `see`/`after`, but node → document. The app
  can then draw it both ways (the node shows its document; the document's page
  shows its home node), and chat-subjects, agenda, search all get to use it.
- Whatever the shape, it should answer: what happens on file rename, and can
  two nodes claim one file?

## Open questions for ratification

1. **One conversation per node, forever?** The named-session scheme gives one
   standing chat per node. Is that the want, or do subjects need history
   ("the three chats we've had about this node")? A suffix (`olai/<id>/2`)
   is possible but starts to smell like a database in a name.
2. **Gone nodes.** A named session outlives its node (archived, deleted). The
   icon has nowhere to hang; the chats list still shows `olai/<id>`. Probably
   fine — show it plainly, refuse in ops' own not-found words if pressed —
   but it should be decided, not discovered.
3. **`.md` files: name-them-too (1) or route-through-a-node (2)?** Option 2
   is one mechanism instead of two, at the cost of requiring the node↔file
   association first.
4. **Does the subject *start* the chat's context?** Opening `olai/<node-id>`
   fresh could arm the composer with that node (via #141's existing arming) so
   the first message already carries the subject as real context — the name
   for finding, the context for the agent. Cheap and probably right.
5. **Unnamed chats stay subject-less** — the existing pile keeps working
   unchanged. Any need to adopt an old chat into a subject later ("this chat
   was really about X")? That would need a rename verb on sessions.
