#lang racket/base

;; Shared expander for #lang olai (outline) and #lang olai/sexp.
;;
;; Surface forms:
;;
;;   (t "title" [#:id "anchor"]
;;              [#:date "YYYY-MM-DD[THH:MM[:SS]]"]
;;              [#:doc "relative/path.md"]
;;              [#:description "..."]
;;              [#:done] | [#:done "ISO"]
;;              [#:doing] | [#:doing "ISO"]
;;              [#:after "anchor"] ... [#:blocks "anchor"] ... [#:see "anchor"] ...
;;              child ...)
;;
;;   (mirror "anchor")
;;   (include "relative/path.rkt")  ; require+splice top-level tasks
;;   (include "relative/*.rkt")     ; ... one splice per file the glob matched
;;
;; Children are (t ...) | (mirror ...) | (include ...) — closed grammar.
;; Module exports `tasks`, `anchors` (hash id -> task), `includes` (list of
;; absolute paths required by this module) and `include-globs` (list of
;; absolute glob patterns it expanded to get them).

(require racket/list
         racket/string
         racket/path
         olai/lang/tags
         olai/lang/graph
         ;; what state a node is in — stored, or derived from its children —
         ;; and the one contradiction the language rejects
         olai/lang/state
         (for-syntax racket/base
                     olai/lang/tags
                     olai/lang/graph
                     olai/lang/state
                     ;; what a starred @include path names, and where it reads
                     olai/glob
                     ;; the date grammar has one owner; the expander is a
                     ;; consumer of it, at phase 1 like the tag grammar
                     olai/dates
                     ;; and what a @doc path means — which extensions are
                     ;; documents, and where a relative one resolves to
                     olai/doc
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
         make-task
         task?
         task-title
         task-date
         task-description
         task-doc
         task-done
         task-doing
         task-status
         task-stored-status
         task-status-derived?
         task-child-tasks
         task-done-at
         task-doing-at
         task-id
         task-tags
         task-edges
         task-children
         task-file
         task-key
         task-loc
         mirror-ref
         mirror-ref?
         mirror-ref-anchor
         mirror-ref-loc
         edge-ref
         edge-ref?
         edge-ref-relation
         edge-ref-anchor
         edge-ref-loc
         title-tags
         tag-rx
         valid-anchor-id?
         check-task-graph
         anchors-of
         #%app #%datum #%top #%top-interaction
         quote)

;; done / doing: #f | #t | ISO date/datetime string. Mutually exclusive on a
;;      node — the `t` macro rejects the pair (see below).
;; doc: #f | the document path the source wrote, VERBATIM and relative to the
;;      defining file. Never resolved here and never read: the string is data
;;      (it is what the JSON carries), and turning it into bytes on a screen
;;      is the web view's business — see olai/doc for the one place that
;;      knows how the two relate.
;; id: #f | non-empty anchor string
;; file: #f | absolute path string of defining outline
;; key: stable node identity — the ^anchor here, #f for an unanchored node
;;      until the load layer mints one (olai/load, mint-task-keys). A
;;      module cannot mint it: it knows only its own entry point, and the same
;;      node reached through a different root must key the same.
;; edges: the typed edges written on this node, in source order — one edge-ref
;;      per `@after` / `@blocks` / `@see` line. VERBATIM: `@blocks` stays
;;      `@blocks` here, because the file keeps whichever direction its writer
;;      thought in; normalizing to one ordering relation is derivation's job
;;      (olai/edges), which is the layer that has the whole graph.
;; loc: srcloc of the form that defined this node. Kept because a tree that
;;      came through @include has no syntax left by the time it is checked,
;;      and an error still has to say file:line:col.
(struct task (title date description doc done doing id tags edges children file key loc)
  #:transparent)

;; Build one BY NAME. Ten positional arguments in the macro template below
;; meant every new field (loc, key, and now doc) had to be threaded through
;; the struct, the template and every construction site, in the same order,
;; with nothing to say when a site got it wrong. With keywords the field order
;; stops being an interface: a new field is a new optional argument that every
;; existing caller already gets right — which is exactly what @doc turned out
;; to be.
(define (make-task #:title title
                   #:date [date #f]
                   #:description [description #f]
                   #:doc [doc #f]
                   #:done [done #f]
                   #:doing [doing #f]
                   #:id [id #f]
                   #:tags [tags '()]
                   #:edges [edges '()]
                   #:children [children '()]
                   #:file [file #f]
                   ;; the ^anchor, or #f until the load layer mints one
                   #:key [key #f]
                   #:loc [loc #f])
  (task title date description doc done doing id tags edges children file key loc))

;; `done` / `doing` are STORAGE — #f, #t, or the ISO day the mark was written
;; with. What a consumer wants is the STATE, and it is derived here, once.
;; Eight places used to read `done` as a boolean, which is fine until a node
;; can be in a third state: then "not done" quietly means "open", in eight
;; places, and each of them has to be found. Switching on task-status instead
;; makes a new state a new `case` clause the compiler cannot help you forget.
;;
;; The language rejects a node carrying both marks, so the order below is not
;; a policy: it is what a hand-built task (make-task, a test) gets if it
;; ignores the rule.
(define (task-stored-status tk)
  (cond
    [(task-done tk) 'done]
    [(task-doing tk) 'doing]
    [else 'open]))

;; The CHILDREN a state is derived from: the ones that have a state. A mirror
;; site is a reference and an unspliced include is a promise; neither is a node
;; this tree can ask (olai/lang/state). Named apart from `task-children`, which
;; is every child FORM the source wrote.
(define (task-child-tasks tk)
  (for/list ([c (in-list (task-children tk))] #:when (task? c)) c))

;; THE state — what a consumer switches on. Stored when the node wrote a mark,
;; derived from its task children when it did not. olai/lang/state owns both
;; the rule and the walk it implies; this is the protocol a task answers it
;; through, and the only place that binds the two.
;;
;; Computed on every ask, and deliberately not cached anywhere: a state that is
;; stored twice is a state that can drift, which is the whole reason it is
;; derived at all. It costs one walk of the subtree, and every caller that
;; walks the tree asking it pays O(nodes x depth) for the lot.
(define (task-status tk)
  (node-status tk #:stored task-stored-status #:kids task-child-tasks))

;; Did that answer come from the children? What the write path refuses to
;; overwrite and what the JSON publishes beside the state itself. It does not
;; ask what the children SAY — see status-derived? — so it is a look at one
;; node where the line above is a walk.
(define (task-status-derived? tk)
  (status-derived? (task-stored-status tk) (task-child-tasks tk)))

;; When the mark was written, if it was recorded: #f for a bare @done /
;; @doing, and for a node that does not carry that mark at all.
(define (stamp v) (and (string? v) v))

(define (task-done-at tk) (stamp (task-done tk)))
(define (task-doing-at tk) (stamp (task-doing tk)))

;; Mirror site: same node as anchors[anchor], not a copy.
(struct mirror-ref (anchor loc) #:transparent)

;; One typed edge, as written: which relation, which anchor it names, and the
;; `@after ^x` line it was written on. A REFERENCE, like a mirror site — it
;; points at a node without carrying one, and what it points at is only
;; answerable once the whole set is in hand (lang/link).
(struct edge-ref (relation anchor loc) #:transparent)

;; What one @include put in the tree, before flatten: the files it named, the
;; top-level tasks they contributed, and — when the site was a GLOB — the
;; pattern that named them.
;;
;; One struct for both spellings, because downstream there is one concept: an
;; include site is a set of files spliced in. The pattern is the only thing a
;; glob site knows that a literal one does not, and it is kept because the
;; STORE has to re-ask it — a file appearing in Daily/ changes what this
;; module means without changing any file it read.
(struct include-splice (pattern files tasks) #:transparent)

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

;; Does the document `stx` names exist? Resolved against the file `stx` was
;; WRITTEN in — a fragment spliced into two roots names the same document from
;; either one.
(define-for-syntax (doc-file-exists?/stx stx)
  (define p (doc-path (syntax-e stx) (syntax-source-path stx)))
  (and p (file-exists? p)))

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

  ;; A DOCUMENT PATH, and the three things that make one: it is relative, it
  ;; ends in an extension the view can draw, and the file is there. All three
  ;; are checked HERE, in the language, and nowhere else — a typo in a @doc
  ;; must reach an agent through `olai check` like every other malformed form,
  ;; not as a grey line in a browser nothing machine-readable ever sees.
  ;;
  ;; Existence is the same call @include already makes, for the same reason:
  ;; the field names a file, and a name that resolves to nothing is not a
  ;; document with a problem, it is a form that is wrong.
  ;;
  ;; In this order, because each one is what makes the next answerable: an
  ;; absolute path has no defining file to resolve against, and a path in no
  ;; format this view reads is not worth going to the disk about.
  (define-syntax-class doc-str
    #:description "a document path relative to this file"
    (pattern d:str
             #:fail-unless (doc-relative? (syntax-e #'d))
             "expected a path relative to this file, not an absolute one"
             #:fail-unless (doc-kind (syntax-e #'d))
             (format "expected a document path ending in ~a" doc-extensions-phrase)
             #:fail-unless (doc-file-exists?/stx #'d)
             (format "file not found: ~a" (syntax-e #'d))))

  ;; A MARK — #:done, #:doing — is a keyword, optionally stamped with an ISO
  ;; date. The two are the same shape and are still written out, because the
  ;; LITERAL keyword is load-bearing: a class parameterized over the keyword
  ;; matches any keyword and rejects the wrong one with a #:when, which fails
  ;; further into the term than `#:date`'s bad-date failure does — and
  ;; syntax-parse then reports the mark instead of the date. That costs the
  ;; srcloc test in tests/outline.rkt ("bad @date value reports … line 3"),
  ;; which is the contract CLAUDE.md is about. Measured, not assumed.
  (define-splicing-syntax-class done-kw
    #:attributes (value)
    (pattern (~seq #:done d:date-str)
             #:attr value (datum->syntax #'d (attribute d.normalized) #'d))
    (pattern (~seq #:done)
             #:attr value #'#t))

  ;; `kw` is the #:doing keyword itself. "done and doing" has to be reported
  ;; AT one of the two marks and this is the one, so only this class carries
  ;; it — in the outline reader each keyword holds the line its own spelling
  ;; was written on, which is what makes the error name @doing / [/].
  (define-splicing-syntax-class doing-kw
    #:attributes (value kw)
    (pattern (~seq (~and k #:doing) d:date-str)
             #:attr value (datum->syntax #'d (attribute d.normalized) #'d)
             #:attr kw #'k)
    (pattern (~seq (~and k #:doing))
             #:attr value #'#t
             #:attr kw #'k))

  ;; A TYPED EDGE, one keyword and the anchor it names. The three spellings are
  ;; written out rather than matched as "any keyword in the closed set": a class
  ;; parameterized over the keyword matches #:date too and rejects it with a
  ;; #:when, which fails further into the term than #:date's own bad-value
  ;; failure and costs the srcloc tests — the same measurement done-kw records
  ;; above. The SET still has one owner (lang/graph): the reader builds its line
  ;; grammar from it, and the checker refuses a relation that is not in it, so a
  ;; keyword added here and nowhere else is a keyword nothing accepts.
  (define-splicing-syntax-class edge-kw
    #:attributes (relation target)
    (pattern (~seq #:after a:anchor-str)
             #:attr relation #'after
             #:attr target #'a)
    (pattern (~seq #:blocks a:anchor-str)
             #:attr relation #'blocks
             #:attr target #'a)
    (pattern (~seq #:see a:anchor-str)
             #:attr relation #'see
             #:attr target #'a))

  (define-splicing-syntax-class t-kwargs
    ;; doing-loc is #f or the #:doing keyword — where "done and doing" is
    ;; reported (see doing-kw above).
    ;;
    ;; e.relation / e.target are the node's edges, at depth 1: a node carries
    ;; one date and any number of edges, which is the only structural
    ;; difference between this and every field above it.
    #:attributes (date description doc done doing doing-loc id
                  [e.relation 1] [e.target 1])
    (pattern (~seq (~alt (~optional (~seq #:date d:date-str)
                                    #:name "#:date")
                         (~optional (~seq #:doc doc-p:doc-str)
                                    #:name "#:doc")
                         (~optional (~seq #:description desc:str)
                                    #:name "#:description")
                         (~optional dk:done-kw
                                    #:name "#:done")
                         (~optional gk:doing-kw
                                    #:name "#:doing")
                         (~optional (~seq #:id id-str:anchor-str)
                                    #:name "#:id")
                         e:edge-kw)
                   ...)
             #:attr date (if (attribute d)
                             (datum->syntax #'d (attribute d.normalized) #'d)
                             #'#f)
             #:attr description (or (attribute desc) #'#f)
             #:attr doc (if (attribute doc-p) #'doc-p #'#f)
             #:attr done (if (attribute dk)
                             (attribute dk.value)
                             #'#f)
             #:attr doing (if (attribute gk)
                              (attribute gk.value)
                              #'#f)
             #:attr doing-loc (and (attribute gk) (attribute gk.kw))
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

  (struct ir-task (id title stored edges children stx) #:transparent)
  (struct ir-mirror (anchor stx) #:transparent)
  (struct ir-include (path stx) #:transparent)
  (struct ir-edge (relation target stx) #:transparent)

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
       (ir-task id*
                (syntax-e #'title)
                (cond
                  [(syntax-e #'kw.done) 'done]
                  [(syntax-e #'kw.doing) 'doing]
                  [else 'open])
                (for/list ([r (in-list (syntax->list #'(kw.e.relation ...)))]
                           [a (in-list (syntax->list #'(kw.e.target ...)))])
                  (ir-edge (syntax-e r) (syntax-e a) a))
                (map syntax->ir (syntax->list #'(child ...)))
                stx)]
      [_ (raise-syntax-error 'olai "internal: bad form for IR" stx)]))

  (define (any-include? irs)
    (define (walk ir)
      (match ir
        [(ir-include _ _) #t]
        [(ir-mirror _ _) #f]
        [(ir-task _ _ _ _ kids _) (ormap walk kids)]))
    (ormap walk irs))

  ;; The compile-time adaptor to the shared checker: an IR node's anchor, its
  ;; children, whether it is a mirror site, where it is, how to fail.
  (define (ir-loc ir)
    (define stx (ir-stx ir))
    (format "~a:~a" (or (syntax-line stx) "?") (or (syntax-column stx) "?")))

  (define (ir-stx ir)
    (match ir
      [(ir-task _ _ _ _ _ stx) stx]
      [(ir-mirror _ stx) stx]
      [(ir-include _ stx) stx]
      [(ir-edge _ _ stx) stx]))

  ;; The task children of an IR node — what a state derives from, and the same
  ;; exclusion the tree pass makes: a mirror site is a reference, an include is
  ;; a promise, and neither has a state to read.
  (define (ir-child-tasks ir)
    (if (ir-task? ir) (filter ir-task? (ir-task-children ir)) '()))

  (define (validate-body-forms stxs)
    (define irs (map syntax->ir stxs))
    ;; When this module uses @include, its own anchors are not all here yet —
    ;; the spliced tree is checked at run time instead (same rules, same
    ;; messages, srclocs carried on the nodes).
    ;;
    ;; #:scope #f either way: a module does not know which files it will be
    ;; loaded beside, so a *mirror it cannot resolve is not yet wrong. The
    ;; linker (lang/link) is the pass that can see them all, and it owns that
    ;; rule.
    ;;
    ;; Mirror sites and typed edges in one call: both are references to an
    ;; anchor, and the second is checked against the index the first builds.
    ;; The open scope is what they share too — an @after target may live in a
    ;; file this module has never heard of, so "unknown" is the linker's alone,
    ;; while a cycle among the forms in hand is a cycle wherever it is read.
    (unless (any-include? irs)
      (define (fail who ir msg)
        (raise-syntax-error who msg (and ir (ir-stx ir))))
      (check-anchor-graph
       irs
       #:id (λ (ir) (and (ir-task? ir) (ir-task-id ir)))
       #:kids (λ (ir) (if (ir-task? ir) (ir-task-children ir) '()))
       #:mirror (λ (ir) (and (ir-mirror? ir) (ir-mirror-anchor ir)))
       #:edges (λ (ir) (if (ir-task? ir) (ir-task-edges ir) '()))
       #:relation ir-edge-relation
       #:target ir-edge-target
       #:scope #f
       #:describe ir-loc
       #:fail fail)
      ;; And the STATE rule, over the same forms: a node that says it is done
      ;; may not contain unfinished work. Skipped with the others under an
      ;; @include for the same reason — the splice can put a child under a
      ;; node this pass reads as childless — and caught by the run-time pass
      ;; over the spliced tree, with the same message.
      (check-status-tree
       (filter ir-task? irs)
       #:stored ir-task-stored
       #:kids ir-child-tasks
       #:title ir-task-title
       #:fail fail))
    (void)))

;; ---- runtime include load + tree validation ------------------------------

(define current-include-stack (make-parameter '()))

(define (path-basename p)
  (define-values (base name dir?) (split-path p))
  (if (path-for-some-system? name)
      (path->string name)
      (format "~a" p)))

;; One file's top-level tasks, with the cycle guard around it. `rel` is what
;; the error calls the file: the path the source wrote for a literal include,
;; and the absolute path for a glob match, which the source never named.
(define (load-include-file abs-path rel)
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
    (values abs* tasks)))

;; ONE include site, however it was spelled: the files it named — one for a
;; literal path, however many the pattern matched for a glob — spliced flat
;; and in that order. A glob is not a second kind of include, it is a set of
;; them, so there is not a second loader either. `pattern` is #f unless the
;; site was a glob.
;;
;; Zero entries is a legal thing to write: `Daily/2027-*.rkt` on the first of
;; January names the files that year is about to have.
(define (load-include-splice pattern entries)
  (define-values (files taskss)
    (for/lists (files taskss) ([e (in-list entries)])
      (load-include-file (car e) (cdr e))))
  (include-splice pattern files (append* taskss)))

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

(define (loc->syntax loc)
  (and loc
       (datum->syntax #f 'olai
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
    [(edge-ref? x) (edge-ref-loc x)]
    [else #f]))

;; Validation over TASKS instead of syntax — the same rules, and the only
;; shape left once @include has spliced or once several files are held side by
;; side. A node carries the srcloc of the form that defined it, so an error
;; here says file:line:col even though nothing syntactic is left.
;;
;; It raises exn:fail:syntax, which is not a lie: this IS the language
;; rejecting a form, and it is what makes olai/load report the location in the
;; same fields as any other read/expand error. It answers with the anchors it
;; declared on the way through.
;;
;; Exported because the LINKER runs it over the whole loaded set (lang/link),
;; which is the same check with the scope closed.
(define (check-task-graph tasks #:scope [scope #f])
  ;; `x` is whatever the rule is ABOUT — a node for the mirror and state
  ;; rules, an edge for the edge ones — and each carries the srcloc of its own
  ;; form.
  (define (fail who x msg)
    (define stx (loc->syntax (and x (node-loc x))))
    (raise (exn:fail:syntax (format "~a: ~a" who msg)
                            (current-continuation-marks)
                            (if stx (list stx) '()))))
  ;; The state rule runs over the same forest, in every phase this function is
  ;; (after a splice, and again over the whole loaded set): it needs no scope,
  ;; since what a node contains is answerable wherever the node is.
  (check-status-tree
   (filter task? tasks)
   #:stored task-stored-status
   #:kids task-child-tasks
   #:title task-title
   #:fail fail)
  (check-anchor-graph
   tasks
   #:id (λ (x) (and (task? x) (task-id x)))
   #:kids (λ (x) (if (task? x) (task-children x) '()))
   #:mirror (λ (x) (and (mirror-ref? x) (mirror-ref-anchor x)))
   #:edges (λ (x) (if (task? x) (task-edges x) '()))
   #:relation edge-ref-relation
   #:target edge-ref-anchor
   #:scope scope
   #:describe (λ (x) (loc->string (node-loc x)))
   #:fail fail))

(define (finalize-tasks forms src)
  (define-values (includes globs) (collect-includes forms))
  (define flat (flatten-tree forms))
  (check-task-graph flat)
  (values flat includes globs))

;; id -> the node that declares it, over whatever forest you hand it: a
;; module's own tasks (the `anchors` it exports), one file's minted trees
;; (olai/load), or every loaded file at once (olai/lang/link). One walk,
;; because "which node is ^agent" is one question — only the forest differs.
;; A mirror site declares nothing, and is not a task, so it is skipped.
(define (anchors-of tasks)
  (define h (make-hash))
  (define (walk x)
    (when (task? x)
      (when (task-id x) (hash-set! h (task-id x) x))
      (for-each walk (task-children x))))
  (for-each walk tasks)
  h)

;; Every include site in this module, in source order.
(define (include-sites forms)
  (define sites '())
  (define (walk x)
    (cond
      [(include-splice? x)
       (set! sites (cons x sites))
       (for-each walk (include-splice-tasks x))]
      [(task? x)
       (for-each walk (task-children x))]
      [else (void)]))
  (for-each walk forms)
  (reverse sites))

;; What those sites contributed: the files they spliced, then the patterns
;; they found them with (a literal site has none). Read off one walk — two
;; walks is two chances to disagree about which sites there were.
;; -> (values (listof string) (listof string))
(define (collect-includes forms)
  (define sites (include-sites forms))
  (values (remove-duplicates (append* (map include-splice-files sites)))
          (remove-duplicates (filter values (map include-splice-pattern sites)))))

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

;; The directory an @include is relative to: the one the file that wrote it
;; sits in.
(define-for-syntax (include-base-dir stx)
  (define src (syntax-source stx))
  (cond
    [(path? src) (path-only src)]
    [(string? src) (path-only (string->path src))]
    [else #f]))

;; What an @include path names, wherever it is written — olai/glob's answer,
;; because a pattern and a file name resolve the same way and `daily` asks the
;; same question of a root it is about to write. All this adds is the
;; directory a source with no path of its own falls back to.
(define-for-syntax (include-target rel dir)
  (include-absolute rel (or dir (current-directory))))

(define-for-syntax (expand-literal-include stx rel dir)
  (define full (include-target rel dir))
  (unless (file-exists? full)
    (raise-syntax-error 'include (format "file not found: ~a" rel) stx))
  #`(load-include-splice #f (list (cons #,(path->string full) #,rel))))

;; A GLOB is expanded HERE, once per compile, so the module graph is static
;; for the life of a load: what the pattern matched is what got required, and
;; nothing re-reads a directory mid-tree. Asking it again is the store's job
;; (olai/store), which is also what recompiles this module when the answer has
;; moved.
;;
;; The two ways it can be wrong are not the same kind of wrong. A pattern
;; outside the grammar is a form the language does not accept. A directory
;; that is not there is a name that resolves to nothing, exactly like a
;; literal @include's missing file — the directory part is literal, so it is a
;; claim, and a typo in it must not read as "matched nothing". What the
;; pattern found in that directory is a different question, and the empty
;; answer is a legal one.
(define-for-syntax (expand-glob-include stx rel dir)
  (define problem (include-glob-problem rel))
  (when problem
    (raise-syntax-error 'include problem stx))
  (define pattern (include-target rel dir))
  (define gdir (glob-dir pattern))
  (unless (directory-exists? gdir)
    (raise-syntax-error 'include
                        (format "no such directory: ~a" (path->string gdir))
                        stx))
  ;; A match names ITSELF in an error: the source wrote a pattern, not this
  ;; file, and if it is gone by the time the require runs — a race, since the
  ;; directory was read a moment ago — the absolute path is what a reader
  ;; needs to go look.
  (define entries
    (for/list ([m (in-list (glob-expand pattern))])
      (define s (path->string m))
      #`(cons #,s #,s)))
  #`(load-include-splice #,(path->string pattern) (list #,@entries)))

(define-syntax (include stx)
  (syntax-parse stx
    [(_ path:str)
     (define rel (syntax-e #'path))
     (define dir (include-base-dir stx))
     (if (include-glob? rel)
         (expand-glob-include stx rel dir)
         (expand-literal-include stx rel dir))]
    [_
     (raise-syntax-error
      'include
      "expected (include \"relative/path.rkt\")"
      stx)]))

;; The shape of `t`, spelled once for the two clauses that answer with it.
(define-for-syntax t-shape
  (string-append "expected (t \"title\" [#:id anchor] [#:date iso-date] "
                 "[#:doc \"path.md\"] [#:description \"...\"] "
                 "[#:done [iso-date]] [#:doing [iso-date]] "
                 "[#:after anchor] [#:blocks anchor] [#:see anchor] child ...)"))

;; What a malformed `t` is blamed on: the title the source wrote, when it
;; wrote one, else the whole form.
(define-for-syntax (t-title-stx stx)
  (match (syntax-e stx)
    [(list-rest _ title _) title]
    [_ stx]))

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str kw:t-kwargs child:child-form ...)
     ;; Done and doing are STATES of one node, so it cannot be in both: `[x]`
     ;; with an `@doing` under it, `[/]` with an `@done`, or the two fields
     ;; together.
     ;;
     ;; Checked HERE and not in lang/graph, which owns the anchor rules: those
     ;; are about a relation BETWEEN nodes, across files, and only resolve
     ;; after @include splices — which is why they run twice, over syntax and
     ;; again over the tree. This rule is about one node's own fields, and
     ;; every node comes through this macro in its own defining module, so
     ;; compile time sees all of them and a splice cannot create a pair that
     ;; was not already there.
     ;;
     ;; Raised rather than spelled as a #:fail-when inside t-kwargs: a failed
     ;; syntax class drops through to the fallback clauses below, which would
     ;; answer "expected (t ...)" and lose the reason.
     (when (and (syntax-e #'kw.done) (syntax-e #'kw.doing))
       (raise-syntax-error
        't
        "a node is done or doing, not both; drop @done / [x] or @doing / [/]"
        stx
        (attribute kw.doing-loc)))
     (define tags (title-tags (syntax-e #'title)))
     (define file (syntax-source-path stx))
     (with-syntax ([tags-lit (datum->syntax stx tags)]
                   [file-lit (datum->syntax stx file)]
                   [(src ln cl ps sp) (loc-parts stx)]
                   ;; every edge keeps the line it was written on, the way a
                   ;; mirror site does: an @include splice leaves no syntax
                   ;; behind, and "unknown ^order" still has to say where
                   [((esrc eln ecl eps esp) ...)
                    (map loc-parts (syntax->list #'(kw.e.target ...)))])
       ;; Keep include-splice values in the children list until finalize-tasks
       ;; flattens the whole tree (so includes can be recorded).
       #'(make-task #:title title
                    #:date kw.date
                    #:description kw.description
                    #:doc kw.doc
                    #:done kw.done
                    #:doing kw.doing
                    #:id kw.id
                    #:tags 'tags-lit
                    #:edges (list (edge-ref 'kw.e.relation
                                            kw.e.target
                                            (srcloc esrc eln ecl eps esp))
                                  ...)
                    #:children (list child ...)
                    #:file file-lit
                    #:key kw.id
                    #:loc (srcloc src ln cl ps sp)))]
    [(_ title . _)
     (raise-syntax-error
      't
      (string-append t-shape "; title must be a string literal")
      stx
      (t-title-stx stx))]
    [_ (raise-syntax-error 't t-shape stx)]))

(define-syntax (module-begin stx)
  (syntax-parse stx
    [(_ form:body-form ...)
     (validate-body-forms (syntax->list #'(form ...)))
     #`(#%module-begin
        (provide tasks anchors includes include-globs)
        (define raw-forms (list form ...))
        (define-values (tasks includes include-globs)
          (finalize-tasks raw-forms #,(syntax-source-path stx)))
        (define anchors (anchors-of tasks))
        (void))]))
