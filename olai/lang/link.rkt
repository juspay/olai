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
          [link-anchors (-> (listof list?) hash?)]))

;; What the set's anchors cover, as the error messages say it out loud. A
;; module's own passes have no name for their scope — they are open, and the
;; rule that would need one is this pass's.
(define set-scope "the loaded set")

;; forests : one (listof task) per file, in load order.
;; -> hash id -> task, or raises exn:fail:syntax at the offending form.
;;
;; The forests are checked as ONE forest: nothing about these rules is per
;; file, and a duplicate that spans two of them is exactly the case the
;; per-module passes cannot see.
(define (link-anchors forests)
  (define roots (apply append forests))
  (check-task-graph roots #:scope set-scope)
  ;; The index is built AFTER the check, so a duplicate is an error rather
  ;; than one node silently overwriting another.
  (anchors-of roots))
