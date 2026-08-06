# olai syntax

Two surface syntaxes share one expander (the validator).

## `#lang olai` — outline (default)

Workflowy-shaped, quoteless titles. The reader translates to `(t ...)` forms; the expander does not know which surface you used.

```racket
#lang olai

olai roadmap #project
  0.4 the agent
    : Minimal HTTP server whose only page is a chat panel
    : driving Claude Code over ACP. Ugly on purpose.
    @date 2026-08-15T09:30
  [/] Wire the third state
    : in progress; who and where live in notes, not grammar
  Buy milk — don't quote me; 2% "raw" milk is fine
```

### Implemented

| Feature | Rule |
|---|---|
| Title | Any non-blank line that is not `#lang`, metadata (`:`/`@`), a mirror, or an include — stored **verbatim** minus its sugar. Escape with `\` to keep a line that starts like one of those. |
| Nesting | Exactly **2 spaces** per level. Tabs forbidden. Indent may increase by at most one level. |
| Description | Indented continuation `: text` — colon **and space**; a bare `:` or `:text` is a reader error. Multiple `: ` lines join with `\n` into one `#:description`. |
| Date/time | Indented `@date …` → `#:date`. Accepts `YYYY-MM-DD` or datetime `YYYY-MM-DDTHH:MM[:SS]` (space instead of `T` ok; normalized to `T`). Validated by gregor in the expander. |
| Include | `@include RELATIVE/PATH.rkt` at a title position → `(include "…")`. Require+splice of the fragment's **top-level** tasks (no redundant root in the fragment). Path relative to the including file. Cycles rejected. |
| Document | Indented `@doc RELATIVE/PATH.md` → `#:doc`. The node expands into that file (see [Documents](#documents-doc)). Extension must be `.md` or `.scrbl`; the file must exist. Path relative to the **defining** file. |
| Done | Indented `@done` or `@done …` → `#:done` / `#:done` timestamp. Bare means completed (`#t`); with a value, same ISO forms as `@date`. |
| Doing | Indented `@doing` or `@doing …` → `#:doing` / `#:doing` timestamp. The third state, between open and done: same rules as `@done`, one node cannot be both. |
| Checkbox sugar | Title prefix `[x] ` / `[X] ` desugars to bare `@done`, `[/] ` to bare `@doing` (prefix **not** part of the title). `[ ] ` is an explicit not-done marker (stripped, no-op). `[-] ` is **not** sugar — it stays part of the title, unclaimed for a future cancelled. Escape with `\` if the title should literally start with `[x] `. |
| At most once | A second `@date`, `@done`, `@doing` or `@doc` under one title is a reader error. `[x] ` counts as the node's `@done` and `[/] ` as its `@doing`, so checkbox **and** field on the same node is a duplicate. |
| One state | Done and doing exclude each other: `[x] ` with an `@doing`, `[/] ` with an `@done`, or both fields, is an expander error at the offending mark's `file:line:col`. |
| Escape | Line starting with `\` (after indent) is a title beginning with the rest. It turns off **all** line sugar for that line — checkbox, mirror, trailing `^anchor` — so titles may start with `:`, `@`, `*`, `[x] `, or `\` and may end in `^word`. |
| Blank lines | Insignificant. |
| Inline `#tags` | In titles: `#` + `[A-Za-z0-9_-]+`. Title stays verbatim; expander fills `task-tags` (no `#`, first-seen order, deduped). Works for both langs. |
| Anchor | Title-trailing `^anchor` (`[A-Za-z0-9_-]+`). Stripped from the stored title; becomes `#:id`. Unique across the whole loaded tree, `@include` fragments included. |
| Mirror | Line that is only `*anchor` → `(mirror "anchor")`. Same node as the `^anchor` declaration (DAG, not a copy). Escape with `\` if a title should start with `*`. |

### Inline formatting (Markdown)

Formatting is **interpretation at render time**, not data. The reader, expander, task struct, and CLI write path leave strings **verbatim**. Only the web view (`olai serve`) parses Markdown, via the `markdown` package → xexprs → sanitizer. `tree` / `check` / `agenda` JSON never do.

| Surface | Markdown scope |
|---|---|
| **Title** | Inline only: bold, italic, code spans, links. Block syntax is text in a title — a leading `#tag`, `- `, `> ` or `1. ` renders verbatim, pill and all. |
| **Notes** (`: ` lines, joined with `\n`) | Full document Markdown, including fenced code blocks. |

#### Ambiguity rules

- `#word` is a **tag** in the data, always: `task-tags` comes from a regexp over the verbatim title, so the JSON is right no matter what the line looks like.
- Rendering agrees: a title is parsed **inline-only**, so a line-initial block marker is text. `#tag first` keeps its pill, `- not a list` is not a list, `> quoted` is not a blockquote. (Notes are the opposite — full document Markdown, blocks included.)
- Tags are pilled in text nodes after the Markdown parse, **except inside `` `code` `` spans** (code wins — a `#tag` inside backticks stays plain code text).
- Mirror sigil `*anchor` is **line-initial** on its own outline line, so it does not collide with inline `*italic*`.
- Raw HTML in titles/notes is **not** trusted: unknown tags are stripped after parse (no `<script>` injection).

#### Designed, not implemented

- `@layout code` — whole node rendered as a code block
- Strikethrough (`~~x~~`) — not in the default `markdown` package grammar we use; `~~x~~` renders literally. Do not invent it yet.

### Not implemented (designed, deferred)

Mark these clearly so agents do not invent them:

- `@layout` and other `@` fields beyond `@date` / `@done` / `@doing` / `@doc` / `@include`
- `.scrbl` **rendering**. The extension is in the language and the path is in the JSON; the web view names the file and says it does not draw one yet (see [Documents](#documents-doc))
- `[-] ` as cancelled — the spelling is left unclaimed, but nothing reads it yet
- UI state in the outline file, or in a sidecar next to it. Collapse state is real but lives in the browser (`localStorage`, keyed by node); zoom is a URL (`/today`, `/#n-<key>`). Nothing on disk records either.
- Check-off from the web view — it renders a static checkbox, and done already renders checked/dimmed. Structure edits go through the CLI or your editor.
- Live push: the page loads the htmx SSE extension but the server opens no event stream yet; edits show up on the next request.

Unknown `@field` is a **reader error** today (names the known fields: `@date`, `@done`, `@doing`, `@doc`, `@include`).

### Documents (`@doc`)

Some nodes are not a line. `@doc` attaches a **file** to one, and the node
expands into it:

```racket
#lang olai

Agent work ^agent
  : one line here, the rest in the file
  @doc docs/agent-work.md
```

- **Two extensions and no third**: `.md` (the default — agents are fluent, and
  the view already parses Markdown for titles and notes) and `.scrbl` (Scribble,
  for a code-heavy document that wants real sections and cross-references).
  Anything else is a checker error naming the set.
- **The file has to be there.** The language checks existence, exactly the way
  `@include` does: a path that resolves to nothing is not a document with a
  problem, it is a form that is wrong, and `olai check` is where an agent hears
  about it — with the `file:line:col` of the path it wrote.
- **Relative to the DEFINING file**, like `@include` — and relative is a rule,
  not a convention: an absolute path is a checker error. A fragment spliced
  into two roots names the same document from either one.
- **Documents stay files.** The string in the outline is data and is what `tree`
  JSON carries (`"doc"`); nothing renders into the JSON. `grep`, `git diff` and
  `$EDITOR` go on working, and the same file can be included elsewhere.
- **Web view**: zoomed (`/n/<key>`), the document is drawn inline below the
  node — Markdown at render time, same as a note. Anywhere else the node shows
  one line of it: the file's name, linking to that page, and the document's
  first line as plain text. A `.scrbl` is named and not drawn; a Scribble
  document is a Racket module, and expanding one inside the server while a
  request is open is a decision with a blast radius rather than a renderer
  detail.
- Editing a document redraws every open page: documents join the watch set
  beside the `@include` fragments.

### Includes (file composition)

`@include` / `(include "path")` is **require + splice**, not textual paste. The included file is a normal `#lang olai` module; its top-level tasks appear in place of the include line. Anchors/mirrors resolve across the whole tree; duplicate `^id` names both files. Each task records its defining file (`task-file`); writes (`done` / `move` / `add --parent ^anchor`) edit that file, not the root. Node identity (`key` in the JSON) is minted from that defining file too, so a node keys the same through any root that includes it, and two roots sharing a fragment agree about it. The file is named relative to the common directory of the loaded set, so loading a fragment as its own root re-bases that name and re-keys its nodes — see [docs/cli.md](cli.md).

### Mirrors

A mirror is the **same node**, not a copy: shared title/fields/children. One node, multiple parents (DAG). Scope is the **loaded tree**: `*id` reaches an `^id` in the same file, or in any fragment that file `@include`s. It cannot reach a file nobody included — that is an unknown-anchor error, not a link.

Validation happens at compile time when the file has no `@include` (the expander can see the whole tree), and right after the splice otherwise; the checks and the messages are the same either way:

- Duplicate `^id` → error, naming the first declaration (line, or the other file's name once fragments are involved).
- Unknown `*id` → error, listing the anchors that do exist.
- Cycle (direct or via other anchors) → error with path, e.g. `agent -> week -> agent`.

JSON tree sites emit `{"mirror":"id"}` (never inline the subtree). An `anchors` object holds each anchored node once. Agenda counts a dated node once (defining breadcrumb). Web view: the defining site gets `id="anchor"`; mirror sites render with a ↗ link to `#anchor`.

## `#lang olai/sexp` — s-expression core

The underlying form the expander sees. Useful for tests and for agents that prefer sexps.

```racket
#lang olai/sexp

(t "Inbox #capture"
   #:description "landing"
   (t "Buy milk" #:date "2026-01-15")
   (t "Agent work" #:id "agent")
   (t "This week" (mirror "agent"))
   (t "Wiring it" #:doing)
   (t "Shipped" #:done "2026-08-03"))
```

Keywords `#:id`, `#:date`, `#:doc`, `#:description`, `#:done` and `#:doing` are optional, any order, at most once each. `#:done` / `#:doing` may be bare or take an ISO date/datetime, and a node may carry at most one of the two. Children are `(t ...)`, `(mirror "anchor")`, or `(include "relative/path.rkt")` — closed grammar, same three forms allowed at top level. Module exports `tasks`, `anchors` (hash id → task), and `includes` (absolute paths spliced in).
