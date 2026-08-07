#lang olai

olai roadmap #project
  language
    [x] glob includes ^glob-includes
      : Merged: [#37](https://github.com/juspay/olai/pull/37).
      : Semantics as ratified in the PR body: lexicographic, one
      : directory per pattern, metacharacters policed only in starred
      : paths, dotfiles never match; store re-globs on staleness checks
      : so new files appear mid-serve. Behavior confirmed by the human
      : against examples/Daily.rkt (2026-08-06).
      : `@include Daily/*.rkt` -- one line instead of a line per month.
      : The sugar has to answer: match order (lexicographic; date-named
      : fragments sort right), zero matches (empty or error?), and flat
      : splice vs structure (Daily.rkt's year > month nesting comes from
      : the index file's own nodes; a flat glob erases it) — the agent
      : proposes the open answers in its PR body for ratification.
      : Mechanically easy: the reader expands the glob at read time,
      : the module graph stays static per load; the watcher must also
      : catch NEW matching files appearing mid-serve.
  web app
    [x] declare-and-check DSL
      @doc ../brainstorming/live-dsl.md
      [x] live-dsl
        : Merged: [#33](https://github.com/juspay/olai/pull/33). One PR: boot-UUID
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
        : is forced everywhere, routes and task-keys unchanged.
      : Anti-entropy for a swarm-built wiring: this repo is written by many agents with partial context, and every id/event string is a convention each one must rediscover — e2e catches the drift late, at simulation prices. Regions and streams as compile-time bindings instead: a dead link or undeclared frame fails at expand time with a srcloc (the agent interface), and stream evolution is append-only at one declaration site. The functional core to macro over shipped in [#29](https://github.com/juspay/olai/pull/29) (`live/`: frame, hub, client attributes); the counters example ([#32](https://github.com/juspay/olai/pull/32)) settled the verdicts against real code (2026-08): ONE PR ships the boot-UUID connect URL (retires `#:version`), the forms (`define-stream`, `define-live-region`, `live-item`), and the raw-htmx-attribute ban (live/README.md + CLAUDE.md pointer). Brainstorm: [docs/brainstorming/live-dsl.md](https://github.com/juspay/olai/blob/master/docs/brainstorming/live-dsl.md); the research behind it, general to any future DSL: [docs/brainstorming/agents-and-dsls.md](https://github.com/juspay/olai/blob/master/docs/brainstorming/agents-and-dsls.md).
