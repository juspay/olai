#lang racket/base

;; Date/time helpers via gregor (no hand-rolled calendar tables).
;;
;; Accepted forms (ISO 8601):
;;   YYYY-MM-DD
;;   YYYY-MM-DDTHH:MM
;;   YYYY-MM-DDTHH:MM:SS
;;   YYYY-MM-DD HH:MM[ :SS]   (space ok; normalized to T)
;; Optional trailing Z / offset when gregor accepts it.

(require racket/string
         (only-in gregor iso8601->date iso8601->datetime today ~t))

(provide valid-iso-date-string?
         normalize-date-string
         date-day-prefix
         today-iso-string)

;; "2026-08-04 14:30" -> "2026-08-04T14:30"
(define (normalize-date-string s)
  (cond
    [(regexp-match #px"^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]+([0-9].*)$" s)
     => (λ (m) (string-append (cadr m) "T" (caddr m)))]
    [else s]))

(define (valid-iso-date-string? s)
  (and (string? s)
       (let ([s (normalize-date-string s)])
         (or (with-handlers ([exn:fail? (λ (_) #f)])
               (iso8601->date s)
               #t)
             (with-handlers ([exn:fail? (λ (_) #f)])
               (iso8601->datetime s)
               #t)))))

;; Calendar day for agenda buckets: first 10 chars of a normalized ISO string.
(define (date-day-prefix s)
  (define n (normalize-date-string s))
  (if (>= (string-length n) 10)
      (substring n 0 10)
      n))

(define (today-iso-string)
  (~t (today) "yyyy-MM-dd"))
