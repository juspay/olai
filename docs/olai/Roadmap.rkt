#lang olai

olai roadmap #project
  : Weekend-sized phases; every phase leaves the tool usable.
  : git log is the real changelog — done work is pruned from this file.
  Now
    : In flight right now, mirrored — each node's defining site stays in
    : its section below. Maintained by the orchestrator as work starts
    : and lands.
    *daily-calendar
  web app
    : The daily surface.
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
    [x] always-visible health indicator
      : Merged inside [#33](https://github.com/juspay/olai/pull/33): a
      : green dot when healthy (nothing to explain, so no words), the
      : pill with words kept for the amber reconnecting and rose stale
      : states. Chrome, outside every live region; e2e asserts the
      : healthy state is visible on load.
    [x] serve takes one root ^serve-one-root
      : Merged: [#48](https://github.com/juspay/olai/pull/48). Root
      : candidates discriminated (stray non-outline .rkt cannot break
      : serve; exit 3 restored when none qualify); ^anchor write
      : routing widened to the recursive tree, nearest-first —
      : `olai done ^x` reaches subdirectory roots. Keys minted
      : against the pointed root (permalinks survive new files).
      : Issues #51/#52 left untouched and not entrenched.
      : `olai serve DIR` (or ONE file) — the
      : multi-file argument list dies, `serve-roots`' three-way split
      : with it. The directory IS the glob, re-asked live by the same
      : probe that already re-asks @include globs — so the first
      : Archive.rkt, or any new root, appears without a restart.
      : Subsumes the "root glob is startup-only" flag in ^archive.
      : Ruled 2026-08-07: roots are RECURSIVE — every .rkt under the
      : directory is a root unless another file in the set @includes
      : it (the subtraction is the double-load prevention); the
      : repo's `just serve` demos examples/ only, the roadmap on
      : demand via `just serve docs/olai`. APPROVED 2026-08-07 with
      : two pre-merge additions ruled: non-outline .rkt in the tree
      : must not break serve (root candidates discriminated, exit 3
      : restored when none qualify), and ^anchor write routing widens
      : to serve's recursive scope so `olai done ^x` reaches
      : subdirectory roots.
    [x] search ^search
      : Merged: [#46](https://github.com/juspay/olai/pull/46). / opens
      : the palette, server-rendered, /search?q= permalink, no-JS
      : fallback, no resting state (its pill collided with the chat
      : panel's close button — e2e caught it). live-query ratified as
      : the new form; ranking title > anchor > tag > note. Query layer
      : (olai/search.rkt) stays pure for the command palette to ride.
    notes fold to one line ^notes-fold
      : [#42](https://github.com/juspay/olai/pull/42) (whole-note
      : toggle) REJECTED and closed 2026-08-07: clicking simply did not
      : work in the human's real browser, video-proven, unfixed by its
      : agent despite green e2e — the tests validated the agent's model
      : of the interaction in a pinned Chromium, not the interaction.
      : Master stands at [#41](https://github.com/juspay/olai/pull/41)
      : (click the ... button), which the human confirmed works; the
      : open complaint is the tiny, distant target. Postmortem verdict:
      : the minimal fix was always a CSS hit-area enlargement on the
      : existing button — zero new JS — not an interaction-model
      : rewrite.
      : Merged: [#38](https://github.com/juspay/olai/pull/38) (hover
      : cut), then [#41](https://github.com/juspay/olai/pull/41) —
      : hover judged too jarring (reflow under the pointer, accidental
      : triggers), replaced by click-to-toggle: ... affordance,
      : deliberate expand/fold, same gesture on mobile, open state
      : survives reload and re-swap. Terminal 533b167c kept alive
      : pending human behavior confirmation. No JS
      : state — folded IS the box being shorter than its content (CSS
      : clamp), opened by node-scoped hover and by focus; tap covers
      : mobile.
      : A node's description shows only its FIRST line by default and
      : expands on hover (mobile needs a tap affordance — hover does
      : not exist there). Pure view state, CSS-first if possible; the
      : full note stays in the DOM so search and morph see it.
    [/] daily calendar in the sidebar ^daily-calendar
      : Dispatched 2026-08-07 (terminal 1c0fa700, Opus). Ruled:
      : empty days are INERT (no write path); the calendar REPLACES
      : the file-name entry.
      : The sidebar's Daily.rkt entry stops being a file name and
      : becomes a mini month calendar: each day cell links to that
      : day's node (/n/<key>), days with content marked, today
      : highlighted. Requested 2026-08-07. Pure view over the
      : snapshot — day nodes are already dated; gregor and the
      : calendar query already exist. Month navigation and Daily-root
      : recognition are the PR's design calls.
    /today can resolve to an archived day #bug
      : Found by the calendar PR ([#50](https://github.com/juspay/olai/pull/50)),
      : pre-existing, flagged not fixed: /today searches every loaded
      : root in file order and does NOT skip archived nodes — an
      : Archive.rkt scaffold titled today's date can beat the
      : journal's own day. Every other query excludes archived in one
      : place; this one should too.
    view toggles
      : Client view state, like collapse: localStorage, no server.
      hide completed
        : Workflowy's Ctrl+O checkmark toggle — [x]/@done nodes stop
        : rendering (the agenda already excludes done); a Done subtree
        : vanishes from view without deletion. A root class + one CSS
        : rule, so re-swaps can't lose it.
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
      : already are that for us. Rides the search index.
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
    [x] routes as bindings ^routes-as-bindings
      : Merged: [#43](https://github.com/juspay/olai/pull/43). Mirror
      : arrow links the defining node's page via the forms;
      : click-the-arrow e2e verified as real regressions; #:node-href
      : REQUIRED, ratified. Its blast radius conflicted all three
      : sibling PRs — resolved by their agents against the minted-route
      : system rather than around it.
      : The declare-and-check move, third application: hrefs are MINTED,
      : never string-appended in drawers. dispatch-rules already returns
      : a URL generator from the same declaration as the dispatcher —
      : today bound as _url and discarded; consume it instead, so a
      : misspelled or dead route is unwritable like a misspelled region.
      : "The address of a node" becomes one owned concept (arch check 3)
      : with one spelling — the mirror-arrow bug (an href pointing at a
      : fragment its page did not contain, 2026-08-06) is this task's
      : origin story, and the class it retires.
  writes
    : Everything whose feature is EDITING the outline .rkt files —
    : grouped 2026-08-07 because they share one spine: ops.rkt's
    : write path (validate-then-rename, auto-commit), whether the
    : trigger is a CLI command, the browser, or a template.
    [x] daily + glob double-include #bug ^daily-glob-bug
      : Merged: [#47](https://github.com/juspay/olai/pull/47). daily
      : now asks glob-match? before writing the literal `@include`
      : line; a covered fragment is created alone, root untouched.
      : Ratified: `covered_by_glob` reply field (pattern verbatim,
      : null when the line was written), and olai/glob owning
      : include-resolution as an arch concept — /simplify found daily
      : had grown a drifted duplicate of the expander's resolver.
      : Originally flagged by the glob PR
      : ([#37](https://github.com/juspay/olai/pull/37)) as out of its
      : scope.
    add --parent sees only top-level titles #bug
      : [#51](https://github.com/juspay/olai/issues/51): `add
      : --parent TITLE` fails on any nested title while `done`
      : resolves the same title fine — two resolvers where docs
      : promise one. Kills the natural `olai daily` then `olai add
      : --parent <today>` loop. Reconfirmed on master 2026-08-07.
    trailing switches swallowed into titles #bug
      : [#52](https://github.com/juspay/olai/issues/52): a switch
      : after the title words is folded into the node title, ok:true
      : — `--no-commit` in that position still commits. Expected:
      : parse switches anywhere or reject unconsumed ones; `--`
      : already exists for real dash-titles. Audit done/doing/move/
      : archive for the same swallow. Reconfirmed on master
      : 2026-08-07. Natural pairing with the #51 fix, one dispatch.
      : Not view state — curated data, so it lives in the file: a
      : #starred tag on the node (tags are the language's open boolean
      : axis; no grammar change, indexed, rename-proof). The sidebar's
      : STARRED section is a pure query over the snapshot, like the
      : agenda. `olai star TITLE|^anchor` writes it with done-style
      : safety — agents can star from day one; the browser's star
      : toggle rides micro-edits' write path. If ordering ever matters,
      : a mirror list supersedes the tag once "mirror nodes across
      : files" lands.
    drag-drop reorder
      : Move and reindent nodes in the browser — the write path is
      : micro-edits' ops layer; order and parent become editable from
      : the view. Sinks with micro-edits' deprioritization (2026-08-06):
      : the agent moves nodes on request.
    templates
      : Recurring structures (weekly review, project skeleton) that
      : capture or the agent instantiates; a template is just an outline
      : file.
    micro-edits
      : DEPRIORITIZED 2026-08-06: the human edits through the agent
      : anyway — capture and check-off are conveniences, not the loop.
      : Sits at the bottom of the queue; the design below stands for
      : whenever it rises.
      : Capture box + check-off from the browser. The phone loop
      : closes: capture, complete, ask the agent for everything else.
      : Elaborated 2026-08-06, layer by layer. OPS: add/done already
      : exist in ops.rkt; the web mutation routes call the same ops
      : (the standing layering promise) — POST for capture (append
      : under Inbox), POST for check-off by node key; op exn kinds map
      : to HTTP codes the way the CLI maps them to exit codes; failures
      : surface in the existing banner vocabulary and leave the file
      : untouched. WRITE SAFETY: identical to the CLI — re-validate
      : before keeping the write, auto-commit. UI: the header capture
      : box finally does something; the checkbox's grandfathered raw
      : hx-post branch dies here — this feature is the ratification
      : point for live/'s first WRITE FORM (the (b)-proposal the
      : blanket ban anticipated), so the DSL grows write vocabulary in
      : the same PR. NO optimistic UI: a write changes the file, the
      : watcher fires, the live stream re-swaps — writes ride the read
      : loop that already exists. e2e: browser capture lands in the
      : file and the view; check-off flips [x] in the file; an invalid
      : write shows the banner and changes nothing.
    [x] delete the dated queries ^delete-dated-queries
      : Merged: [#53](https://github.com/juspay/olai/pull/53).
      : `olai agenda`, `olai calendar`, `olai ics` retired — modules,
      : /api/agenda, tests, docs contract. Founding features (#1)
      : gone by the human's ruling: unused. json-reply-version stays
      : 1 (ruled — no surviving reply changed shape). Month layout
      : moved to olai/dates.rkt for #50 (month-layout arch concept);
      : typed edges, derived status, BLOCKED derivation survive.
  language
    : The grammar grows; the expander stays the only validator.
    [x] archive ^archive
      : Merged: [#44](https://github.com/juspay/olai/pull/44).
      : Archived is a FILE, not a node state; queries
      : exclude in one place; GET /archive; scaffolds merge on title,
      : anchors never copied. Flagged: first archive in a dir needs a
      : serve restart (root glob is startup-only — own change); moved
      : @doc/@include paths not rewritten (srcloc'd rejection when it
      : would break). En-route fix to ratify: ops resolves in a fresh
      : namespace (second op in one process read the pre-write tree).
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
    [x] mirror nodes across files ^mirror-nodes-across-files
      : Merged: [#39](https://github.com/juspay/olai/pull/39). Same
      : checker, third reach: the whole loaded set at once, with
      : "unknown anchor" and a did-you-mean over the set. Demo:
      : examples/Week.rkt mirrors *agent from Example.rkt. Behavior
      : change: a lone file of a linked pair now fails its own check —
      : checked-as-the-set-you-give. Terminal 1d0e56f9 kept alive
      : pending human confirmation.
      : The user-facing feature: one node, shown wherever it matters,
      : regardless of which file defines it — put `*meeting-prep` in
      : today's Daily list and the node defined in Tasks.rkt renders
      : there too; checking it off from either site flips the one real
      : node, and the agenda still counts it once. Anchors and mirrors
      : exist since the in-file mirrors work, but they resolve only
      : inside one file (or
      : through an @include splice); files loaded side by side cannot
      : point at each other yet. The work is the LINKER: resolve
      : anchors across the whole loaded set, dangling refs srcloc'd.
      : Ships first, built to the typed-edges doc's requirements —
      : typed edges is the second PR on the same linker.
    [x] derived status ^derived-status
      : Merged: [#49](https://github.com/juspay/olai/pull/49). Ruled:
      : ONE done predicate — derived done counts everywhere, edges
      : included, narrowing typed-edges' "parent of all-done children
      : keeps blocking" to explicit-open parents only; [/] derives
      : too; `olai done` on a statusless parent errors (kind derived,
      : exit 4, open children listed). status_source stored|derived
      : in tree JSON. Checker points nested done-above-open at the
      : INNERMOST offender (agent call, merged as-is; agenda-side
      : sub-call mooted by the agenda deletion).
      : Stop storing what the tree already says: a parent with task
      : children and no status of its own gets NO stored checkbox —
      : done-ness is computed (done iff all children done) at query
      : time by agenda, renderer, JSON, so it can never go stale. A
      : parent with its own completion criterion writes an explicit
      : status as today, and the checker then rejects the
      : contradiction ([x] parent above an open child, srcloc'd). Born
      : 2026-08-06 from the orchestrator forgetting to close
      : "declare-and-check DSL" after its last child merged —
      : duplicated state drifts; derived state cannot.
    [x] typed edges ^typed-edges
      @doc ../brainstorming/typed-edges.md
      : Merged: [#45](https://github.com/juspay/olai/pull/45) (by the
      : human directly). En route it tripped the arch churn audit
      : exactly where the #39 agent predicted (lang/expander at the
      : stable ceiling); fixed the sanctioned way — declaration changed
      : to settling, argued in the PR. Ratified calls: done-ness does
      : NOT propagate (a parent of all-done children keeps blocking),
      : and @done never reads as blocked. Demo: examples/Kitchen.rkt.
      : The graph beyond containment (the Tend thesis): tree stays the
      : spanning structure; order/dependency/cross-reference become
      : grammar (`@after ^x`, `@blocks ^y`, `@see ^z`), checked by the
      : language, derived into the snapshot, queried pure. Design in
      : the attached doc — @blocks normalizes to @after, mirrors join
      : the reverse index but not the grammar, done-propagation for
      : subtree targets still open. Second PR after "mirror nodes
      : across files" — same linker (sequencing settled 2026-08-06);
      : the backlinks panel is gated on this.
  codebase
    : The repo's own shape and workflow.
    [x] architecture as data ^architecture-as-data
      @doc ../brainstorming/architecture-as-data.md
      : Merged: [#40](https://github.com/juspay/olai/pull/40). arch/ is
      : its own collection (the spec's #lang olai/arch would have made
      : a package cycle with live/); six CLAUDE.md prose rules deleted,
      : each replaced by a check; day-one findings were three renames.
      : Known boundary: check 1 does direction, not sole-consumership.
      : Known caveat: the churn audit can fail a PR that never touched
      : the flagged file. Terminal 52e040af kept alive pending human
      : confirmation.
      : Half-mechanize the Hickey/Lowy lenses: CLAUDE.md's layering
      : prose becomes checked declarations — package-level arch.rkt
      : files (clock + owned authorities + concepts), one walker
      : enforcing dependency direction, authority ownership, concept
      : exclusivity, and churn-vs-declaration lies. Scope verdicts
      : settled 2026-08-06 (all four checks, package defaults + module
      : overrides, NO waivers, `just arch` + CI lane); design in the
      : attached doc.
