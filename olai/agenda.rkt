#lang racket/base

;; Pure agenda: collect dated tasks, sort by date, group vs a today string.
;; Rendering is the web view's or json/reply's; the clock is the CLI's.

(require (except-in olai/lang/expander #%module-begin) ; task
         olai/dates
         olai/query)

(provide (struct-out dated-task)
         collect-dated
         agenda-groups
         agenda-groups-from-files)

;; date: ISO date or datetime string (YYYY-MM-DD[THH:MM[:SS]])
;; title: task title
;; breadcrumb: "A > B > title" path from root (optional file basename root)
(struct dated-task (date title breadcrumb) #:transparent)

;; #:root — optional string prepended to every breadcrumb (e.g. file basename).
;; An agenda is what is still OPEN: a node in any other state has had its say.
(define (collect-dated tasks #:root [root #f])
  (for/list ([d (in-list (collect-dated-nodes tasks #:root root))]
             #:when (eq? (task-status (dated-node-task d)) 'open))
    (define tk (dated-node-task d))
    (dated-task (task-date tk) (task-title tk) (dated-node-breadcrumb d))))

;; items: already-collected (listof dated-task)
(define (group-dated-items items today)
  (define sorted
    (sort items string<? #:key dated-task-date))
  (define-values (overdue today* upcoming)
    (for/fold ([ov '()] [td '()] [up '()])
              ([it (in-list sorted)])
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

;; -> (listof (cons group-sym (listof dated-task)))
;; group-sym is 'overdue | 'today | 'upcoming; empty groups omitted.
(define (agenda-groups tasks today #:root [root #f])
  (group-dated-items (collect-dated tasks #:root root) today))

;; file-entries: (listof (cons path tasks))
;; When more than one file, breadcrumbs are rooted at each file's basename.
(define (agenda-groups-from-files file-entries today)
  (group-dated-items
   (with-file-roots file-entries
                    (λ (tasks root) (collect-dated tasks #:root root)))
   today))
