#lang racket/base

;; Pure calendar query: group dated tasks by calendar day (includes done).
;; Day nodes (bare ISO titles in Daily.rkt) are tracked separately for links.

(require racket/list
         racket/set
         racket/string
         racket/format
         (except-in olai/lang/expander #%module-begin)
         olai/dates
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
         parse-year-month
         shift-year-month
         format-year-month
         format-calendar)

;; done:   the stored field, #f | #t | ISO timestamp (what JSON serializes)
;; status: what that MEANS — 'open | 'done, derived once (lang/expander)
;; id: task-id or #f
(struct cal-item (date title breadcrumb done status id) #:transparent)

;; Unlike the agenda, nothing is filtered out by state: a calendar shows what
;; happened.
(define (collect-cal-items tasks #:root [root #f])
  (for/list ([d (in-list (collect-dated-nodes tasks #:root root))])
    (define tk (dated-node-task d))
    (cal-item (task-date tk) (task-title tk) (dated-node-breadcrumb d)
              (task-done tk) (task-status tk) (task-id tk))))

;; Bare ISO day titles (Daily.rkt day nodes). -> setof "YYYY-MM-DD"
(define (collect-day-nodes tasks)
  (list->set (collect-day-titles tasks)))

;; "2026-08" -> (values 2026 8) or (values #f #f)
(define (parse-year-month s)
  (cond
    [(and (string? s)
          (regexp-match #px"^([0-9]{4})-([0-9]{2})$" s))
     => (λ (m)
          (define y (string->number (cadr m)))
          (define mo (string->number (caddr m)))
          (if (and y mo (<= 1 mo 12))
              (values y mo)
              (values #f #f)))]
    [else (values #f #f)]))

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

(define (format-calendar cal-hash)
  (define lines
    (cons
     (format "CALENDAR ~a" (hash-ref cal-hash 'month))
     (append*
      (for/list ([d (in-list (hash-ref cal-hash 'days))])
        (define date (hash-ref d 'date))
        (define node? (hash-ref d 'day_node #f))
        (define head
          (string-append date (if node? "  (day notes)" "")))
        (cons head
              (for/list ([it (in-list (hash-ref d 'items))])
                (define mark
                  (case (cal-item-status it)
                    [(done) "  [x] "]
                    [else "  - "]))
                (string-append
                 mark (cal-item-title it)
                 "  [" (cal-item-date it) "]"
                 (if (non-empty-string? (cal-item-breadcrumb it))
                     (string-append "\n         " (cal-item-breadcrumb it))
                     ""))))))))
  (string-join lines "\n"))
