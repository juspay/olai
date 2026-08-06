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
      [x] WP7 zoom + breadcrumbs
        : Per-node zoom route keyed by task-key; breadcrumbs from the
        : ancestor path; node permalinks point at the zoom instead of
        : home.
      collapse state lost on live re-swap #bug
        : collapse.js re-applied on htmx:afterSwap, where the settle
        : phase then restores the server's class attribute (and the
        : unvisited-key branch read htmx's copy of the OLD class).
        : Fix: the pass moved to htmx:afterSettle — one line, both
        : panes (apply() is document-wide; the sidebar renders outside
        : the #ol-live swap target and was never in the line of fire).
        @done 2026-08-05
    [/] live view glitches #bug
      : In flight: terminal 322a5e1f, worktree live-view, Claude Opus.
      : One disease behind them all: DOM that did not change is replaced
      : anyway — full page loads on sidebar clicks, whole-container
      : swaps on SSE. Seen: chat panel rebuilt by sidebar navigation;
      : scroll jumps on live re-swap; selection/focus loss; CSS
      : transition replay; click-vs-swap race; stale outline after
      : sleep (the stream has no reconnect catch-up).
      partial navigation
        : Sidebar/crumb/permalink links hx-get the same URL with
        : hx-target/hx-select #ol-live, morph swap, hx-push-url; the
        : chat panel, sidebar, and skin live outside #ol-live and are
        : never rebuilt. The plain href stays — no-JS and deep links
        : keep working.
      morph swaps
        : Vendor idiomorph beside htmx+sse; outline swaps (navigation
        : and SSE alike) become morphs keyed on the stable node ids.
        : Kills scroll jump, selection/focus loss, transition replay,
        : and the click-vs-swap race by construction; the afterSettle
        : re-apply stays for genuinely new subtrees.
      outline stream catch-up
        : What chat got in [#24](https://github.com/juspay/olai/pull/24), via the protocol: the snapshot gains a
        : revision, events.rkt stamps it as the SSE id:, reconnects
        : send Last-Event-ID, and a behind client gets one fresh
        : outline-changed. Sleep, iOS tab suspension, network blips
        : heal with zero client JS. The hub stays generic — ids are
        : its vocabulary; what a revision MEANS stays the store's.
      declare-and-check DSL
        : Anti-entropy for a swarm-built wiring: this repo is written
        : by many agents with partial context, and every id/event
        : string is a convention each one must rediscover — e2e catches
        : the drift late, at simulation prices. Regions and streams as
        : compile-time bindings instead: a dead link or undeclared
        : frame fails at expand time with a srcloc (the agent
        : interface), and stream evolution is append-only at one
        : declaration site. Thin macros over the framework's
        : functional core; second PR, only if the declarations CHECK
        : something a swarm actually trips on. Brainstorm:
        : [docs/brainstorming/live-dsl.md](https://github.com/juspay/olai/blob/master/docs/brainstorming/live-dsl.md)
        : (make this an @doc when that lands).
      stream health indicator
        : The user must know when they are reading a stale app. Two
        : layers: htmx:sseOpen/sseClose for clean drops, and a
        : heartbeat + client watchdog for half-dead connections (the
        : outline stream grows the heartbeat chat already has). Quiet
        : when live; subtle while reconnecting; the store's last-good
        : banner vocabulary ("showing last known state") when the
        : watchdog trips. Catch-up clears it on reconnect.
      e2e coverage
        : Pin the class dead: scroll survives a live re-swap; a text
        : selection survives; chat DOM identity survives sidebar
        : navigation; kill the connection, edit the file, reconnect —
        : the outline catches up; the indicator shows stale while the
        : stream is down and clears on recovery.
    0.6 micro-edits
      : Capture box + check-off from the browser (done status already in the
      : language + CLI). The phone loop closes: capture, complete, ask the
      : agent for everything else.
    drag-drop reorder
      : Move and reindent nodes in the browser — the write path is 0.6's
      : ops layer; order and parent become editable from the view.
    0.9 search
      : Text search + keyboard nav in the web view.
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
      : mirror list supersedes the tag once 0.2b.2 lands.
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
      : A zoomed node lists what points at it — mirrors today, typed
      : edges once that linker lands. The reverse index is a pure query
      : over the snapshot.
    command palette
      : Ctrl+K (and Ctrl+; fallback), the Workflowy "Jump To": one box
      : that fuzzy-jumps to any node by title, ^anchor, or #tag, and
      : runs commands (theme flip, collapse all, /today). Workflowy
      : pairs it with user-assigned shortcut codes on bullets — anchors
      : already are that for us. Rides 0.9's search index.
    chat
      : The panel becomes the outline's other half.
      panel opened during boot misses its conversation #bug
        : Found by the e2e suite ([#22](https://github.com/juspay/olai/pull/22), @skip scenario): serve answers
        : requests while the agent boots in its own thread, and boot
        : frames broadcast only to subscribers already on /events — a
        : panel opened mid-boot never learns its session. Fixed by
        : catch-up on connect: one frame constructor for live broadcast
        : and replay ([#24](https://github.com/juspay/olai/pull/24)).
        @done 2026-08-06
      mobile chat unusable #bug
        : On iPhone the chat panel is completely broken (reported
        : 2026-08-05). The panel is desktop-first: position fixed,
        : --chat-w = max(21rem, 33vw) — 21rem is nearly the whole of a
        : 390px screen — and the [#14](https://github.com/juspay/olai/pull/14) gutter squeezes .ol-main to
        : nothing beside it. On a narrow viewport the panel likely
        : wants to be a full-width sheet instead of a side panel;
        : reproduce in a phone-sized viewport, then fix. An e2e
        : scenario at mobile viewport should pin whatever the fix
        : establishes.
        @done 2026-08-06
      tool-output folding
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
        : the node out. Pairs with WP7 zoom.
      markdown replies
        : Full Markdown in agent replies — fenced code with highlighting,
        : via the vendored markdown lib. Render-time only; transcript
        : strings stay verbatim.
      session picker adopts foreign sessions #bug
        : session/list is trusted unfiltered and the adapter scopes by
        : prefix, so sessions from other checkouts of the repo (agent
        : worktrees, an orchestrator in the root) show in the picker —
        : and boot ADOPTS the newest as the web conversation. The raw
        : entries carry cwd (acp.rkt:370); filter list-sessions to exact
        : server-cwd matches before the picker or adopt logic sees them.
        @done 2026-08-05
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
      : A third state between open and done: `[/]` title sugar (the
      : Obsidian community standard for in-progress; [-] stays free for
      : a future cancelled) + `@doing` field (#:doing in the core), same
      : desugar rules as [x]/@done. Rendered distinctly (pulsing/slanted
      : pill); agenda gains a DOING group above TODAY; `olai doing
      : TITLE|^anchor` flips it with the usual write safety; done clears
      : doing. Who/where lives in notes, not grammar — an orchestrator
      : marks a task [/] and notes the terminal id under it.
      @done 2026-08-06
    \@doc documents
      : Expand a node into a full document: a @doc field attaches a file,
      : rendered inline when the node is zoomed; one-line preview collapsed.
      : Two tiers by extension: .md (default; agents are fluent) and .scrbl
      : (Scribble for code-heavy power docs — real sections, highlighted code,
      : cross-refs). Documents stay files: greppable, diffable, editable by
      : $EDITOR and agents, includable elsewhere.
  codebase
    : The repo's own shape and workflow.
    e2e tests
      : Browser-level journeys the wire tests can't see (integration/
      : stops at HTTP: HTML strings, SSE frames, JSON — no JS runs).
      : The kolu pattern: cucumber-js features + step definitions,
      : Playwright headless Chromium from support hooks, @skip tags,
      : env retry budget; own `just e2e` recipe + CI lane, never in
      : `just test`. Node dev-deps provisioned by nix
      : (playwright-driver pins the browser). Each scenario boots
      : `olai serve` on an ephemeral port against a temp outline.
      : First features: fold survives an SSE re-swap (the parked
      : collapse #bug becomes its regression test); chat panel open
      : keeps .ol-main readable (the [#14](https://github.com/juspay/olai/pull/14) wrap bug); theme flip
      : persists across reload.
      @done 2026-08-05
    chat boot frames race the assertions #bug
      : integration/chat.rkt fails intermittently, on either runner, with an
      : extra LEADING frame: ("commands" "session" "user" "chunk") for
      : ("user" "chunk") at chat.rkt:886, and ("commands" "reset" ...) for
      : ("reset" ...) at chat.rkt:949.
      : Not a commit: it failed on master at 46cf193a — a Roadmap.rkt-only
      : commit — with f6d1b71c before it and c609691d after it both green,
      : and once on [#17](https://github.com/juspay/olai/pull/17)'s macOS lane, green on re-run with no chat or acp
      : change. Two different assertions, two different runners, always the
      : same shape.
      : Cause: with-server gates on wait-booted (chat.rkt:167), which waits
      : for chat-session-id — set from the session/new RESULT. The fake
      : agent emits commands! and session-info! one round trip LATER, on
      : session/set_mode (fake-acp-agent.rkt:349). chat-boot! runs in its
      : own thread (serve.rkt), so those two frames can land after the test
      : opens /events and inside its assertion window. The fake agent pins
      : the order AMONG boot frames; nothing pins boot against the test's
      : own subscription, which is the ordering that breaks.
      : Fix: gate on the LAST boot signal, not the first — wait-booted
      : answers (and (chat-session-id ag) (pair? (chat-commands ag))), since
      : chat-commands is populated by the very frame that races and the fake
      : agent ships a non-empty list at boot. One line, no product change.
      @done 2026-08-05
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
