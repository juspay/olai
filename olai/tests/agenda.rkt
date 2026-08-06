#lang racket/base

(require rackunit
         racket/list
         racket/path
         (except-in olai/lang/expander #%module-begin)
         olai/agenda)

(define (tk title date desc kids #:done [done #f] #:doing [doing #f] #:id [id #f])
  (make-task #:title title #:date date #:description desc #:done done
             #:doing doing #:id id #:children kids #:key (or id title)))

(module+ test
  (define sample
    (list
     (tk "Inbox" #f #f
         (list
          (tk "Old" "2026-07-01" #f '())
          (tk "Milk" "2026-08-03" #f '())
          (tk "Nested" #f #f
              (list (tk "Later" "2026-09-15" #f '())))))
     (tk "Root2" #f #f
         (list (tk "Soon" "2026-08-10" #f '())
               (tk "Also today" "2026-08-03" #f '())))))

  (test-case "empty tasks => no groups"
    (check-equal? (agenda-groups '() "2026-08-03") '()))

  (test-case "no dated tasks => no groups"
    (check-equal?
     (agenda-groups (list (tk "A" #f #f (list (tk "B" #f #f '()))))
                    "2026-08-03")
     '()))

  (test-case "groups overdue / today / upcoming with fixed today"
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map car groups) '(overdue today upcoming))
    (define ov (cdr (assq 'overdue groups)))
    (define td (cdr (assq 'today groups)))
    (define up (cdr (assq 'upcoming groups)))
    (check-equal? (map agenda-item-title ov) '("Old"))
    (check-equal? (map agenda-item-date ov) '("2026-07-01"))
    (check-equal? (map agenda-item-title td) '("Milk" "Also today"))
    (check-equal? (map agenda-item-date td) '("2026-08-03" "2026-08-03"))
    (check-equal? (map agenda-item-title up) '("Soon" "Later"))
    (check-equal? (map agenda-item-date up) '("2026-08-10" "2026-09-15")))

  (test-case "sort order is date ascending within and across groups"
    (define groups (agenda-groups sample "2026-08-03"))
    (define all
      (append* (map cdr groups)))
    (check-equal? (map agenda-item-date all)
                  '("2026-07-01" "2026-08-03" "2026-08-03" "2026-08-10" "2026-09-15")))

  (test-case "breadcrumbs include ancestors and title"
    (define items (collect-agenda sample))
    (define later
      (findf (λ (it) (equal? (agenda-item-title it) "Later")) items))
    (check-equal? (agenda-item-breadcrumb later) "Inbox > Nested > Later")
    (define milk
      (findf (λ (it) (equal? (agenda-item-title it) "Milk")) items))
    (check-equal? (agenda-item-breadcrumb milk) "Inbox > Milk"))

  (test-case "omit empty groups"
    (define only-future
      (list (tk "A" "2099-01-01" #f '())))
    (define groups (agenda-groups only-future "2026-08-03"))
    (check-equal? (map car groups) '(upcoming))
    (define only-past
      (list (tk "A" "2000-01-01" #f '())))
    (check-equal? (map car (agenda-groups only-past "2026-08-03"))
                  '(overdue)))

  (test-case "datetime on today buckets as TODAY; sorts by full timestamp"
    (define sample
      (list
       (tk "A" "2026-08-03T09:00" #f '())
       (tk "B" "2026-08-03T18:00" #f '())
       (tk "C" "2026-08-02T23:00" #f '())
       (tk "D" "2026-08-04T01:00" #f '())))
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map car groups) '(overdue today upcoming))
    (check-equal? (map agenda-item-title (cdr (assq 'overdue groups))) '("C"))
    (check-equal? (map agenda-item-title (cdr (assq 'today groups))) '("A" "B"))
    (check-equal? (map agenda-item-date (cdr (assq 'today groups)))
                  '("2026-08-03T09:00" "2026-08-03T18:00"))
    (check-equal? (map agenda-item-title (cdr (assq 'upcoming groups))) '("D")))

  (test-case "done tasks excluded from agenda even when dated"
    (define sample
      (list
       (tk "Open overdue" "2026-07-01" #f '())
       (tk "Done overdue" "2026-07-01" #f '() #:done #t)
       (tk "Done today" "2026-08-03" #f '() #:done "2026-08-03")
       (tk "Open today" "2026-08-03" #f '())
       (tk "Done upcoming" "2026-09-01" #f '() #:done #t)))
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map car groups) '(overdue today))
    (check-equal? (map agenda-item-title (cdr (assq 'overdue groups)))
                  '("Open overdue"))
    (check-equal? (map agenda-item-title (cdr (assq 'today groups)))
                  '("Open today")))

  ;; ---- the DOING group -----------------------------------------------------
  ;;
  ;; The agenda's question is what is on the plate. A node in flight is on it
  ;; whether or not anyone dated it, which is the whole reason the group is
  ;; not just another date bucket.

  (test-case "doing nodes group above today, dated or not"
    (define sample
      (list
       (tk "Late" "2026-07-01" #f '())
       (tk "In flight" #f #f '() #:doing #t)
       (tk "Due today" "2026-08-03" #f '())
       (tk "Later" "2026-09-01" #f '())))
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map car groups) '(overdue doing today upcoming))
    (check-equal? (map agenda-item-title (cdr (assq 'doing groups)))
                  '("In flight"))
    (check-false (agenda-item-date (car (cdr (assq 'doing groups))))))

  (test-case "a dated doing node is in DOING and nowhere else"
    (define sample
      (list (tk "Started, overdue" "2026-07-01" #f '() #:doing "2026-08-02")
            (tk "Started, today" "2026-08-03" #f '() #:doing #t)))
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map car groups) '(doing))
    (check-equal? (map agenda-item-title (cdr (assq 'doing groups)))
                  '("Started, overdue" "Started, today"))
    (check-equal? (map agenda-item-date (cdr (assq 'doing groups)))
                  '("2026-07-01" "2026-08-03")))

  (test-case "within DOING: dated first by date, undated last in tree order"
    (define sample
      (list (tk "No date A" #f #f '() #:doing #t)
            (tk "Dated late" "2026-09-01" #f '() #:doing #t)
            (tk "No date B" #f #f '() #:doing #t)
            (tk "Dated early" "2026-01-01" #f '() #:doing #t)))
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map agenda-item-title (cdr (assq 'doing groups)))
                  '("Dated early" "Dated late" "No date A" "No date B")))

  (test-case "done wins over doing; a done node is off the agenda either way"
    (define sample
      (list (tk "Finished" "2026-07-01" #f '() #:done #t #:doing #t)
            (tk "Open" "2026-07-01" #f '())))
    (define groups (agenda-groups sample "2026-08-03"))
    (check-equal? (map car groups) '(overdue))
    (check-equal? (map agenda-item-title (cdr (assq 'overdue groups)))
                  '("Open")))

  (test-case "every item says which state put it in its group"
    (define sample
      (list (tk "Late" "2026-07-01" #f '())
            (tk "In flight" #f #f '() #:doing #t)))
    (define items (collect-agenda sample))
    (check-equal? (sort (map (λ (i) (symbol->string (agenda-item-status i)))
                             items)
                        string<?)
                  '("doing" "open")))

  (test-case "an undated doing node still gets a breadcrumb"
    (define sample
      (list (tk "Inbox" #f #f (list (tk "In flight" #f #f '() #:doing #t)))))
    (define it (car (collect-agenda sample)))
    (check-equal? (agenda-item-breadcrumb it) "Inbox > In flight"))

  (test-case "multi-file merge roots breadcrumbs at basename"
    (define a (list (tk "Milk" "2026-08-01" #f '())))
    (define b (list (tk "Later" "2026-09-01" #f '())))
    (define groups
      (agenda-groups-from-files
       (list (cons (string->path "/tmp/Tasks.rkt") a)
             (cons (string->path "/tmp/Roadmap.rkt") b))
       "2026-08-03"))
    (check-equal? (map car groups) '(overdue upcoming))
    (define ov (car (cdr (assq 'overdue groups))))
    (define up (car (cdr (assq 'upcoming groups))))
    (check-equal? (agenda-item-breadcrumb ov) "Tasks.rkt > Milk")
    (check-equal? (agenda-item-breadcrumb up) "Roadmap.rkt > Later")
    ;; single file: no file root
    (define one
      (agenda-groups-from-files
       (list (cons (string->path "/tmp/Tasks.rkt") a))
       "2026-08-03"))
    (check-equal? (agenda-item-breadcrumb (car (cdr (assq 'overdue one))))
                  "Milk")))
