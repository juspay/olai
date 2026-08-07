#lang racket/base

;; THE LINKER: what a ^anchor means across the whole loaded set.
;;
;; An anchor is a NAME, and until now its scope was one module: `*id` reached
;; an `^id` in the same file, or in a fragment that file spliced in with
;; @include. Two files loaded side by side could not point at each other,
;; because nothing ever held them at the same time — every check ran inside one
;; module, and a module knows only its own entry point.
;;
;; This is the pass that holds them. It runs once per load of a SET (olai/load,
;; link-outlines), after @include has spliced and after keys are minted, and it
;; is where the closed-scope rules live:
;;
;;   * a duplicate ^anchor is an error naming both sites, wherever the two are;
;;   * an unknown *mirror is an error listing the anchors that do exist, with
;;     a did-you-mean over them;
;;   * a mirror cycle is an error with its path, now that one can run through
;;     several files.
;;
;; Same rules and same messages as the module's own passes (lang/graph owns
;; them; the expander's passes leave "unknown" to this one, since a module
;; cannot know which files it will be loaded beside). The answer is the INDEX
;; the set shares: id -> the node that declares it. Mirror binding reads it
;; (lang/walk, resolve-mirrors), the JSON publishes it, and the next kind of
;; reference — a typed edge's target (docs/brainstorming/typed-edges.md) — is
;; the same lookup against the same hash.

(require racket/contract
         (except-in olai/lang/expander #%module-begin))

(provide (contract-out
          [link-anchors (-> list? hash?)]
          [link-written (-> list? hash?)]))

;; The set's task forests as ONE forest — nothing about these rules is per
;; file, and a duplicate that spans two of them is exactly the case the
;; per-module passes cannot see.
;;
;; -> hash id -> task, or raises exn:fail:syntax at the offending form. The
;; index is what the check collected on its way through, so a duplicate is an
;; error rather than one node silently overwriting another.
(define (link-anchors roots)
  (check-task-graph roots #:scope "the loaded set"))

;; The same rules over the files a WRITE just wrote, held together.
;;
;; A write touches one file, or — since `archive` — two: the outline a node
;; left and the archive it arrived in. Held apart they would each pass while
;; the pair was broken (an ^anchor that now exists twice is a fact about
;; neither file alone), so the write path validates them as the set they are.
;;
;; But the scope stays OPEN, exactly as a module's own passes leave it: a
;; write's set is the files under the pen, not the set somebody will load, and
;; a `*mirror` naming an anchor in a file this write is not touching is not
;; wrong — it is the feature. "Unknown" is an answer about a LOAD, and only
;; the linker above is closed enough to give it.
(define (link-written roots)
  (check-task-graph roots))
