#lang racket/base

;; Set / rewrite / clear @date on an outline title (TITLE or ^anchor).
;; Two more argument sets for the metadata engine (olai/meta).

(require olai/dates
         olai/fail
         olai/meta)

(provide set-date-in-text
         clear-date-in-text)

;; -> (values new-text line-1-based resolved-title normalized-date)
(define (set-date-in-text text title-or-anchor date-str #:at [at #f])
  (unless (valid-iso-date-string? date-str)
    (user-fail "invalid date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]"
               date-str))
  (define date* (normalize-date-string date-str))
  (define-values (new line title)
    (update-meta! text title-or-anchor
                  #:at at
                  #:drop-fields '(date)
                  #:insert-line (λ (pad) (string-append pad "@date " date*))))
  (values new line title date*))

;; -> (values new-text line-1-based resolved-title)
(define (clear-date-in-text text title-or-anchor #:at [at #f])
  (update-meta! text title-or-anchor
                #:at at
                #:drop-fields '(date)
                #:check!
                (λ (m label dropped)
                  (when (null? dropped)
                    (user-fail "~a has no @date to clear (line ~a)"
                               label (title-match-line m))))))
