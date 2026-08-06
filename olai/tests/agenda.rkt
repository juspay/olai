#lang racket/base

(require rackunit
         racket/list
         racket/path
         (except-in olai/lang/expander #%module-begin)
         olai/agenda)

(define (tk title date desc kids #:done [done #f] #:id [id #f])
  (make-task #:title title #:date date #:description desc #:done done
             #:id id #:children kids #:key (or id title)))

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
    (check-equal? (map dated-task-title ov) '("Old"))
    (check-equal? (map dated-task-date ov) '("2026-07-01"))
    (check-equal? (map dated-task-title td) '("Milk" "Also today"))
    (check-equal? (map dated-task-date td) '("2026-08-03" "2026-08-03"))
    (check-equal? (map dated-task-title up) '("Soon" "Later"))
    (check-equal? (map dated-task-date up) '("2026-08-10" "2026-09-15")))

  (test-case "sort order is date ascending within and across groups"
    (define groups (agenda-groups sample "2026-08-03"))
    (define all
      (append* (map cdr groups)))
    (check-equal? (map dated-task-date all)
                  '("2026-07-01" "2026-08-03" "2026-08-03" "2026-08-10" "2026-09-15")))

  (test-case "breadcrumbs include ancestors and title"
    (define items (collect-dated sample))
    (define later
      (findf (λ (it) (equal? (dated-task-title it) "Later")) items))
    (check-equal? (dated-task-breadcrumb later) "Inbox > Nested > Later")
    (define milk
      (findf (λ (it) (equal? (dated-task-title it) "Milk")) items))
    (check-equal? (dated-task-breadcrumb milk) "Inbox > Milk"))

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
    (check-equal? (map dated-task-title (cdr (assq 'overdue groups))) '("C"))
    (check-equal? (map dated-task-title (cdr (assq 'today groups))) '("A" "B"))
    (check-equal? (map dated-task-date (cdr (assq 'today groups)))
                  '("2026-08-03T09:00" "2026-08-03T18:00"))
    (check-equal? (map dated-task-title (cdr (assq 'upcoming groups))) '("D")))

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
    (check-equal? (map dated-task-title (cdr (assq 'overdue groups)))
                  '("Open overdue"))
    (check-equal? (map dated-task-title (cdr (assq 'today groups)))
                  '("Open today")))

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
    (check-equal? (dated-task-breadcrumb ov) "Tasks.rkt > Milk")
    (check-equal? (dated-task-breadcrumb up) "Roadmap.rkt > Later")
    ;; single file: no file root
    (define one
      (agenda-groups-from-files
       (list (cons (string->path "/tmp/Tasks.rkt") a))
       "2026-08-03"))
    (check-equal? (dated-task-breadcrumb (car (cdr (assq 'overdue one))))
                  "Milk")))
