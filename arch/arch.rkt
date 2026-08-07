#lang arch

;; The checker's own architecture. It reads the tree, so it is at the bottom of
;; it: nothing here may depend on olai or live, and the grammar is the part
;; that has to hold still.
(clock stable)
(owns)

;; The three modules that touch the world, and each of them exists to keep the
;; rest from having to: git's output format, the reader's, the module system's.
(override "churn.rkt" (owns subprocess))
(override "source.rkt" (owns filesystem))
(override "scope.rkt" (owns filesystem))
(override "explain.rkt" (owns filesystem))
(override "main.rkt" (clock settling) (owns filesystem))
(override "check.rkt" (clock settling))
(override "expander.rkt" (owns filesystem))

;; One walker over the anchor rules is the pattern this whole tool is about, so
;; it holds for the tool.
;;
;; The clock words are enumerated rather than globbed because `live/examples/
;; counters/clock.rkt` exports `clock` and `clock-now` — a stream named after
;; what it ticks, in a package that has nothing to do with this one. That is a
;; real collision between two honest names, and the narrow list is what a
;; declaration says when the code is right and the words merely coincide.
(override "vocabulary.rkt"
          (concept arch-vocabulary "authorit*" "clocks" "clock?" "clock-rank" "clock-allows"))
(override "wording.rkt" (concept arch-wording "word-list" "did-you-mean"))
(override "finding.rkt" (concept arch-finding "finding*" "make-labeller" "loc-brief"))
