#lang racket/base

;; The day journal as a MONTH: what the sidebar's calendar is drawn from. Which
;; days the outline has a node for, where each one is, and the one address the
;; month as a whole is reached at.

(require racket/list
         (except-in olai/lang/expander #%module-begin)
         olai/journal)

(module+ test
  (require rackunit))

(module+ test
  (define (tk title date desc kids #:id [id #f])
    (make-task #:title title #:date date #:description desc #:id id
               #:children kids #:key (or id title)))

  (define daily-tasks
    (list (tk "2026" #f #f
              (list (tk "August" #f #f
                        (list (tk "2026-08-03" #f #f
                                  (list (tk "Setup day" #f #f '())))
                              (tk "2026-08-04" #f #f '())
                              ;; a dated task is not a day: it has no page of
                              ;; its own to be a cell's link
                              (tk "Dentist" "2026-08-06T09:30" #f '())))))))

  (test-case "a day with a node carries its key; every other cell is inert"
    (define cells (day-month-cells (day-month-for daily-tasks "2026-08" "2026-08-04")))
    (define (cell date)
      (findf (λ (c) (and c (equal? (hash-ref c 'date) date))) cells))
    (check-equal? (hash-ref (cell "2026-08-03") 'key) "2026-08-03")
    (check-equal? (hash-ref (cell "2026-08-04") 'key) "2026-08-04")
    ;; dated, but not a day node: nothing to link to
    (check-false (hash-ref (cell "2026-08-06") 'key))
    (check-false (hash-ref (cell "2026-08-20") 'key))
    ;; the whole month is there, padded to whole weeks
    (check-equal? (remainder (length cells) 7) 0)
    (check-equal? (length (filter values cells)) 31))

  (test-case "today is the cell it falls on, node or no node"
    (define cells (day-month-cells (day-month-for daily-tasks "2026-08" "2026-08-20")))
    (define today (findf (λ (c) (and c (hash-ref c 'is_today))) cells))
    (check-equal? (hash-ref today 'date) "2026-08-20")
    (check-false (hash-ref today 'key)))

  ;; The month as a whole is reached at the node its days hang under: one
  ;; address, on the month, rather than something a reader picks out of cells.
  (test-case "the month is addressed by what its days hang under"
    (check-equal? (day-month-key (day-month-for daily-tasks "2026-08" "2026-08-04"))
                  "August")
    ;; a month with no days falls back to the outline's first node, so a fresh
    ;; month is still a way in
    (check-equal? (day-month-key (day-month-for daily-tasks "2026-09" "2026-09-15"))
                  "2026")
    ;; a day node at a file's top level hangs under nothing, and the fallback
    ;; is that node itself — the outline's first
    (check-equal? (day-month-key
                   (day-month-for (list (tk "2026-08-03" #f #f '()))
                                  "2026-08" "2026-08-03"))
                  "2026-08-03")
    ;; and an outline with nothing in it has nowhere to go
    (check-false (day-month-key (day-month-for '() "2026-08" "2026-08-03"))))

  (test-case "a month the journal has nothing in is all inert"
    (define cells (day-month-cells (day-month-for daily-tasks "2026-09" "2026-09-15")))
    (check-equal? (length (filter values cells)) 30)
    (check-true (for/and ([c (in-list cells)])
                  (or (not c) (not (hash-ref c 'key))))))

  ;; The columns and the padding are one fact (week-days): a grid whose first
  ;; column is Monday has to start the month on the right one.
  (test-case "the month lands on the week this grid lays out"
    (define cells (month-grid-dates "2026-08" "2026-08-03"))
    ;; 2026-08-01 is a Saturday: the sixth column of a Monday-first week
    (check-equal? (for/first ([c (in-list cells)] [i (in-naturals)] #:when c) i)
                  5)
    (check-equal? (length week-days) 7)
    (check-equal? (remainder (length cells) (length week-days)) 0)
    (define first-day (findf values cells))
    (check-equal? (hash-ref first-day 'date) "2026-08-01")
    (check-equal? (hash-ref first-day 'day_num) 1)
    (check-false (hash-ref first-day 'is_today))
    (check-true (hash-ref (findf (λ (c) (and c (equal? (hash-ref c 'date)
                                                       "2026-08-03")))
                                 cells)
                          'is_today)))

  ;; The journal is recognised by its BASENAME, the way the archive is
  ;; (olai/archive) — a path or a label a renderer already reduced to one.
  (test-case "which root is the journal"
    (check-true (daily-file? "Daily.rkt"))
    (check-true (daily-file? "/home/me/notes/Daily.rkt"))
    (check-true (daily-file? (string->path "/home/me/notes/Daily.rkt")))
    (check-false (daily-file? "Tasks.rkt"))
    (check-false (daily-file? "Daily/2026-08.rkt"))
    (check-false (daily-file? #f)))

  (test-case "a month's name and its fragment"
    (check-equal? (month-name 1) "January")
    (check-equal? (month-name 8) "August")
    (check-equal? (month-fragment-rel 2026 8) "Daily/2026-08.rkt")
    (check-equal? (month-fragment-rel 2026 12) "Daily/2026-12.rkt")))
