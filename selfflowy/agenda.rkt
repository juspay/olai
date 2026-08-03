#lang racket/base

;; Pure agenda: collect dated tasks, sort by date, group vs a today string.
;; Plain-text formatting only (no ANSI). Printing/clock live in the CLI.

(require racket/list
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/dates)

(provide (struct-out dated-task)
         collect-dated
         agenda-groups
         format-agenda)

;; date: ISO date or datetime string (YYYY-MM-DD[THH:MM[:SS]])
;; title: task title
;; breadcrumb: "A > B > title" path from root
(struct dated-task (date title breadcrumb) #:transparent)

(define (collect-dated tasks)
  (define (walk tk ancestors)
    (define title (task-title tk))
    (define path (append ancestors (list title)))
    (define crumb (string-join path " > "))
    ;; Done tasks are excluded from the agenda even if they still have a date.
    (define here
      (if (and (task-date tk) (not (task-done tk)))
          (list (dated-task (task-date tk) title crumb))
          '()))
    (append here
            (append*
             (for/list ([c (in-list (task-children tk))])
               (walk c path)))))
  (append*
   (for/list ([tk (in-list tasks)])
     (walk tk '()))))

;; -> (listof (cons group-sym (listof dated-task)))
;; group-sym is 'overdue | 'today | 'upcoming; empty groups omitted.
;; Items within each group sorted by date ascending (ISO strings).
(define (agenda-groups tasks today)
  (define items
    (sort (collect-dated tasks)
          string<?
          #:key dated-task-date))
  (define-values (overdue today* upcoming)
    (for/fold ([ov '()] [td '()] [up '()])
              ([it (in-list items)])
      ;; Bucket by calendar day; sort still uses full timestamp string.
      (define day (date-day-prefix (dated-task-date it)))
      (cond
        [(string<? day today) (values (cons it ov) td up)]
        [(string=? day today) (values ov (cons it td) up)]
        [else (values ov td (cons it up))])))
  (define groups
    (list (cons 'overdue (reverse overdue))
          (cons 'today (reverse today*))
          (cons 'upcoming (reverse upcoming))))
  (filter (λ (g) (not (null? (cdr g)))) groups))

(define (group-header sym)
  (case sym
    [(overdue) "OVERDUE"]
    [(today) "TODAY"]
    [(upcoming) "UPCOMING"]
    [else (symbol->string sym)]))

(define (format-dated-task it)
  (define line1
    (format "  [~a]  ~a" (dated-task-date it) (dated-task-title it)))
  (define line2
    (string-append "         " (dated-task-breadcrumb it)))
  (string-append line1 "\n" line2))

;; Render grouped agenda to a string. Empty => "no dated tasks".
(define (format-agenda groups)
  (if (null? groups)
      "no dated tasks"
      (string-join
       (for/list ([g (in-list groups)])
         (define header (group-header (car g)))
         (define body
           (string-join
            (map format-dated-task (cdr g))
            "\n"))
         (string-append header "\n" body))
       "\n\n")))
