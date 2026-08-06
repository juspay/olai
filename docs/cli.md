# olai CLI — agent contract

Agents are the only users. Every command that has a reply emits **JSON**,
always — `--json` is still accepted and does nothing. Fields within a
`version` are **append-only**; a bump of `version` is a breaking change.

**Human view is the web app** (`olai/web`). There is no ANSI terminal tree, no
static HTML export, and no plain-text mode: what was printed for a person to
read at a terminal is gone. Two commands do not answer JSON — `ics`, whose
output IS a format (RFC 5545), and `serve`, which serves the web view. Their
errors are `olai: message` on stderr.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | usage: unknown command (`css` and `html` are retired), bad flags, missing TITLE, a malformed `--date` / `--month` / `--port` |
| 2 | the outline said no: load or validation error, no such task, ambiguous title, already done, a write aimed at a `#lang olai/sexp` file |
| 3 | file not found |

The write commands know nothing about exit codes: an op (`olai/ops`) fails with
a KIND — usage, validation, not-found — and the CLI maps the kind to a code.
The codes are the contract; the kinds are how the layer below talks about
failure.

## Global

- Default outline file when no paths given: `$OLAI_HOME/Tasks.rkt`.
  `add` / `done` / `move` always target one file via `--file`, same default.
- **`OLAI_HOME` has no default.** Unset, any command that would need it —
  the file defaults above, `daily` without `--home` — is a **usage error**
  (exit 1, the error object on stderr), nothing is read or written:

  ```json
  {"version":1,"ok":false,
   "error":{"file":null,"line":null,"col":null,
            "message":"OLAI_HOME is not set; set it to your outline directory, or name the outline explicitly (a path argument, --file, --home)"}}
  ```

  Naming files (or `--file` / `--home`) works with the variable unset.
- **Read commands** (`check` / `tree` / `agenda` / `calendar` / `ics` /
  `serve`) accept **one or more** outline paths. The justfile defaults to
  `$OLAI_HOME/*.rkt`, or the repo's own `examples/Example.rkt Roadmap.rkt`
  when `OLAI_HOME` is unset. `serve` also takes the DIRECTORY and globs it
  itself — that is its front door, see below.
- Personal data lives outside the repo, in the directory `OLAI_HOME`
  names. Auto-commit (`add` / `done` / `move` / `daily`) only runs
  when the directory of the file actually written is a git work tree;
  otherwise it no-ops (`committed: false`) and Dropbox (or your sync) is the history layer.
- `--json` may appear after the subcommand everywhere it used to; it is a
  no-op, kept so an invocation an agent already knows does not become a
  usage error.

## `check [file ...]`

Validate `#lang olai` or `#lang olai/sexp` module(s).

**Single file** keeps the historical shape:

```json
{"version":1,"ok":true,"file":".../Example.rkt","tasks":12,"anchors":1,"mirrors":1}
```

`tasks` counts each defining node once (mirrors do not inflate the count).
`anchors` / `mirrors` are counts of `^id` declarations and `*id` sites. A file
that splices `@include` fragments also carries `includes` — absent, not empty,
when there are none:

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

Top-level `ok` is false if any file failed. Per-file errors ride in the array
on **stdout** and nothing goes to stderr — the single-file shape is the one
that reports on stderr (see *Errors*). Exit is still 2.

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
      "done": null,
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

Mirror sites in `children` are `{"mirror":"agent"}` — never an inlined subtree.
The `anchors` object holds each anchored node once (same shape as a task).

A root that splices `@include` fragments also carries `includes`
(`[{"file":"..."}]`, absent when there are none), and every node whose
**defining** file differs from the loaded file carries its own `file` — that is
where writes go (see *Write routing under `@include`*).

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
  ]
}
```

`date` / `description` are raw strings or `null` (Markdown is not interpreted
here). `done` is the stored field: `null` (open), `true` (completed, no
timestamp), or an ISO timestamp string. `status` is what that field MEANS —
`"open"` or `"done"` — and is the one to switch on: it is where a future
state would show up, while `done` keeps its type. `id` is `null` or the anchor
string. `tags` is always an array.

`key` is the node's stable identity — its `^anchor` when it has one, else a
hash of its **defining** file plus the child ordinals that reach it inside
that file. Only the anchor case comes from the expander (a module sees one
entry point and would key a spliced node twice); the rest are minted by the
load layer, over the whole set of files you loaded, at once. A key survives
renaming the node or any ancestor and cannot collide between same-titled
siblings; it changes when siblings are reordered (anchor the node if you need
more). Because the file is the one that DEFINES the node, an `@include`d node
keys the same through any root that includes it, and two roots sharing a
fragment agree about it.

The file's name inside that hash is its path **relative to the common
directory of the loaded set** — so two roots named `Daily.rkt` in different
directories do not collide, and moving the whole outline home does not re-key
it. The corollary is that the base moves with the set: load a nested fragment
as its own root and its label re-bases, so its nodes key differently than they
do under the root that includes them.

```console
$ olai tree examples/Daily.rkt           # "Setup day" -> p8cfece7b
$ olai tree examples/Daily/2026-08.rkt   # "Setup day" -> p3dd3c447
```

Load the files you always load (`serve` keys against the set it was given) and
keys are stable. The web view addresses nodes by this key (element ids,
permalinks, stored collapse state).

## `agenda [file ...]`

Dated tasks relative to local today, **merged across all given files**. **Done
tasks are excluded** even if they still have a `@date`. When more than one file
is given, breadcrumbs are rooted at each file's basename
(`Tasks.rkt > Inbox > Buy milk`). All three arrays are always present, possibly
empty.

Stdout:

```json
{
  "version": 1,
  "today": "2026-08-03",
  "overdue": [{"title":"...","date":"2026-01-15T08:00","breadcrumb":"..."}],
  "today_items": [],
  "upcoming": []
}
```

## `calendar [--month YYYY-MM] [file ...]`

Group **dated** tasks by calendar day for one month (default: current).
**Done tasks are included** (JSON `done` is `true` or a timestamp, `status` is
`"done"`). Days that
have a bare-ISO day node in Daily-style outlines set `day_node: true` (for
web deep-links). Multi-file merge like agenda.

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
         "status":"open","id":null}
      ]
    }
  ]
}
```

## `serve [--port N] [--bind ADDR] [DIR | file ...]`

Run the web view over an outline directory. Blocks until Ctrl-C, which shuts
the listener down cleanly.

**A DIRECTORY is the front door** — one argument that is a directory, or no
argument at all, which means `$PWD`. The roots are that directory's `*.rkt` at
the **top level only** (`@include` fragments live in subdirectories, so a
recursive walk would load every one of them twice), sorted, so the node keys
minted against the set are stable. The glob is evaluated once at startup: a new
top-level file is picked up by restarting, not while running. A directory with
no `*.rkt` in it is refused, naming the directory, exit 3. `just serve` is this
form over `$OLAI_HOME` (with it unset, `just serve` names the repo's own
outlines instead).

The agent runs **in that directory** — exactly it, not the base derived from
the files. That is the point of the form: Claude Code keys its stored sessions
by the directory it was started in, so a stable one is what makes "the session
you were last in" a thing that survives a restart (see *Sessions* below).

```console
$ olai serve ~/notes
olai serve http://127.0.0.1:8080 dir: /home/me/notes files: /.../Daily.rkt /.../Tasks.rkt
```

**Explicit `.rkt` files are the plumbing** — the roots are those files, and the
agent works from the directory they hang off (one file: its directory; several:
the deepest directory holding all of them, the base keys are minted against).

```console
$ olai serve examples/Example.rkt
olai serve http://127.0.0.1:8080 files: /.../examples/Example.rkt
```

- `--port N` — default `8080`. `0` binds a free port and logs which one.
- `--bind ADDR` — default `127.0.0.1`. `--bind ""` listens on all interfaces.
- **No auth.** The network is the auth: put it behind Tailscale or Caddy.

**`OLAI_ACP_AGENT`** is an absolute path to an executable that speaks the
[Agent Client Protocol](https://agentclientprotocol.com/) on stdio; `serve`
spawns it as a subprocess. There is no PATH lookup: with the variable unset
(or pointing at something that is not executable) the server refuses to start.
The Nix package is self-sufficient — `makeWrapper --set-default` bakes the
bundled Claude Code adapter (`packages.acp-agent`) into `bin/olai`, so
`nix build` / `nix run` / the home-manager unit need no ambient env. The
dev shell (so `just serve` on a raco-linked tree) exports the same default.
Exporting the variable yourself wins, which is how you point `serve` at a
different agent.

Unset, or pointing at a file that is missing or not executable, is a **usage
error**: nothing binds a port and the reason goes to stderr naming the
variable —

```console
$ olai serve
olai: OLAI_ACP_AGENT is not set; serve needs the path to an ACP agent (docs/cli.md)
$ OLAI_ACP_AGENT=/nope olai serve
olai: OLAI_ACP_AGENT does not exist: /nope
```

— exit 1, the usage code. The agent is spawned **at startup**, in a background
thread: the listener is up first, so pages serve while the subprocess starts
and the last conversation replays into them (see *Sessions*). A boot that fails
is an `error` frame and a log line, and the next chat message retries it — the
same path a crashed agent takes, which is likewise replaced on the next message.
Its stderr is a log sink, drained into the server's own stderr with an `acp:`
prefix; only its stdout is protocol. Chat frames ride `/events` under the `chat`
event name, one JSON object per event:
`{"type":"user","text"}`, `{"type":"chunk","text"}`,
`{"type":"tool","id","title","status"}` (the same `id` twice means the same
line, updated), `{"type":"done","stopReason","html"}` (`html` is the turn's
agent text rendered as Markdown), `{"type":"error","message"}`,
`{"type":"reset"}`, `{"type":"model","name"}`,
`{"type":"commands","commands":[{"name","description"}]}`,
`{"type":"session","id","title"}`. New keys may appear;
existing ones keep their meaning.

The `model` frame is which model the session is running, and it is the agent's
word for it — said two ways, because one is not enough. The adapter reports the
**picked** model as a session config option (`configOptions`, the entry with id
`model`), once in the `session/new` result and again in a
`config_option_update` whenever it changes under a live session. But a `/model`
slash command is handled inside the wrapped Claude Code CLI: the adapter never
sees it as a config change, so `configOptions` go on naming the model the
session started on. The **running** model is in the CLI's own `system`/`init`
message, which the adapter forwards verbatim as a `_claude/sdkMessage`
notification — to a client that asked, for the kinds it asked for, which is why
`session/new` carries
`_meta.claudeCode.emitRawSDKMessages = [{"type":"system","subtype":"init"}]`.
Only the `model` field of it is read.

Whichever source moved last wins, and each is debounced against its own
previous value: the picker resends its whole set whenever anything in it moves,
and the running model repeats every turn. The first running model is a baseline
(it agrees with the config option) and is not announced twice. A running model
the picker offers is labelled with the picker's name; one it does not offer is
shown raw and named once in the log — truthful, where a guess would not be. An
agent that never says leaves the header alone; nothing is inferred from a
command line or a version, and an agent that is not the Claude Code adapter
ignores the `_meta` and loses nothing.

The `commands` frame is the agent's slash commands — the adapter pushes the
whole list as an `available_commands_update` (`availableCommands`, each entry
`{name, description, input}`) just after `session/new`, and again whenever the
set moves under a live session. The bridge keeps the names and descriptions,
drops `input` (an argument hint the panel does not draw), and pushes a frame
only when the list actually changed. A command is INVOKED as ordinary prompt
text — `/name arguments` in a `POST /chat` — so nothing else on the wire knows
about them.

### Sessions

An agent that keeps its conversations keys them by the directory it was started
in — which is why `serve DIR` runs it in exactly that directory. So there is a
LAST session, and the server comes up in it:

- After `initialize`, if the agent advertises `loadSession` and
  `sessionCapabilities.list`, the bridge asks `session/list` for that directory
  and **adopts the most recently updated** session with `session/load`. Nothing
  stored, or an agent that advertises neither: `session/new`, as before.
- `session/load` **replays the whole conversation** as `session/update`
  notifications and only then answers. The replay has no live turn and nothing
  in it says where one turn ended, so the bridge reconstructs them from the one
  boundary it has: a `user_message_chunk` opens a turn, agent chunks and tool
  calls fill it, the next user message closes it. Replayed turns land in the
  transcript in the same shape as lived ones, and go out as the same frames —
  `user`, `chunk`, `tool`, `done` — so open tabs fill in as they arrive. Their
  `stopReason` is **null**: a replay does not carry how a turn ended, and
  `end_turn` would be a guess.
- The `session` frame is which conversation this is. It goes out when a session
  is established (new, adopted, or picked) and again when its title moves — the
  agent writes the title in the background and pushes it as a
  `session_info_update` (which also carries `updatedAt`; only the title is
  read). `title` is null until there is one, so a fresh session says its id
  first and its name later. The panel header shows the title, quietly, beside
  the model.
- `+ new` still means `session/new`: the agent-side context goes away, a
  `session` frame names the new one, and a `reset` clears the panels.

The picker is two routes. `GET /chat/sessions` asks the agent every time (its
list is the only one that is right):

```json
{"sessions":[{"id":"…","title":"Investigate the crash",
              "updatedAt":"2026-08-05T14:41:21.471Z","current":true}]}
```

Newest first; `title` / `updatedAt` may be `null`; `current` marks the one the
server is in. `POST /chat/load` (form field `id`) moves to one: `204`, then a
`reset`, the replayed turns, and the `session` frame on `/events`, so every open
tab repopulates. `409` while a turn is running or another load is in flight;
`503` when the agent is gone or does not keep sessions. The load is not a turn —
it does not appear in the transcript as one, and the transcript it replaces is
dropped, because a transcript of a session you are no longer in is a lie.

A turn is accepted (and its `user` frame pushed) before the subprocess exists,
so a cancel can arrive during the handshake. It is remembered and sent as soon
as the prompt is on the wire: every cancelled turn ends the same way, a `done`
frame whose `stopReason` the agent chose (`cancelled` from a Claude Code
adapter).

Routes:

| Route | Body |
|-------|------|
| `GET /` | HTML page (Workflowy-style skin from `olai/web/render.rkt`) |
| `GET /n/<key>` | one node, zoomed: breadcrumbs (home, the file, each ancestor) plus that subtree and nothing else. `key` as in `tree` JSON. A key the current snapshot has no node for is a page saying so, with a `200` — a node can be deleted while a tab sits zoomed on it, and that tab re-fetches this page to find out |
| `GET /today` | the first node titled with today's ISO date (the Daily day node), zoomed — the same view as `/n/<key>`, with today's key looked up per request; terse empty state when there is none yet |
| `GET /events` | `text/event-stream`, never ends. `event: outline` with the store revision as its data whenever a watched file reloaded, plus one at local midnight; `event: chat` with one JSON frame from the agent per line; a `:hb` comment on connect and every 15s after, so a client knows it is subscribed and proxies leave it alone |
| `POST /chat` | prompt the agent; form field `text` (empty after trimming is `400`). `204` — what the panel draws comes back over `/events`, so every open tab stays in step. `409` with a terse `text/plain` body while a turn is running, `503` when the agent is gone |
| `POST /chat/new` | new chat: the agent-side context goes away, `204`, and a `reset` frame clears every panel |
| `POST /chat/cancel` | cancel the turn in flight, `204` (also while the agent is still booting); the `done` frame (`stopReason` `cancelled`) follows on its own |
| `GET /chat/sessions` | the agent's stored conversations for this directory, JSON (see *Sessions*); `503` while the agent is gone |
| `POST /chat/load` | load one of them; form field `id` (missing is `400`). `204` — the reset, the replayed turns and the `session` frame come back over `/events`. `409` while a turn or another load is running, `503` when the agent is gone |
| `GET /api/tree` | byte-identical to `olai tree` |
| `GET /api/agenda` | byte-identical to `olai agenda` |
| `GET /static/app.css` | the skin, `text/css`, `Cache-Control: no-cache`. Generated from the Racket modules that draw the page — `olai/web/skin` composes them — not a file on disk. This route is the only way to get those bytes; there is no `css` command |
| `GET /static/manifest.webmanifest` | web app manifest (`application/manifest+json`); name, icons, `display: standalone`, default theme colours |
| `GET /static/*` | files under `olai/web/static/` (icons, htmx, scripts, `pwa.js`) |
| anything else | `404`, terse `text/plain` |

A node's permalink is `/n/<key>` (`key` as in `tree` JSON): every bullet in the
outline and every entry in the sidebar tree links to that node's own zoom page.
A key survives a rename — of the node or of any ancestor — but an unanchored
node keys off its position, so moving it to a new ordinal mints a new key and
the old link stops resolving. `^anchor` a node whose link has to outlive that.

Within a page, anchored nodes and bare-ISO day nodes also keep a plain
`#<anchor>` / `#<YYYY-MM-DD>` target, so links people wrote by hand still
resolve, and every node carries `id="n-<key>"`.

Paths that climb out of `static/` are 404, not files.

**Prefs** are a sidebar section, one row per preference — client state, stored
in `localStorage` under `olai.<pref>`, never sent to the server (same standing
as the collapse state) and therefore per browser. The first row is `theme`: one
chip per theme in `olai/web/theme`'s table, and nothing else. The sheet carries
all of them, so picking one is a value on `<html data-theme>` and nothing else
— no round trip, no re-render. A page that has picked nothing reads in the
default theme (the sheet's bare `:root`) and that chip is the lit one; the OS's
`prefers-color-scheme` is never consulted, and a stored theme the sheet no
longer carries is forgotten on sight. A tiny inline script in `<head>` restores
stored prefs before the first paint (`static/prefs.js` is the picker); each
theme declares its own `color-scheme`, so scrollbars and form controls follow.
`<meta name="theme-color">` starts as the default theme's paper and is rewritten
from `--paper` by `static/pwa.js` whenever a chip flips, so the browser chrome
tracks the page.

**PWA.** The page links the manifest and icons and is installable (Add to
Home Screen / install prompt) when served over HTTPS or localhost. There is
no service worker and no offline mode: the view is live-or-nothing (SSE,
agent). `static/pwa.js` only keeps `theme-color` in step with the picked theme.

The chat panel (a `>_ agent` button, bottom right; open state remembered in
`localStorage`) is server-rendered from the bridge's transcript on every page
load — frames are ephemeral, so a reload or a second tab replays instead of
missing the conversation — and kept live by `static/chat.js` off the page's one
SSE connection. Its header names the model when the agent has reported one, and
the conversation when it has a title. The `chats` button beside `+ new` opens a
popover over `GET /chat/sessions` — newest first, the current one marked, ↑/↓
and Enter or a click to load one, Esc to close.
Agent text is Markdown at render time, same as titles and notes; what you typed
and a tool's title never are.

Typing `/` in the panel's input — or pressing the `/` button on the input row,
which shows the whole list — opens a completion popover over the agent's
slash commands (replayed onto the panel as `data-commands`, kept live by the
`commands` frame): ↑/↓ move, Enter or Tab accept the highlighted one into the
input, Esc closes, and Enter with nothing open sends the message as always.
Accepting only writes `/name ` — sending is what invokes it.

**Edits are pushed, and picked up on the next request either way.** The server
keeps a snapshot of the outlines (roots plus every `@include` fragment) and
reloads it when a watched file's mtime or size changes; a reload runs in a
fresh namespace, so the module registry cannot serve you yesterday's file. A
watcher holds a `filesystem-change-evt` on each watched file's *directory*
(saves are atomic renames, which fire there), debounces the flurry, and pushes
an `outline` event on `/events` when the store actually reloaded. Open pages
re-fetch themselves and swap the pane and the error banner — no refresh.

A file is broken for a moment during every edit, so the two surfaces differ:

- `/api/*` answers `500` with the JSON error object (same shape as the CLI's
  errors, `file` / `line` / `col` / `message`) — agents never get stale data
  quietly.
- `/` keeps rendering the **last good** snapshot and puts the error, with its
  `file:line:col`, in a banner at the top of the page. With no last-good
  snapshot (the first load failed) it answers `500` with the same banner.

A broken file pushes an event too — the banner appearing IS the news — so the
revision moves on a failed reload as well as a good one. It is a counter, not
a version: compare it, do not parse it.

Exit codes: 0 on clean shutdown, 1 on bad flags, a port it cannot bind, or a
missing / unusable `OLAI_ACP_AGENT`; 3 when an outline path does not
exist, or a directory holds no top-level `*.rkt`.

There is no static HTML export — `curl http://127.0.0.1:8080/ > snap.html`
if you want one.

## `add [--file F] [--date ISO] [--description TEXT] [--parent TITLE|^anchor] [--no-commit] TITLE...`

`--date` accepts `YYYY-MM-DD` or a datetime (`YYYY-MM-DDTHH:MM` / `…:SS`; a space
instead of `T` is fine).

Capture under a parent node: default top-level `Inbox` (created if missing), or
`--parent ^anchor` / `--parent TITLE`. Writes **outline** syntax only. TITLE
words join with spaces (no shell quoting required).

- Validates by re-loading after write; on failure restores the prior file.
- If the file's directory is a git work tree, auto-commits that file with
  message `capture: TITLE` unless `--no-commit`.
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

`parent` echoes `--parent` verbatim (`null` for the default Inbox). `file` is
the file actually written — with `--parent ^anchor` that may be an `@include`
fragment, not `--file`.

## `done [--file F] [--undo] [--no-commit] TITLE...|^anchor`

Mark a task done by exact title match or `^anchor` (or undo). **One file only**
(`--file`). Writes **outline** syntax only — same safety as `add`: write temp →
re-validate → rename; restore on failure.

- Exact title match across the file (a `[x] ` checkbox prefix and a trailing
  `^anchor` are not part of the matched title), or a single `^id` addressing
  the defining site.
- **0 matches** → exit 2.
- **>1 matches** → exit 2; message lists each `file:line` and suggests
  `add a ^anchor to disambiguate`.
- On success: inserts `@done YYYY-MM-DD` (today) after the task's metadata,
  preserving the rest of the file. Rejects tasks already done.
- `--undo`: remove `@done` metadata and strip a leading `[x] ` / `[X] ` prefix.
- Auto-commit `done: TITLE` / `undone: TITLE` in a git work tree unless
  `--no-commit`.

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

## `move [--file F] [--no-commit] [--clear] TITLE...|^anchor DATE`

Set or rewrite `@date` on a task (same write-safety as `add`/`done`). `DATE`
is ISO date or datetime. `--clear` removes `@date` instead (no DATE arg).
Auto-commit message: `move: TITLE -> DATE` (or cleared).

```json
{"version":1,"ok":true,"file":"...","title":"Buy milk","line":6,"date":"2026-08-10","committed":false}
```

With `--clear`, `date` is `null`. `title` is always the node's resolved title,
never the raw `^anchor` you passed.

## `ics [--out PATH] [file ...]`

RFC 5545 `VCALENDAR` of all dated tasks (done included) on stdout, or into
`--out PATH` (which prints the path it wrote). Minimal writer — no catalog ics
package. UID is `anchor@olai` when present, else a stable hash of
path/title/date. `DTSTART` is `VALUE=DATE` or local datetime.

The one command whose output is neither JSON nor the web view: nothing else
produces a calendar feed, so a calendar client is the consumer and the format
is the reply. Errors are plain (`olai: ...`), exit codes as above.

## `daily [--date YYYY-MM-DD] [--home DIR] [--no-commit]`

Ensure a day node exists in the personal Daily structure under `$OLAI_HOME`
(or `--home`):

- Fragment: `Daily/YYYY-MM.rkt` (day nodes only at top level)
- Root: `Daily.rkt` with `year > MonthName > @include Daily/YYYY-MM.rkt`

Creates the month fragment and `@include` line on first use in a month;
idempotent thereafter. Writes use add-style validate-then-rename, and
auto-commit like the other write commands — the fragment and the root that
includes it in ONE commit (`daily: YYYY-MM-DD`).

```json
{"version":1,"ok":true,"day":"2026-08-04","file":".../Daily/2026-08.rkt",
 "created_month":true,"created_day":true,"line":2,"committed":true}
```

Both `created_*` are `false` on every run after the first for that day, and
`committed` is `false` when there was nothing to write (or `--no-commit`).

## Write routing under `@include`

`done` / `move` / `add --parent ^anchor` resolve the target against the loaded
tree (including fragments), then edit the **defining file** of that node.
JSON `file` fields on tree nodes show where agents should write.

## Errors

Single object on **stderr**, exit non-zero — for every command that replies in
JSON, which is every one but `ics` and `serve`:

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

`line` / `col` / `file` are `null` when not applicable — a load failure carries
all three (and repeats them as a `file:line:col` prefix in `message`), a
"you asked for something that is not there" failure names the file only:

```json
{"version":1,"ok":false,
 "error":{"file":".../Tasks.rkt","line":null,"col":null,
          "message":"\"Wire the CLI\" is already done (line 16)"}}
```

`message` is addressed to a person, not to a stack: no `some-private-function:`
prefix in front of the answer. Agents must not regex pretty-printed messages.

## Stability

- Two counters, both `1` today and free to move apart: the **model** version
  rides on `tree` payloads (what a node/tree/anchor IS), the **reply** version
  on command envelopes (`ok` / `error`, `agenda`, `calendar`, the write
  commands) — a new node field bumps the first, a reshaped envelope the second.
- Top-level objects always include `"version": 1`.
- Within v1, new keys may appear; existing keys keep meaning and type.
- Removing or renaming a key requires a version bump.
- The JSON is the contract; the plain text that used to come out without
  `--json` was not, and is gone. No key changed with it.

## Retired

The web app is the daily surface, so the CLI keeps only what an agent calls and
what guards a write:

| Gone | Instead |
|------|---------|
| plain output on `check` / `agenda` / `calendar` / `add` / `done` / `move` / `daily` | the same command, which now always emits its JSON |
| `css` | `GET /static/app.css` from a running `serve`; in-tree, `racket -e '(require olai/web/skin) (displayln (stylesheet))'` |
| `html` (earlier) | `serve`, or `curl http://127.0.0.1:8080/ > snap.html` |

`--json` still parses everywhere it did. An invocation of a retired COMMAND is
an unknown command: exit 1.

## Nix build note

Runtime deps (`gregor`, `markdown`) and nixpkgs are pinned with **npins**
(`npins/sources.json`). `nix build` is fully offline/sandboxed.
