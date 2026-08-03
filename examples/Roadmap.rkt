#lang selfflowy

Selfflowy roadmap #project
  : Weekend-sized phases; every phase leaves the tool usable.
  : git log is the real changelog.
  [x] 0.1 the language
    : The s-exp core, then the quoteless outline syntax took the flagship
    : name (selfflowy/sexp keeps the old form). Strict 2-space indent,
    : verbatim titles, ": " notes, @date fields, inline #tags, closed
    : grammar, srcloc'd errors agents can act on.
  [x] 0.2a dates
    : @date with ISO date or datetime (gregor); `selfflowy agenda` groups
    : overdue / today / upcoming.
  [x] 0.3 capture
    : `selfflowy add` appends under Inbox, re-validates before keeping the
    : write, auto-commits. Bind it to a hotkey.
  [x] agent-first CLI
    : Agents are the primary users: --json everywhere (version key,
    : append-only fields), exit-code contract, errors as JSON. docs/cli.md
    : is the contract. Multi-file paths; merged agenda.
  [x] html view
    : `selfflowy html` — Tailwind + details/summary, Markdown in titles and
    : notes (render-time only). Terminal renderer retired; tree is JSON-only.
  [x] done status
    : `@done` / `[x]` sugar, `#:done` in the core, agenda exclusion, checked
    : HTML rendering, `selfflowy done TITLE` with add-style write safety.
  [x] 0.2b.1 mirrors (in-file)
    : ^anchor / *anchor; #:id + (mirror); cycle rejection; JSON mirror refs +
    : anchors index; agenda dedupe; html permalinks; done/add accept ^anchor.
  0.2b.2 cross-file mirrors
    : Link anchors across outline files (not yet).
  0.4 the agent
    : Minimal HTTP server whose only page is a chat panel driving Claude
    : Code over ACP, plus the html view served live. Talk to your outline
    : from any browser. Ugly on purpose.
  0.5 the outline
    : Real read-mostly web view: collapse, zoom, breadcrumbs; SSE pushes
    : updates when files change (agent edits appear live).
  0.6 micro-edits
    : Capture box + check-off from the browser (done status already in the
    : language + CLI). The phone loop closes: capture, complete, ask the
    : agent for everything else.
  0.7 PWA
    : Manifest + service worker; offline reading, background-sync capture
    : queue.
  0.8 calendar
    : Agenda & calendar views over date literals.
  0.9 search
    : Text search + keyboard nav in the web view.
  1.0 daily driver
    : When the author stops opening Workflowy.
