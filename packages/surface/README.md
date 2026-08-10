# @olai/surface — the typed reactive layer, declared once

The spec both ends speak. The server implements it and the browser subscribes
to it, and neither writes a line of wire code: no raw sockets, no hand-rolled
routes, no message envelopes. Because the two sides read the same declaration,
they are a type error away from disagreeing about the protocol rather than a
runtime surprise.

Built on kolu's surface framework (`@kolu/surface`, hydrated from the Nix store
rather than installed — which is why it is absent from this manifest and
declared once at the workspace root; see `bunfig.toml`).

## The members, and the shapes are the argument

Which kind each member is was a decision. Two are the outline:

- **`outlines` is a stream, not a cell.** The files belong to the disk, not to
  the server, so the server reports what it read rather than owning a value it
  could be asked to change. Every subscription opens with a full snapshot, so a
  reconnect is a fresh read and nothing has to be resumed — and a probe that
  found a change sends the next frame down that same subscription, which is the
  whole of how the page stays live.
- **`errors` is a cell**, read-only on the wire, because "what is wrong right
  now" is one value the server does own. It is deliberately independent of the
  snapshot, and that independence is load-bearing: a set that stops validating
  leaves the last good tree on screen underneath a banner, which is only
  expressible if the two arrive separately.

`OutlineFrame` is nullable on purpose. A reader must tell three states apart —
no answer yet (no frame), nothing has ever validated (`null`), here is your
outline (a snapshot) — and a nullable frame says all three with no second
encoding.

The two error channels are not a duplication: `set.broken` says WHICH outline
is unreadable, because that is a property of the set the sidebar and the pane
are drawn from, and the cell says what is wrong with the set AS A WHOLE, which
no single file owns. A file listed in `broken` is being rendered around;
anything in the cell is being held back.

Three more are the chat, declared next door in `src/chat.ts` because they are a
subject of their own:

- **`transcript` is a collection**, served with the batched `deltas` verb. That
  verb IS snapshot-then-deltas: a subscriber gets every entry that already
  exists in one frame and then one coalesced frame per tick. So a tab opened
  halfway through a turn, a tab reloaded after a crash and a tab that has been
  listening since the first token all see the same conversation, with no replay
  protocol and no client-side merge. Keying it is what makes a TOOL FRAME
  updatable: the agent reports a call, then reports it again with a status, and
  the second report is an upsert on the same key rather than a second row.

  The framework audit asked for "events paired with a collection", because an
  event replays nothing to a late joiner. A `deltas` collection is that pair in
  one member — the push and the history are the same frames down the same
  subscription — so publishing each entry to an event as well would be one fact
  delivered twice and a dedup rule in the browser.
- **`chat` is a cell**: which session this is, what it is called, which model is
  running, what slash commands the agent offers, whether a turn is in flight.
  One value the server owns, read-only on the wire.
- **the procedures are the verbs**: send, cancel, new, load, and the list the
  picker draws. Each declares its failure channel, so "a turn is already
  running" arrives as a `busy` a caller can branch on rather than as an opaque
  transport error.

Nothing in the transcript is an optimistic echo — what a person typed appears
because the server put it there, exactly like everything else, so two tabs
always agree and a send that failed never leaves a message on screen that was
never sent. The agent's WRITES are not members at all: they reach the ops layer
through the internal MCP server, and what a reader sees of them is the outline
stream moving.

Who is on the other end is deliberately NOT a member here. It is a real
question — a page bound to a server that has been replaced must know, and both
ends of the stale-tab handshake compare that id — but the framework reserves
`system/identity` for it and answers it out of every surface, process id
included. A member of our own would be a second answer to a question already
answered.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, which exports the
`surface` definition and the `OutlineFrame` schema. That is the whole package —
a declaration, with no implementation on either side of it.

## Layering

Depends on `@olai/format` and nothing else in the workspace: the only olai
types on the wire are the format's own, travelling verbatim. `server` and `web`
both depend on this. [docs/architecture.md](../../docs/architecture.md) has the
reasoning.

## Running

```sh
just test                    # the whole workspace's unit tests
```

`src/surface.test.ts` is two tests, and it earns more than it looks. It asserts
that `errors` serves no `set` verb — the browser may not write it — and that
the assembled RPC group contains the framework's own members alongside ours,
which only holds if the `@kolu/surface` sources hydrated from the Nix store
resolved `effect` out of the root `node_modules`. A second copy of effect, a
missing root dependency or a stale kolu pin all land here rather than in the
browser.
