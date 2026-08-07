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
;; status: 'open | 'doing — the state the node is in. 'done never reaches
;;         here: a finished node has had its say.
;; bucket: 'overdue | 'doing | 'today | 'upcoming — where the item sits by its
;;         own facts, filled in against `today` when the groups are made. It is
;;         kept on the item because a BLOCKED item is in the blocked group and
;;         still overdue, and the agenda has to be able to say both.
;; waiting: the anchors this node's unfinished `@after` targets name; empty
;;         when it is not blocked (olai/query, blocked-nodes)
(struct agenda-item (date title breadcrumb status bucket waiting) #:transparent)

;; What is on the plate: every node in flight, and any OPEN node someone
;; dated. A done node is out even when it still carries a @date.
(define (agenda-node? tk)
  (case (task-status tk)
    [(doing) #t]
    [(open) (and (task-date tk) #t)]
    [else #f]))

;; #:root    — optional string prepended to every breadcrumb (file basename).
;; #:blocked — key -> the anchors that node is waiting on (olai/query). Empty
;;             is the honest default: an agenda over a tree nobody linked has
;;             no graph to be blocked by.
(define (collect-agenda tasks #:root [root #f] #:blocked [blocked (hash)])
  (for/list ([c (in-list (collect-nodes tasks agenda-node? #:root root))])
    (define tk (crumbed-node-task c))
    (agenda-item (task-date tk) (task-title tk) (crumbed-node-breadcrumb c)
                 (task-status tk)
                 #f
                 (hash-ref blocked (task-key tk) '()))))

(define (in-flight? it) (eq? (agenda-item-status it) 'doing))

(define (blocked? it) (pair? (agenda-item-waiting it)))

;; Dated first, in date order; undated after them in tree order (`sort` is
;; stable). Only the DOING group can hold an undated item, so only it needs
;; this — the date buckets sort on a date every member has.
(define (earlier? a b)
  (define da (agenda-item-date a))
  (define db (agenda-item-date b))
  (cond
    [(and da db) (string<? da db)]
    [else (and da #t)]))

;; Where an item sits by its own facts. Bucket by calendar day; the sort still
;; uses the full timestamp string.
(define (bucket-of it today)
  (cond
    [(in-flight? it) 'doing]
    [else
     (define day (date-day-prefix (agenda-item-date it)))
     (cond
       [(string<? day today) 'overdue]
       [(string=? day today) 'today]
       [else 'upcoming])]))

;; items: already-collected (listof agenda-item)
(define (group-agenda-items items today)
  (define stamped
    (for/list ([it (in-list items)])
      (struct-copy agenda-item it [bucket (bucket-of it today)])))
  ;; BLOCKED comes out first, and that is the whole of what the group does: a
  ;; node waiting on something unfinished is not on today's plate, however
  ;; today its date is. It keeps its bucket, so the reply can say a thing is
  ;; overdue AND blocked — which is the state a person most needs to see.
  (define-values (blocked actionable) (partition blocked? stamped))
  (define-values (doing dated) (partition in-flight? actionable))
  (define by-date (sort dated string<? #:key agenda-item-date))
  (define (in-bucket sym)
    (filter (λ (it) (eq? (agenda-item-bucket it) sym)) by-date))
  ;; DOING sits above TODAY: what you are on outranks what you planned for
  ;; the day, and below what is already late. BLOCKED sits under all of them:
  ;; it is the one group you cannot act on.
  (define groups
    (list (cons 'overdue (in-bucket 'overdue))
          (cons 'doing (sort doing earlier?))
          (cons 'today (in-bucket 'today))
          (cons 'upcoming (in-bucket 'upcoming))
          (cons 'blocked (sort blocked earlier?))))
  (filter (λ (g) (not (null? (cdr g)))) groups))

;; -> (listof (cons group-sym (listof agenda-item)))
;; group-sym is 'overdue | 'doing | 'today | 'upcoming | 'blocked; empty groups
;; omitted.
(define (agenda-groups tasks today #:root [root #f] #:blocked [blocked (hash)])
  (group-agenda-items (collect-agenda tasks #:root root #:blocked blocked) today))

;; file-entries: (listof (cons path tasks))
;; When more than one file, breadcrumbs are rooted at each file's basename.
(define (agenda-groups-from-files file-entries today #:blocked [blocked (hash)])
  (group-agenda-items
   (with-file-roots file-entries
                    (λ (tasks root)
                      (collect-agenda tasks #:root root #:blocked blocked)))
   today))
