#lang racket/base

;; THE STATES a node can be in, spelled once.
;;
;; Modifiers, not components: they carry no rules of their own. They qualify
;; the classes every module below paints, and collapse.js toggles is-collapsed
;; from the browser — so they are defined here, ahead of everything, where any
;; selector can reach them and nobody has to decide who owns them.
;;
;; Nothing in this file draws, and nothing in it registers a rule, which is why
;; its position in the cascade cannot matter.

(require olai/web/style)

(provide is-done is-doing is-today is-tree is-collapsed has-children
         state-class)

(define-modifier is-done is-doing is-today is-tree is-collapsed has-children)

;; One switch, so a fourth state is a clause here rather than a boolean loose
;; in the markup — and the shell, the checkbox and the pills cannot disagree
;; about what a state looks like.
(define (state-class status)
  (case status
    [(done) is-done]
    [(doing) is-doing]
    [else #f]))
