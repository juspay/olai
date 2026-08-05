#lang selfflowy/sexp

;; Same shape as examples/Example.rkt, in the underlying s-expression core.
;; Prefer #lang selfflowy (outline) for day-to-day editing.

(t "Inbox #capture"
   #:description "Quick capture landing zone"
   (t "Buy milk — don't quote me; 2% \"raw\" milk is fine"
      #:date "2026-01-15"
      #:description "overdue sample")
   (t "Write Selfflowy README"
      #:description "Ship the pitch before the code calcifies"
      (t "Compare Racket vs Rhombus")
      (t "Ship phase 0.1 #lang"
         #:date "2026-08-03"
         #:description "today-ish sample; outline + check + tree")))

(t "Someday"
   (t "Calendar view"
      #:date "2026-12-01"
      #:description "upcoming sample — agenda over date literals")
   (t "PWA offline capture"
      #:description "Manifest + service worker"))
