#lang racket/base

;; Set / rewrite / clear @date on an outline title (TITLE or ^anchor).
;; Two more argument sets for the metadata engine (selfflowy/meta).

(require selfflowy/dates
         selfflowy/meta)

(provide set-date-in-text
         clear-date-in-text)

;; -> (values new-text line-1-based resolved-title normalized-date)
(define (set-date-in-text text title-or-anchor date-str)
  (unless (valid-iso-date-string? date-str)
    (error 'set-date-in-text
           "invalid date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]"
           date-str))
  (define date* (normalize-date-string date-str))
  (define-values (new line title)
    (update-meta! text title-or-anchor
                  #:who 'set-date-in-text
                  #:drop-field 'date
                  #:insert-line (λ (pad) (string-append pad "@date " date*))))
  (values new line title date*))

;; -> (values new-text line-1-based resolved-title)
(define (clear-date-in-text text title-or-anchor)
  (update-meta! text title-or-anchor
                #:who 'clear-date-in-text
                #:drop-field 'date
                #:check!
                (λ (m label dropped)
                  (when (null? dropped)
                    (error 'clear-date-in-text
                           "no @date on ~s (line ~a)"
                           label (title-match-line m))))))
