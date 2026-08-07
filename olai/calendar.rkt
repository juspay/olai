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
         (struct-out day-month)
         collect-cal-items
         collect-day-nodes
         calendar-for-month
         calendar-from-files
         month-grid-cells
         week-days
         day-month-for
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

;; Which days an outline HAS a node for (olai/query finds them). -> setof
;; "YYYY-MM-DD"
(define (collect-day-nodes tasks)
  (list->set (hash-keys (collect-day-sites tasks))))

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
    (for/fold ([acc (set)]) ([e (in-list file-entries)])
      (set-union acc (collect-day-nodes (cdr e)))))
  (calendar-for-month items nodes ym))

;; THE WEEK, as this grid lays it out: gregor weekdays (0=Sun … 6=Sat), Monday
;; first. The column order and the lead padding are one fact, so they are read
;; off one list — and a surface that draws headings over the columns reads the
;; same one rather than remembering which day this module starts on.
(define week-days '(1 2 3 4 5 6 0))

;; Cell: #f (padding) or hash with date/day_num/items/day_node/is_today
(define (month-grid-cells ym cal-hash today)
  (define-values (y m) (parse-year-month ym))
  (define first (date y m 1))
  (define lead (index-of week-days (->wday first)))
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
  (define week (length week-days))
  (define rem (remainder (length cells) week))
  (if (zero? rem)
      cells
      (append cells (make-list (- week rem) #f))))

;; ---- the day nodes, as a month ---------------------------------------------

;; ONE MONTH OF THE DAY JOURNAL, whole:
;;
;;   key   what the month AS A WHOLE is reached at — the node its days hang
;;         under (the month node in a Daily.rkt, the year in the monolithic
;;         shape), else the outline's first node, else #f for an outline with
;;         nothing in it. A month nobody has written in yet still has to be a
;;         way into the journal, which is what the fallback is for.
;;   cells the grid: #f for the padding the month begins and ends with, else a
;;         hash of `date`, `day_num`, `is_today` and `key` — that last one #f
;;         for a day the outline has no node for, which is the whole of
;;         "an empty day is inert": there is nothing to address.
;;
;; One value and not a list the caller picks a month key out of: the month's
;; own address is a fact about the month, and a drawer scanning cells for it
;; would be rebuilding a whole out of its parts.
;;
;; Day NODES and not dated tasks, which is what makes this a different question
;; from `calendar-for-month`'s: a cell is a way into a day's own page, and a
;; `@date` on a task somewhere is not one. The grid itself is that same
;; function's, asked over the days alone — one owner for where the 1st lands.
(struct day-month (key cells) #:transparent)

(define (day-month-for tasks ym today)
  (define sites (collect-day-sites tasks))
  (define cal (calendar-for-month '() (list->set (hash-keys sites)) ym))
  (define cells
    (for/list ([cell (in-list (month-grid-cells ym cal today))])
      (and cell
           (let* ([date (hash-ref cell 'date)]
                  [site (hash-ref sites date #f)])
             (hash 'date date
                   'day_num (hash-ref cell 'day_num)
                   'is_today (hash-ref cell 'is_today)
                   'key (and site (day-site-key site)))))))
  (day-month (month-holder-key tasks sites ym) cells))

;; What this month hangs under, taken from its own days: the node a reader
;; zooms to see the whole of it. Dates in order, never hash order — the answer
;; is the same on every render or the header moves under the pointer.
(define (month-holder-key tasks sites ym)
  (or (for/or ([date (in-list (sort (hash-keys sites) string<?))]
               #:when (string-prefix? date ym))
        (day-site-parent (hash-ref sites date)))
      (let ([tk (findf task? tasks)]) (and tk (task-key tk)))))
