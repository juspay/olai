#lang racket/base

;; Date/time helpers via gregor (no hand-rolled calendar tables).
;;
;; Accepted forms (ISO 8601):
;;   YYYY-MM-DD
;;   YYYY-MM-DDTHH:MM
;;   YYYY-MM-DDTHH:MM:SS
;;   YYYY-MM-DD HH:MM[ :SS]   (space ok; normalized to T)
;; Optional trailing Z / offset when gregor accepts it.

(require racket/match
         racket/string
         (only-in gregor date +days iso8601->date iso8601->datetime today ~t))

(provide valid-iso-date-string?
         normalize-date-string
         date-day-prefix
         today-iso-string
         bare-iso-date-title?
         friendly-date-label
         weekday-abbrev)

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

;; What a weekday is CALLED, two letters, by gregor's own number for it
;; (0=Sun … 6=Sat): "Su", "Mo", … A column heading over a calendar is the same
;; kind of fact as the label above, so it comes from the same place and out of
;; the same library — a table of day names written by hand is the thing this
;; module exists to not have. Any week does: the reference is a Sunday, and
;; gregor names the day `w` days after it.
(define sunday (date 2026 8 2))

(define (weekday-abbrev w)
  (~t (+days sunday w) "EEEEEE"))
