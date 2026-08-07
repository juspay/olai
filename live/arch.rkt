#lang arch

;; The live-view framework. It imports nothing from olai and never will, and
;; that is not a sentence any more: olai is declared settling and volatile, so
;; an edge from here to there points the wrong way and the checker says so.
(clock stable)
(owns)

;; The hub is where the concurrency is, and it is the only place: a broadcast
;; goes to every subscriber on a thread of the hub's making.
(override "hub.rkt" (owns threads) (concept sse-hub "hub-*" "make-hub" "subscriber*"))

;; A frame carries a monotonic id, which is a clock read — the one in the
;; framework, on purpose, so the app never mints one.
(override "frame.rkt" (owns clock) (concept sse-frame "frame*" "make-frame"))

;; `just expand` is a program, not part of the framework: it reads a file off
;; the disk and prints what the forms in it became.
(override "expand.rkt" (clock settling) (owns filesystem))

;; The forms, and the checks under them. One declarer per name is the rule the
;; whole module exists for; this says it about the module itself.
(override "dsl.rkt" (concept live-forms "define-stream" "define-live-region" "stream-*"))
