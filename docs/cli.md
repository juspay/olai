# selfflowy CLI — agent contract

Agents are the primary users. Prefer `--json`. Fields within a `version` are
**append-only**; a bump of `version` is a breaking change.

**Human view is the web app** (`selfflowy/web`). There is no ANSI terminal
tree and no static HTML export. Agents use `tree` / `check` / `agenda --json`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | usage / bad flags / missing TITLE |
| 2 | validation or load error (bad outline, bad date, capture failed) |
| 3 | file not found |

Same codes for plain and `--json` modes.

## Global

- Default outline file when no paths given:
  `$SELFFLOWY_HOME/Tasks.rkt` (default home:
  `~/Dropbox/Selfflowy-Srid`). `add` / `done` / `move` always target one file
  via `--file`, same default.
- **Read commands** (`check` / `tree` / `agenda` / `calendar` / `ics` /
  `serve`) accept **one or more** outline paths. The justfile defaults to
  `$SELFFLOWY_HOME/{Tasks,Daily,Roadmap}.rkt` (no `examples/` paths).
- Personal data lives outside the repo. Override the directory with
  `SELFFLOWY_HOME`. Auto-commit (`add` / `done` / `move` / `daily`) only runs
  when the directory of the file actually written is a git work tree;
  otherwise it no-ops (`committed: false`) and Dropbox (or your sync) is the history layer.
- `--json` may appear after the subcommand where supported.

## `check [--json] [file ...]`

Validate `#lang selfflowy` or `#lang selfflowy/sexp` module(s).

Plain — one ok-line per file; if any fail, all are reported then exit 2.
Anchor / mirror / include counts are appended only when non-zero:

```
$ selfflowy check examples/Example.rkt examples/Roadmap.rkt
ok: .../Example.rkt (12 tasks, 1 anchor, 1 mirror)
ok: .../Roadmap.rkt (8 tasks)
```

JSON — **single file** keeps the historical shape:

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

## `tree [--json] [file ...]`

**Always JSON** (the task forest). `--json` is accepted as a no-op for compat.
Humans should use the web app.

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
    {"file":".../Roadmap.rkt","tasks":[...],"anchors":{...},
     "task_count":8,"mirror_count":0,"anchor_count":0}
  ]
}
```

`date` / `description` are raw strings or `null` (Markdown is not interpreted
here). `done` is `null` (open), `true` (completed, no timestamp), or an ISO
timestamp string. `id` is `null` or the anchor string. `tags` is always an array.

`key` is the node's stable identity — its `^anchor` when it has one, else a
hash of its **defining** file plus the child ordinals that reach it inside
that file. It survives renaming the node or any ancestor and cannot collide
between same-titled siblings; it changes when siblings are reordered (anchor
the node if you need more). Because the file is the one that DEFINES the node,
an `@include`d node keys the same whether you load the fragment or the root
that includes it, and two roots sharing a fragment agree about it. File names
are taken relative to the common directory of the files you loaded, so two
roots named `Daily.rkt` in different directories do not collide, and moving
the whole outline home does not re-key it. The web view addresses nodes by
this key (element ids, permalinks, stored collapse state).

## `agenda [--json] [file ...]`

Dated tasks relative to local today, **merged across all given files**. **Done
tasks are excluded** even if they still have a `@date`. When more than one file
is given, breadcrumbs are rooted at each file's basename
(`Tasks.rkt > Inbox > Buy milk`). Plain mode is unstyled text. Empty groups are
omitted in plain mode, and an agenda with nothing in it prints `no dated tasks`;
JSON always includes all three arrays (possibly empty).

Plain:

```
OVERDUE
  [2026-01-15T08:00]  Buy milk
         Tasks.rkt > Inbox > Buy milk
```

JSON stdout:

```json
{
  "version": 1,
  "today": "2026-08-03",
  "overdue": [{"title":"...","date":"2026-01-15T08:00","breadcrumb":"..."}],
  "today_items": [],
  "upcoming": []
}
```

## `calendar [--json] [--month YYYY-MM] [file ...]`

Group **dated** tasks by calendar day for one month (default: current).
**Done tasks are included** (JSON `done` is `true` or a timestamp). Days that
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
        {"title":"Buy milk","date":"2026-08-04T18:00","breadcrumb":"...","done":null,"id":null}
      ]
    }
  ]
}
```

## `serve [--port N] [--bind ADDR] [file ...]`

Run the web view over the given outlines (default file set as above:
`$SELFFLOWY_HOME/Tasks.rkt`; `just serve` passes the usual trio). Blocks
until Ctrl-C, which shuts the listener down cleanly. One line on stdout at
startup:

```
$ selfflowy serve examples/Example.rkt
selfflowy serve http://127.0.0.1:8080 files: /.../examples/Example.rkt
```

- `--port N` — default `8080`. `0` binds a free port and logs which one.
- `--bind ADDR` — default `127.0.0.1`. `--bind ""` listens on all interfaces.
- **No auth.** The network is the auth: put it behind Tailscale or Caddy.

Routes:

| Route | Body |
|-------|------|
| `GET /` | HTML page (Workflowy-style skin from `selfflowy/web/render.rkt`) |
| `GET /today` | the first node titled with today's ISO date (the Daily day node), zoomed; terse empty state when there is none yet |
| `GET /api/tree` | byte-identical to `selfflowy tree` |
| `GET /api/agenda` | byte-identical to `selfflowy agenda --json` |
| `GET /static/*` | files under `selfflowy/web/static/` |
| anything else | `404`, terse `text/plain` |

A node's permalink is `/#n-<key>` (`key` as in `tree` JSON). Anchored nodes and
bare-ISO day nodes also keep a plain `#<anchor>` / `#<YYYY-MM-DD>` target, so
links people wrote by hand still resolve.

Paths that climb out of `static/` are 404, not files.

**Edits are picked up on the next request.** The server keeps a snapshot of
the outlines (roots plus every `@include` fragment) and reloads it when a
watched file's mtime or size changes; a reload runs in a fresh namespace, so
the module registry cannot serve you yesterday's file.

A file is broken for a moment during every edit, so the two surfaces differ:

- `/api/*` answers `500` with the JSON error object (same shape as `--json`
  errors, `file` / `line` / `col` / `message`) — agents never get stale data
  quietly.
- `/` keeps rendering the **last good** snapshot and puts the error, with its
  `file:line:col`, in a banner at the top of the page. With no last-good
  snapshot (the first load failed) it answers `500` with the same banner.

There is **no live push yet**: the page ships the htmx SSE extension but the
server opens no event stream, so a reload is still a reload. That is the next
thing to land here.

Exit codes: 0 on clean shutdown, 1 on bad flags or a port it cannot bind,
3 when an outline path does not exist.

There is no static HTML export — `curl http://127.0.0.1:8080/ > snap.html`
if you want one.

## `add [--json] [--file F] [--date ISO] [--description TEXT] [--parent TITLE|^anchor] [--no-commit] TITLE...`

`--date` accepts `YYYY-MM-DD` or a datetime (`YYYY-MM-DDTHH:MM` / `…:SS`; a space
instead of `T` is fine).

Capture under a parent node: default top-level `Inbox` (created if missing), or
`--parent ^anchor` / `--parent TITLE`. Writes **outline** syntax only. TITLE
words join with spaces (no shell quoting required).

- Validates by re-loading after write; on failure restores the prior file.
- If the file's directory is a git work tree, auto-commits that file with
  message `capture: TITLE` unless `--no-commit`.
- Never prompts; never opens an editor.

Plain:

```
$ selfflowy add --no-commit buy oat milk
added "buy oat milk" under Inbox in .../Tasks.rkt (line 12)
```

JSON stdout:

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

## `done [--json] [--file F] [--undo] [--no-commit] TITLE...|^anchor`

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

Plain:

```
$ selfflowy done --no-commit Buy milk
done "Buy milk" in .../Tasks.rkt (line 5)
```

JSON stdout:

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

## `move [--json] [--file F] [--no-commit] [--clear] TITLE...|^anchor DATE`

Set or rewrite `@date` on a task (same write-safety as `add`/`done`). `DATE`
is ISO date or datetime. `--clear` removes `@date` instead (no DATE arg).
Auto-commit message: `move: TITLE -> DATE` (or cleared).

```json
{"version":1,"ok":true,"file":"...","title":"Buy milk","line":6,"date":"2026-08-10","committed":false}
```

With `--clear`, `date` is `null`. `title` is always the node's resolved title,
never the raw `^anchor` you passed.

## `ics [--out PATH] [file ...]`

RFC 5545 `VCALENDAR` of all dated tasks (done included). Minimal writer —
no catalog ics package. UID is `anchor@selfflowy` when present, else a
stable hash of path/title/date. `DTSTART` is `VALUE=DATE` or local datetime.

## `daily [--json] [--date YYYY-MM-DD] [--home DIR] [--no-commit]`

Ensure a day node exists in the personal Daily structure under `$SELFFLOWY_HOME`
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

## Errors (`--json`)

Single object on **stderr**, exit non-zero:

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

`line` / `col` / `file` are `null` when not applicable. Agents must not regex
pretty-printed messages.

## Stability

- Top-level objects always include `"version": 1`.
- Within v1, new keys may appear; existing keys keep meaning and type.
- Removing or renaming a key requires a version bump.

## Nix build note

Runtime deps (`gregor`, `markdown`) and nixpkgs are pinned with **npins**
(`npins/sources.json`). `nix build` is fully offline/sandboxed.
