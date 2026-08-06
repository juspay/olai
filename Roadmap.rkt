#lang olai

olai roadmap #project
  : Weekend-sized phases; every phase leaves the tool usable.
  : git log is the real changelog.
  Done
    : Landed, pushed, verified.
    [x] 0.1 the language
      : The s-exp core, then the quoteless outline syntax took the flagship
      : name (olai/sexp keeps the old form). Strict 2-space indent,
      : verbatim titles, ": " notes, @date fields, inline #tags, closed
      : grammar, srcloc'd errors agents can act on.
    [x] 0.2a dates
      : @date with ISO date or datetime (gregor); `olai agenda` groups
      : overdue / today / upcoming.
    [x] 0.3 capture
      : `olai add` appends under Inbox, re-validates before keeping the
      : write, auto-commits. Bind it to a hotkey.
    [x] agent-first CLI
      : Agents are the primary users: --json everywhere (version key,
      : append-only fields), exit-code contract, errors as JSON. docs/cli.md
      : is the contract. Multi-file paths; merged agenda.
    [x] html view
      : `olai html` — Tailwind + details/summary, Markdown in titles and
      : notes (render-time only). Terminal renderer retired; tree is JSON-only.
      : (Superseded: the html command died when `olai serve` arrived.)
    [x] done status
      : `@done` / `[x]` sugar, `#:done` in the core, agenda exclusion, checked
      : HTML rendering, `olai done TITLE` with add-style write safety.
    [x] 0.2b.1 mirrors (in-file)
      : ^anchor / *anchor; #:id + (mirror); cycle rejection; JSON mirror refs +
      : anchors index; agenda dedupe; html permalinks; done/add accept ^anchor.
    [x] @include composition + daily rollover
      : @include require+splice; Daily/YYYY-MM.rkt fragments; olai daily; write-path routes to defining file.
    [x] 0.8 calendar
      : Agenda, month grid in html (links to Daily day nodes), move, ics.
      : (Grid view later retired with the html command; query/move/ics live.)
    [x] 0.7 PWA
      : Installable web view: manifest, palm-leaf icons, theme-color, mobile
      : chrome (safe-area, touch targets). No offline shell — live-or-nothing.
    [x] 0.4 the agent ^web-agent
      : Minimal HTTP server with a chat panel driving Claude Code over ACP,
      : plus the outline served live. Talk to your outline from any browser.
      [x] WP1 serve skeleton
        : `olai serve` + routes (/, /api/tree, /api/agenda, /static/*);
        : nix run; just run/watch. Byte-identical JSON to the CLI.
      [x] WP4 ACP bridge
        : Spawn claude-agent-acp subprocess (bypass-permissions), stdio
        : JSON-RPC, session lifecycle, chat SSE events, fake-agent tests.
      [x] WP5 chat panel
        : Panel fragment, POST /chat, streamed text + tool-call lines.
      [x] WP6 integration
        : Final wiring, headless CI smoke (boot, curl, file-change, SSE).
  web app
    : The daily surface.
    0.5 the outline ^web-outline
      : Real read-mostly web view: collapse, zoom, breadcrumbs; SSE pushes
      : updates when files change (agent edits appear live).
      [x] WP2 renderers + skin
        : render.rkt fragment functions; Workflowy-faithful CSS (no
        : Tailwind); vendored htmx+sse; localStorage collapse.
      WP2.5 review fixes
        : Dual-lens (Hickey/Lowy) review output, adjudicated.
        @done 2026-08-04
        store layer
          : Snapshot + fresh-namespace reload; last-good + error banner;
          : include set for the watcher; derived index cached.
          @done 2026-08-04
        stable node keys
          : task-key from anchor or file+ordinal -- rename-safe permalinks,
          : collapse state, swap targets; no sibling collisions.
          @done 2026-08-04
        shared write path
          : apply-outline-edit! safe in a persistent server; CLI + web.
          @done 2026-08-04
        seams & dedup
          : /today route (fixes 404), render-file-section, today required,
          : collapse.js static, one owner for ids/assets/palette/tags.
          @done 2026-08-04
      [x] WP3 SSE + watcher
        : /events hub; filesystem-change-evt debounce; outline-changed
        : fragment re-swaps; midnight re-render.
      WP7 zoom + breadcrumbs
        : Per-node zoom route keyed by task-key (render-zoom exists, wired
        : only to /today); breadcrumbs from the ancestor path; node
        : permalinks point at the zoom instead of home.
    0.6 micro-edits
      : Capture box + check-off from the browser (done status already in the
      : language + CLI). The phone loop closes: capture, complete, ask the
      : agent for everything else.
    0.9 search
      : Text search + keyboard nav in the web view.
  language
    : The grammar grows; the expander stays the only validator.
    0.2b.2 cross-file mirrors
      : Link anchors across outline files (not yet).
    typed edges
      : The graph beyond containment (the Tend thesis). Tree stays the
      : spanning structure -- every node has one defining site; any other
      : relation is a typed reference to an anchor: `@after ^x`,
      : `@blocks ^y`, `@see ^z`. The linker resolves triples
      : (relation source-key target-key), rejects dangling refs with
      : srclocs, and enforces acyclicity PER RELATION (after: yes, with
      : cycle-path errors; see: cycles are fine). Store snapshot carries
      : per-relation adjacency + topo caches; queries are pure functions
      : (blocked = unfinished @after targets; project = reachable
      : subgraph). JSON gains an edges index beside anchors. Rides on the
      : 0.2b.2 linker; task-key is the node identity.
    glob includes
      : `@include Daily/*.rkt` -- one line instead of a line per month.
      : The sugar has to answer: match order (lexicographic; date-named
      : fragments sort right), zero matches (empty or error?), and flat
      : splice vs structure (Daily.rkt's year > month nesting comes from
      : the index file's own nodes; a flat glob erases it). Mechanically
      : easy: the reader expands the glob at read time, the module graph
      : stays static per load, the watcher already re-reads the include
      : set.
    doing status
      : A third state between open and done: `[~]` title sugar + `@doing`
      : field (#:doing in the core), same desugar rules as [x]/@done.
      : Rendered distinctly (pulsing/slanted pill); agenda gains a DOING
      : group above TODAY; `olai doing TITLE|^anchor` flips it with
      : the usual write safety; done clears doing. Would have replaced the
      : "In progress" prose notes this roadmap has been faking.
    \@doc documents
      : Expand a node into a full document: a @doc field attaches a file,
      : rendered inline when the node is zoomed; one-line preview collapsed.
      : Two tiers by extension: .md (default; agents are fluent) and .scrbl
      : (Scribble for code-heavy power docs — real sections, highlighted code,
      : cross-refs). Documents stay files: greppable, diffable, editable by
      : $EDITOR and agents, includable elsewhere.
  codebase
    : The repo's own shape and workflow.
    refactor pass ^pre-squash
      : Structural cleanups batched together, done just prior to squashing
      : master into one root commit.
      core review fixes
        : Adjudicated dual-lens pass over lang/ + core: keys minted per
        : DEFINING file in the load layer (entry-point independent); one
        : line-grammar owner consumed by all mutators; one metadata-edit
        : engine + one TITLE|^anchor resolver + ops layer (CLI = shell);
        : core->web edge cut (file-label); one graph checker with srclocs
        : kept under @include; one fold-tasks walker; single owners for
        : counts/ics envelope. Then: status derivation, JSON version split,
        : keyword task constructor.
        @done 2026-08-04
      contracts at the seams
        : Make contract-out the policy for module boundaries (store, outline
        : struct, render exports, apply-outline-edit!): blame-assigned,
        : srcloc'd runtime errors agents can act on. Typed Racket at most
        : for pure leaf modules, never lang/. CLAUDE.md one-liner on adopt.
        @done 2026-08-04
      mirror resolution out of the render walk
        : A resolve pass outside web/ producing already-bound nodes (plus
        : mirror-of markers); render just draws. Deferred from the
        : dual-lens review; also what 0.2b.2 cross-file mirrors needs.
        @done 2026-08-04
      shrink the CLI
        : Once the web app is the daily surface, retire the human-facing
        : CLI commands; the CLI remains as the agent tool surface and
        : write-safety layer.
        @done 2026-08-05
    architecture as data
      : Half-mechanize the Hickey/Lowy lenses: each module carries an `arch`
      : submodule declaring its volatility clock and owned ambient
      : authorities (wall-clock, filesystem, subprocess); a ~100-line raco
      : check walks module->imports and enforces (a) dependencies point
      : volatile -> stable only, (b) authorities used only where owned,
      : (c) declared concept exclusivity on tagged exports. CI-run. Bonus:
      : diff declared clocks against git-churn and flag lies. "The expander
      : is the only validator", applied to the codebase's own shape. Human/
      : agent review shifts to auditing declarations and naming new
      : concepts. Only worth the CHECKED subset -- declarations rot like
      : comments otherwise.
