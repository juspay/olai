#lang olai

olai roadmap #project
  : Weekend-sized phases; every phase leaves the tool usable.
  : git log is the real changelog — done work is pruned from this file.
  web app
    : The daily surface.
    declare-and-check DSL
      @doc docs/brainstorming/live-dsl.md
      [/] live-dsl
        : One PR ([#33](https://github.com/juspay/olai/pull/33)): boot-UUID
        : connect URL (retires #:version, stale tabs get one reload
        : frame), define-stream / define-live-region / live-item + usage
        : forms expanding to live/client calls, tutor-format expansion
        : errors as tested contract, `just expand FILE`, counters
        : migrated as the worked example, blanket raw-htmx ban
        : (live/README.md + CLAUDE.md), and olai/web itself rewired
        : through the forms (human widened the scope; the orchestrator
        : had wrongly deferred that to a follow-up). Addenda folded in
        : mid-flight: always-visible health indicator (green live state);
        : the sidebar becomes a second live region on the outline
        : stream — fixing the stale-sidebar bug (titles updated in
        : #ol-live only; sidebar copies went stale until reload); and
        : render.rkt splits into one file per UI component, each
        : carrying its declarations and styles, so review reads one
        : surface per file like counters. Ratification round on the
        : agent's three (b)-proposals: stream-event RATIFIED; #:id on
        : define-live-region REJECTED (binding name = DOM id, olai's
        : class renamed); live-item skip REVERSED — n-<key> element ids
        : are not a contract (only ^anchors are permanent), so the form
        : is forced everywhere, routes and task-keys unchanged. In
        : flight: terminal 73729cfd, worktree live-dsl, Claude Opus.
      : Anti-entropy for a swarm-built wiring: this repo is written by many agents with partial context, and every id/event string is a convention each one must rediscover — e2e catches the drift late, at simulation prices. Regions and streams as compile-time bindings instead: a dead link or undeclared frame fails at expand time with a srcloc (the agent interface), and stream evolution is append-only at one declaration site. The functional core to macro over shipped in [#29](https://github.com/juspay/olai/pull/29) (`live/`: frame, hub, client attributes); the counters example ([#32](https://github.com/juspay/olai/pull/32)) settled the verdicts against real code (2026-08): ONE PR ships the boot-UUID connect URL (retires `#:version`), the forms (`define-stream`, `define-live-region`, `live-item`), and the raw-htmx-attribute ban (live/README.md + CLAUDE.md pointer). Brainstorm: [docs/brainstorming/live-dsl.md](https://github.com/juspay/olai/blob/master/docs/brainstorming/live-dsl.md); the research behind it, general to any future DSL: [docs/brainstorming/agents-and-dsls.md](https://github.com/juspay/olai/blob/master/docs/brainstorming/agents-and-dsls.md).
    [x] markdown fidelity
      : Merged: [#35](https://github.com/juspay/olai/pull/35).
      : One PR over olai/web/markdown.rkt + assets, absorbing chat's
      : "markdown replies" item. (1) Fenced-code highlighting: stop
      : stripping the language class; vendor highlight.js via Nix like
      : the other browser assets. (2) Images: allowlist img, RELATIVE
      : paths only, served same-origin by a route confined to
      : $OLAI_HOME — no external fetches, no data: URIs. (3) Footnotes:
      : allowlist sup and the anchor id/name pairs so markers and jump
      : links survive sanitize. Ceiling stays the markdown package (no
      : tables, strikethrough, task lists).
    [/] always-visible health indicator
      : The stream pill currently renders nothing while healthy. Human
      : wants a standing signal instead (2026-08-06): a quiet "live"
      : state — green dot — joining the existing amber reconnecting and
      : rose stale states. Still chrome, still outside every live
      : region. Folded into the live-dsl PR
      : ([#33](https://github.com/juspay/olai/pull/33)) — that agent
      : owns render.rkt right now.
    0.6 micro-edits
      : Capture box + check-off from the browser (done status already in the
      : language + CLI). The phone loop closes: capture, complete, ask the
      : agent for everything else.
    drag-drop reorder
      : Move and reindent nodes in the browser — the write path is 0.6's
      : ops layer; order and parent become editable from the view.
    0.9 search
      : Text search + keyboard nav in the web view.
    notes fold to one line
      : A node's description shows only its FIRST line by default and
      : expands on hover (mobile needs a tap affordance — hover does
      : not exist there). Pure view state, CSS-first if possible; the
      : full note stays in the DOM so search and morph see it. Parked
      : (2026-08-06).
    view toggles
      : Client view state, like collapse: localStorage, no server.
      hide completed
        : Workflowy's Ctrl+O checkmark toggle — [x]/@done nodes stop
        : rendering (the agenda already excludes done); a Done subtree
        : vanishes from view without deletion. A root class + one CSS
        : rule, so re-swaps can't lose it.
    starred nodes
      : Not view state — curated data, so it lives in the file: a
      : #starred tag on the node (tags are the language's open boolean
      : axis; no grammar change, indexed, rename-proof). The sidebar's
      : STARRED section is a pure query over the snapshot, like the
      : agenda. `olai star TITLE|^anchor` writes it with done-style
      : safety — agents can star from day one; the browser's star
      : toggle rides 0.6's write path. If ordering ever matters, a
      : mirror list supersedes the tag once "mirror nodes across
      : files" lands.
    node views
      : One language field says how a node DRAWS its children (heading |
      : numbered | board | table); the checker owns the closed set,
      : renderers follow. The data stays outline-shaped either way.
      headings
        : A node renders as a heading tier, its children as the section.
      numbered lists
        : Children render 1. 2. 3. — the order is already the tree's.
      kanban board
        : Children as columns, grandchildren as cards; done and #tags
        : drive the lanes.
      tables
        : Children as rows, fields as columns — trackers and small
        : databases without leaving the outline.
    templates
      : Recurring structures (weekly review, project skeleton) that
      : capture or the agent instantiates; a template is just an outline
      : file.
    backlinks panel
      : A zoomed node lists what points at it. Data model settled
      : (2026-08-06): a reverse index as a SNAPSHOT FIELD beside
      : `index`, built once per reload — hash target-key -> (listof
      : backlink), backlink = (source-key kind), kinds being the
      : relations ('mirror, then 'after/'blocks/'see). BLOCKED on typed
      : edges by the human's call: one data model designed once, the
      : panel ships with real relations, not mirrors alone. Typed edges
      : ride the cross-file linker — that chain gates this.
    command palette
      : Ctrl+K (and Ctrl+; fallback), the Workflowy "Jump To": one box
      : that fuzzy-jumps to any node by title, ^anchor, or #tag, and
      : runs commands (theme flip, collapse all, /today). Workflowy
      : pairs it with user-assigned shortcut codes on bullets — anchors
      : already are that for us. Rides 0.9's search index.
    chat
      : The panel becomes the outline's other half.
      [x] tool-output folding
        : Merged: [#36](https://github.com/juspay/olai/pull/36).
        : ACP tool-call frames (and similar chatter) collapse by default
        : in the chat panel; a toggle unfolds any of them on demand. The
        : transcript stays complete — folding is view state, like the
        : outline's collapse.
      edit flash-and-jump
        : When a chat-driven edit lands (the SSE re-swap already fires),
        : flash the changed node in the outline pane; the tool-call line
        : (`Edit Tasks.rkt`) clicks through to the affected node's zoom.
      chat about this node
        : An affordance on any node opens the panel with that node's key
        : and subtree as context — "reschedule these" without spelling
        : the node out. Pairs with the zoom view.
      markdown replies
        : Folded into "markdown fidelity" (web app): replies already
        : render through the markdown lib; what's missing — fenced-code
        : highlighting — is the sanitizer stripping the language class,
        : fixed there for all four surfaces at once.
  language
    : The grammar grows; the expander stays the only validator.
    archive
      : Done work leaves the working file WITHOUT dying: `olai archive
      : TITLE|^anchor` moves the subtree into Archive.rkt, re-creating
      : its ancestor chain there so the tree structure reads intact
      : years later. Anchors move with their nodes and keep resolving
      : from live files — which is why this is GATED on "mirror nodes
      : across files" (the linker). Agenda and search exclude archived
      : nodes; an archive view shows them on demand. Usual write
      : safety: re-validate, auto-commit. Born from the 2026-08-06
      : roadmap prune, which DELETED the Done section and broke every
      : reference into it — archiving is what that should have been.
      : Corollary lesson, no code needed: things worth referencing get
      : ^anchors, not prose numbering.
    mirror nodes across files
      : The user-facing feature: one node, shown wherever it matters,
      : regardless of which file defines it — put `*meeting-prep` in
      : today's Daily list and the node defined in Tasks.rkt renders
      : there too; checking it off from either site flips the one real
      : node, and the agenda still counts it once. Anchors and mirrors
      : exist since 0.2b.1, but they resolve only inside one file (or
      : through an @include splice); files loaded side by side cannot
      : point at each other yet. The work is the LINKER: resolve
      : anchors across the whole loaded set, dangling refs srcloc'd.
      : Ships first, built to the typed-edges doc's requirements —
      : typed edges is the second PR on the same linker. Not
      : dispatched.
    typed edges
      @doc docs/brainstorming/typed-edges.md
      : The graph beyond containment (the Tend thesis): tree stays the
      : spanning structure; order/dependency/cross-reference become
      : grammar (`@after ^x`, `@blocks ^y`, `@see ^z`), checked by the
      : language, derived into the snapshot, queried pure. Design in
      : the attached doc — @blocks normalizes to @after, mirrors join
      : the reverse index but not the grammar, done-propagation for
      : subtree targets still open. Second PR after "mirror nodes
      : across files" — same linker (sequencing settled 2026-08-06);
      : the backlinks panel is gated on this.
    glob includes
      : `@include Daily/*.rkt` -- one line instead of a line per month.
      : The sugar has to answer: match order (lexicographic; date-named
      : fragments sort right), zero matches (empty or error?), and flat
      : splice vs structure (Daily.rkt's year > month nesting comes from
      : the index file's own nodes; a flat glob erases it). Mechanically
      : easy: the reader expands the glob at read time, the module graph
      : stays static per load, the watcher already re-reads the include
      : set.
  codebase
    : The repo's own shape and workflow.
    architecture as data
      @doc docs/brainstorming/architecture-as-data.md
      : Half-mechanize the Hickey/Lowy lenses: CLAUDE.md's layering
      : prose becomes checked declarations — package-level arch.rkt
      : files (clock + owned authorities + concepts), one walker
      : enforcing dependency direction, authority ownership, concept
      : exclusivity, and churn-vs-declaration lies. Scope verdicts
      : settled 2026-08-06 (all four checks, package defaults + module
      : overrides, NO waivers, `just arch` + CI lane); design in the
      : attached doc. Wait for the live-dsl PR to merge first — this
      : touches every package.
