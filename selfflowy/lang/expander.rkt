#lang racket/base

;; Shared expander for #lang selfflowy (outline) and #lang selfflowy/sexp.
;;
;; Surface form (both readers produce this):
;;
;;   (t "title" [#:date "YYYY-MM-DD"] [#:description "..."] child ...)
;;
;; Inline #tags in titles are extracted into the task-tags field; the title
;; string stays verbatim. Children must be nested (t ...) forms.

(require racket/list
         (for-syntax racket/base
                     syntax/parse
                     racket/string
                     racket/list))

(provide (rename-out [module-begin #%module-begin])
         t
         task
         task?
         task-title
         task-date
         task-description
         task-tags
         task-children
         title-tags
         #%app #%datum #%top #%top-interaction
         quote)

(struct task (title date description tags children) #:transparent)

;; Extract #tags from a title: word = [A-Za-z0-9_-]+, no # in the list,
;; order of first appearance, deduplicated. Title is not modified.
(define (title-tags title)
  (define raw
    (regexp-match* #px"#([A-Za-z0-9_-]+)"
                   title
                   #:match-select (λ (m) (cadr m))))
  (remove-duplicates raw))

(define-for-syntax (title-tags/stx title)
  (define raw
    (regexp-match* #px"#([A-Za-z0-9_-]+)"
                   title
                   #:match-select (λ (m) (cadr m))))
  (remove-duplicates raw))

(begin-for-syntax
  (define (date-string? s)
    (and (string? s)
         (regexp-match? #px"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" s)
         (let* ([parts (map string->number (string-split s "-"))]
                [m (list-ref parts 1)]
                [d (list-ref parts 2)])
           (and (<= 1 m 12)
                (or (and (memv m '(1 3 5 7 8 10 12)) (<= 1 d 31))
                    (and (memv m '(4 6 9 11)) (<= 1 d 30))
                    (and (= m 2) (<= 1 d 29)))))))

  (define-syntax-class date-str
    #:description "YYYY-MM-DD date"
    (pattern d:str
             #:fail-unless (date-string? (syntax-e #'d))
             "expected YYYY-MM-DD date"))

  (define-splicing-syntax-class t-kwargs
    #:attributes (date description)
    (pattern (~seq (~alt (~optional (~seq #:date d:date-str)
                                    #:name "#:date")
                         (~optional (~seq #:description desc:str)
                                    #:name "#:description"))
                   ...)
             #:attr date (or (attribute d) #'#f)
             #:attr description (or (attribute desc) #'#f)))

  (define-syntax-class task-form
    #:description "a nested (t ...) task form"
    #:literals (t)
    (pattern (t title:str kw:t-kwargs child:task-form ...))))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child:task-form ...)
     (define tags (title-tags/stx (syntax-e #'title)))
     (with-syntax ([tags-lit (datum->syntax stx tags)])
       #'(task title kw.date kw.description 'tags-lit (list child ...)))]
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
