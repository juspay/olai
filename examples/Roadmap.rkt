#lang selfflowy

;; Project roadmap as selfflowy data — single source of truth.
;; Render: selfflowy tree examples/Roadmap.rkt

(t "Selfflowy roadmap"
   #:description "Weekend-sized phases; every phase leaves the tool usable"
   (t "0.1 the language"
      #:description "#lang selfflowy + `selfflowy check`; render tree to terminal. Usable today with $EDITOR, Claude Code, and git. No server.")
   (t "0.2 mirrors & dates"
      #:description "References resolve, cycles rejected, date literals; `selfflowy agenda` in the terminal.")
   (t "0.3 capture"
      #:description "`selfflowy add \"buy milk\"` appends to the inbox file; auto-commit. Bind it to a hotkey.")
   (t "0.4 the agent"
      #:description "Minimal HTTP server whose only page is a chat panel driving Claude Code over ACP, plus a crude tree dump. Talk to your outline from any browser. Ugly on purpose.")
   (t "0.5 the outline"
      #:description "Real read-mostly view: collapse, zoom, breadcrumbs; SSE pushes updates when files change (agent edits appear live).")
   (t "0.6 micro-edits"
      #:description "Capture box + check-off from the browser. The phone loop closes: capture, complete, ask the agent for everything else.")
   (t "0.7 PWA"
      #:description "Manifest + service worker; offline reading, background-sync capture queue.")
   (t "0.8 calendar"
      #:description "Agenda & calendar views over date literals.")
   (t "0.9 search"
      #:description "Plain text search + keyboard nav.")
   (t "1.0 daily driver"
      #:description "When the author stops opening Workflowy."))
