# olai CLI — agent contract

Agents are the only users. Every command that has a reply emits **JSON**, always — `--json` is still accepted and does nothing. Fields within a `version` are **append-only**; a bump of `version` is a breaking change.

**Human view is the web app** (`olai/web`). There is no ANSI terminal tree, no static HTML export, and no plain-text mode: what was printed for a person to read at a terminal is gone. Two commands do not answer JSON — `ics`, whose output IS a format (RFC 5545), and `serve`, which serves the web view. Their errors are `olai: message` on stderr.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | usage: unknown command (`css` and `html` are retired), bad flags, missing TITLE, a malformed `--date` / `--month` / `--port` |
| 2 | the outline said no: load or validation error, no such task, ambiguous title, already done, a write aimed at a `#lang olai/sexp` file |
| 3 | file not found |

The write commands know nothing about exit codes: an op (`olai/ops`) fails with a KIND — usage, validation, not-found — and the CLI maps the kind to a code. The codes are the contract; the kinds are how the layer below talks about failure.

## Global

- Default outline file when no paths given: `$OLAI_HOME/Tasks.rkt`. `add` / `done` / `doing` / `move` / `archive` always target one file via `--file`, same default.
- **`OLAI_HOME` has no default.** Unset, any command that would need it — the file defaults above, `daily` without `--home` — is a **usage error** (exit 1, the error object on stderr), nothing is read or written:

  ```json
  {"version":1,"ok":false,
   "error":{"file":null,"line":null,"col":null,
            "message":"OLAI_HOME is not set; set it to your outline directory, or name the outline explicitly (a path argument, --file, --home)"}}
  ```

  Naming files (or `--file` / `--home`) works with the variable unset.
- **Read commands** (`check` / `tree` / `agenda` / `calendar` / `ics` / `serve`) accept **one or more** outline paths. They are read as one **SET**: node keys are minted against it, and it is the scope an `^anchor` has, so a `*mirror` reaches a node another named file defines and one that reaches nothing is an error ([Mirrors](syntax.md#mirrors)). Load the files you always load. The justfile defaults to `$OLAI_HOME/*.rkt`, or the repo's own `examples/Example.rkt examples/Week.rkt Roadmap.rkt` when `OLAI_HOME` is unset — the two examples are a set on purpose, since `Week.rkt` mirrors an anchor `Example.rkt` declares. `serve` also takes the DIRECTORY and globs it itself — that is its front door, see below.
- Personal data lives outside the repo, in the directory `OLAI_HOME` names. Auto-commit (`add` / `done` / `doing` / `move` / `archive` / `daily`) only runs when the directory of the file actually written is a git work tree; otherwise it no-ops (`committed: false`) and Dropbox (or your sync) is the history layer.
- `--json` may appear after the subcommand everywhere it used to; it is a no-op, kept so an invocation an agent already knows does not become a usage error.

## `check [file ...]`

Validate `#lang olai` or `#lang olai/sexp` module(s).

**Single file** keeps the historical shape:

```json
{"version":1,"ok":true,"file":".../Example.rkt","tasks":12,"anchors":1,"mirrors":1}
```

`tasks` counts each defining node once (mirrors do not inflate the count). `anchors` / `mirrors` are counts of `^id` declarations and `*id` sites. A file that splices `@include` fragments also carries `includes` — absent, not empty, when there are none:

```json
{"version":1,"ok":true,"file":".../IncludeRoot.rkt","tasks":6,"anchors":1,
 "mirrors":1,"includes":[{"file":".../IncludeFrag.rkt"}]}
```

**Multiple files**:

```json
{
  "version": 1,
  "ok": false,
  "files": [
    {"file":".../Example.rkt","ok":true,"tasks":12,"anchors":1,"mirrors":1},
    {"file":".../bad.rkt","ok":false,
     "error":{"file":".../bad.rkt","line":4,"col":8,"message":"..."}}
  ]
}
```

Top-level `ok` is false if any file failed. Per-file errors ride in the array on **stdout** and nothing goes to stderr — the single-file shape is the one that reports on stderr (see [Errors](#errors)). Exit is still 2.

The files given are checked as one **set**, because that is an anchor's scope (see [Mirrors](syntax.md#mirrors)). Every file can parse and the set still not link — a `*mirror` naming nothing anywhere, an `^anchor` two of them declare — and that failure belongs to no single file, so it is the reply's own `error`, with the `file:line:col` of the offending form:

```json
{"version":1,"ok":false,
 "files":[{"file":".../a.rkt","ok":true,"tasks":1,"anchors":1,"mirrors":0},
          {"file":".../b.rkt","ok":true,"tasks":1,"anchors":1,"mirrors":0}],
 "error":{"file":".../b.rkt","line":2,"col":0,
          "message":"...: duplicate ^agent; first declared at .../a.rkt:2:0"}}
```

Only asked when every file loaded. Exit 2. In the single-file shape a link failure is simply the error, on stderr, like any other.

## `tree [file ...]`

The task forest.

Single file:

```json
{
  "version": 1,
  "file": ".../Example.rkt",
  "tasks": [
    {
      "title": "Inbox #capture",
      "date": null,
      "description": "Quick capture landing zone",
      "doc": null,
      "done": null,
      "doing": null,
      "status": "open",
      "id": null,
      "key": "pd076e677",
      "tags": ["capture"],
      "children": [ ... ]
    }
  ],
  "anchors": { "agent": { "title": "Agent work", "id": "agent", "key": "agent",
                          "children": [] } },
  "task_count": 12,
  "mirror_count": 1,
  "anchor_count": 1
}
```

Mirror sites in `children` are `{"mirror":"agent"}` — never an inlined subtree. The `anchors` object holds each anchored node once (same shape as a task) and is the **set's** index: every `^id` any of the loaded files declares, which is the scope a `{"mirror":"…"}` resolves in.

A root that splices `@include` fragments also carries `includes` (`[{"file":"..."}]`, absent when there are none), and every node whose **defining** file differs from the loaded file carries its own `file` — that is where writes go (see [Write routing under `@include`](#write-routing-under-include)). A [glob](syntax.md#globs) include contributes one entry per file it matched: what the JSON reports is the answer, never the pattern.

Multiple files:

```json
{
  "version": 1,
  "files": [
    {"file":".../Example.rkt","tasks":[...],"anchors":{...},
     "task_count":12,"mirror_count":1,"anchor_count":1},
    {"file":".../Daily.rkt","tasks":[...],"anchors":{...},
     "task_count":18,"mirror_count":1,"anchor_count":2,
     "includes":[{"file":".../Daily/2026-07.rkt"},{"file":".../Daily/2026-08.rkt"}]}
  ],
  "anchors": {"agent": {"title":"Agent work","id":"agent","key":"agent",
                        "file":".../Example.rkt","children":[]}}
}
```

Two `anchors` objects, two scopes, and the nesting says which: the one inside a file entry is what THAT file's tree declares — its own and its `@include` fragments' (`anchor_count` counts them) — and the top-level one is the whole set's, which is where a `{"mirror":"agent"}` in any of these files points, and, via each entry's `file`, which file a write to it edits.

`date` / `description` are raw strings or `null` (Markdown is not interpreted here). `doc` is the `@doc` path the outline wrote, **verbatim** — relative to the node's **defining** file (the `file` key, when it differs from the loaded one), never resolved and never rendered: the document is a file you can already read, diff and edit. `done` and `doing` are the stored marks: `null` (not in that state), `true` (marked, no timestamp), or an ISO timestamp string. A node carries at most one of them — the language rejects both. `status` is what they MEAN — `"open"`, `"doing"` or `"done"` — and is the one to switch on: it is where a future state would show up, while `done` / `doing` keep their type. `id` is `null` or the anchor string. `tags` is always an array.

`key` is the node's stable identity — its `^anchor` when it has one, else a hash of its **defining** file plus the child ordinals that reach it inside that file. Only the anchor case comes from the expander (a module sees one entry point and would key a spliced node twice); the rest are minted by the load layer, over the whole set of files you loaded, at once. A key survives renaming the node or any ancestor and cannot collide between same-titled siblings; it changes when siblings are reordered (anchor the node if you need more). Because the file is the one that DEFINES the node, an `@include`d node keys the same through any root that includes it, and two roots sharing a fragment agree about it.

The file's name inside that hash is its path **relative to the common directory of the loaded set** — so two roots named `Daily.rkt` in different directories do not collide, and moving the whole outline home does not re-key it. The corollary is that the base moves with the set: load a nested fragment as its own root and its label re-bases, so its nodes key differently than they do under the root that includes them.

```bash
$ olai tree examples/Daily.rkt           # "Setup day" -> p8cfece7b
$ olai tree examples/Daily/2026-08.rkt   # "Setup day" -> p3dd3c447
```

Load the files you always load (`serve` keys against the set it was given) and keys are stable. The web view addresses nodes by this key (element ids, permalinks, stored collapse state).

## `agenda [file ...]`

What is on the plate, relative to local today, **merged across all given files**. **Done tasks are excluded** even if they still have a `@date`. When more than one file is given, breadcrumbs are rooted at each file's basename (`Tasks.rkt > Inbox > Buy milk`). All four arrays are always present, possibly empty.

Stdout:

```json
{
  "version": 1,
  "today": "2026-08-03",
  "overdue": [{"title":"...","date":"2026-01-15T08:00","breadcrumb":"...",
               "status":"open"}],
  "doing": [{"title":"...","date":null,"breadcrumb":"...","status":"doing"}],
  "today_items": [],
  "upcoming": []
}
```

`doing` sits above `today_items` in the reading order the groups have. An item's `status` is why it is in the group it is in: `"open"` for the three date buckets, `"doing"` for that one.

A node in flight is on the agenda **whether or not anyone dated it** — that is the point of the group — so `date` is `null` there where the date buckets always have one, and a dated `@doing` node appears in `doing` and nowhere else. Within the group, dated items come first by date and undated ones follow in tree order.

## `calendar [--month YYYY-MM] [file ...]`

Group **dated** tasks by calendar day for one month (default: current). **Done tasks are included** (JSON `done` is `true` or a timestamp, `status` is `"done"`). Days that have a bare-ISO day node in Daily-style outlines set `day_node: true` (for web deep-links). Multi-file merge like agenda.

```json
{
  "version": 1,
  "month": "2026-08",
  "days": [
    {
      "date": "2026-08-04",
      "day_node": true,
      "items": [
        {"title":"Buy milk","date":"2026-08-04T18:00","breadcrumb":"...","done":null,
         "doing":null,"status":"open","id":null}
      ]
    }
  ]
}
```

## `serve [--port N] [--bind ADDR] [DIR | file ...]`

Run the web view over an outline directory. Blocks until Ctrl-C, which shuts the listener down cleanly.

**A DIRECTORY is the front door** — one argument that is a directory, or no argument at all, which means `$PWD`. The roots are that directory's `*.rkt` at the **top level only** (`@include` fragments live in subdirectories, so a recursive walk would load every one of them twice), sorted, so the node keys minted against the set are stable. It is the same glob `@include Daily/*.rkt` is (see [Globs](syntax.md#globs)), so a dotfile is not a root — an editor's `.#Tasks.rkt` lock file is a dangling symlink, not an outline. The glob is evaluated once at startup: a new top-level file is picked up by restarting, not while running. A directory with no `*.rkt` in it is refused, naming the directory, exit 3. `just serve` is this form over `$OLAI_HOME` (with it unset, `just serve` names the repo's own outlines instead).

The agent runs **in that directory** — exactly it, not the base derived from the files. That is the point of the form: Claude Code keys its stored sessions by the directory it was started in, so a stable one is what makes "the session you were last in" a thing that survives a restart (see [Sessions](#sessions) below).

```text
$ olai serve ~/notes
olai serve http://127.0.0.1:8080 dir: /home/me/notes files: /.../Daily.rkt /.../Tasks.rkt
```

**Explicit `.rkt` files are the plumbing** — the roots are those files, and the agent works from the directory they hang off (one file: its directory; several: the deepest directory holding all of them, the base keys are minted against).

```text
$ olai serve examples/Example.rkt
olai serve http://127.0.0.1:8080 files: /.../examples/Example.rkt
```

- `--port N` — default `8080`. `0` binds a free port and logs which one. The default is a preference: with `8080` taken, `serve` binds a free port instead, says so on stderr (`olai: port 8080 is taken; serving on 41235`), and the URL it prints is the port it actually bound. A port you typed is a request — taken, `serve` refuses to start (exit 1). The printed URL is a contract: the e2e harness reads the port back out of it (`e2e/support/server.js`), which is how a scenario gets a server nobody else can collide with.
- `--bind ADDR` — default `127.0.0.1`. `--bind ""` listens on all interfaces.
- **No auth.** The network is the auth: put it behind Tailscale or Caddy.

**`OLAI_ACP_AGENT`** is an absolute path to an executable that speaks the [Agent Client Protocol](https://agentclientprotocol.com/) on stdio; `serve` spawns it as a subprocess. There is no PATH lookup: with the variable unset (or pointing at something that is not executable) the server refuses to start. The Nix package is self-sufficient — `makeWrapper --set-default` bakes the bundled Claude Code adapter (`packages.acp-agent`) into `bin/olai`, so `nix build` / `nix run` / the home-manager unit need no ambient env. The dev shell (so `just serve` on a raco-linked tree) exports the same default. Exporting the variable yourself wins, which is how you point `serve` at a different agent.

Unset, or pointing at a file that is missing or not executable, is a **usage error**: nothing binds a port and the reason goes to stderr naming the variable —

```text
$ olai serve
olai: OLAI_ACP_AGENT is not set; serve needs the path to an ACP agent (docs/cli.md)
$ OLAI_ACP_AGENT=/nope olai serve
olai: OLAI_ACP_AGENT does not exist: /nope
```

— exit 1, the usage code. The agent is spawned **at startup**, in a background thread: the listener is up first, so pages serve while the subprocess starts and the last conversation replays (see [Sessions](#sessions)). A page answered inside that window is not behind for it — it carries no conversation to be stale, and the stream tells it what the boot said, whichever side of the boot it connected on. A boot that fails is an `error` frame and a log line, and the next chat message retries it — the same path a crashed agent takes, which is likewise replaced on the next message. Its stderr is a log sink, drained into the server's own stderr with an `acp:` prefix; only its stdout is protocol. Chat frames ride the stream under the `chat` event name, one JSON object per event: `{"type":"user","text"}`, `{"type":"chunk","text"}`, `{"type":"tool","id","title","status"}` (the same `id` twice means the same line, updated), `{"type":"done","stopReason","html"}` (`html` is the turn's agent text rendered as Markdown), `{"type":"error","message"}`, `{"type":"reset"}`, `{"type":"model","name"}`, `{"type":"commands","commands":[{"name","description"}]}`, `{"type":"session","id","title"}`. New keys may appear; existing ones keep their meaning.

The `model` frame is which model the session is running, and it is the agent's word for it — said two ways, because one is not enough. The adapter reports the **picked** model as a session config option (`configOptions`, the entry with id `model`), once in the `session/new` result and again in a `config_option_update` whenever it changes under a live session. But a `/model` slash command is handled inside the wrapped Claude Code CLI: the adapter never sees it as a config change, so `configOptions` go on naming the model the session started on. The **running** model is in the CLI's own `system`/`init` message, which the adapter forwards verbatim as a `_claude/sdkMessage` notification — to a client that asked, for the kinds it asked for, which is why `session/new` carries `_meta.claudeCode.emitRawSDKMessages = [{"type":"system","subtype":"init"}]`. Only the `model` field of it is read.

Whichever source moved last wins, and each is debounced against its own previous value: the picker resends its whole set whenever anything in it moves, and the running model repeats every turn. The first running model is a baseline (it agrees with the config option) and is not announced twice. A running model the picker offers is labelled with the picker's name; one it does not offer is shown raw and named once in the log — truthful, where a guess would not be. An agent that never says leaves the header alone; nothing is inferred from a command line or a version, and an agent that is not the Claude Code adapter ignores the `_meta` and loses nothing.

The `commands` frame is the agent's slash commands — the adapter pushes the whole list as an `available_commands_update` (`availableCommands`, each entry `{name, description, input}`) just after `session/new`, and again whenever the set moves under a live session. The bridge keeps the names and descriptions, drops `input` (an argument hint the panel does not draw), and pushes a frame only when the list actually changed. A command is INVOKED as ordinary prompt text — `/name arguments` in a `POST /chat` — so nothing else on the wire knows about them.

### Sessions

An agent that keeps its conversations keys them by the directory it was started in — which is why `serve DIR` runs it in exactly that directory. So there is a LAST session, and the server comes up in it:

- After `initialize`, if the agent advertises `loadSession` and `sessionCapabilities.list`, the bridge asks `session/list` for that directory and **adopts the most recently updated** session with `session/load`. Nothing stored, or an agent that advertises neither: `session/new`, as before.
- `session/load` **replays the whole conversation** as `session/update` notifications and only then answers. The replay has no live turn and nothing in it says where one turn ended, so the bridge reconstructs them from the one boundary it has: a `user_message_chunk` opens a turn, agent chunks and tool calls fill it, the next user message closes it. Replayed turns land in the transcript in the same shape as lived ones, and go out as the same frames — `user`, `chunk`, `tool`, `done` — so open tabs fill in as they arrive. Their `stopReason` is **null**: a replay does not carry how a turn ended, and `end_turn` would be a guess.
- The `session` frame is which conversation this is. It goes out when a session is established (new, adopted, or picked) and again when its title moves — the agent writes the title in the background and pushes it as a `session_info_update` (which also carries `updatedAt`; only the title is read). `title` is null until there is one, so a fresh session says its id first and its name later. The panel header shows the title, quietly, beside the model.
- `+ new` still means `session/new`: the agent-side context goes away, a `session` frame names the new one, and a `reset` clears the panels.

The picker is two routes. `GET /chat/sessions` asks the agent every time (its list is the only one that is right):

```json
{"sessions":[{"id":"…","title":"Investigate the crash",
              "updatedAt":"2026-08-05T14:41:21.471Z","current":true}]}
```

Newest first; `title` / `updatedAt` may be `null`; `current` marks the one the server is in. `POST /chat/load` (form field `id`) moves to one: `204`, then a `reset`, the replayed turns, and the `session` frame on the stream, so every open tab repopulates. `409` while a turn is running or another load is in flight; `503` when the agent is gone or does not keep sessions. The load is not a turn — it does not appear in the transcript as one, and the transcript it replaces is dropped, because a transcript of a session you are no longer in is a lie.

A turn is accepted (and its `user` frame pushed) before the subprocess exists, so a cancel can arrive during the handshake. It is remembered and sent as soon as the prompt is on the wire: every cancelled turn ends the same way, a `done` frame whose `stopReason` the agent chose (`cancelled` from a Claude Code adapter).

Routes:

| Route | Body |
|-------|------|
| `GET /` | HTML page (Workflowy-style skin from `olai/web/render.rkt`) |
| `GET /n/<key>` | one node, zoomed: breadcrumbs (home, the file, each ancestor) plus that subtree and nothing else. `key` as in `tree` JSON. A node with a `@doc` has its document drawn inline here, in full; everywhere else it shows one line of it. A key the current snapshot has no node for is a page saying so, with a `200` — a node can be deleted while a tab sits zoomed on it, and that tab re-fetches this page to find out |
| `GET /archive` | what `olai archive` put away: the outlines' `Archive.rkt`, drawn the ordinary way, with the ordinary permalinks under it. Linked from the sidebar beside Today, and drawn nowhere else — the home page and the sidebar tree are the LIVE outlines. A directory with no archive is a page saying so, with a `200` |
| `GET /today` | the first node titled with today's ISO date (the Daily day node), zoomed — the same view as `/n/<key>`, with today's key looked up per request; terse empty state when there is none yet |
| `GET /live/<boot-id>/events` | `text/event-stream`, never ends. The address carries this process's boot id, so a tab that outlived a restart gets one `live:reload` frame and the end of the stream rather than a refusal; full contract in **[docs/live.md](live.md)**. `event: outline` whenever a watched file reloaded, plus one at local midnight — its data and its `id:` are both the cursor the outlines are now at; `event: chat` with one JSON frame from the agent per line, and no id (a message is not a checkpoint). Opens with `retry:` and an `event: live:hb` carrying its own cadence in seconds, repeated at that cadence, so proxies leave the connection alone and a client can notice it stopping. **A new connection is caught up first**, to that connection alone and before anything live: one `outline` if it names any cursor but the current one (`Last-Event-ID`, or `?last-event-id=` for a page's first connection — so sleep, tab suspension and a server restart all heal), then a `reset`, the conversation's `session` / `model` / `commands` as they stand, and the transcript as the frames that built it (`mark` for a break a live `reset` already cleared). A page opened while the agent was still waking up — or reloaded, or reconnected — knows exactly what one opened a minute earlier does |
| `POST /chat` | prompt the agent; form field `text` (empty after trimming is `400`). `204` — what the panel draws comes back over the stream, so every open tab stays in step. `409` with a terse `text/plain` body while a turn is running, `503` when the agent is gone |
| `POST /chat/new` | new chat: the agent-side context goes away, `204`, and a `reset` frame clears every panel |
| `POST /chat/cancel` | cancel the turn in flight, `204` (also while the agent is still booting); the `done` frame (`stopReason` `cancelled`) follows on its own |
| `GET /chat/sessions` | the agent's stored conversations for this directory, JSON (see [Sessions](#sessions)); `503` while the agent is gone |
| `POST /chat/load` | load one of them; form field `id` (missing is `400`). `204` — the reset, the replayed turns and the `session` frame come back over the stream. `409` while a turn or another load is running, `503` when the agent is gone |
| `GET /api/tree` | byte-identical to `olai tree` |
| `GET /api/agenda` | byte-identical to `olai agenda` |
| `GET /static/app.css` | the skin, `text/css`, `Cache-Control: no-cache`. Generated from the Racket modules that draw the page — `olai/web/skin` composes them — not a file on disk. This route is the only way to get those bytes; there is no `css` command |
| `GET /static/manifest.webmanifest` | web app manifest (`application/manifest+json`); name, icons, `display: standalone`, default theme colours |
| `GET /static/*` | files under `olai/web/static/` — olai's own assets: icons, `collapse.js`, `prefs.js`, `chat.js`, `pwa.js`, `highlight-init.js`, and the vendored highlighter under `hljs/` |
| `GET /media/*` | pictures under the directory being served — what a note's `![](shot.png)` asks for. Same rules as `/static/`: a path that climbs out is a `404`, and so is a miss. Only picture extensions are served (`png`, `jpe?g`, `gif`, `webp`, `avif`, `bmp`, `ico`); an `.svg` is a document that can script, and the outline's own files are not pictures |
| `GET /live/*` | files under the `live` collection's `static/` — the live-view client runtime this app ships and never edits: htmx, its SSE extension, idiomorph, and the health watchdog ([live/README.md](../live/README.md)) |
| anything else | `404`, terse `text/plain` |

A node's permalink is `/n/<key>` (`key` as in `tree` JSON): every bullet in the outline and every entry in the sidebar tree links to that node's own zoom page. A key survives a rename — of the node or of any ancestor — but an unanchored node keys off its position, so moving it to a new ordinal mints a new key and the old link stops resolving. `^anchor` a node whose link has to outlive that.

Within a page, anchored nodes and bare-ISO day nodes also keep a plain `#<anchor>` / `#<YYYY-MM-DD>` target, so links people wrote by hand still resolve, and every node in a live region carries an element id minted by that region (`ol-live-<key>` in the outline, `ol-sidebar-<key>` in the tree). Those are the live view's, not addresses: a node's permanent names are its `^anchor` and its `/n/<key>` permalink.

Paths that climb out of `static/` are 404, not files.

**Markdown** is render-time only: the strings in the struct and in every JSON reply stay verbatim. A title is INLINE (block syntax in one is just characters — a leading `#tag` is a tag, not an `<h1>`); a note, an agent's finished turn and a `@doc` document are full Markdown. What comes out is sanitized against an allowlist — anything not on it is dropped, attributes included — and three things ride through it:

* **Fenced code** keeps its language: the fence's first word, if it is a bare language name, becomes `class="language-<lang>"` on the `<code>`, and the browser paints it with highlight.js. That bundle is vendored (pinned in `npins/sources.json`, built by `nix/highlight-js.nix`, served from `/static/hljs/`) — never a CDN, and never a hand-committed blob. The colours are the skin's, so they follow the theme you picked; `racket` and `rkt` read as Scheme. A word that is not a language hljs has is a block left as plain text.
* **Images** are files beside the outline: a RELATIVE `src` naming a picture becomes `/media/<path>`, and nothing else is drawn at all — no `http(s):`, no `data:`, no `//host`, no absolute path, no `..`, and no format the route will not serve (the list is `olai/web/markdown`'s, and the route is built from the same one). A picture is a note's, a document's or an agent turn's; a title stays one line and draws none.
* **Footnotes** (`text[^1]` + `[^1]: …`) work, both ways. The ids are re-minted per piece of Markdown — the parser's own are never trusted onto the page — so the same note draws the same ids on every render and two notes on one page cannot collide.

No tables, no strikethrough, no task lists: that is the `markdown` package's ceiling, and the parser is not ours to replace.

**Prefs** are a sidebar section, one row per preference — client state, stored in `localStorage` under `olai.<pref>`, never sent to the server (same standing as the collapse state) and therefore per browser. The first row is `theme`: one chip per theme in `olai/web/theme`'s table, and nothing else. The sheet carries all of them, so picking one is a value on `<html data-theme>` and nothing else — no round trip, no re-render. A page that has picked nothing reads in the default theme (the sheet's bare `:root`) and that chip is the lit one; the OS's `prefers-color-scheme` is never consulted, and a stored theme the sheet no longer carries is forgotten on sight. A tiny inline script in `<head>` restores stored prefs before the first paint (`static/prefs.js` is the picker); each theme declares its own `color-scheme`, so scrollbars and form controls follow. `<meta name="theme-color">` starts as the default theme's paper and is rewritten from `--paper` by `static/pwa.js` whenever a chip flips, so the browser chrome tracks the page.

**PWA.** The page links the manifest and icons and is installable (Add to Home Screen / install prompt) when served over HTTPS or localhost. There is no service worker and no offline mode: the view is live-or-nothing (SSE, agent). `static/pwa.js` only keeps `theme-color` in step with the picked theme.

The chat panel (a `>_ agent` button, bottom right; open state remembered in `localStorage`) comes out of the server EMPTY and in none of its states. Every word in it and every class on it arrives as a frame on the page's one SSE connection, `static/chat.js` drawing them — including the conversation that happened before the page existed, which the stream replays down the connection as it is made. Nothing about the conversation is server-rendered: a page is answered while the agent may still be waking up, so a panel drawn from what was known then would be a panel that never finds out. Its header names the model when the agent has reported one, and the conversation when it has a title. The `chats` button beside `+ new` opens a popover over `GET /chat/sessions` — newest first, the current one marked, ↑/↓ and Enter or a click to load one, Esc to close. Agent text is Markdown at render time, same as titles and notes; what you typed and a tool's title never are.

Typing `/` in the panel's input — or pressing the `/` button on the input row, which shows the whole list — opens a completion popover over the agent's slash commands (the whole list, from the `commands` frame — the catch-up's included): ↑/↓ move, Enter or Tab accept the highlighted one into the input, Esc closes, and Enter with nothing open sends the message as always. Accepting only writes `/name ` — sending is what invokes it.

**Edits are pushed, and picked up on the next request either way.** The server keeps a snapshot of the outlines (roots, every `@include` fragment, and every document a node's `@doc` attaches) and reloads it when a watched file's mtime or size changes; a reload runs in a fresh namespace, so the module registry cannot serve you yesterday's file. An `@include` [glob](syntax.md#globs) is watched by re-asking it: a new `Daily/2026-09.rkt` moves no file the server had already read, so the pattern's answer is what the staleness check compares — and the directory it reads is watched even before it has matched anything. A watcher holds a `filesystem-change-evt` on each watched file's *directory* (saves are atomic renames, which fire there), debounces the flurry, and pushes an `outline` event on the stream when the store actually reloaded. Open pages re-fetch themselves and MORPH the pane and the error banner onto what is already there — no refresh, and nothing that did not change is replaced, so scroll, selection and focus survive. A page that was not listening when the file moved is told on the way back in ([docs/live.md](live.md)).

A file is broken for a moment during every edit, so the two surfaces differ:

- `/api/*` answers `500` with the JSON error object (same shape as the CLI's errors, `file` / `line` / `col` / `message`) — agents never get stale data quietly.
- `/` keeps rendering the **last good** snapshot and puts the error, with its `file:line:col`, in a banner at the top of the page. With no last-good snapshot (the first load failed) it answers `500` with the same banner.

A broken file pushes an event too — the banner appearing IS the news — so the cursor moves on a failed reload as well as a good one. It is a token, not a version: compare it, do not parse it.

Exit codes: 0 on clean shutdown, 1 on bad flags, a port it cannot bind, or a missing / unusable `OLAI_ACP_AGENT`; 3 when an outline path does not exist, or a directory holds no top-level `*.rkt`.

There is no static HTML export — `curl http://127.0.0.1:8080/ > snap.html` if you want one.

## `add [--file F] [--date ISO] [--description TEXT] [--parent TITLE|^anchor] [--no-commit] TITLE...`

`--date` accepts `YYYY-MM-DD` or a datetime (`YYYY-MM-DDTHH:MM` / `…:SS`; a space instead of `T` is fine).

Capture under a parent node: default top-level `Inbox` (created if missing), or `--parent ^anchor` / `--parent TITLE`. Writes **outline** syntax only. TITLE words join with spaces (no shell quoting required).

- Validates by re-loading after write; on failure restores the prior file.
- If the file's directory is a git work tree, auto-commits that file with message `capture: TITLE` unless `--no-commit`.
- Never prompts; never opens an editor.

Stdout:

```json
{
  "version": 1,
  "ok": true,
  "file": ".../Tasks.rkt",
  "title": "buy oat milk",
  "date": null,
  "description": null,
  "parent": null,
  "line": 12,
  "created_inbox": false,
  "committed": false
}
```

`parent` echoes `--parent` verbatim (`null` for the default Inbox). `file` is the file actually written — with `--parent ^anchor` that may be an `@include` fragment or a sibling root, not `--file` (see [Write routing](#write-routing-the-defining-file)).

## `done [--file F] [--undo] [--no-commit] TITLE...|^anchor`

Mark a task done by exact title match or `^anchor` (or undo). **One file named** (`--file`); an `^anchor` may resolve to a sibling root, and the write follows the node (see [Write routing](#write-routing-the-defining-file)). Writes **outline** syntax only — same safety as `add`: write temp → re-validate → rename; restore on failure.

- Exact title match across the file (a `[x] ` / `[/] ` checkbox prefix and a trailing `^anchor` are not part of the matched title), or a single `^id` addressing the defining site.
- **0 matches** → exit 2.
- **>1 matches** → exit 2; message lists each `file:line` and suggests `add a ^anchor to disambiguate`.
- On success: inserts `@done YYYY-MM-DD` (today) after the task's metadata, preserving the rest of the file. Rejects tasks already done.
- **Clears doing**: an `@doing` line goes with the edit and a `[/] ` prefix is stripped off the title. A node carrying both marks is a form the language rejects, so this is not tidiness — it is what makes the write valid.
- `--undo`: remove `@done` metadata and strip a leading `[x] ` / `[X] ` prefix.
- Auto-commit `done: TITLE` / `undone: TITLE` in a git work tree unless `--no-commit`.

Stdout:

```json
{
  "version": 1,
  "ok": true,
  "file": ".../Tasks.rkt",
  "title": "Buy milk",
  "line": 5,
  "done": "2026-08-03",
  "undone": false,
  "committed": false
}
```

On `--undo`, `done` is `null` and `undone` is `true`.

## `doing [--file F] [--undo] [--no-commit] TITLE...|^anchor`

Put a task in the third state, between open and done (or take it back out). Same resolver, same write safety and same shape as `done` — it is the same op with a different mark.

- On success: inserts `@doing YYYY-MM-DD` (today) after the task's metadata.
- Rejects a task **already doing**, and a task **already done** — undo the done first, so nothing decides for you that finished work is not. Both are exit 2.
- `--undo`: remove `@doing` metadata and strip a leading `[/] ` prefix.
- Auto-commit `doing: TITLE` / `not-doing: TITLE` in a git work tree unless `--no-commit`.

```json
{"version":1,"ok":true,"file":".../Tasks.rkt","title":"Buy milk","line":5,
 "doing":"2026-08-03","undone":false,"committed":false}
```

On `--undo`, `doing` is `null` and `undone` is `true`.

Who is doing it, and where, live in the node's notes — not in the grammar. An orchestrator marks a task `[/]` and writes the terminal id under it.

## `move [--file F] [--no-commit] [--clear] TITLE...|^anchor DATE`

Set or rewrite `@date` on a task (same write-safety as `add`/`done`). `DATE` is ISO date or datetime. `--clear` removes `@date` instead (no DATE arg). Auto-commit message: `move: TITLE -> DATE` (or cleared).

```json
{"version":1,"ok":true,"file":"...","title":"Buy milk","line":6,"date":"2026-08-10","committed":false}
```

With `--clear`, `date` is `null`. `title` is always the node's resolved title, never the raw `^anchor` you passed.

## `archive [--file F] [--no-commit] TITLE...|^anchor`

Move a node's whole subtree out of the working outline and into `Archive.rkt`,
**re-creating the chain it hung off** so the tree still reads years later.
Same resolver as `done` / `move`, same write safety.

```bash
$ olai archive --file Tasks.rkt install
```

```json
{"version":1,"ok":true,
 "file":".../Archive.rkt","from":".../Tasks.rkt","title":"install","line":4,
 "ancestors":["kitchen remodel"],"created_archive":false,"committed":true}
```

`file` is where the node lives **now**; `from` is the outline it left — which
may be an `@include` fragment, not the file you named ([Write
routing](#write-routing-the-defining-file)). `ancestors` is the chain that was
re-created or merged into, outermost first. `line` is the node's line in the
archive.

- **Where the archive is**: `Archive.rkt` beside the outline **you named**
  (`--file`, or the default `$OLAI_HOME/Tasks.rkt`) — never beside the defining
  file. A fragment lives in a subdirectory and `serve DIR` globs the top level
  only, so an archive down there is one nothing loads. Created on first use.
- **The scaffold**: one node per ancestor, carrying its **title and nothing
  else** — no `^anchor` (a name is unique across the set, and copying one would
  break the link an archived node keeps resolving through), no dates, notes or
  state. A chain node the archive already has is **merged** into, matched by
  exact title at that level; new arrivals **append** at the end of it, so the
  file reads in the order things were put away.
- **The chain is the DEFINING file's**: the titles indented above the node in
  the file it lives in. A fragment spliced into two roots hangs off two
  different things depending on which root you read it through; the file's own
  ancestry is the one that is not a guess.
- **Nothing is stamped.** Archiving is not finishing: a `@done` node keeps its
  timestamp, an open node stays open. What changes is where the node lives.
- **Anchors move with the node** and go on resolving: `^install` archived out of
  `Tasks.rkt` is still what `*install` in `Daily.rkt` means, as long as both
  files are loaded — which `serve DIR` and `olai tree DIR/*.rkt` both do.
- **Both files are validated as one set** before either is written (a `^anchor`
  that would now exist twice is a failure neither file has on its own), and both
  land in **one commit**, `archive: TITLE`.
- Archiving a node that is already in the archive is exit 2, as is a title that
  matches nothing.
- A node's `key` is its `^anchor`, or a hash of its **defining file** and
  ordinals — so an anchored node keeps its `/n/<key>` permalink through the
  move, and an unanchored one does not. `^anchor` what has to outlive it.
- **A `@doc` or `@include` path inside the subtree is not rewritten.** It is
  relative to the defining file, so it survives when the archive sits in the
  same directory (the usual case) and is a validation error — the write is
  refused, both files untouched — when it does not.
- A running `serve` picks the archive up when it is a root it globbed at
  startup. The **first** archive in a directory creates a file that server never
  saw: restart it (the same rule an `@include` glob's directory does not have —
  see [`serve`](#serve---port-n---bind-addr-dir--file-)).

**Archived work is a file, not a state**, and that is the whole design: the
queries below skip it (`agenda`, `calendar`, `ics` — done work is not an answer
to "what is going on"), the web view draws it at `GET /archive` and nowhere
else, and **loading excludes nothing** — `tree` and `check` report every
archived node, its key, and its anchor, because the model is the model.

## `ics [--out PATH] [file ...]`

RFC 5545 `VCALENDAR` of all dated tasks (done included) on stdout, or into `--out PATH` (which prints the path it wrote). Minimal writer — no catalog ics package. UID is `anchor@olai` when present, else a stable hash of path/title/date. `DTSTART` is `VALUE=DATE` or local datetime.

The one command whose output is neither JSON nor the web view: nothing else produces a calendar feed, so a calendar client is the consumer and the format is the reply. Errors are plain (`olai: ...`), exit codes as above.

## `daily [--date YYYY-MM-DD] [--home DIR] [--no-commit]`

Ensure a day node exists in the personal Daily structure under `$OLAI_HOME` (or `--home`):

- Fragment: `Daily/YYYY-MM.rkt` (day nodes only at top level)
- Root: `Daily.rkt` with `year > MonthName > @include Daily/YYYY-MM.rkt`

Creates the month fragment and `@include` line on first use in a month; idempotent thereafter. Writes use add-style validate-then-rename, and auto-commit like the other write commands — the fragment and the root that includes it in ONE commit (`daily: YYYY-MM-DD`).

```json
{"version":1,"ok":true,"day":"2026-08-04","file":".../Daily/2026-08.rkt",
 "created_month":true,"created_day":true,"line":2,"committed":true}
```

Both `created_*` are `false` on every run after the first for that day, and `committed` is `false` when there was nothing to write (or `--no-commit`).

## Write routing: the defining file

`done` / `doing` / `move` / `archive` / `add --parent ^anchor` resolve the target, then edit the **defining file** of that node — which may not be the file you named. JSON `file` fields on tree nodes (and on the set's `anchors` entries) show where agents should write.

Two scopes, because the two kinds of spec are different things:

- A **TITLE** is text, and its scope is the outline you pointed at (`--file`, or the default) plus its `@include` fragments. Unchanged.
- An **`^anchor`** is a name, and since mirrors reach across files its scope is the set: if the file you named does not declare it, the other top-level `*.rkt` **in that file's directory** are consulted, and the one that declares it is where the write lands. So `olai done '^meeting-prep' --file Daily.rkt` marks the node `Tasks.rkt` defines, which is what "checking a mirror off flips the one real node" means. A sibling that does not load is not consulted — it is not the file being written, and one broken outline must not stop every write to the others.

The file actually written is the reply's `file`.

## Errors

Single object on **stderr**, exit non-zero — for every command that replies in JSON, which is every one but `ics` and `serve`:

```json
{
  "version": 1,
  "ok": false,
  "error": {
    "file": ".../Tasks.rkt",
    "line": 4,
    "col": 2,
    "message": "..."
  }
}
```

`line` / `col` / `file` are `null` when not applicable — a load failure carries all three (and repeats them as a `file:line:col` prefix in `message`), a "you asked for something that is not there" failure names the file only:

```json
{"version":1,"ok":false,
 "error":{"file":".../Tasks.rkt","line":null,"col":null,
          "message":"\"Wire the CLI\" is already done (line 16)"}}
```

`message` is addressed to a person, not to a stack: no `some-private-function:` prefix in front of the answer. Agents must not regex pretty-printed messages.

## Stability

- Two counters, both `1` today and free to move apart: the **model** version rides on `tree` payloads (what a node/tree/anchor IS), the **reply** version on command envelopes (`ok` / `error`, `agenda`, `calendar`, the write commands) — a new node field bumps the first, a reshaped envelope the second.
- Top-level objects always include `"version": 1`.
- Within v1, new keys may appear; existing keys keep meaning and type.
- Removing or renaming a key requires a version bump.
- The JSON is the contract; the plain text that used to come out without `--json` was not, and is gone. No key changed with it.

## Retired

The web app is the daily surface, so the CLI keeps only what an agent calls and what guards a write:

| Gone | Instead |
|------|---------|
| plain output on `check` / `agenda` / `calendar` / `add` / `done` / `doing` / `move` / `daily` | the same command, which now always emits its JSON |
| `css` | `GET /static/app.css` from a running `serve`; in-tree, `racket -e '(require olai/web/skin) (displayln (stylesheet))'` |
| `html` (earlier) | `serve`, or `curl http://127.0.0.1:8080/ > snap.html` |

`--json` still parses everywhere it did. An invocation of a retired COMMAND is an unknown command: exit 1.

## Nix build note

Runtime deps (`gregor`, `markdown`) and nixpkgs are pinned with **npins** (`npins/sources.json`). `nix build` is fully offline/sandboxed.
