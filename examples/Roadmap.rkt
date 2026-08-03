#lang selfflowy

Shipped #project
  : Landed and pushed. git log is the real changelog.
  0.1 the language
    : The s-exp core, then the quoteless outline syntax took the flagship
    : name (selfflowy/sexp keeps the old form). Strict 2-space indent,
    : verbatim titles, ": " notes, @date fields, inline #tags, closed
    : grammar, srcloc'd errors agents can act on.
  0.2a dates
    : @date with ISO date or datetime (gregor); `selfflowy agenda` groups
    : overdue / today / upcoming.
  0.3 capture
    : `selfflowy add` appends under Inbox, re-validates before keeping the
    : write, auto-commits. Bind it to a hotkey.
  agent-first CLI
    : Agents are the primary users: --json everywhere (version key,
    : append-only fields), exit-code contract, errors as JSON. docs/cli.md
    : is the contract.
  html view
    : `selfflowy html` — Tailwind + details/summary, Markdown in titles and
    : notes (render-time only). Terminal renderer retired; tree is JSON-only.
  done status
    : `@done` / `[x]` sugar, `#:done` in the core, agenda exclusion, checked
    : HTML rendering, `selfflowy done TITLE` with add-style write safety.

Selfflowy roadmap #project
  : Weekend-sized phases; every phase leaves the tool usable.
  0.2b mirrors
    : ^anchor / *anchor references resolve; cycles rejected at check time.
    : Design already in docs/syntax.md.
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
