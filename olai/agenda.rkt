#lang racket/base

;; Pure agenda: collect the nodes that are on your plate, sort them, group
;; them against a today string. Rendering is the web view's or json/reply's;
;; the clock is the CLI's.

(require racket/list
         (except-in olai/lang/expander #%module-begin) ; task
         olai/dates
         olai/query)

(provide (struct-out agenda-item)
         agenda-bucket
         agenda-item-blocked?
         collect-agenda
         agenda-groups
         agenda-groups-from-files)

;; date: ISO date or datetime string, or #f — a node someone CLAIMED is on the
;;       agenda whether or not anyone dated it
;; title: task title
;; breadcrumb: "A > B > title" path from root (optional file basename root)
;; status: 'open | 'doing — the state the node is in. 'done never reaches
;;         here: a finished node has had its say.
;; source: 'stored | 'derived — where that state came from (olai/lang/state).
;;         Carried because the DOING GROUP is not about the state, it is about
;;         the claim; see claimed-doing? below.
;; waiting: the nodes this one's unfinished `@after` targets name; empty when
;;         it is not blocked (olai/query, blocked-nodes)
;;
;; Which GROUP it lands in is not a field: it is `agenda-bucket` below, a
;; function of these facts and a day. A field would be one more thing to be
;; right about, and would have to hold some value on an item nobody has asked
;; the question of yet.
(struct agenda-item (date title breadcrumb status source waiting) #:transparent)

;; WHO SAID SO. `doing` derives — a parent of a node in flight is in flight,
;; all the way up (olai/lang/state) — and that is true of the TREE without
;; being an answer to "what are you on". Every ancestor of one `[/]` leaf would
;; be here, dateless, in the group that ignores dates, saying nothing the leaf
;; below it does not say better under a breadcrumb that names them all.
;;
;; So this group asks the narrower question the group is FOR: who claimed a
;; node. A claim is a mark somebody wrote — `@doing` / `[/]`, with who and
;; where in the node's notes (docs/cli.md) — and a derived state is nobody's
;; claim. The alternative rule, "only leaves", says almost the same thing by
;; accident (a leaf can derive nothing) and gets the one case that matters
;; wrong: an orchestrator marks the PARENT `[/]` and writes the terminal id
;; under it, which is the very thing this group exists to show.
(define (claimed-doing? tk) (eq? (task-stored-status tk) 'doing))

;; What is on the plate: every node someone claimed, and any unfinished node
;; someone dated. A done node is out even when it still carries a @date — and
;; done is done however it was arrived at, so a heading drops off the agenda on
;; the day its last child is finished.
;;
;; A node that DERIVES `doing` and carries a date is on the plate by its date,
;; in the bucket that date puts it in: it is unfinished work someone dated, and
;; the only thing the derived state changes is what `status` calls it.
(define (agenda-node? tk)
  (cond
    [(eq? (task-status tk) 'done) #f]
    [(claimed-doing? tk) #t]
    [else (and (task-date tk) #t)]))

;; #:root    — optional string prepended to every breadcrumb (file basename).
;; #:blocked — key -> the anchors that node is waiting on (olai/query). Empty
;;             is the honest default: an agenda over a tree nobody linked has
;;             no graph to be blocked by.
(define (collect-agenda tasks #:root [root #f] #:blocked [blocked (hash)])
  (for/list ([c (in-list (collect-nodes tasks agenda-node? #:root root))])
    (define tk (crumbed-node-task c))
    (agenda-item (task-date tk) (task-title tk) (crumbed-node-breadcrumb c)
                 (task-status tk)
                 (if (task-status-derived? tk) 'derived 'stored)
                 (hash-ref blocked (task-key tk) '()))))

;; The DOING group's membership, said once: in that state, and by somebody's
;; claim rather than by derivation (claimed-doing? above). An item that derives
;; `doing` is in whatever bucket its date puts it in.
(define (in-flight? it)
  (and (eq? (agenda-item-status it) 'doing)
       (eq? (agenda-item-source it) 'stored)))

;; Waiting on anything is being blocked, and that is the whole definition —
;; said here, where the grouping reads it, so the reply cannot answer it a
;; second way and disagree about which array an item is in.
(define (agenda-item-blocked? it) (pair? (agenda-item-waiting it)))

;; Dated first, in date order; undated after them in tree order (`sort` is
;; stable). Only the DOING group can hold an undated item, so only it needs
;; this — the date buckets sort on a date every member has.
(define (earlier? a b)
  (define da (agenda-item-date a))
  (define db (agenda-item-date b))
  (cond
    [(and da db) (string<? da db)]
    [else (and da #t)]))

;; WHERE AN ITEM SITS BY ITS OWN FACTS: 'overdue | 'doing | 'today | 'upcoming.
;; Bucket by calendar day; the sort still uses the full timestamp string.
;;
;; It is the group an item is in — except for a BLOCKED one, which is in the
;; blocked group and is still whatever this says. That is the whole reason it
;; is asked rather than read off the grouping: a node can be overdue AND
;; blocked, and both surfaces have to be able to say so.
(define (agenda-bucket it today)
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
  ;; BLOCKED comes out first, and that is the whole of what the group does: a
  ;; node waiting on something unfinished is not on today's plate, however
  ;; today its date is.
  (define-values (blocked actionable) (partition agenda-item-blocked? items))
  (define-values (doing dated) (partition in-flight? actionable))
  (define by-date (sort dated string<? #:key agenda-item-date))
  (define (in-bucket sym)
    (filter (λ (it) (eq? (agenda-bucket it today) sym)) by-date))
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
