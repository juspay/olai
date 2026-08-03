#lang racket/base

;; Date helpers via gregor (no hand-rolled calendar tables).

(require (only-in gregor iso8601->date today ~t))

(provide valid-iso-date-string?
         today-iso-string)

(define (valid-iso-date-string? s)
  (and (string? s)
       (with-handlers ([exn:fail? (λ (_) #f)])
         (iso8601->date s)
         #t)))

(define (today-iso-string)
  (~t (today) "yyyy-MM-dd"))
