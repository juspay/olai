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
;;   (include "relative/path.rkt")  ; require+splice top-level tasks
;;
;; Children are (t ...) | (mirror ...) | (include ...) — closed grammar.
;; Module exports `tasks`, `anchors` (hash id -> task), and `includes`
;; (list of absolute paths required by this module).

(require racket/list
         racket/string
         racket/path
         selfflowy/lang/tags
         selfflowy/lang/graph
         (for-syntax racket/base
                     selfflowy/lang/tags
                     selfflowy/lang/graph
                     ;; the date grammar has one owner; the expander is a
                     ;; consumer of it, at phase 1 like the tag grammar
                     selfflowy/dates
                     syntax/parse
                     racket/string
                     racket/list
                     racket/match
                     racket/path))

(provide (rename-out [module-begin #%module-begin])
         t
         mirror
         include
         task
         task?
         task-title
         task-date
         task-description
         task-done
         task-id
         task-tags
         task-children
         task-file
         task-key
         task-loc
         mirror-ref
         mirror-ref?
         mirror-ref-anchor
         mirror-ref-loc
         title-tags
         tag-rx
         valid-anchor-id?
         validate-task-tree!
         #%app #%datum #%top #%top-interaction
         quote)

;; done: #f | #t | ISO date/datetime string
;; id: #f | non-empty anchor string
;; file: #f | absolute path string of defining outline
;; key: stable node identity — the ^anchor here, #f for an unanchored node
;;      until the load layer mints one (selfflowy/load, mint-task-keys). A
;;      module cannot mint it: it knows only its own entry point, and the same
;;      node reached through a different root must key the same.
;; loc: srcloc of the form that defined this node. Kept because a tree that
;;      came through @include has no syntax left by the time it is checked,
;;      and an error still has to say file:line:col.
(struct task (title date description done id tags children file key loc)
  #:transparent)

;; Mirror site: same node as anchors[anchor], not a copy.
(struct mirror-ref (anchor loc) #:transparent)

;; Runtime include result before flatten (list of top-level tasks from fragment).
(struct include-splice (abs-path rel tasks) #:transparent)

(define (valid-anchor-id? s)
  (and (string? s) (regexp-match? #px"^[A-Za-z0-9_-]+$" s)))

(define-for-syntax (valid-anchor-id?/stx s)
  (and (string? s) (regexp-match? #px"^[A-Za-z0-9_-]+$" s)))

;; Where `stx` is, as literals the expansion can rebuild a srcloc from at run
;; time. Nothing syntactic survives an @include splice; this does.
(define-for-syntax (loc-parts stx)
  (datum->syntax stx
                 (list (syntax-source-path stx)
                       (syntax-line stx)
                       (syntax-column stx)
                       (syntax-position stx)
                       (syntax-span stx))))

(define-for-syntax (syntax-source-path stx)
  (define s (syntax-source stx))
  (cond
    [(path? s) (path->string (simplify-path s #f))]
    [(string? s) s]
    [else #f]))

(begin-for-syntax
  (define-syntax-class date-str
    #:description "ISO date or datetime (YYYY-MM-DD[THH:MM[:SS]])"
    (pattern d:str
             #:fail-unless (valid-iso-date-string? (syntax-e #'d))
             "expected ISO date or datetime (YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS])"
             #:attr normalized (normalize-date-string (syntax-e #'d))))

  (define-syntax-class anchor-str
    #:description "anchor id [A-Za-z0-9_-]+"
    (pattern d:str
             #:fail-unless (valid-anchor-id?/stx (syntax-e #'d))
             "expected anchor id matching [A-Za-z0-9_-]+"))

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

  (define-syntax-class include-form
    #:description "an (include \"path\") form"
    #:literals (include)
    (pattern (include p:str)
             #:attr path #'p))

  (define-syntax-class child-form
    #:description "a nested (t ...), (mirror ...), or (include ...) form"
    (pattern :task-form)
    (pattern :mirror-form)
    (pattern :include-form))

  (define-syntax-class task-form
    #:description "a nested (t ...) task form"
    #:literals (t)
    (pattern (t title:str kw:t-kwargs child:child-form ...)))

  (define-syntax-class body-form
    #:description "a top-level (t ...), (mirror ...), or (include ...) form"
    (pattern :task-form)
    (pattern :mirror-form)
    (pattern :include-form))

  ;; ---- compile-time IR for local validation ------------------------------

  (struct ir-task (id kids stx) #:transparent)
  (struct ir-mirror (anchor stx) #:transparent)
  (struct ir-include (path stx) #:transparent)

  (define (syntax->ir stx)
    (syntax-parse stx
      #:literals (t mirror include)
      [(mirror a:str)
       (ir-mirror (syntax-e #'a) stx)]
      [(include p:str)
       (ir-include (syntax-e #'p) stx)]
      [(t title:str kw:t-kwargs child ...)
       (define id (and (syntax-e #'kw.id) (syntax-e #'kw.id)))
       (define id* (if (string? id) id #f))
       (ir-task id* (map syntax->ir (syntax->list #'(child ...))) stx)]
      [_ (raise-syntax-error 'selfflowy "internal: bad form for IR" stx)]))

  (define (any-include? irs)
    (define (walk ir)
      (match ir
        [(ir-include _ _) #t]
        [(ir-mirror _ _) #f]
        [(ir-task _ kids _) (ormap walk kids)]))
    (ormap walk irs))

  ;; The compile-time adaptor to the shared checker: an IR node's anchor, its
  ;; children, whether it is a mirror site, where it is, how to fail.
  (define (ir-loc ir)
    (define stx (ir-stx ir))
    (format "~a:~a" (or (syntax-line stx) "?") (or (syntax-column stx) "?")))

  (define (ir-stx ir)
    (match ir
      [(ir-task _ _ stx) stx]
      [(ir-mirror _ stx) stx]
      [(ir-include _ stx) stx]))

  (define (validate-body-forms stxs)
    (define irs (map syntax->ir stxs))
    ;; When this module uses @include, cross-file anchors resolve only after
    ;; the splice — the whole tree is checked at run time instead (same rules,
    ;; same messages, srclocs carried on the nodes).
    (unless (any-include? irs)
      (check-anchor-graph
       irs
       #:id (λ (ir) (and (ir-task? ir) (ir-task-id ir)))
       #:kids (λ (ir) (if (ir-task? ir) (ir-task-kids ir) '()))
       #:mirror (λ (ir) (and (ir-mirror? ir) (ir-mirror-anchor ir)))
       #:scope "this file"
       #:describe ir-loc
       #:fail (λ (who ir msg)
                (raise-syntax-error who msg (and ir (ir-stx ir))))))
    (void))
  )

;; ---- runtime include load + tree validation ------------------------------

(define current-include-stack (make-parameter '()))

(define (path-basename p)
  (define-values (base name dir?) (split-path p))
  (if (path-for-some-system? name)
      (path->string name)
      (format "~a" p)))

(define (load-include-tasks abs-path rel)
  (define abs* (path->string (simplify-path (string->path abs-path) #t)))
  (define stack (current-include-stack))
  (when (member abs* stack string=?)
    (define chain
      (string-join
       (append (map path-basename stack) (list (path-basename abs*)))
       " -> "))
    (error 'include "include cycle: ~a" chain))
  (parameterize ([current-include-stack (cons abs* stack)])
    (define tasks
      (with-handlers
          ([exn:fail?
            (λ (e)
              (define msg (exn-message e))
              (cond
                [(regexp-match? #px"include cycle:" msg)
                 (raise e)]
                ;; Mutual module load often surfaces as missing export mid-cycle.
                [(or (regexp-match? #px"binding is missing" msg)
                     (regexp-match? #px"cycle" msg))
                 (define chain
                   (string-join
                    (append (map path-basename (cons abs* stack))
                            (list (path-basename abs*)))
                    " -> "))
                 (error 'include "include cycle: ~a" chain)]
                [(regexp-match? #px"cannot open module|cannot find module|file not found|No such file"
                                msg)
                 (error 'include "file not found: ~a" rel)]
                [else (raise e)]))])
        (dynamic-require `(file ,abs*) 'tasks)))
    (include-splice abs* rel tasks)))

(define (flatten-child x)
  (cond
    [(include-splice? x) (include-splice-tasks x)]
    [(task? x) (list x)]
    [(mirror-ref? x) (list x)]
    [else (list x)]))

(define (flatten-children xs)
  (append* (map flatten-child xs)))

(define (rebuild-task tk kids)
  (struct-copy task tk [children kids]))

;; Recursively flatten include-splices nested under tasks.
(define (flatten-tree tasks)
  (define (walk x)
    (cond
      [(include-splice? x)
       (append* (map walk (include-splice-tasks x)))]
      [(task? x)
       (list (rebuild-task x (append* (map walk (task-children x)))))]
      [(mirror-ref? x) (list x)]
      [else '()]))
  (append* (map walk tasks)))

;; Full-tree validation after includes splice — the same three rules the
;; compile-time pass applies, over tasks instead of syntax. A node carries
;; the srcloc of the form that defined it, so an error here says
;; file:line:col even though nothing syntactic is left.
;;
;; It raises exn:fail:syntax, which is not a lie: this IS the language
;; rejecting a form, and it is what makes selfflowy/load report the location
;; in the same fields as any other read/expand error.
(define (loc->syntax loc)
  (and loc
       (datum->syntax #f 'selfflowy
                      (vector (srcloc-source loc)
                              (srcloc-line loc)
                              (srcloc-column loc)
                              (srcloc-position loc)
                              (srcloc-span loc)))))

(define (loc->string loc)
  (cond
    [(not loc) "?"]
    [else
     (format "~a:~a:~a"
             (or (srcloc-source loc) "?")
             (or (srcloc-line loc) "?")
             (or (srcloc-column loc) 0))]))

(define (node-loc x)
  (cond
    [(task? x) (task-loc x)]
    [(mirror-ref? x) (mirror-ref-loc x)]
    [else #f]))

(define (validate-task-tree! tasks)
  (check-anchor-graph
   tasks
   #:id (λ (x) (and (task? x) (task-id x)))
   #:kids (λ (x) (if (task? x) (task-children x) '()))
   #:mirror (λ (x) (and (mirror-ref? x) (mirror-ref-anchor x)))
   #:scope "this tree"
   #:describe (λ (x) (loc->string (node-loc x)))
   #:fail
   (λ (who x msg)
     (define stx (loc->syntax (and x (node-loc x))))
     (raise (exn:fail:syntax (format "~a: ~a" who msg)
                             (current-continuation-marks)
                             (if stx (list stx) '())))))
  (void))

(define (finalize-tasks forms src)
  (define includes (collect-include-paths forms))
  (define flat (flatten-tree forms))
  (validate-task-tree! flat)
  (values flat includes))

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

(define (collect-include-paths forms)
  (define paths '())
  (define (walk x)
    (cond
      [(include-splice? x)
       (set! paths (cons (include-splice-abs-path x) paths))
       (for-each walk (include-splice-tasks x))]
      [(task? x)
       (for-each walk (task-children x))]
      [else (void)]))
  (for-each walk forms)
  (reverse (remove-duplicates paths)))

(define-syntax (mirror stx)
  (syntax-parse stx
    [(_ a:anchor-str)
     (with-syntax ([(src ln cl ps sp) (loc-parts stx)])
       #'(mirror-ref a (srcloc src ln cl ps sp)))]
    [_
     (raise-syntax-error
      'mirror
      "expected (mirror \"anchor\")"
      stx)]))

(define-syntax (include stx)
  (syntax-parse stx
    [(_ path:str)
     (define src (syntax-source stx))
     (define dir
       (cond
         [(path? src) (path-only src)]
         [(string? src) (path-only (string->path src))]
         [else #f]))
     (define rel (syntax-e #'path))
     (define full
       (simplify-path
        (path->complete-path
         (if dir (build-path dir rel) (string->path rel))
         (or dir (current-directory)))))
     (define full-str (path->string full))
     (unless (file-exists? full)
       (raise-syntax-error
        'include
        (format "file not found: ~a" rel)
        stx))
     #`(load-include-tasks #,full-str #,rel)]
    [_
     (raise-syntax-error
      'include
      "expected (include \"relative/path.rkt\")"
      stx)]))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child:child-form ...)
     (define tags (title-tags (syntax-e #'title)))
     (define file (syntax-source-path stx))
     (with-syntax ([tags-lit (datum->syntax stx tags)]
                   [file-lit (datum->syntax stx file)]
                   [(src ln cl ps sp) (loc-parts stx)])
       ;; Keep include-splice values in the children list until finalize-tasks
       ;; flattens the whole tree (so includes can be recorded).
       ;; key is the ^anchor, or #f until the load layer mints one.
       #'(task title kw.date kw.description kw.done kw.id 'tags-lit
               (list child ...) file-lit kw.id (srcloc src ln cl ps sp)))]
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

(define-syntax (module-begin stx)
  (syntax-parse stx
    [(_ form:body-form ...)
     (validate-body-forms (syntax->list #'(form ...)))
     #`(#%module-begin
        (provide tasks anchors includes)
        (define raw-forms (list form ...))
        (define-values (tasks includes)
          (finalize-tasks raw-forms #,(syntax-source-path stx)))
        (define anchors (build-anchors-hash tasks))
        (void))]))
