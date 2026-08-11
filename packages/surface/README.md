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

Which kind each member is was a decision. Three are the outline:

- **`outlines` is a collection keyed by root-relative path**, read-only on the
  wire and served with the batched `deltas` verb. The files belong to the disk,
  not to the server, so the server reports what it read rather than owning a
  value it could be asked to change. The unit is one FILE: a probe tick that
  touched one outline sends that outline's entry and not the corpus, and a
  `git pull` that rewrote forty of them is still one coalesced
  `{upserts, removes}` frame. A (re)subscribe opens with the whole keyed set,
  so a reconnect is a fresh read and nothing has to be resumed.

  The key is DECLARED — `keySchema` — rather than inherited from a client
  library's default, which is the type-level half of why this member was
  re-modelled at all
  ([docs/brainstorming/outlines-as-collection.md](../../docs/brainstorming/outlines-as-collection.md)).
- **`manifest` is a cell**: what is true of the SET rather than of any one file
  — today, the documents. Its `null` is the state a collection cannot express:
  an empty snapshot means "this directory holds no outlines", and a first probe
  that has not finished has to say something else. So a reader tells three
  states apart from this one member — no frame yet, `null`, a value — exactly
  as it did from the nullable stream frame this replaced.

  It carries NO set revision, and that is what keeps every document's text off
  the wire: a revision belongs to a file, each entry carries the one it was
  published at, and a second copy of it here would have made this value differ
  on every probe tick. Without it the cell's `equals` holds, and a tick that
  touched no `.md` publishes nothing at all.
- **`errors` is a cell**, read-only on the wire, because "what is wrong right
  now" is one value the server does own. It is deliberately independent of the
  entries, and that independence is load-bearing: a set that stops validating
  leaves the last good tree on screen underneath a banner, which is only
  expressible if the two arrive separately.

`OutlineEntry` carries a file's nodes, its `rev`, and its `broken` — and the
last of those is the per-entity error scope as DATA: a file that stopped
parsing KEEPS ITS KEY and carries its errors, so the sidebar still lists it and
its own pane is what shows the trouble. The two error channels are not a
duplication: an entry's `broken` says WHICH outline is unreadable, because that
is a property of the file the pane is drawn from, and the cell says what is
wrong with the set AS A WHOLE, which no single file owns. A file with `broken`
is being rendered around; anything in the cell is being held back.

**Entries of one revision arrive together; entries of DIFFERENT revisions coexist.**
Only the files a tick touched are upserted, so an unchanged neighbour keeps the
`rev` it was last published at — a consumer rendering B's subtree from A's
mirror must tolerate A@42 beside B@41 for a frame. That is deliberate and it is
the price of the wire being O(changed files); the design doc's cross-file
consistency paragraph is the long version.

Documents stay set-wide, in the manifest, and they carry their TEXT: markdown is
interpreted at view time and a `doc` reference is drawn wherever its node is, so
a paths-only list would need a second read path the app does not have. What that
still costs is granularity rather than frequency — one edited `.md` sends every
`.md`, because the cell's value is the list — and making them a collection of
their own is the obvious next step and deliberately not that change.

One more pair is GIT:

- **`pending` is a cell**, read-only on the wire: what is waiting to be
  committed, which the server DERIVES from git on every published revision and
  on a slow sweep of its own — nothing watches `.git`, so committing in a
  terminal changes this without changing one served byte. Its default is the
  empty value rather than `null`, and there is no third state to tell apart: a
  page that has not heard yet, a directory that is not a repository and a server
  with `--commit=off` all draw the same thing, which is nothing. It carries an
  `equals`, so a sweep that finds nothing new sends nothing.
- **`git.commit` is a procedure**, not a write verb on that cell. Committing is
  not "set pending to something": it is an act with four answers, three of which
  are refusals a reader has to be shown — the repository is busy, nothing was
  waiting, git said no.

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
entries moving.

Who is on the other end is deliberately NOT a member here. It is a real
question — a page bound to a server that has been replaced must know, and both
ends of the stale-tab handshake compare that id — but the framework reserves
`system/identity` for it and answers it out of every surface, process id
included. A member of our own would be a second answer to a question already
answered.

## One address that is not a member

A picture cannot travel the surface: a document's `![](shot.png)` becomes an
`<img src>` and the browser fetches that URL itself. So there is exactly one
HTTP route besides the bundle, and it has two ends — the renderer that writes
the URL and the route that reads it — in packages that cannot import each
other. `src/media.ts` is that bijection: the prefix, `mediaHref`, and
`mediaTarget` with the traversal guard and the picture allowlist in it. Two
copies of "what a media URL looks like" would be a contract kept by memory, and
its failures are silent in both directions — a URL the client writes and the
server does not recognise is a broken image, and a URL the server reads more
loosely than the client writes is a file nobody meant to serve.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, which exports the
`surface` definition, the `OutlineEntry` and `Manifest` schemas and the media
URL above. That is the whole package — a declaration, with no implementation on
either side of it.

## Layering

Depends on `@olai/format` and nothing else in the workspace: the only olai
types on the wire are the format's own, travelling verbatim. `server` and `web`
both depend on this. [docs/architecture.md](../../docs/architecture.md) has the
reasoning.

## Running

```sh
just test                    # the whole workspace's unit tests
```

`src/surface.test.ts` is four tests, and it earns more than it looks. It asserts
that `errors` and `manifest` serve no `set` verb and that `outlines` serves no
`upsert`/`delete` — the browser may not write any of the three — that the
collection really is served with `deltas` and `keys`, and that
the assembled RPC group contains the framework's own members alongside ours,
which only holds if the `@kolu/surface` sources hydrated from the Nix store
resolved `effect` out of the root `node_modules`. A second copy of effect, a
missing root dependency or a stale kolu pin all land here rather than in the
browser.
