#lang arch

;; The language: readers, the expander, and the one graph checker. Changes here
;; are deliberate and rare — a new form is a grammar change, and the outlines
;; already written have to keep loading.
;;
;; Stable, which is the whole of "the language depends on nothing above it":
;; an edge from here to the core or to the web view points the wrong way and
;; the checker refuses it.
(clock stable)
(owns)

;; @doc and @include name files, and the language checks that they are there —
;; a path that resolves to nothing is a form that is wrong, not a document with
;; a problem. That is the one door to the world this package opens.
(override "expander.rkt" (owns filesystem))

;; One checker for the anchor/mirror rules, over a node protocol the caller
;; supplies — compile time and run time go through this and nowhere else.
(override "graph.rkt" (concept anchor-graph "check-anchor-graph"))
