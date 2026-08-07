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
         (for-syntax racket/base
                     olai/lang/tags
                     olai/lang/graph
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
         task-done-at
         task-doing-at
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
;; loc: srcloc of the form that defined this node. Kept because a tree that
;;      came through @include has no syntax left by the time it is checked,
;;      and an error still has to say file:line:col.
(struct task (title date description doc done doing id tags children file key loc)
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
                   #:children [children '()]
                   #:file [file #f]
                   ;; the ^anchor, or #f until the load layer mints one
                   #:key [key #f]
                   #:loc [loc #f])
  (task title date description doc done doing id tags children file key loc))

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
(define (task-status tk)
  (cond
    [(task-done tk) 'done]
    [(task-doing tk) 'doing]
    [else 'open]))

;; When the mark was written, if it was recorded: #f for a bare @done /
;; @doing, and for a node that does not carry that mark at all.
(define (stamp v) (and (string? v) v))

(define (task-done-at tk) (stamp (task-done tk)))
(define (task-doing-at tk) (stamp (task-doing tk)))

;; Mirror site: same node as anchors[anchor], not a copy.
(struct mirror-ref (anchor loc) #:transparent)

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

  (define-splicing-syntax-class t-kwargs
    ;; doing-loc is #f or the #:doing keyword — where "done and doing" is
    ;; reported (see doing-kw above).
    #:attributes (date description doc done doing doing-loc id)
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
                                    #:name "#:id"))
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
      [_ (raise-syntax-error 'olai "internal: bad form for IR" stx)]))

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

;; Full-tree validation after includes splice — the same three rules the
;; compile-time pass applies, over tasks instead of syntax. A node carries
;; the srcloc of the form that defined it, so an error here says
;; file:line:col even though nothing syntactic is left.
;;
;; It raises exn:fail:syntax, which is not a lie: this IS the language
;; rejecting a form, and it is what makes olai/load report the location
;; in the same fields as any other read/expand error.
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
  (define-values (includes globs) (collect-includes forms))
  (define flat (flatten-tree forms))
  (validate-task-tree! flat)
  (values flat includes globs))

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

;; What an @include path names, wherever it is written. A pattern resolves the
;; same way a file name does — relative to the DEFINING file, so a fragment
;; spliced into two roots reads the same directory from either one — which is
;; why both branches below go through here and not through two spellings of
;; it.
(define-for-syntax (include-absolute rel dir)
  (define base (or dir (current-directory)))
  (simplify-path (path->complete-path (build-path base rel) base)))

(define-for-syntax (expand-literal-include stx rel dir)
  (define full (include-absolute rel dir))
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
  (define pattern (include-absolute rel dir))
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
                 "[#:done [iso-date]] [#:doing [iso-date]] child ...)"))

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
                   [(src ln cl ps sp) (loc-parts stx)])
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
        (define anchors (build-anchors-hash tasks))
        (void))]))
