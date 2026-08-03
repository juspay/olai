#lang selfflowy

;; Committed example of #lang selfflowy syntax.
;; Your private outline lives in Tasks.rkt (gitignored).
;; Keywords #:date and #:description may appear in either order after the title.
;; Dates span past / near / future so `selfflowy agenda` shows all three groups.

(t "Inbox"
   #:description "Quick capture landing zone"
   (t "Buy milk"
      #:date "2026-01-15"
      #:description "overdue sample — 2% if they have it")
   (t "Write Selfflowy README"
      #:description "Ship the pitch before the code calcifies"
      (t "Compare Racket vs Rhombus")
      (t "Ship phase 0.1"
         #:date "2026-08-03"
         #:description "today-ish sample; #lang + check + tree")))

(t "Someday"
   (t "Calendar view"
      #:date "2026-12-01"
      #:description "upcoming sample — agenda over date literals")
   (t "PWA offline capture"
      #:description "Manifest + service worker"))
