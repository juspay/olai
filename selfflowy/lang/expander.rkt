#lang racket/base

;; Shared expander for #lang selfflowy (outline) and #lang selfflowy/sexp.
;;
;; Surface forms:
;;
;;   (t "title" [#:id "anchor"]
;;              [#:date "YYYY-MM-DD[THH:MM[:SS]]"]
;;              [#:description "..."]
;;              [#:done] | [#:done "ISO"]
;;              child ...)
;;
;;   (mirror "anchor")
;;
;; Children are (t ...) or (mirror ...) — closed grammar. Anchors unique per
;; file; mirrors resolve; cycles rejected at expand time. Module exports
;; `tasks` and `anchors` (hash id -> task).

(require racket/list
         racket/string
         (for-syntax racket/base
                     syntax/parse
                     racket/string
                     racket/list
                     racket/match
                     (only-in gregor iso8601->date iso8601->datetime)))

(provide (rename-out [module-begin #%module-begin])
         t
         mirror
         task
         task?
         task-title
         task-date
         task-description
         task-done
         task-id
         task-tags
         task-children
         mirror-ref
         mirror-ref?
         mirror-ref-anchor
         title-tags
         valid-anchor-id?
         #%app #%datum #%top #%top-interaction
         quote)

;; done: #f | #t | ISO date/datetime string
;; id: #f | non-empty anchor string
(struct task (title date description done id tags children) #:transparent)

;; Mirror site: same node as anchors[anchor], not a copy.
(struct mirror-ref (anchor) #:transparent)

(define (valid-anchor-id? s)
  (and (string? s) (regexp-match? #px"^[A-Za-z0-9_-]+$" s)))

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

(define-for-syntax (valid-anchor-id?/stx s)
  (and (string? s) (regexp-match? #px"^[A-Za-z0-9_-]+$" s)))

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

  (define-syntax-class anchor-str
    #:description "anchor id [A-Za-z0-9_-]+"
    (pattern d:str
             #:fail-unless (valid-anchor-id?/stx (syntax-e #'d))
             "expected anchor id matching [A-Za-z0-9_-]+"))

  ;; #:done | #:done "ISO"
  (define-splicing-syntax-class done-kw
    #:attributes (value)
    (pattern (~seq #:done d:date-str)
             #:attr value (datum->syntax #'d (attribute d.normalized) #'d))
    (pattern (~seq #:done)
             #:attr value #'#t))

  (define-splicing-syntax-class t-kwargs
    #:attributes (date description done id)
    (pattern (~seq (~alt (~optional (~seq #:date d:date-str)
                                    #:name "#:date")
                         (~optional (~seq #:description desc:str)
                                    #:name "#:description")
                         (~optional dk:done-kw
                                    #:name "#:done")
                         (~optional (~seq #:id id-str:anchor-str)
                                    #:name "#:id"))
                   ...)
             #:attr date (if (attribute d)
                             (datum->syntax #'d (attribute d.normalized) #'d)
                             #'#f)
             #:attr description (or (attribute desc) #'#f)
             #:attr done (if (attribute dk)
                             (attribute dk.value)
                             #'#f)
             #:attr id (if (attribute id-str)
                           #'id-str
                           #'#f)))

  (define-syntax-class mirror-form
    #:description "a (mirror \"anchor\") form"
    #:literals (mirror)
    (pattern (mirror a:anchor-str)
             #:attr anchor #'a))

  (define-syntax-class child-form
    #:description "a nested (t ...) or (mirror ...) form"
    (pattern :task-form)
    (pattern :mirror-form))

  (define-syntax-class task-form
    #:description "a nested (t ...) task form"
    #:literals (t)
    (pattern (t title:str kw:t-kwargs child:child-form ...)))

  (define-syntax-class body-form
    #:description "a top-level (t ...) or (mirror ...) form"
    (pattern :task-form)
    (pattern :mirror-form))

  ;; ---- compile-time IR for validation ------------------------------------

  ;; ir-task: id is string or #f; kids is list of ir; stx is whole form
  ;; ir-mirror: anchor string; stx is whole form
  (struct ir-task (id kids stx) #:transparent)
  (struct ir-mirror (anchor stx) #:transparent)

  (define (syntax->ir stx)
    (syntax-parse stx
      #:literals (t mirror)
      [(mirror a:str)
       (ir-mirror (syntax-e #'a) stx)]
      [(t title:str kw:t-kwargs child ...)
       (define id (and (syntax-e #'kw.id) (syntax-e #'kw.id)))
       ;; kw.id is #'#f when absent — syntax-e of #f is #f
       (define id* (if (string? id) id #f))
       (ir-task id* (map syntax->ir (syntax->list #'(child ...))) stx)]
      [_ (raise-syntax-error 'selfflowy "internal: bad form for IR" stx)]))

  (define (collect-anchor-decls ir-roots)
    ;; -> hash id -> first stx (the task form)
    (define h (make-hash))
    (define (walk ir)
      (match ir
        [(ir-mirror _ _) (void)]
        [(ir-task id kids stx)
         (when id
           (define prev (hash-ref h id #f))
           (when prev
             (define pline (syntax-line prev))
             (define pcol (syntax-column prev))
             (raise-syntax-error
              't
              (format "duplicate ^~a; first declared at ~a:~a"
                      id
                      (or pline "?")
                      (or pcol "?"))
              stx))
           (hash-set! h id stx))
         (for-each walk kids)]))
    (for-each walk ir-roots)
    h)

  (define (check-mirrors-resolve ir-roots decl-hash)
    (define known (hash-keys decl-hash))
    (define (walk ir)
      (match ir
        [(ir-mirror anchor stx)
         (unless (hash-has-key? decl-hash anchor)
           (define listed
             (if (null? known)
                 "(none)"
                 (string-join (sort known string<?) ", ")))
           (raise-syntax-error
            'mirror
            (format "unknown *~a; anchors in this file: ~a" anchor listed)
            stx))]
        [(ir-task _ kids _)
         (for-each walk kids)]))
    (for-each walk ir-roots))

  ;; Edges for cycle detection: from each anchor, walk its defining subtree
  ;; (not following mirror targets' bodies — only mirror edges + nested
  ;; anchored containment). Edge owner -> target when:
  ;;   - nested task declares target id under owner
  ;;   - mirror *target appears under owner
  ;; Cycle path reported via mirror stx when a mirror edge closes a cycle.
  (define (check-mirror-cycles ir-roots decl-hash)
    ;; Map id -> ir-task for that declaration
    (define id->ir (make-hash))
    (define (index ir)
      (match ir
        [(ir-mirror _ _) (void)]
        [(ir-task id kids _)
         (when id (hash-set! id->ir id ir))
         (for-each index kids)]))
    (for-each index ir-roots)

    ;; edges: hash from -> (listof (cons to mirror-stx-or-#f))
    (define edges (make-hash))
    (define (add-edge! from to mirror-stx)
      (hash-set! edges from
                 (cons (cons to mirror-stx)
                       (hash-ref edges from '()))))

    (define (walk-under ir owner)
      (match ir
        [(ir-mirror anchor stx)
         (add-edge! owner anchor stx)]
        [(ir-task id kids _)
         (when id
           (add-edge! owner id #f))
         (for ([k (in-list kids)])
           (walk-under k owner))]))

    (for ([(id ir) (in-hash id->ir)])
      (for ([k (in-list (ir-task-kids ir))])
        (walk-under k id)))

    ;; DFS cycle detect; prefer reporting a mirror edge on the cycle
    (define WHITE 0) (define GRAY 1) (define BLACK 2)
    (define color (make-hash))
    (define parent (make-hash)) ; id -> (cons prev-id mirror-stx-or-#f)

    (define (format-cycle end)
      ;; reconstruct path end -> ... -> end
      (define nodes (list end))
      (let loop ([cur end])
        (define p (hash-ref parent cur #f))
        (cond
          [(not p) nodes]
          [else
           (define prev (car p))
           (set! nodes (cons prev nodes))
           (if (equal? prev end)
               nodes
               (loop prev))])))

    (define (cycle-mirror-stx path-nodes)
      ;; find a mirror edge along the cycle
      (define n (length path-nodes))
      (for/or ([i (in-range (sub1 n))])
        (define from (list-ref path-nodes i))
        (define to (list-ref path-nodes (add1 i)))
        (for/or ([e (in-list (hash-ref edges from '()))])
          (and (equal? (car e) to) (cdr e)))))

    (define (dfs u)
      (hash-set! color u GRAY)
      (for ([e (in-list (hash-ref edges u '()))])
        (define v (car e))
        (define mstx (cdr e))
        (define c (hash-ref color v WHITE))
        (cond
          [(= c GRAY)
           (hash-set! parent v (cons u mstx))
           (define path (format-cycle v))
           (define path-str (string-join path " -> "))
           (define err-stx (or (cycle-mirror-stx path) mstx u))
           (raise-syntax-error
            'mirror
            (format "mirror *~a creates a cycle: ~a"
                    (if mstx v (car path))
                    path-str)
            (if (syntax? err-stx) err-stx #f))]
          [(= c WHITE)
           (hash-set! parent v (cons u mstx))
           (dfs v)]))
      (hash-set! color u BLACK))

    (for ([id (in-hash-keys id->ir)])
      (when (= (hash-ref color id WHITE) WHITE)
        (dfs id))))

  (define (validate-body-forms stxs)
    (define irs (map syntax->ir stxs))
    (define decls (collect-anchor-decls irs))
    (check-mirrors-resolve irs decls)
    (check-mirror-cycles irs decls)
    (void))
  )

(define-syntax (mirror stx)
  (syntax-parse stx
    [(_ a:anchor-str)
     #'(mirror-ref a)]
    [_
     (raise-syntax-error
      'mirror
      "expected (mirror \"anchor\")"
      stx)]))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child:child-form ...)
     (define tags (title-tags/stx (syntax-e #'title)))
     (with-syntax ([tags-lit (datum->syntax stx tags)])
       #'(task title kw.date kw.description kw.done kw.id 'tags-lit
               (list child ...)))]
    [(_ title . _)
     (raise-syntax-error
      't
      "expected (t \"title\" [#:id anchor] [#:date iso-date] [#:description \"...\"] [#:done [iso-date]] child ...); title must be a string literal"
      stx
      (let ([e (syntax-e stx)])
        (if (and (pair? e) (pair? (cdr e))) (cadr e) stx)))]
    [_
     (raise-syntax-error
      't
      "expected (t \"title\" [#:id anchor] [#:date iso-date] [#:description \"...\"] [#:done [iso-date]] child ...)"
      stx)]))

(define (build-anchors-hash tasks)
  (define h (make-hash))
  (define (walk x)
    (cond
      [(task? x)
       (define id (task-id x))
       (when id (hash-set! h id x))
       (for ([c (in-list (task-children x))])
         (walk c))]
      [else (void)]))
  (for ([t (in-list tasks)]) (walk t))
  h)

(define-syntax (module-begin stx)
  (syntax-parse stx
    [(_ form:body-form ...)
     (validate-body-forms (syntax->list #'(form ...)))
     #'(#%module-begin
        (provide tasks anchors)
        (define tasks (list form ...))
        (define anchors (build-anchors-hash tasks))
        (void))]))
