#lang racket/base

(require rackunit
         racket/set
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/calendar
         olai/dates)

(define (tk title date desc kids #:done [done #f] #:id [id #f])
  (make-task #:title title #:date date #:description desc #:done done
             #:id id #:children kids #:key (or id title)))

(module+ test
  (test-case "collect includes done; mirrors once"
    (define t
      (list
       (tk "A" "2026-08-01" #f
           (list (tk "B" "2026-08-02" #f '() #:done #t #:id "b")
                 (mirror-ref "b" #f)))))
    (define items (collect-cal-items t))
    (check-equal? (length items) 2)
    (check-equal? (sort (map (λ (it) (symbol->string (cal-item-status it)))
                             items)
                        string<?)
                  '("done" "open"))
    (check-equal? (length (filter (λ (i) (equal? (cal-item-title i) "B")) items))
                  1))

  (test-case "day nodes from bare ISO titles"
    (define t
      (list (tk "2026"
                #f #f
                (list (tk "August" #f #f
                          (list (tk "2026-08-03" #f #f
                                    (list (tk "note" #f #f '())))
                                (tk "not-a-date" #f #f '())))))))
    (define nodes (collect-day-nodes t))
    (check-true (set-member? nodes "2026-08-03"))
    (check-false (set-member? nodes "not-a-date"))
    (check-false (set-member? nodes "2026")))

  (test-case "calendar-for-month groups and marks day_node"
    (define items
      (list (cal-item "2026-08-04T09:30" "Dentist" "Inbox > Dentist" #f 'open #f)
            (cal-item "2026-07-01" "Old" "Old" #f 'open #f)
            (cal-item "2026-08-10" "Ship" "Ship" #t 'done "ship")))
    (define nodes (set "2026-08-03" "2026-08-04"))
    (define cal (calendar-for-month items nodes "2026-08"))
    (check-equal? (hash-ref cal 'month) "2026-08")
    (define days (hash-ref cal 'days))
    (define dates (map (λ (d) (hash-ref d 'date)) days))
    (check-not-false (member "2026-08-03" dates)) ; day node only
    (check-not-false (member "2026-08-04" dates))
    (check-not-false (member "2026-08-10" dates))
    (check-false (member "2026-07-01" dates))
    (define d3 (findf (λ (d) (equal? (hash-ref d 'date) "2026-08-03")) days))
    (check-true (hash-ref d3 'day_node))
    (check-equal? (hash-ref d3 'items) '()))

  (test-case "month-grid Mon-start for Aug 2026"
    ;; 2026-08-01 is Saturday -> lead 5 (Mon..Fri empty)
    (define cal (calendar-for-month '() (set) "2026-08"))
    (define cells (month-grid-cells "2026-08" cal "2026-08-03"))
    (check-equal? (remainder (length cells) 7) 0)
    (check-false (list-ref cells 0))
    (check-false (list-ref cells 4))
    (define sat (list-ref cells 5))
    (check-equal? (hash-ref sat 'day_num) 1)
    (check-equal? (hash-ref sat 'date) "2026-08-01")
    (define mon3 (findf (λ (c) (and c (equal? (hash-ref c 'date) "2026-08-03")))
                        cells))
    (check-true (hash-ref mon3 'is_today)))

  (test-case "shift-year-month"
    (check-equal? (shift-year-month "2026-08" -1) "2026-07")
    (check-equal? (shift-year-month "2026-01" -1) "2025-12")
    (check-equal? (shift-year-month "2026-12" 1) "2027-01"))

  (test-case "format-calendar plain"
    (define cal
      (calendar-for-month
       (list (cal-item "2026-08-04" "X" "A > X" #f 'open #f))
       (set)
       "2026-08"))
    (define s (format-calendar cal))
    (check-true (string-contains? s "CALENDAR 2026-08") s)
    (check-true (string-contains? s "2026-08-04") s)
    (check-true (string-contains? s "X") s)))
