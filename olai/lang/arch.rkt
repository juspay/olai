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
;;
;; SETTLING, and the audit is what said so: the expander changed in 7 of the
;; last 30 commits where stable allows 6. It is not churn — it is five language
;; PRs in a row, each adding a form or a field to the task struct (the third
;; state, @doc, the @include glob, the linker, and now typed edges), and a sixth
;; is the likeliest next thing to happen to this file. The grammar SURFACE is
;; what holds still, and it still declares itself so: line.rkt, outline.rkt and
;; tags.rkt are untouched by any of that, and graph.rkt — the rules — is stable
;; because rules are what a new form is checked against.
(override "expander.rkt" (clock settling) (owns filesystem))

;; The three modules built directly ON the task struct, which is the expander's.
;; They may not claim to be steadier than the thing they are made of — that is
;; check 1, and it is right: a struct that takes a field every few weeks is a
;; ceiling on how stable anything reading it can be. Their own churn is 0 and 1
;; of 30, and settling has no lower bound, so this costs them nothing but a
;; promise they cannot keep.
(override "link.rkt" (clock settling))
(override "reader.rkt" (clock settling))
(override "walk.rkt" (clock settling))

;; Flat-record JSONL surface: parse lines with the `json` library into the same
;; task tree the expander produces, then run check-task-graph. Settling with
;; the other readers; owns filesystem because @doc existence and @include
;; resolution are checked here the way the expander checks them for #lang olai.
(override "jsonl.rkt" (clock settling) (owns filesystem))

;; What state a node is in, and the one contradiction that state can be in with
;; what it contains. One owner, because a derived answer that two modules
;; computed is a stored answer with extra steps: the expander applies it to a
;; task, the write path applies it to raw text, and neither gets to have its
;; own idea of when a parent is done.
(override "state.rkt"
          (concept node-state "derive-status" "node-status" "status-derived?"
                   "check-status-tree"))

;; One checker for the anchor rules — mirrors and typed edges — over a node
;; protocol the caller supplies. Compile time and run time go through this and
;; nowhere else, and so does the CLOSED RELATION SET: the reader builds its
;; line grammar from `edge-relations` rather than restating the three names,
;; and what `@blocks` means is `normalize-edge` and no second opinion.
(override "graph.rkt"
          (concept anchor-graph "check-anchor-graph")
          (concept edge-rules "edge-relations" "edge-relations-label"
                   "edge-relation?" "normalize-edge"
                   "derived-relation-acyclic?"))
