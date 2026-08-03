# selfflowy syntax

Two surface syntaxes share one expander (the validator).

## `#lang selfflowy` — outline (default)

Workflowy-shaped, quoteless titles. The reader translates to `(t ...)` forms;
the expander does not know which surface you used.

```
#lang selfflowy

Selfflowy roadmap #project
  0.4 the agent
    : Minimal HTTP server whose only page is a chat panel
    : driving Claude Code over ACP. Ugly on purpose.
    @date 2026-08-15T09:30
  Buy milk — don't quote me; 2% "raw" milk is fine
```

### Implemented

| Feature | Rule |
|--------|------|
| Title | Non-blank line, **verbatim** (any characters). |
| Nesting | Exactly **2 spaces** per level. Tabs forbidden. Indent may increase by at most one level. |
| Description | Indented continuation `: text`. Multiple `: ` lines join with `\n` into one `#:description`. |
| Date/time | Indented `@date …` → `#:date`. Accepts `YYYY-MM-DD` or datetime `YYYY-MM-DDTHH:MM[:SS]` (space instead of `T` ok; normalized to `T`). Validated by gregor in the expander. |
| Escape | Line starting with `\` (after indent) is a title beginning with the rest (so titles may start with `:`, `@`, or `\`). |
| Blank lines | Insignificant. |
| Inline `#tags` | In titles: `#` + `[A-Za-z0-9_-]+`. Title stays verbatim; expander fills `task-tags` (no `#`, first-seen order, deduped). Works for both langs. |

### Inline formatting (Markdown)

Formatting is **interpretation at render time**, not data. The reader, expander,
task struct, and CLI write path leave strings **verbatim**. Only `selfflowy html`
parses Markdown (via the `markdown` package → xexprs).

| Surface | Markdown scope |
|--------|----------------|
| **Title** | Inline subset only: bold, italic, code spans, links. Block constructs never apply inside a title (no headings, lists, fenced blocks). |
| **Notes** (`: ` lines, joined with `\n`) | Full document Markdown, including fenced code blocks. |

**Ambiguity rules**

- `#word` is a **tag**, never an ATX heading. Block Markdown is not parsed in titles; tags are recognized in text nodes after Markdown parse, **except inside `` `code` `` spans** (code wins — a `#tag` inside backticks stays plain code text, not a pill).
- Future mirror sigil `*anchor` is **line-initial** on its own outline line, so it will not collide with inline `*italic*`.
- Raw HTML in titles/notes is **not** trusted: unknown tags are stripped after parse (no `<script>` injection).

**Designed, not implemented**

- `@layout code` — whole node rendered as a code block
- Strikethrough (`~~x~~`) — not in the default `markdown` package grammar we use; do not invent it yet

### Not implemented (designed, deferred)

Mark these clearly so agents do not invent them:

- `[x]` / `@done` — completion / check-off
- `^anchor` / `*anchor` — mirrors / references
- `@layout` and other `@` fields beyond `@date`
- Sidecar UI state (collapse, zoom, focus) — not in the outline file

Unknown `@field` is a **reader error** today (names the known fields).

## `#lang selfflowy/sexp` — s-expression core

The underlying form the expander sees. Useful for tests and for agents that
prefer sexps.

```
#lang selfflowy/sexp

(t "Inbox #capture"
   #:description "landing"
   (t "Buy milk" #:date "2026-01-15"))
```

Keywords `#:date` and `#:description` are optional, either order, at most once
each. Children must themselves be `(t ...)` forms (closed grammar).
