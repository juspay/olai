#lang racket/base

;; Date/time helpers via gregor (no hand-rolled calendar tables).
;;
;; Accepted forms (ISO 8601):
;;   YYYY-MM-DD
;;   YYYY-MM-DDTHH:MM
;;   YYYY-MM-DDTHH:MM:SS
;;   YYYY-MM-DD HH:MM[ :SS]   (space ok; normalized to T)
;; Optional trailing Z / offset when gregor accepts it.

(require racket/format
         racket/list
         racket/match
         racket/string
         (only-in gregor
                  date days-in-month iso8601->date iso8601->datetime today
                  +months ->month ->wday ->year ~t))

(provide valid-iso-date-string?
         normalize-date-string
         date-day-prefix
         today-iso-string
         bare-iso-date-title?
         friendly-date-label
         parse-year-month
         format-year-month
         shift-year-month
         week-days
         month-grid-dates)

;; "2026-08-04 14:30" -> "2026-08-04T14:30"
(define (normalize-date-string s)
  (match s
    [(regexp #px"^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]+([0-9].*)$" (list _ day time))
     (string-append day "T" time)]
    [_ s]))

;; True when `parse` accepts the string rather than raising.
(define (parses? parse s)
  (with-handlers ([exn:fail? (λ (_) #f)])
    (parse s)
    #t))

(define (valid-iso-date-string? s)
  (cond
    [(string? s)
     (define n (normalize-date-string s))
     (or (parses? iso8601->date n)
         (parses? iso8601->datetime n))]
    [else #f]))

;; Calendar day for agenda buckets: first 10 chars of a normalized ISO string.
(define (date-day-prefix s)
  (define n (normalize-date-string s))
  (if (>= (string-length n) 10)
      (substring n 0 10)
      n))

(define (today-iso-string)
  (~t (today) "yyyy-MM-dd"))

;; True when `s` is exactly YYYY-MM-DD (a day-node title in Daily.rkt).
(define (bare-iso-date-title? s)
  (and (string? s)
       (regexp-match? #px"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" s)
       (valid-iso-date-string? s)))

;; Display-only label for a bare ISO day: "Mon, Aug 3".
(define (friendly-date-label iso-day)
  (~t (iso8601->date iso-day) "EEE, MMM d"))

;; ---- a month, and where its days land on a grid -----------------------------
;;
;; Here because it is date arithmetic and nothing else: which column the 1st of
;; a month falls in, how many days it has, how far the last week is padded.
;; It arrived with `olai calendar` and outlived it — the command is gone and
;; the LAYOUT is not, because a surface that draws a month still has to ask
;; where the days go, and there is one answer.

;; "2026-08" -> (values 2026 8), or (values #f #f) for anything else.
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

;; The month `delta-months` from this one — what a prev/next link is.
(define (shift-year-month ym delta-months)
  (define-values (y m) (parse-year-month ym))
  (unless y (error 'shift-year-month "bad year-month: ~s" ym))
  (define d (+months (date y m 1) delta-months))
  (format-year-month (->year d) (->month d)))

;; THE WEEK, as this grid lays it out: gregor weekdays (0=Sun … 6=Sat), Monday
;; first. The column order and the lead padding are one fact, so they are read
;; off one list — and a surface that draws headings over the columns reads the
;; same one rather than remembering which day this module starts on.
(define week-days '(1 2 3 4 5 6 0))

;; WHERE THE DAYS LAND: one month as whole weeks, #f for the padding at either
;; end (the days of the first and last week that belong to another month).
;; Cell: hash of date / day_num / is_today.
;;
;; The layout and nothing else. What a cell then SAYS about its day is the
;; caller's — a key to open, a count to draw — so the shape has one owner and
;; any number of readings.
(define (month-grid-dates ym today)
  (define-values (y m) (parse-year-month ym))
  (unless y (error 'month-grid-dates "bad year-month: ~s" ym))
  (define lead (index-of week-days (->wday (date y m 1))))
  (define cells
    (append
     (make-list lead #f)
     (for/list ([dom (in-range 1 (add1 (days-in-month y m)))])
       (define date-str (iso-day y m dom))
       (hash 'date date-str
             'day_num dom
             'is_today (equal? date-str today)))))
  (define week (length week-days))
  (define rem (remainder (length cells) week))
  (if (zero? rem)
      cells
      (append cells (make-list (- week rem) #f))))
