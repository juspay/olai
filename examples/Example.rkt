#lang selfflowy

;; Committed example of #lang selfflowy syntax (phase 0.1).
;; Your private outline lives in Tasks.rkt (gitignored).
;; Keywords #:date and #:description may appear in either order after the title.

(t "Inbox"
   #:description "Quick capture landing zone"
   (t "Buy milk"
      #:date "2026-08-04"
      #:description "2% if they have it")
   (t "Write Selfflowy README"
      #:description "Ship the pitch before the code calcifies"
      (t "Compare Racket vs Rhombus")
      (t "Ship phase 0.1"
         #:description "#lang + check + tree; no server")))

(t "Someday"
   (t "Calendar view"
      #:description "Agenda over date literals")
   (t "PWA offline capture"
      #:description "Manifest + service worker"))
