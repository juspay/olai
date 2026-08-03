# selfflowy CLI — agent contract

Agents are the primary users. Prefer `--json`. Fields within a `version` are
**append-only**; a bump of `version` is a breaking change.

**Human view is HTML** (`selfflowy html`). There is no ANSI terminal tree.
Agents use `tree` / `check` / `agenda --json`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | usage / bad flags / missing TITLE |
| 2 | validation or load error (bad outline, bad date, capture failed) |
| 3 | file not found |

Same codes for plain and `--json` modes.

## Global

- Default outline file when no paths given: `Tasks.rkt` in the cwd
  (`add` / `done` always target one file via `--file`, default `Tasks.rkt`).
- **Read commands** (`check` / `tree` / `agenda` / `html`) accept **one or more**
  outline paths. The justfile defaults to `Tasks.rkt examples/Roadmap.rkt`.
- `--json` may appear after the subcommand where supported.

## `check [--json] [file ...]`

Validate `#lang selfflowy` or `#lang selfflowy/sexp` module(s).

Plain — one ok-line per file; if any fail, all are reported then exit 2:

```
$ selfflowy check examples/Example.rkt examples/Roadmap.rkt
ok: .../Example.rkt (10 tasks)
ok: .../Roadmap.rkt (16 tasks)
```

JSON — **single file** keeps the historical shape:

```json
{"version":1,"ok":true,"file":".../Example.rkt","tasks":10}
```

**Multiple files**:

```json
{
  "version": 1,
  "ok": false,
  "files": [
    {"file":".../good.rkt","ok":true,"tasks":2},
    {"file":".../bad.rkt","ok":false,"error":{"file":"...","line":3,"col":2,"message":"..."}}
  ]
}
```

Top-level `ok` is false if any file failed. Per-file errors are in the array
(stdout), not only on stderr.

## `tree [--json] [file ...]`

**Always JSON** (the task forest). `--json` is accepted as a no-op for compat.
Humans should use `html`.

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
      "tags": ["capture"],
      "children": [ ... ]
    }
  ]
}
```

Multiple files:

```json
{
  "version": 1,
  "files": [
    {"file":".../Tasks.rkt","tasks":[...]},
    {"file":".../Roadmap.rkt","tasks":[...]}
  ]
}
```

`date` / `description` are raw strings or `null` (Markdown is not interpreted
here). `done` is `null` (open), `true` (completed, no timestamp), or an ISO
timestamp string. `tags` is always an array.

## `agenda [--json] [file ...]`

Dated tasks relative to local today, **merged across all given files**. **Done
tasks are excluded** even if they still have a `@date`. When more than one file
is given, breadcrumbs are rooted at each file's basename
(`Tasks.rkt > Inbox > Buy milk`). Plain mode is unstyled text. Empty groups
omitted in plain mode; JSON always includes all three arrays (possibly empty).

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

## `html [--out PATH] [file ...]`

Render an interactive HTML **tree** (nested lists; parents are
`<details>`/`<summary>` — click a node to expand/collapse). No `--json` —
HTML is the output format. Titles/notes use Markdown at render time only.
With multiple files, each file is a top-level section (`<h2>` = basename)
above its tree.

- Default: write the document to **stdout** (pipe-friendly).
- `--out PATH`: write a file and print the absolute path on stdout.

```
$ selfflowy html --out /tmp/all.html Tasks.rkt examples/Roadmap.rkt
/tmp/all.html
```

Exit codes same as other read commands (0 / 1 / 2 / 3).

## `add [--json] [--file F] [--date ISO] [--description TEXT] [--no-commit] TITLE...`

`--date` accepts `YYYY-MM-DD` or a datetime (`YYYY-MM-DDTHH:MM` / `…:SS`; a space
instead of `T` is fine).

Capture under a top-level `Inbox` node (created if missing). Writes **outline**
syntax only. TITLE words join with spaces (no shell quoting required).

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
  "line": 12,
  "created_inbox": false,
  "committed": false
}
```

## `done [--json] [--file F] [--undo] [--no-commit] TITLE...`

Mark a task done by exact title match (or undo). **One file only** (`--file`).
Writes **outline** syntax only — same safety as `add`: write temp → re-validate
→ rename; restore on failure.

- Exact title match across the file (checkbox prefix is not part of the title).
- **0 matches** → exit 2.
- **>1 matches** → exit 2; message lists each `file:line` so an agent can
  disambiguate (future: anchors).
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
