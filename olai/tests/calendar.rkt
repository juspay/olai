#lang racket/base

(require racket/set
         (except-in olai/lang/expander #%module-begin)
         olai/calendar
         olai/dates)

(module+ test
  (require rackunit))

(module+ test
  (define (tk title date desc kids #:done [done #f] #:doing [doing #f] #:id [id #f])
    (make-task #:title title #:date date #:description desc #:done done
               #:doing doing #:id id #:children kids #:key (or id title))))

(module+ test
  (test-case "collect keeps every state; mirrors once"
    (define t
      (list
       (tk "A" "2026-08-01" #f
           (list (tk "B" "2026-08-02" #f '() #:done #t #:id "b")
                 (tk "C" "2026-08-02" #f '() #:doing "2026-08-01")
                 (mirror-ref "b" #f)))))
    (define items (collect-cal-items t))
    (check-equal? (length items) 3)
    (check-equal? (sort (map (λ (it) (symbol->string (cal-item-status it)))
                             items)
                        string<?)
                  '("doing" "done" "open"))
    ;; the stored mark rides along beside what it means
    (define c (findf (λ (i) (equal? (cal-item-title i) "C")) items))
    (check-equal? (cal-item-doing c) "2026-08-01")
    (check-false (cal-item-done c))
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
      (list (cal-item "2026-08-04T09:30" "Dentist" "Inbox > Dentist" #f #f 'open #f)
            (cal-item "2026-07-01" "Old" "Old" #f #f 'open #f)
            (cal-item "2026-08-10" "Ship" "Ship" #t #f 'done "ship")))
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

  ;; ---- the day nodes, as a month ------------------------------------------
  ;;
  ;; What the sidebar's calendar is drawn from: the same grid, asked which days
  ;; the journal HAS a node for and where that node is.

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
    (define cells (day-node-cells daily-tasks "2026-08" "2026-08-04"))
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
    (define cells (day-node-cells daily-tasks "2026-08" "2026-08-20"))
    (define today (findf (λ (c) (and c (hash-ref c 'is_today))) cells))
    (check-equal? (hash-ref today 'date) "2026-08-20")
    (check-false (hash-ref today 'key)))

  (test-case "a day says what it hangs under: the way out of one day"
    (define cells (day-node-cells daily-tasks "2026-08" "2026-08-04"))
    (define d (findf (λ (c) (and c (equal? (hash-ref c 'date) "2026-08-03")))
                     cells))
    (check-equal? (hash-ref d 'parent_key) "August")
    ;; a day node written at a file's top level has no way out
    (define flat (day-node-cells (list (tk "2026-08-03" #f #f '()))
                                 "2026-08" "2026-08-03"))
    (define top (findf (λ (c) (and c (equal? (hash-ref c 'date) "2026-08-03")))
                       flat))
    (check-equal? (hash-ref top 'key) "2026-08-03")
    (check-false (hash-ref top 'parent_key)))

  (test-case "a month the journal has nothing in is all inert"
    (define cells (day-node-cells daily-tasks "2026-09" "2026-09-15"))
    (check-equal? (length (filter values cells)) 30)
    (check-true (for/and ([c (in-list cells)])
                  (or (not c) (not (hash-ref c 'key))))))

  (test-case "shift-year-month"
    (check-equal? (shift-year-month "2026-08" -1) "2026-07")
    (check-equal? (shift-year-month "2026-01" -1) "2025-12")
    (check-equal? (shift-year-month "2026-12" 1) "2027-01")))
