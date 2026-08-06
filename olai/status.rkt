#lang racket/base

;; The node STATES in outline (#lang olai) source text: put one on, take one
;; off. Argument sets for the metadata engine (olai/meta), which does the
;; editing; nothing here knows a regexp for what a line is.
;;
;; done and doing are one concept — where a node has got to — so they are one
;; module. Marking done has to CLEAR doing, and the sugar the two states wear
;; ([x] and [/]) is stripped the same way; two modules would be two places to
;; teach that a state exists.

(require racket/contract
         olai/fail
         olai/lang/line
         olai/meta)

;; The write layer's boundary: ops.rkt hands these a whole file's text and a
;; TITLE|^anchor, and gets text back. Flat checks — three strings and an
;; index; the text is never walked to prove it is one.
(define mutator/c
  (->* (string? string?) (#:at (or/c exact-nonnegative-integer? #f)) any))

(define stamping-mutator/c
  (->* (string? string? string?) (#:at (or/c exact-nonnegative-integer? #f))
       any))

(provide (contract-out
          [mark-done-in-text stamping-mutator/c]
          [undo-done-in-text mutator/c]
          [mark-doing-in-text stamping-mutator/c]
          [undo-doing-in-text mutator/c])
         ;; the resolver surface the CLI and the other ops share, passed
         ;; through from the module that owns it (olai/meta)
         find-title-matches
         find-anchor-matches
         parse-title-or-anchor
         (struct-out title-match))

;; ---- how a state is spelled ------------------------------------------------

;; The metadata line a state writes: `@done 2026-08-05`.
(define ((state-line state stamp) pad)
  (format "~a@~a ~a" pad state stamp))

;; The title-prefix sugar that says the same thing as the field (docs/syntax.md:
;; one node, one of them), removed when the field is. Which prefix means which
;; state is lang/line's to know — this module does not spell `[x]` — so a
;; state that grows a checkbox grows it in one place. A title wearing no
;; checkbox, or another state's, comes back unchanged.
(define ((unsugar state) title-line)
  (define-values (indent content) (line-indent+content title-line))
  (define-values (text flag) (strip-checkbox-prefix content))
  (if (eq? flag state)
      (string-append (make-string indent #\space) text)
      title-line))

;; ---- what an op will and will not do ---------------------------------------
;;
;; Preconditions, as the sentence the user gets. They run before anything is
;; rewritten (olai/meta, #:check!).

(define ((refuses . states) m label _dropped)
  (for ([s (in-list states)])
    (when (eq? (title-match-status m) s)
      (user-fail "~a is already ~a (line ~a)" label s (title-match-line m)))))

(define ((demands state) m label _dropped)
  (unless (eq? (title-match-status m) state)
    (user-fail "~a is not ~a (line ~a)" label state (title-match-line m))))

;; ---- done ------------------------------------------------------------------

;; Insert `@done DATE` after the title's metadata. Clears doing on the way:
;; a node that is finished is not in flight, and leaving both would be a form
;; the language rejects on the next load.
;; title may be a plain title or ^anchor.
;; -> (values new-text line-1-based)
(define (mark-done-in-text text title today #:at [at #f])
  (define-values (new line _title)
    (update-meta! text title
                  #:at at
                  #:drop-fields '(doing)
                  #:retitle (unsugar 'doing)
                  #:insert-line (state-line 'done today)
                  #:check! (refuses 'done)))
  (values new line))

;; ---- doing -----------------------------------------------------------------

;; Insert `@doing DATE`. A done node is refused rather than reopened: undo
;; the done first, so nothing decides for you that finished work is not.
;; -> (values new-text line-1-based)
(define (mark-doing-in-text text title today #:at [at #f])
  (define-values (new line _title)
    (update-meta! text title
                  #:at at
                  #:insert-line (state-line 'doing today)
                  #:check! (refuses 'done 'doing)))
  (values new line))

;; ---- taking one off --------------------------------------------------------
;;
;; Marking is where the two states differ (done clears doing, doing refuses a
;; done node); UNMARKING is the same edit either way — drop the field, take
;; the checkbox off the title, and refuse a node that is not in the state.
;; So it is written once and the state is the argument.
;; -> (values new-text line-1-based)
(define ((undo-state state) text title #:at [at #f])
  (define-values (new line _title)
    (update-meta! text title
                  #:at at
                  #:drop-fields (list state)
                  #:retitle (unsugar state)
                  #:check! (demands state)))
  (values new line))

(define undo-done-in-text (undo-state 'done))
(define undo-doing-in-text (undo-state 'doing))
