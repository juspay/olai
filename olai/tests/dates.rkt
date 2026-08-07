#lang racket/base

;; The date grammar, and the month layout that outlived `olai calendar`.

(require racket/list
         olai/dates)

(module+ test
  (require rackunit))

;; ---- year-months ------------------------------------------------------------

(module+ test
  (test-case "a year-month parses, or answers that it did not"
    (define-values (y m) (parse-year-month "2026-08"))
    (check-equal? y 2026)
    (check-equal? m 8)
    (define-values (y2 m2) (parse-year-month "2026-13"))
    (check-false y2)
    (check-false m2)
    (define-values (y3 m3) (parse-year-month "nope"))
    (check-false y3)
    (check-false m3))

  (test-case "format pads the month"
    (check-equal? (format-year-month 2026 8) "2026-08")
    (check-equal? (format-year-month 2026 12) "2026-12"))

  (test-case "shifting crosses a year boundary in both directions"
    (check-equal? (shift-year-month "2026-08" 1) "2026-09")
    (check-equal? (shift-year-month "2026-12" 1) "2027-01")
    (check-equal? (shift-year-month "2026-01" -1) "2025-12")))

;; ---- the grid ---------------------------------------------------------------

(module+ test
  ;; August 2026 starts on a Saturday, so a Monday-first week pads five cells
  ;; ahead of the 1st.
  (test-case "a month lays out Mon-first, padded to whole weeks"
    (define cells (month-grid-dates "2026-08" "2026-08-03"))
    (check-equal? (length week-days) 7)
    (check-equal? (remainder (length cells) 7) 0)
    (check-equal? (length (filter values cells)) 31)
    (check-equal? (takef cells not) '(#f #f #f #f #f))
    (define first-day (list-ref cells 5))
    (check-equal? (hash-ref first-day 'date) "2026-08-01")
    (check-equal? (hash-ref first-day 'day_num) 1))

  (test-case "exactly one cell is today, and only when today is in the month"
    (define cells (month-grid-dates "2026-08" "2026-08-03"))
    (check-equal? (for/list ([c (in-list cells)]
                             #:when (and c (hash-ref c 'is_today)))
                    (hash-ref c 'date))
                  '("2026-08-03"))
    (check-equal? (for/list ([c (in-list (month-grid-dates "2026-09" "2026-08-03"))]
                             #:when (and c (hash-ref c 'is_today)))
                    c)
                  '()))

  (test-case "a month that starts on a Monday needs no lead padding"
    ;; 2026-06-01 is a Monday
    (define cells (month-grid-dates "2026-06" "2026-06-01"))
    (check-equal? (hash-ref (car cells) 'date) "2026-06-01"))

  (test-case "a year-month it cannot read is an error, not a wrong grid"
    (check-exn exn:fail? (λ () (month-grid-dates "2026-13" "2026-08-03")))))
