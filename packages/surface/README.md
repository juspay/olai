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
- **`git` is a cell**, read-only on the wire, and it is here because of a bug:
  writes came back `committed: false` on a directory its owner knew was a
  repository, and the reason went to the server's log where a browser reader
  never sees it. Whether this directory is a work tree, and whether the last
  commit worked, is one value the server owns about the DIRECTORY rather than
  about any file in it — four states (`off` under `--no-commit`, `repo`, `none`,
  `error` with git's own words). The app header draws them on the ONE control it
  has for git, the Commit pill, which reads this cell beside `pending`: a quiet
  `✓ committed`, a dim `commits off` and `no git here`, and a `⚠ git error`
  carrying what git said. It is read on the MCP face too, as a resource, and
  that is not a duplicate of the browser's reading — an agent in a terminal asks
  the same question and gets the same answer, which is HACKING.md's consistency
  rule rather than a convenience. It
  moves at most twice in an ordinary serve — the probe, and a commit that
  refuses — so nothing about it is a stream. Its shape is deliberately the same
  as `@olai/ops`' own `GitState`: the server hands one straight to the other,
  and the two drifting is a type error at that seam.

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
  committed AND what olai last recorded, which the server DERIVES from git on
  every published revision, whenever a commit lands by any door, and on a slow
  sweep of its own — nothing watches `.git`, so committing in a terminal
  changes this without changing one served byte. The two facts ride together
  because they are one question asked twice: an empty pending list cannot say
  whether anything was ever committed here, and `last: null` is what says
  "never". Its default is the
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

  A tool entry carries what its call CHANGED, and structured — never as prose
  for a browser to parse back. Two shapes, because there are two kinds of write
  and they may not be drawn the same way: a `FileDiff` per file the agent
  rewrote directly (path, what it said, what it says now — the client derives
  the line diff), and a `Wrote` for a write that went through the ops layer,
  which is the node-level story in the format's own classification because a
  `.jsonl` diff is one enormous line per node.

  The framework audit asked for "events paired with a collection", because an
  event replays nothing to a late joiner. A `deltas` collection is that pair in
  one member — the push and the history are the same frames down the same
  subscription — so publishing each entry to an event as well would be one fact
  delivered twice and a dedup rule in the browser.
- **`chat` is a cell**: which session this is, what it is called, which model is
  running, what slash commands the agent offers, whether a turn is in flight.
  One value the server owns, read-only on the wire.
- **the procedures are the verbs**: send, cancel, new, load, the list the
  picker draws, and `attach`. Each declares its failure channel, so "a turn is
  already running" arrives as a `busy` a caller can branch on rather than as an
  opaque transport error.

`attach` is the one that carries BYTES, and both halves of that are decisions.
It is a PROCEDURE rather than an upload route, because a procedure inherits the
origin gate and the session the listener already enforces for the websocket,
where a second HTTP route would need its own copy of both. And it is CHUNKED,
because a frame that scaled with the file would eventually be an oversized one,
and the wire answers that by closing the socket rather than failing the call —
taking every other subscription on that tab down with it. HOW it is cut up is
not this package's: the arithmetic sits beside the cap it is derived from, in
`@kolu/surface/frame-chunking`, and both ends import it from there. `attach.ts`
carried a copy of that derivation until the pin that installed it — copied from
kolu's own padi, where a 26 MB drop had proved it the hard way — and a margin
kept in two places is a margin that eventually disagrees with itself.

What `src/attach.ts` still holds is olai's POLICY: 50 MB per file, which is a
separate number from a chunk on purpose (a cap smaller than one frame would mean
the chunking never ran), and it lives here for the same reason the media URL
does — the browser gates on it before encoding and the server gates on it before
writing, and two copies of a threshold are two thresholds.

The same module holds WHAT may be attached, and it is two lists that meet in
one place: `/format`'s pictures (what a browser can paint, which is also
what a relative `![](…)` may point at) plus `DOCUMENT_EXTENSIONS` — `.pdf`,
`.txt`, `.md`, `.csv`, `.json`, the kinds an agent opens from a path rather than
looks at. `isPicture` deliberately did NOT grow a `.pdf`: what chat may carry
and what a note may draw are different questions, and answering them with one
list would put PDFs behind `/media`. `.svg` is in neither — a document that can
script is not a picture this app paints nor text it passes on.

It is a SIBLING of `send` rather than a widening of it: the two answer different
questions — `attach` says where the bytes landed, `send` says a turn was
accepted — and one file is N calls to one send. What `send` grew is a list of
PATHS, which are what `attach` answered with; the bytes are already on disk by
then, and the agent is handed the path and reads the file itself.

`send` grew a second list on the same argument, and it is the one place this
spec says an id rather than a value: the NODES a message is about, as ids.
Everything else about them — title, `file:line`, the ancestors that make a bare
title mean something — is the SET's answer, and the set is the server's to read;
a browser sending its own would be sending a reading of a frame that is already
old. So the id crosses the wire, the server resolves it against the same
snapshot a keystroke's write is judged against, and the resolved `NodeContext`
comes back on the sent message's own row — where it is what the message was
about, rather than something a browser remembers about a message it drew.

`attach` answers with the file's NAME as well as its path, and that is not a
convenience. The name a caller SENT is a request: the server sanitizes it and
suffixes a collision, so `shot.png` pasted twice is `shot.png` and `shot-1.png`,
and it is the answer that the transcript row carries. A client keeping the name
it sent would be keeping a second answer to "what is this called" — one paste
away from drawing one picture on another message's row.

Nothing in the transcript is an optimistic echo — what a person typed appears
because the server put it there, exactly like everything else, so two tabs
always agree and a send that failed never leaves a message on screen that was
never sent. The agent's WRITES are not members at all: they reach the ops layer
through the internal MCP server, and what a reader sees of them is the outline
entries moving.

The last member is the **keyboard's and the row menu's** (`src/edit.ts`) — one
procedure over one tagged union, and the only place a browser may cause a
write:

- **the verbs are INTENTS.** `Tab` says "indent this", not "reparent it under
  the node above and put it last"; `Ctrl+Enter` says "toggle done", not "set"
  or "clear"; `Ctrl+Shift+Enter` (`walk`) says "walk this row's mark on", not
  which of the three that lands on — the ring, and the argument for `done` not
  being a stop on it, are the resolver's. What a row's neighbours are, and what
  mark it carries, are facts
  about the SNAPSHOT — so they are read where the snapshot is, against the
  revision the write is judged against, rather than computed from a tree a tab
  drew some frames ago and posted back.
- **one union, one procedure** — the shape `@olai/ops` already uses for the
  same kind of thing (`Request` + `run`). The list of verbs is then spelled
  once: adding one is an arm here and an arm in the resolver, and every other
  site is a compile error rather than a silent hole. Five procedures was the
  first shape, and it was five spellings of one list.
- **it is not the ops request vocabulary re-spelled.** It is smaller (no
  `create`, no `see`, no `after`, no `mirror`, no chosen ids) and, where it
  differs, it differs because something is resolved behind it — so the verbs
  that resolve nothing use the ops layer's own words (`title`, `desc`, `date`,
  `unmirror`, `archive`), and a name that differs from an op's is a name with
  arithmetic behind it. Ops itself learns none of it: an op does not know it is
  being called over a wire.
- **three of the verbs are the POINTER's**, and they are here to close a
  DEVIATION rather than to grow the editor: an agent could set or clear a date,
  retire a placement and archive a subtree, and a person could do none of them
  (HACKING.md — "MCP and Web ops must be consistent; never deviate"). `date`,
  `unmirror` and `archive` each resolve to the request the equivalent tool
  sends. A fence the UI wants stays in the UI: `archive` takes a subtree because
  `archive_node` does, and the confirm naming how many rows go is the menu's own
  second step — put here, it would be a rule the agent's op does not have.
  `date` is the one with two senders and it always carried the op's full
  `string | null`: the `•••` menu sends the `null` (`Clear date`), and the date
  picker on a row sends the day somebody chose — the ten characters, verbatim,
  because a date is TEXT (`docs/format.md`) and nothing on this face parses one.
- **two of the verbs are an UNDO's**, and they are the one place the list is
  not shaped like a key: `place` says where a row SAT, `remove` that a row this
  session created should go. They name absolute things because "put it back"
  means one, and what keeps that honest is who named the ids — the server
  derived every one of them from the snapshot the original write was judged
  against, and rides them back on the answer (`Applied.undo`) for the browser to
  replay. Nothing restores a snapshot: an undo is one more op at the write gate,
  judged against the set as it is now.
- **and one verb is BOTH theirs.** `mark` names the mark a node should carry —
  what a menu entry means ("this is doing now") and what an undo means ("it
  carried `todo` before I ticked it off"). Two callers, one arm; a second would
  have been the same request under two names, free to drift.
- **the two TEXT verbs need no undo twin.** The inverse of setting a title is
  setting the title it replaced, so an undo sends `title` — same verb, same op,
  the other text. What it adds is `was`: the text it expects to find. A person
  typing overwrites whatever is there (which is what `set_title` does for an
  agent); an undo may only overwrite what IT wrote, so a row somebody else has
  retyped is refused rather than written over.
- **neither removal here is a delete.** `remove` is the inverse of an `add`: no
  key sends it, the only row it can take back is a row that was just made, and
  what it resolves to is `archive` — narrowed to a node with nothing under it.
  `archive` is that same op unnarrowed, the human's subtree ruling with a
  confirm in front of it; the ids come along, so mirrors and `after` edges that
  name the subtree go on resolving. A key that ERASES one is the one edit a
  person cannot re-type from memory, nothing on any face does it, and whether
  this face ever gets a delete KEY is still the deferral #109 recorded.

It declares `OpFailure` as its error channel, which is what the editor is built
on: a refused write comes back as the validator's own rows, so the draft it
came from is kept and the reason shown beside it. What it ANSWERS with is the
node the write was about, the ops layer's own `nudge` — advice on a success
(the last task under a parent going done), which an agent already receives in
its tool result and the person who pressed the key is exactly who it is for —
and the inverse above, which is absent for the writes nothing would take back
(the text edits, and a row that has gone to the archive). Nothing about the
collections changed: they are still read-only on the wire, and an edit reaches
a reader as the file it produced.

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
`surface` definition, the `OutlineEntry` and `Manifest` schemas, the `Edit`
vocabulary and the media URL above. That is the whole package — a declaration, with no implementation on
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
