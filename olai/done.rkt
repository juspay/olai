#lang racket/base

;; Mark / unmark done in outline (#lang olai) source text.
;; Two argument sets for the metadata engine (olai/meta): insert an
;; @done line, or drop it and un-check the title.

(require olai/fail
         olai/meta)

(provide mark-done-in-text
         undo-done-in-text
         ;; the resolver surface the CLI and the other ops share
         find-title-matches
         find-anchor-matches
         parse-title-or-anchor
         (struct-out title-match))

;; Insert `@done DATE` after the title's metadata. Fails if already done.
;; title may be a plain title or ^anchor.
;; -> (values new-text line-1-based)
(define (mark-done-in-text text title today #:at [at #f])
  (define-values (new line _title)
    (update-meta! text title
                  #:at at
                  #:insert-line (λ (pad) (string-append pad "@done " today))
                  #:check!
                  (λ (m label _dropped)
                    (when (title-match-already-done? m)
                      (user-fail "~a is already done (line ~a)"
                                 label (title-match-line m))))))
  (values new line))

;; Remove done state: strip @done metadata and the [x]/[X] title prefix.
;; -> (values new-text line-1-based)
(define (undo-done-in-text text title #:at [at #f])
  (define-values (new line _title)
    (update-meta! text title
                  #:at at
                  #:drop-field 'done
                  #:retitle uncheck
                  #:check!
                  (λ (m label _dropped)
                    (unless (title-match-already-done? m)
                      (user-fail "~a is not done (line ~a)"
                                 label (title-match-line m))))))
  (values new line))

(define (uncheck title-line)
  (cond
    [(regexp-match #px"^( *)\\[[xX]\\] (.*)$" title-line)
     => (λ (m) (string-append (cadr m) (caddr m)))]
    [else title-line]))
