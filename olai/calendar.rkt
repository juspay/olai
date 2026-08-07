#lang racket/base

;; Pure calendar query: group dated tasks by calendar day (includes done).
;; Day nodes (bare ISO titles in Daily.rkt) are tracked separately for links.

(require racket/list
         racket/match
         racket/set
         racket/string
         racket/format
         (except-in olai/lang/expander #%module-begin)
         olai/dates
         ;; the one walk over a task tree, and its mirror policy: a day node is
         ;; counted where it is DEFINED, like everything else here
         (only-in olai/lang/walk fold-tasks)
         olai/query
         (only-in gregor
                  date
                  +months
                  days-in-month
                  ->wday
                  ->year
                  ->month))

(provide (struct-out cal-item)
         collect-cal-items
         collect-day-nodes
         calendar-for-month
         calendar-from-files
         month-grid-cells
         day-node-cells
         parse-year-month
         shift-year-month
         format-year-month)

;; done / doing: the stored marks, #f | #t | ISO timestamp (what JSON
;;         serializes)
;; status: what they MEAN — 'open | 'doing | 'done, derived once
;;         (lang/expander)
;; id: task-id or #f
(struct cal-item (date title breadcrumb done doing status id) #:transparent)

;; Unlike the agenda, nothing is filtered out by state: a calendar shows what
;; happened.
(define (collect-cal-items tasks #:root [root #f])
  (for/list ([d (in-list (collect-dated-nodes tasks #:root root))])
    (define tk (crumbed-node-task d))
    (cal-item (task-date tk) (task-title tk) (crumbed-node-breadcrumb d)
              (task-done tk) (task-doing tk) (task-status tk) (task-id tk))))

;; Bare ISO day titles (Daily.rkt day nodes). -> setof "YYYY-MM-DD"
(define (collect-day-nodes tasks)
  (list->set (collect-day-titles tasks)))

;; "2026-08" -> (values 2026 8) or (values #f #f)
(define (parse-year-month s)
  (match s
    [(regexp #px"^([0-9]{4})-([0-9]{2})$" (list _ year month))
     (define y (string->number year))
     (define mo (string->number month))
     (if (and y mo (<= 1 mo 12))
         (values y mo)
         (values #f #f))]
    [_ (values #f #f)]))

(define (format-year-month y m)
  (format "~a-~a" y (~r m #:min-width 2 #:pad-string "0")))

(define (iso-day y m d)
  (format "~a-~a-~a"
          y
          (~r m #:min-width 2 #:pad-string "0")
          (~r d #:min-width 2 #:pad-string "0")))

(define (shift-year-month ym delta-months)
  (define-values (y m) (parse-year-month ym))
  (unless y (error 'shift-year-month "bad year-month: ~s" ym))
  (define d (+months (date y m 1) delta-months))
  (format-year-month (->year d) (->month d)))

;; items: (listof cal-item); day-nodes: setof string
;; -> hash 'month 'days
(define (calendar-for-month items day-nodes ym)
  (define-values (y m) (parse-year-month ym))
  (unless y (error 'calendar-for-month "bad year-month: ~s" ym))
  (define prefix (format-year-month y m))
  (define by-day (make-hash))
  (for ([it (in-list items)])
    (define day (date-day-prefix (cal-item-date it)))
    (when (string-prefix? day prefix)
      (hash-update! by-day day (λ (xs) (cons it xs)) '())))
  (define days-with-items
    (for/list ([d (in-list (sort (hash-keys by-day) string<?))])
      (define its (sort (hash-ref by-day d) string<? #:key cal-item-date))
      (hash 'date d
            'items its
            'day_node (set-member? day-nodes d))))
  (define node-only
    (for/list ([d (in-set day-nodes)]
               #:when (and (string-prefix? d prefix)
                           (not (hash-has-key? by-day d))))
      (hash 'date d
            'items '()
            'day_node #t)))
  (hash 'month prefix
        'days (sort (append days-with-items node-only)
                    string<?
                    #:key (λ (h) (hash-ref h 'date)))))

;; file-entries: (listof (cons path tasks))
(define (calendar-from-files file-entries ym)
  (define items
    (with-file-roots file-entries
                     (λ (tasks root) (collect-cal-items tasks #:root root))))
  (define nodes
    (list->set
     (append* (for/list ([e (in-list file-entries)])
                (collect-day-titles (cdr e))))))
  (calendar-for-month items nodes ym))

;; Mon-start grid. Cell: #f (padding) or hash with date/day_num/items/day_node/is_today
(define (month-grid-cells ym cal-hash today)
  (define-values (y m) (parse-year-month ym))
  (define first (date y m 1))
  ;; ->wday: 0=Sun … 6=Sat; Mon-start lead offset:
  (define lead (modulo (- (->wday first) 1) 7))
  (define dim (days-in-month y m))
  (define by-date
    (for/hash ([d (in-list (hash-ref cal-hash 'days))])
      (values (hash-ref d 'date) d)))
  (define cells
    (append
     (make-list lead #f)
     (for/list ([dom (in-range 1 (add1 dim))])
       (define date-str (iso-day y m dom))
       (define info (hash-ref by-date date-str #f))
       (hash 'date date-str
             'day_num dom
             'items (if info (hash-ref info 'items) '())
             'day_node (and info (hash-ref info 'day_node #f))
             'is_today (equal? date-str today)))))
  (define rem (remainder (length cells) 7))
  (if (zero? rem)
      cells
      (append cells (make-list (- 7 rem) #f))))

;; ---- the day nodes, as a month ---------------------------------------------

;; WHERE the day nodes are: "YYYY-MM-DD" -> (cons key parent-key). The set
;; `collect-day-nodes` answers with says which days exist; a calendar cell is a
;; LINK, and a link is a key, so this is the same walk asked the other question.
;;
;; First site wins, in tree order — the rule the store's own day lookup keeps
;; (snapshot-day-key): an outline with two nodes titled one day says one thing
;; twice, and every surface agrees on the one it says first.
;;
;; The parent is the node the day hangs under — the month in a Daily.rkt, the
;; year in the monolithic shape — which is the way back OUT of a single day.
;; #f for a day node written at a file's top level, which has no way out.
(define (day-node-sites tasks)
  (fold-tasks tasks
              (λ (tk path acc)
                (define title (task-title tk))
                (if (and (bare-iso-date-title? title)
                         (not (hash-has-key? acc title)))
                    (hash-set acc title
                              (cons (task-key tk)
                                    (and (pair? path) (task-key (last path)))))
                    acc))
              (hash)))

;; ONE MONTH OF DAY NODES, as the cells of a grid: #f for the padding a
;; Mon-start month begins and ends with, else a hash of
;;
;;   date  day_num  is_today  key  parent_key
;;
;; where `key` is #f for a day the outline has no node for. That is the whole
;; of "empty days are inert": there is nothing to address, so nothing links.
;;
;; Day NODES and not dated tasks, which is what makes this a different question
;; from `calendar-for-month`'s: a cell is a way into the day's own page, and a
;; `@date` on a task somewhere else is not one. The grid itself is that same
;; function's, asked over the days alone — one owner for where the 1st of a
;; month lands.
(define (day-node-cells tasks ym today)
  (define sites (day-node-sites tasks))
  (define cal (calendar-for-month '() (list->set (hash-keys sites)) ym))
  (for/list ([cell (in-list (month-grid-cells ym cal today))])
    (and cell
         (let* ([date (hash-ref cell 'date)]
                [site (hash-ref sites date #f)])
           (hash 'date date
                 'day_num (hash-ref cell 'day_num)
                 'is_today (hash-ref cell 'is_today)
                 'key (and site (car site))
                 'parent_key (and site (cdr site)))))))
