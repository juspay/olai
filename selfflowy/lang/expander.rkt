#lang racket/base

;; #lang selfflowy expander (phase 0.1)
;;
;; A module is a list of top-level tasks:
;;
;;   #lang selfflowy
;;   (t "Inbox"
;;      (t "Buy milk"
;;         #:date "2026-08-04"
;;         #:description "2% if they have it"))
;;
;; Optional keywords after the title (any order, at most once each):
;;   #:date        YYYY-MM-DD string
;;   #:description free-form string
;;
;; Mirrors/agenda are phase 0.2.

(require (for-syntax racket/base
                     syntax/parse
                     racket/string))

(provide (rename-out [module-begin #%module-begin])
         t
         task
         task?
         task-title
         task-date
         task-description
         task-children
         #%app #%datum #%top #%top-interaction
         quote)

(struct task (title date description children) #:transparent)

(begin-for-syntax
  (define (date-string? s)
    (and (string? s)
         (regexp-match? #px"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" s)
         (let* ([parts (map string->number (string-split s "-"))]
                [m (list-ref parts 1)]
                [d (list-ref parts 2)])
           (and (<= 1 m 12)
                ;; cheap day-of-month check (no leap-year refinement in 0.1)
                (or (and (memv m '(1 3 5 7 8 10 12)) (<= 1 d 31))
                    (and (memv m '(4 6 9 11)) (<= 1 d 30))
                    (and (= m 2) (<= 1 d 29)))))))

  (define (unique-attr attr-list)
    (define xs (filter values (or attr-list '())))
    (cond
      [(null? xs) #'#f]
      [(null? (cdr xs)) (car xs)]
      [else 'duplicate]))

  ;; Optional #:date / #:description in either order (at most once each).
  (define-splicing-syntax-class t-kwargs
    #:attributes (date description)
    (pattern (~seq (~or (~seq #:date d)
                        (~seq #:description desc)) ...)
             #:attr date (unique-attr (attribute d))
             #:attr description (unique-attr (attribute desc))
             #:fail-when (eq? (attribute date) 'duplicate)
             "duplicate #:date"
             #:fail-when (eq? (attribute description) 'duplicate)
             "duplicate #:description")))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child ...)
     #:do [(define date-stx #'kw.date)
           (define date-val (syntax-e date-stx))
           (define desc-stx #'kw.description)
           (define desc-val (syntax-e desc-stx))
           (when (and date-val (not (string? date-val)))
             (raise-syntax-error
              't
              "date after #:date must be a string literal YYYY-MM-DD"
              stx
              date-stx))
           (when (and (string? date-val) (not (date-string? date-val)))
             (raise-syntax-error
              't
              (format "invalid date ~s; expected YYYY-MM-DD (e.g. \"2026-08-04\")"
                      date-val)
              stx
              date-stx))
           (when (and desc-val (not (string? desc-val)))
             (raise-syntax-error
              't
              "value after #:description must be a string literal"
              stx
              desc-stx))
           (for ([c (in-list (syntax->list #'(child ...)))])
             (when (keyword? (syntax-e c))
               (raise-syntax-error
                't
                "unexpected keyword among children; only #:date and #:description are supported, immediately after the title"
                stx
                c)))]
     #'(task title kw.date kw.description (list child ...))]
    [(_ title . _)
     (raise-syntax-error
      't
      "expected (t \"title\" [#:date \"YYYY-MM-DD\"] [#:description \"...\"] child ...); title must be a string literal"
      stx
      (let ([e (syntax-e stx)])
        (if (and (pair? e) (pair? (cdr e))) (cadr e) stx)))]
    [_
     (raise-syntax-error
      't
      "expected (t \"title\" [#:date \"YYYY-MM-DD\"] [#:description \"...\"] child ...)"
      stx)]))

(define-syntax (module-begin stx)
  (syntax-parse stx
    [(_ form ...)
     #'(#%module-begin
        (provide tasks)
        (define tasks (list form ...))
        (void))]))
