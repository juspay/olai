#lang selfflowy

Selfflowy roadmap #project
  : Weekend-sized phases; every phase leaves the tool usable
  0.1 the language
    : #lang selfflowy + `selfflowy check`; render tree to terminal. Usable today with $EDITOR, Claude Code, and git. No server.
  0.2 mirrors & dates
    : References resolve, cycles rejected, date literals; `selfflowy agenda` in the terminal.
  0.3 capture
    : `selfflowy add "buy milk"` appends to the inbox file; auto-commit. Bind it to a hotkey.
  0.4 the agent
    : Minimal HTTP server whose only page is a chat panel driving Claude Code over ACP, plus a crude tree dump. Talk to your outline from any browser. Ugly on purpose.
  0.5 the outline
    : Real read-mostly view: collapse, zoom, breadcrumbs; SSE pushes updates when files change (agent edits appear live).
  0.6 micro-edits
    : Capture box + check-off from the browser. The phone loop closes: capture, complete, ask the agent for everything else.
  0.7 PWA
    : Manifest + service worker; offline reading, background-sync capture queue.
  0.8 calendar
    : Agenda & calendar views over date literals.
  0.9 search
    : Plain text search + keyboard nav.
  1.0 daily driver
    : When the author stops opening Workflowy.
