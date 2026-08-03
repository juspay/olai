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
;; Children must themselves be (t ...) forms (closed grammar).
;; Mirrors/agenda are phase 0.2.
;;
;; Callers that (require) this module for the data model should use
;; (except-in ... #%module-begin) so module+ submodules keep racket's
;; #%module-begin (this export is for #lang only).

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

  (define-syntax-class date-str
    #:description "YYYY-MM-DD date"
    (pattern d:str
             #:fail-unless (date-string? (syntax-e #'d))
             "expected YYYY-MM-DD date"))

  ;; Optional #:date / #:description in either order (at most once each).
  (define-splicing-syntax-class t-kwargs
    #:attributes (date description)
    (pattern (~seq (~alt (~optional (~seq #:date d:date-str)
                                    #:name "#:date")
                         (~optional (~seq #:description desc:str)
                                    #:name "#:description"))
                   ...)
             #:attr date (or (attribute d) #'#f)
             #:attr description (or (attribute desc) #'#f)))

  ;; Closed grammar: every task node is a (t ...) form, recursively.
  (define-syntax-class task-form
    #:description "a nested (t ...) task form"
    #:literals (t)
    (pattern (t title:str kw:t-kwargs child:task-form ...))))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child:task-form ...)
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
    [(_ form:task-form ...)
     #'(#%module-begin
        (provide tasks)
        (define tasks (list form ...))
        (void))]))
