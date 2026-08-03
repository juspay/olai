#lang racket/base

(require rackunit
         racket/list
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/agenda)

(module+ test
  (define sample
    (list
     (task "Inbox" #f #f
           (list
            (task "Old" "2026-07-01" #f '())
            (task "Milk" "2026-08-03" #f '())
            (task "Nested" #f #f
                  (list (task "Later" "2026-09-15" #f '())))))
     (task "Root2" #f #f
           (list (task "Soon" "2026-08-10" #f '())
                 (task "Also today" "2026-08-03" #f '())))))

  (test-case "empty tasks => no groups"
    (check-equal? (agenda-groups '() "2026-08-03") '()))

  (test-case "no dated tasks => no groups"
    (check-equal?
     (agenda-groups (list (task "A" #f #f (list (task "B" #f #f '()))))
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
      (list (task "A" "2099-01-01" #f '())))
    (define groups (agenda-groups only-future "2026-08-03"))
    (check-equal? (map car groups) '(upcoming))
    (define only-past
      (list (task "A" "2000-01-01" #f '())))
    (check-equal? (map car (agenda-groups only-past "2026-08-03"))
                  '(overdue)))

  (test-case "format-agenda empty message"
    (check-equal? (format-agenda '()) "no dated tasks")))
