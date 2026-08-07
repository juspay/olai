#lang racket/base

;; Pure calendar query: group dated tasks by calendar day (includes done).
;; Day nodes (bare ISO titles in Daily.rkt) are tracked separately for links.

(require racket/list
         racket/set
         racket/string
         racket/format
         (except-in olai/lang/expander #%module-begin)
         olai/dates
         ;; where the days of a month LAND: the journal's grid, which is the
         ;; one this decorates rather than a second one (olai/journal)
         (only-in olai/journal month-grid-dates)
         olai/query
         (only-in gregor date +months ->year ->month))

(provide (struct-out cal-item)
         collect-cal-items
         collect-day-nodes
         calendar-for-month
         calendar-from-files
         month-grid-cells
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

(define (format-year-month y m)
  (format "~a-~a" y (~r m #:min-width 2 #:pad-string "0")))

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

;; The month grid with what a DATED month knows about each day on it: the items
;; that fall there, and whether the day has a node of its own.
;; Cell: #f (padding) or hash with date/day_num/items/day_node/is_today
(define (month-grid-cells ym cal-hash today)
  (define by-date
    (for/hash ([d (in-list (hash-ref cal-hash 'days))])
      (values (hash-ref d 'date) d)))
  (for/list ([cell (in-list (month-grid-dates ym today))])
    (and cell
         (let ([info (hash-ref by-date (hash-ref cell 'date) #f)])
           (hash-set* cell
                      'items (if info (hash-ref info 'items) '())
                      'day_node (and info (hash-ref info 'day_node #f)))))))

