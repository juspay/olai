#lang racket/base

;; Pure agenda: collect dated tasks, sort by date, group vs a today string.
;; Plain-text formatting only (no ANSI). Printing/clock live in the CLI.

(require racket/list
         racket/path
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/dates)

(provide (struct-out dated-task)
         collect-dated
         agenda-groups
         agenda-groups-from-files
         format-agenda)

;; date: ISO date or datetime string (YYYY-MM-DD[THH:MM[:SS]])
;; title: task title
;; breadcrumb: "A > B > title" path from root (optional file basename root)
(struct dated-task (date title breadcrumb) #:transparent)

;; #:root — optional string prepended to every breadcrumb (e.g. file basename).
(define (collect-dated tasks #:root [root #f])
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
  (define start (if root (list root) '()))
  (append*
   (for/list ([tk (in-list tasks)])
     (walk tk start))))

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
  (define multi? (> (length file-entries) 1))
  (define items
    (append*
     (for/list ([e (in-list file-entries)])
       (define path (car e))
       (define tasks (cdr e))
       (define root
         (and multi?
              (path->string (file-name-from-path path))))
       (collect-dated tasks #:root root))))
  (group-dated-items items today))

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
