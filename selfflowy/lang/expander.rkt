#lang racket/base

;; Shared expander for #lang selfflowy (outline) and #lang selfflowy/sexp.
;;
;; Surface form (both readers produce this):
;;
;;   (t "title" [#:date "YYYY-MM-DD[THH:MM[:SS]]"]
;;              [#:description "..."]
;;              [#:done] | [#:done "YYYY-MM-DD[THH:MM[:SS]]"]
;;              child ...)
;;
;; Inline #tags in titles are extracted into the task-tags field; the title
;; string stays verbatim. Children must be nested (t ...) forms.
;; Date/time validation uses gregor. #:done is optional; bare means #t,
;; with a string means completed at that timestamp.

(require racket/list
         (for-syntax racket/base
                     syntax/parse
                     racket/string
                     racket/list
                     (only-in gregor iso8601->date iso8601->datetime)))

(provide (rename-out [module-begin #%module-begin])
         t
         task
         task?
         task-title
         task-date
         task-description
         task-done
         task-tags
         task-children
         title-tags
         #%app #%datum #%top #%top-interaction
         quote)

;; done: #f | #t | ISO date/datetime string
(struct task (title date description done tags children) #:transparent)

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
  (define (normalize-date-string s)
    (cond
      [(regexp-match #px"^([0-9]{4}-[0-9]{2}-[0-9]{2})[ ]+([0-9].*)$" s)
       => (λ (m) (string-append (cadr m) "T" (caddr m)))]
      [else s]))

  (define (date-string? s)
    (and (string? s)
         (let ([s (normalize-date-string s)])
           (or (with-handlers ([exn:fail? (λ (_) #f)])
                 (iso8601->date s)
                 #t)
               (with-handlers ([exn:fail? (λ (_) #f)])
                 (iso8601->datetime s)
                 #t)))))

  (define-syntax-class date-str
    #:description "ISO date or datetime (YYYY-MM-DD[THH:MM[:SS]])"
    (pattern d:str
             #:fail-unless (date-string? (syntax-e #'d))
             "expected ISO date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS])"
             #:attr normalized (normalize-date-string (syntax-e #'d))))

  ;; #:done | #:done "ISO"
  (define-splicing-syntax-class done-kw
    #:attributes (value)
    (pattern (~seq #:done d:date-str)
             #:attr value (datum->syntax #'d (attribute d.normalized) #'d))
    (pattern (~seq #:done)
             #:attr value #'#t))

  (define-splicing-syntax-class t-kwargs
    #:attributes (date description done)
    (pattern (~seq (~alt (~optional (~seq #:date d:date-str)
                                    #:name "#:date")
                         (~optional (~seq #:description desc:str)
                                    #:name "#:description")
                         (~optional dk:done-kw
                                    #:name "#:done"))
                   ...)
             #:attr date (if (attribute d)
                             (datum->syntax #'d (attribute d.normalized) #'d)
                             #'#f)
             #:attr description (or (attribute desc) #'#f)
             #:attr done (if (attribute dk)
                             (attribute dk.value)
                             #'#f)))

  (define-syntax-class task-form
    #:description "a nested (t ...) task form"
    #:literals (t)
    (pattern (t title:str kw:t-kwargs child:task-form ...))))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child:task-form ...)
     (define tags (title-tags/stx (syntax-e #'title)))
     (with-syntax ([tags-lit (datum->syntax stx tags)])
       #'(task title kw.date kw.description kw.done 'tags-lit (list child ...)))]
    [(_ title . _)
     (raise-syntax-error
      't
      "expected (t \"title\" [#:date iso-date] [#:description \"...\"] [#:done [iso-date]] child ...); title must be a string literal"
      stx
      (let ([e (syntax-e stx)])
        (if (and (pair? e) (pair? (cdr e))) (cadr e) stx)))]
    [_
     (raise-syntax-error
      't
      "expected (t \"title\" [#:date iso-date] [#:description \"...\"] [#:done [iso-date]] child ...)"
      stx)]))

(define-syntax (module-begin stx)
  (syntax-parse stx
    [(_ form:task-form ...)
     #'(#%module-begin
        (provide tasks)
        (define tasks (list form ...))
        (void))]))
