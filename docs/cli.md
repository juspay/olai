# selfflowy CLI — agent contract

Agents are the primary users. Prefer `--json`. Fields within a `version` are
**append-only**; a bump of `version` is a breaking change.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | usage / bad flags / missing TITLE |
| 2 | validation or load error (bad outline, bad date, capture failed) |
| 3 | file not found |

Same codes for plain and `--json` modes.

## Global

- Default outline file: `Tasks.rkt` in the cwd (except `add --file`).
- `--json` may appear after the subcommand for every command.

## `check [--json] [file]`

Validate a `#lang selfflowy` or `#lang selfflowy/sexp` module.

Plain:

```
$ selfflowy check examples/Example.rkt
ok: .../Example.rkt (8 tasks)
```

JSON stdout:

```json
{"version":1,"ok":true,"file":".../Example.rkt","tasks":8}
```

## `tree [--json] [file]`

Print the outline (unicode tree + dim descriptions on a TTY), or the full
task forest as JSON.

JSON stdout:

```json
{
  "version": 1,
  "file": ".../Example.rkt",
  "tasks": [
    {
      "title": "Inbox #capture",
      "date": null,
      "description": "Quick capture landing zone",
      "tags": ["capture"],
      "children": [ ... ]
    }
  ]
}
```

`date` / `description` are strings or `null`. `tags` is always an array.

## `agenda [--json] [file]`

Dated tasks relative to local today. Empty groups omitted in plain mode;
JSON always includes all three arrays (possibly empty).

Plain:

```
OVERDUE
  [2026-01-15]  Buy milk
         Inbox > Buy milk
```

JSON stdout:

```json
{
  "version": 1,
  "today": "2026-08-03",
  "overdue": [{"title":"...","date":"2026-01-15","breadcrumb":"..."}],
  "today_items": [],
  "upcoming": []
}
```

## `add [--json] [--file F] [--date YYYY-MM-DD] [--description TEXT] [--no-commit] TITLE...`

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
    "message": "expected YYYY-MM-DD date"
  }
}
```

`line` / `col` / `file` are `null` when not applicable. Agents must not regex
pretty-printed messages.

## Stability

- Top-level objects always include `"version": 1`.
- Within v1, new keys may appear; existing keys keep meaning and type.
- Removing or renaming a key requires a version bump.
