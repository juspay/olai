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
         file/sha1
         selfflowy/lang/tags
         (for-syntax racket/base
                     selfflowy/lang/tags
                     syntax/parse
                     racket/string
                     racket/list
                     racket/match
                     racket/path
                     (only-in gregor iso8601->date iso8601->datetime)))

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
         mirror-ref
         mirror-ref?
         mirror-ref-anchor
         title-tags
         tag-rx
         valid-anchor-id?
         validate-task-tree!
         find-task-by-id
         find-tasks-by-title
         #%app #%datum #%top #%top-interaction
         quote)

;; done: #f | #t | ISO date/datetime string
;; id: #f | non-empty anchor string
;; file: #f | absolute path string of defining outline
;; key: stable node identity, minted at load time (see mint-keys)
(struct task (title date description done id tags children file key) #:transparent)

;; Mirror site: same node as anchors[anchor], not a copy.
(struct mirror-ref (anchor) #:transparent)

;; Runtime include result before flatten (list of top-level tasks from fragment).
(struct include-splice (abs-path rel tasks) #:transparent)

(define (valid-anchor-id? s)
  (and (string? s) (regexp-match? #px"^[A-Za-z0-9_-]+$" s)))

(define-for-syntax (valid-anchor-id?/stx s)
  (and (string? s) (regexp-match? #px"^[A-Za-z0-9_-]+$" s)))

(define-for-syntax (syntax-source-path stx)
  (define s (syntax-source stx))
  (cond
    [(path? s) (path->string (simplify-path s #f))]
    [(string? s) s]
    [else #f]))

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

  (define (collect-anchor-decls ir-roots)
    (define h (make-hash))
    (define (walk ir)
      (match ir
        [(ir-mirror _ _) (void)]
        [(ir-include _ _) (void)]
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
        [(ir-include _ _) (void)]
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

  (define (check-mirror-cycles ir-roots decl-hash)
    (define id->ir (make-hash))
    (define (index ir)
      (match ir
        [(ir-mirror _ _) (void)]
        [(ir-include _ _) (void)]
        [(ir-task id kids _)
         (when id (hash-set! id->ir id ir))
         (for-each index kids)]))
    (for-each index ir-roots)

    (define edges (make-hash))
    (define (add-edge! from to mirror-stx)
      (hash-set! edges from
                 (cons (cons to mirror-stx)
                       (hash-ref edges from '()))))

    (define (walk-under ir owner)
      (match ir
        [(ir-include _ _) (void)]
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

    (define WHITE 0) (define GRAY 1) (define BLACK 2)
    (define color (make-hash))
    (define parent (make-hash))

    (define (format-cycle end)
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
    ;; When this module uses @include, cross-file anchors resolve only after
    ;; splice at runtime — skip full mirror checks here.
    (unless (any-include? irs)
      (check-mirrors-resolve irs decls)
      (check-mirror-cycles irs decls))
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

;; Full-tree validation after includes splice. Raises exn:fail with message.
(define (validate-task-tree! tasks)
  (define id->task (make-hash))
  (define id->file (make-hash))
  (define (walk x)
    (cond
      [(mirror-ref? x) (void)]
      [(task? x)
       (define id (task-id x))
       (when id
         (define prev (hash-ref id->task id #f))
         (when prev
           (define f1 (or (hash-ref id->file id #f) "?"))
           (define f2 (or (task-file x) "?"))
           (error 't
                  "duplicate ^~a; first declared in ~a, again in ~a"
                  id
                  (path-basename f1)
                  (path-basename f2)))
         (hash-set! id->task id x)
         (hash-set! id->file id (task-file x)))
       (for ([c (in-list (task-children x))])
         (walk c))]))
  (for ([t (in-list tasks)]) (walk t))

  (define known (sort (hash-keys id->task) string<?))
  (define (check-mirrors x)
    (cond
      [(mirror-ref? x)
       (define a (mirror-ref-anchor x))
       (unless (hash-has-key? id->task a)
         (define listed
           (if (null? known) "(none)" (string-join known ", ")))
         (error 'mirror
                "unknown *~a; anchors in this tree: ~a" a listed))]
      [(task? x)
       (for ([c (in-list (task-children x))])
         (check-mirrors c))]))
  (for ([t (in-list tasks)]) (check-mirrors t))

  ;; Cycle detection on id graph
  (define edges (make-hash))
  (define (add-edge! from to)
    (hash-set! edges from (cons to (hash-ref edges from '()))))
  (define (walk-under x owner)
    (cond
      [(mirror-ref? x)
       (add-edge! owner (mirror-ref-anchor x))]
      [(task? x)
       (when (task-id x)
         (add-edge! owner (task-id x)))
       (for ([c (in-list (task-children x))])
         (walk-under c owner))]))
  (for ([(id tk) (in-hash id->task)])
    (for ([c (in-list (task-children tk))])
      (walk-under c id)))

  (define WHITE 0) (define GRAY 1) (define BLACK 2)
  (define color (make-hash))
  (define parent (make-hash))
  (define (dfs u)
    (hash-set! color u GRAY)
    (for ([v (in-list (hash-ref edges u '()))])
      (define c (hash-ref color v WHITE))
      (cond
        [(= c GRAY)
         (hash-set! parent v u)
         (define nodes (list v))
         (let loop ([cur v])
           (define p (hash-ref parent cur #f))
           (when p
             (set! nodes (cons p nodes))
             (unless (equal? p v) (loop p))))
         (error 'mirror
                "mirror creates a cycle: ~a"
                (string-join nodes " -> "))]
        [(= c WHITE)
         (hash-set! parent v u)
         (dfs v)]))
    (hash-set! color u BLACK))
  (for ([id (in-hash-keys id->task)])
    (when (= (hash-ref color id WHITE) WHITE)
      (dfs id)))
  (void))

;; ---- node identity -------------------------------------------------------
;;
;; A node's key is what everything downstream addresses it by: element ids,
;; permalinks, stored collapse state, SSE swap targets. So it must not be
;; derived from anything the user retypes casually. It is:
;;
;;   * the ^anchor when the node has one — user-chosen, survives everything;
;;   * otherwise a hash of "<file>/<child ordinals>" ("Tasks.rkt/0.2.1"),
;;     which survives renaming the node or any ancestor, cannot collide
;;     between same-titled siblings, and changes only when siblings are
;;     reordered (anchor the node if you want more than that).
;;
;; Minted here, after includes splice, so ordinals are the ones the reader of
;; this file actually sees.

(define (short-hash s)
  (substring (sha1 (open-input-bytes (string->bytes/utf-8 s))) 0 8))

(define (path-key label ordinals)
  (string-append
   "p"
   (short-hash (format "~a/~a"
                       label
                       (string-join (map number->string (reverse ordinals)) ".")))))

(define (mint-keys tasks label)
  (define (walk x ordinals)
    (cond
      [(task? x)
       (struct-copy task x
                    [key (or (task-id x) (path-key label ordinals))]
                    [children (for/list ([c (in-list (task-children x))]
                                         [i (in-naturals)])
                                (walk c (cons i ordinals)))])]
      [else x]))
  (for/list ([t (in-list tasks)] [i (in-naturals)])
    (walk t (list i))))

(define (finalize-tasks forms src)
  (define includes (collect-include-paths forms))
  (define flat (flatten-tree forms))
  (validate-task-tree! flat)
  (values (mint-keys flat (if src (path-basename src) "")) includes))

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

(define (find-task-by-id tasks id)
  (define (walk x)
    (cond
      [(mirror-ref? x) #f]
      [(task? x)
       (if (equal? (task-id x) id)
           x
           (for/or ([c (in-list (task-children x))])
             (walk c)))]
      [else #f]))
  (for/or ([t (in-list tasks)]) (walk t)))

(define (find-tasks-by-title tasks title)
  (define acc '())
  (define (walk x)
    (cond
      [(mirror-ref? x) (void)]
      [(task? x)
       (when (equal? (task-title x) title)
         (set! acc (cons x acc)))
       (for ([c (in-list (task-children x))])
         (walk c))]))
  (for ([t (in-list tasks)]) (walk t))
  (reverse acc))

(define-syntax (mirror stx)
  (syntax-parse stx
    [(_ a:anchor-str)
     #'(mirror-ref a)]
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
                   [file-lit (datum->syntax stx file)])
       ;; Keep include-splice values in the children list until finalize-tasks
       ;; flattens the whole tree (so includes can be recorded).
       ;; key is #f until finalize-tasks mints it: ordinals are only knowable
       ;; once includes have spliced.
       #'(task title kw.date kw.description kw.done kw.id 'tags-lit
               (list child ...) file-lit #f))]
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
