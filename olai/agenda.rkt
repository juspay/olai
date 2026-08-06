#lang racket/base

;; Pure agenda: collect the nodes that are on your plate, sort them, group
;; them against a today string. Rendering is the web view's or json/reply's;
;; the clock is the CLI's.

(require racket/list
         (except-in olai/lang/expander #%module-begin) ; task
         olai/dates
         olai/query)

(provide (struct-out agenda-item)
         collect-agenda
         agenda-groups
         agenda-groups-from-files)

;; date: ISO date or datetime string, or #f — a node IN FLIGHT is on the
;;       agenda whether or not anyone dated it
;; title: task title
;; breadcrumb: "A > B > title" path from root (optional file basename root)
;; status: 'open | 'doing — which group this item belongs to. 'done never
;;         reaches here: a finished node has had its say.
(struct agenda-item (date title breadcrumb status) #:transparent)

;; What is on the plate: every node in flight, and any OPEN node someone
;; dated. A done node is out even when it still carries a @date.
(define (agenda-node? tk)
  (case (task-status tk)
    [(doing) #t]
    [(open) (and (task-date tk) #t)]
    [else #f]))

;; #:root — optional string prepended to every breadcrumb (e.g. file basename).
(define (collect-agenda tasks #:root [root #f])
  (for/list ([c (in-list (collect-nodes tasks agenda-node? #:root root))])
    (define tk (crumbed-node-task c))
    (agenda-item (task-date tk) (task-title tk) (crumbed-node-breadcrumb c)
                 (task-status tk))))

(define (in-flight? it) (eq? (agenda-item-status it) 'doing))

;; Dated first, in date order; undated after them in tree order (`sort` is
;; stable). Only the DOING group can hold an undated item, so only it needs
;; this — the date buckets sort on a date every member has.
(define (earlier? a b)
  (define da (agenda-item-date a))
  (define db (agenda-item-date b))
  (cond
    [(and da db) (string<? da db)]
    [else (and da #t)]))

;; items: already-collected (listof agenda-item)
(define (group-agenda-items items today)
  (define-values (doing dated) (partition in-flight? items))
  (define-values (overdue today* upcoming)
    (for/fold ([ov '()] [td '()] [up '()])
              ([it (in-list (sort dated string<? #:key agenda-item-date))])
      ;; Bucket by calendar day; sort still uses full timestamp string.
      (define day (date-day-prefix (agenda-item-date it)))
      (cond
        [(string<? day today) (values (cons it ov) td up)]
        [(string=? day today) (values ov (cons it td) up)]
        [else (values ov td (cons it up))])))
  ;; DOING sits above TODAY: what you are on outranks what you planned for
  ;; the day, and below what is already late.
  (define groups
    (list (cons 'overdue (reverse overdue))
          (cons 'doing (sort doing earlier?))
          (cons 'today (reverse today*))
          (cons 'upcoming (reverse upcoming))))
  (filter (λ (g) (not (null? (cdr g)))) groups))

;; -> (listof (cons group-sym (listof agenda-item)))
;; group-sym is 'overdue | 'doing | 'today | 'upcoming; empty groups omitted.
(define (agenda-groups tasks today #:root [root #f])
  (group-agenda-items (collect-agenda tasks #:root root) today))

;; file-entries: (listof (cons path tasks))
;; When more than one file, breadcrumbs are rooted at each file's basename.
(define (agenda-groups-from-files file-entries today)
  (group-agenda-items
   (with-file-roots file-entries
                    (λ (tasks root) (collect-agenda tasks #:root root)))
   today))
