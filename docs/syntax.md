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
| Include glob | `@include RELATIVE/DIR/*.rkt` — one line where a line per file used to be. `*` matches any run of characters inside **one file name**; the directory part is literal. Matches splice flat, in lexicographic order, like that many literal lines. No matches is an empty splice; a directory that is not there is an error. See [Globs](#globs). |
| Document | Indented `@doc RELATIVE/PATH.md` → `#:doc`. The node expands into that file (see [Documents](#documents-doc)). Extension must be `.md` or `.scrbl`; the file must exist. Path relative to the **defining** file. |
| Done | Indented `@done` or `@done …` → `#:done` / `#:done` timestamp. Bare means completed (`#t`); with a value, same ISO forms as `@date`. On a node with task children it is a claim about the node itself and may not contradict them — see [Derived state](#derived-state). |
| Doing | Indented `@doing` or `@doing …` → `#:doing` / `#:doing` timestamp. The third state, between open and done: same rules as `@done`, one node cannot be both. |
| Checkbox sugar | Title prefix `[x] ` / `[X] ` desugars to bare `@done`, `[/] ` to bare `@doing` (prefix **not** part of the title). `[ ] ` is an explicit not-done marker (stripped, no-op). `[-] ` is **not** sugar — it stays part of the title, unclaimed for a future cancelled. Escape with `\` if the title should literally start with `[x] `. |
| At most once | A second `@date`, `@done`, `@doing` or `@doc` under one title is a reader error. `[x] ` counts as the node's `@done` and `[/] ` as its `@doing`, so checkbox **and** field on the same node is a duplicate. |
| One state | Done and doing exclude each other: `[x] ` with an `@doing`, `[/] ` with an `@done`, or both fields, is an expander error at the offending mark's `file:line:col`. |
| Escape | Line starting with `\` (after indent) is a title beginning with the rest. It turns off **all** line sugar for that line — checkbox, mirror, trailing `^anchor` — so titles may start with `:`, `@`, `*`, `[x] `, or `\` and may end in `^word`. |
| Blank lines | Insignificant. |
| Inline `#tags` | In titles: `#` + `[A-Za-z0-9_-]+`. Title stays verbatim; expander fills `task-tags` (no `#`, first-seen order, deduped). Works for both langs. |
| Anchor | Title-trailing `^anchor` (`[A-Za-z0-9_-]+`). Stripped from the stored title; becomes `#:id`. Unique across the whole loaded **set**, `@include` fragments and sibling files included. |
| Mirror | Line that is only `*anchor` → `(mirror "anchor")`. Same node as the `^anchor` declaration (DAG, not a copy), in whichever loaded file declares it. Escape with `\` if a title should start with `*`. |
| Typed edge | Indented `@after ^x` / `@blocks ^y` / `@see ^z` → an edge to that anchor. **Any number** per node, unlike every field above. The `^` is required. See [Typed edges](#typed-edges). |

### Derived state

**A parent does not store what its children already say.** A node with task
children and no mark of its own is **done when all of them are**, computed
every time anybody asks — the agenda, the web view, `tree` JSON, the typed-edge
graph. Nothing writes it down, so it cannot go stale.

```racket
#lang olai

0.5 the write path            ; derives DONE — every child is
  [x] ratify the form
  [x] wire the route
0.6 the command palette       ; derives OPEN — one child is not
  [x] the search index
  the palette itself
```

The rules, in the order they are asked:

- **A mark wins.** A parent may have a completion criterion its children know
  nothing about ("and then ship it"), and `@done` / `[x] ` on it is how you say
  so. What is stored is the answer.
- **No task children, no derivation.** A leaf is exactly what it wrote, as
  before. So is a parent whose only children are `:` notes, a `@doc`, or a
  `*mirror`.
- **All task children done ⇒ done.** Recursively: a child that itself derives
  done counts as done.
- **Anything else ⇒ open.** Mixed done and open is open. Half a list is not a
  state of its own.
- **`[/] ` is never derived.** A parent of an in-flight child is *open*, not
  doing. Being in flight is a claim about somebody's attention (who and where
  live in the node's notes), not a fact about what a node contains — and it
  would propagate to the root, so the file's own top node would read as work in
  progress the moment anyone started anything, and land there in the agenda's
  `doing` group, which ignores dates. The child is already in that group, under
  a breadcrumb that names its parents. Write `@doing` on the parent if you mean
  it.
- **A `*mirror` child derives nothing.** A mirror is a reference, resolvable
  only once the whole set is in hand; counting one would make a module answer
  this question differently at compile time than the linker does. Containment
  is what the tree says, and containment is what a state is derived from.
- **An `@include` splices real children in**, and they count like any others:
  a month node above a fragment of finished days derives done.

The one thing the checker adds: **a stored `@done` may not sit above unfinished
work.** Same message from every entry point (compile time, after the splice,
the linker), at the `file:line:col` of the parent that stored the mark:

```text
T.rkt:4:2: @done: marked done above unfinished work: "pick tiles" is open; drop @done / [x] and done-ness derives from the children, or finish them
```

There is no matching rule for `@doing`: a parent may be in flight above
anything at all.

Writing a state that would be derived is refused rather than stored — `olai
done` on such a parent names the unfinished children instead of marking them
(see [docs/cli.md](cli.md)). `tree` JSON says which kind of answer a node's
`status` is, in `status_source`.

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

- `@layout` and other `@` fields beyond `@date` / `@done` / `@doing` / `@doc` / `@include` / `@after` / `@blocks` / `@see`
- `.scrbl` **rendering**. The extension is in the language and the path is in the JSON; the web view names the file and says it does not draw one yet (see [Documents](#documents-doc))
- `[-] ` as cancelled — the spelling is left unclaimed, but nothing reads it yet
- UI state in the outline file, or in a sidecar next to it. Collapse state is real but lives in the browser (`localStorage`, keyed by node); zoom is a URL (`/today`, `/n/<key>`). Nothing on disk records either.
- Check-off from the web view — it renders a static checkbox, and done already renders checked/dimmed. Structure edits go through the CLI or your editor.
- Live push: the page loads the htmx SSE extension but the server opens no event stream yet; edits show up on the next request.

Unknown `@field` is a **reader error** today (names the known fields: `@date`, `@done`, `@doing`, `@doc`, `@include`, `@after`, `@blocks`, `@see`).

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

`@include` / `(include "path")` is **require + splice**, not textual paste. The included file is a normal `#lang olai` module; its top-level tasks appear in place of the include line. Anchors/mirrors resolve across the whole loaded set, fragments included; duplicate `^id` names both files. Each task records its defining file (`task-file`); writes (`done` / `move` / `add --parent ^anchor`) edit that file, not the root. Node identity (`key` in the JSON) is minted from that defining file too, so a node keys the same through any root that includes it, and two roots sharing a fragment agree about it. The file is named relative to the common directory of the loaded set, so loading a fragment as its own root re-bases that name and re-keys its nodes — see [docs/cli.md](cli.md).

#### Globs

`@include Daily/*.rkt` is the same include with the file names left to the
directory: one line instead of one per month.

```racket
#lang olai

Daily notes ^daily
2026
  @include Daily/2026-*.rkt
2027
  @include Daily/2027-*.rkt
```

- **`*` stars a file name, never a path.** The directory part is literal, so a
  pattern names exactly one directory. `**`, `?`, `[...]` and `{...}` are
  errors naming themselves — the grammar is closed, and a shell's spellings
  are not quietly taken as literal characters. (A path with **no** `*` in it
  is a file name, brackets and all: `@include odd[1].rkt` is a literal
  include of a file with that name.)
- **The set is expanded once per load**, at compile time, so the module graph
  is static while a tree is being built. Nothing re-reads a directory
  mid-splice.
- **Matches splice flat, in lexicographic order**, exactly where the line sits
  — the same as that many literal `@include` lines in that order. Date-named
  fragments (`2026-01.rkt`, `2026-02.rkt`, …) therefore sort by date for free.
  Structure comes from the including file's own nodes, as above; a glob adds
  none.
- **No matches is an empty splice, not an error.** A pattern is a query, and
  the empty answer is a legal one: `Daily/2027-*.rkt` on the first of January
  names the files that year is about to have, and an outline that would not
  load until one existed is an outline that breaks every New Year's Day.
- **A directory that is not there IS an error**, with the `file:line:col` of
  the include. The directory part is literal, so it is a claim the same way a
  literal `@include`'s file name is one; a typo in it must not read as
  "matched nothing".
- **A leading dot is not matched**, as in a shell. `.#2026-01.rkt` — the lock
  file Emacs leaves beside a file being edited, and a dangling symlink — would
  otherwise break an outline nobody had touched.
- **A new match while `olai serve` is running is picked up.** The pattern is
  re-asked on every staleness check and the directory it reads is watched, so
  the first fragment of a new month joins every open page without a restart.
  This is the one thing in the module graph that can move without any file the
  server already read being touched.

- **A pattern that covers a fragment is the include.** `olai daily` writes a
  literal `@include Daily/YYYY-MM.rkt` into `Daily.rkt` — unless a pattern
  already there names that file, in which case it writes the fragment and
  leaves the root alone. Two includes of one file are that file spliced twice
  ([docs/cli.md](cli.md#daily---date-yyyy-mm-dd---home-dir---no-commit)).

`olai check`'s `includes` lists the files a glob matched, one entry each — a
glob is not visible downstream, only its answer is.

### Mirrors

A mirror is the **same node**, not a copy: shared title/fields/children. One node, multiple parents (DAG).

Scope is the **loaded set** — every file you named, plus everything they `@include`. So `*meeting-prep` in `Daily.rkt` finds the `^meeting-prep` that `Tasks.rkt` declares, as long as both are loaded (`olai tree Tasks.rkt Daily.rkt`, `olai serve DIR`, `just check`). It cannot reach a file that is not in the set — that is an unknown-anchor error, not a link — so checking ONE file of a linked pair reports the mirror it cannot resolve. Load the files you always load.

Three phases, one checker (`lang/graph`), same rules and same messages:

| Phase | Sees | Checks |
|---|---|---|
| compile time (no `@include`) | one module's syntax | duplicate, cycle |
| after the splice | one root's whole tree | duplicate, cycle |
| **the linker** (`lang/link`), once per load of a set | every file at once | duplicate, cycle, **unknown** |

"Unknown" is the linker's alone: a module cannot know which files it will be loaded beside, so an unresolved `*id` is not yet wrong when the module compiles. That is also what lets the write path validate one file at a time (`add` / `done` / `move` re-load the file they wrote) while the anchor it mirrors lives in another.

- Duplicate `^id` → error at the second declaration, naming the first (`file:line:col`, in whichever file it is).
- Unknown `*id` → error at the mirror site, listing the anchors the set does have, and naming the near miss: `unknown *meting-prep; anchors in the loaded set: agent, meeting-prep; did you mean *meeting-prep?`
- Cycle (direct, via other anchors, or through another file) → error with path, e.g. `agent -> week -> agent`.

The repo's own demo is `examples/Week.rkt`, whose `*agent` is the node `examples/Example.rkt` declares — `just check` and `just serve` load both, and `olai check examples/Week.rkt` on its own is the error above.

JSON tree sites emit `{"mirror":"id"}` (never inline the subtree). The top-level `anchors` object is the **set's** index — each anchored node once, with the `file` that defines it when the set has more than one root. Agenda counts a dated node once, at its defining breadcrumb, however many files mirror it. Writes go to the defining file: `olai done '^meeting-prep' --file Daily.rkt` edits `Tasks.rkt` (see [docs/cli.md](cli.md)). Web view: the defining site gets `id="anchor"` (a target a hand-written `#anchor` in a note still reaches); mirror sites render with a ↗ link to the node's own page, `/n/<key>`, and follow an edit to the file that defines the node. The arrow is not a fragment: a mirror is usually drawn on a page the defining site is not on at all — every zoom, and every file that only names the anchor — so a `#anchor` there is a click that does nothing.

### Typed edges

The tree says one thing: what CONTAINS what. Order, dependency and
cross-reference are said with edges, which are grammar and therefore checked:

```racket
#lang olai

kitchen remodel #project
  [x] demo the old cabinets ^demo
  order the new ones ^order
  install ^install
    @after ^order
    @after ^demo
  paint
    @after ^install
    @see ^colour
  pick a colour ^colour
  clear the driveway
    @blocks ^order
```

Three relations, and the set is **closed** — a fourth is a human-ratified
change to the language, not a field you may invent:

| Written | Means |
|---|---|
| `@after ^x` | this node is not actionable until `^x` is done — **ordering** |
| `@blocks ^y` | the same fact from the other end: `^y` is after this node |
| `@see ^z` | a plain cross-reference. No ordering, no blocking, no semantics |

- **An edge never moves a node.** The tree stays the spanning structure: every
  node has exactly one defining site, and an edge points at one.
- **`@blocks` is a spelling, not a second relation.** `a @blocks b` derives to
  `b after a`, so the graph has one ordering relation to check and sort and the
  two spellings cannot disagree. The file keeps whichever direction its writer
  thought in, and `tree` JSON keeps it on the node — the normalized form is the
  set's `edges` index (see [docs/cli.md](cli.md)).
- **`@after` is ordering, never scheduling.** It says nothing about a date. A
  blocked node with a due date is overdue *and* blocked, and the agenda says
  both.
- **A done node is waiting on nothing.** Being blocked is a fact about what you
  can start; a node that is finished has started. So a `@done` node never reads
  as blocked, whatever its `@after` target says.
- **An archived node neither blocks nor is blocked.** Work put away in
  `Archive.rkt` is out of every live view, both ways round: it is not told it
  cannot start (there is a page that draws it, and a pill there would be
  nonsense), and it stops standing in anyone's way — archiving is what you do
  to work that is over, so a live node still waiting on one would wait forever.
  The **checker** gets no such exemption: an ordering that runs in a circle is
  wrong wherever its nodes live, so a cycle through the archive is still an
  error.
- **One done predicate, and this is it.** A target counts as done when [its
  state says so](#derived-state) — stored (`@done`, `[x] `) or derived, and the
  graph cannot tell which. So a statusless parent whose children are all done
  stops blocking what comes after it, which is the point: the thing you were
  waiting for has happened. What still blocks is a parent that says it is not
  finished — an `@doing` one, or any parent with a child that is not done.
  (Superseded: before derived state, done-ness was only ever stored, and a
  parent of all-done children kept blocking. That call now reaches only the
  parents that write a state of their own.)
- **Scope is the loaded set**, exactly like a mirror's: `@after ^serve` reaches
  the `^serve` any loaded file declares, and one that reaches nothing is an
  error at the edge — which is the linker's rule alone, so a module still
  compiles on its own (see [Mirrors](#mirrors)).
- **Mirrors are not edges.** A mirror is identity — the same node, shown twice
  — not a relation, so it stays out of this grammar. It joins the *reverse*
  index as one more kind of thing pointing at a node.

Two rules, both reported at the `file:line:col` of the offending line:

```text
T.rkt:3:2: @after: unknown ^ordr; anchors in the loaded set: demo, install, order; did you mean ^order?
T.rkt:3:2: @after: cycle in @after: ^install -> ^order -> ^install; @after must be acyclic
```

Acyclicity is **per relation**: `@after` may not run in a circle (a node cannot
be after itself, however long the way round), while `@see` cycles are fine —
two notes may point at each other all day. A node may carry any number of
edges, and the same node may be written `@after` twice.

The repo's demo is `examples/Kitchen.rkt`.

## `#lang olai/sexp` — s-expression core

The underlying form the expander sees. Useful for tests and for agents that prefer sexps.

```racket
#lang olai/sexp

(t "Inbox #capture"
   #:description "landing"
   (t "Buy milk" #:date "2026-01-15")
   (t "Agent work" #:id "agent")
   (t "This week" (mirror "agent"))
   (t "Wiring it" #:doing #:after "agent")
   (t "Shipped" #:done "2026-08-03"))
```

Keywords `#:id`, `#:date`, `#:doc`, `#:description`, `#:done` and `#:doing` are optional, any order, at most once each. `#:done` / `#:doing` may be bare or take an ISO date/datetime, and a node may carry at most one of the two. `#:after`, `#:blocks` and `#:see` are the [typed edges](#typed-edges) — same three relations, any number of them, and the anchor is a bare string here (the `^` is the outline surface's sigil, like `*` for a mirror). Children are `(t ...)`, `(mirror "anchor")`, or `(include "relative/path.rkt")` — closed grammar, same three forms allowed at top level. `include` takes a [glob](#globs) here too (`(include "Daily/*.rkt")`): one surface syntax does not get language the other does not. Module exports `tasks`, `anchors` (hash id → task), `includes` (absolute paths spliced in) and `include-globs` (the absolute patterns that found them, empty unless a glob was written).
