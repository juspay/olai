#lang racket/base

;; A module as its SOURCE says it — read, never expanded.
;;
;; Three things come out of one read, and each one is a place a message has to
;; be able to point at:
;;
;;   requires    what this module says it depends on, resolved to paths, with
;;               the srcloc of the require spec that said it
;;   definitions what it defines, by name, with where
;;   mentions    every identifier it writes down, with where it first appears
;;
;; Reading rather than expanding is a decision about COST: `just arch` has to
;; live in the edit loop beside `just check`, and expanding this tree takes
;; tens of seconds. It is also a decision about MEANING — an architecture check
;; is about what a module says it depends on, not about what a macro it uses
;; happened to pull in behind it.
;;
;; What it costs: a dependency introduced only by a macro is invisible here.
;; That is the honest trade, and it is the same one a reader makes.
;;
;; The names come from the module system instead (arch/facts): what a module
;; EXPORTS and what it IMPORTS are questions only a compiler can answer, and
;; asking a compiled module is cheap. Locations are this file's; names are that
;; one's; nothing computes both.

(require racket/contract
         racket/list
         racket/path
         racket/string
         racket/set
         syntax/modread
         syntax/modresolve
         syntax/srcloc)

(provide (struct-out source)
         (contract-out
          [read-source (-> path? source?)]
          [source-where (-> source? symbol? (or/c srcloc? #f))]))

;; path        : the module, absolute and simplified
;; requires    : (listof (cons path srcloc)) — resolved, in source order, the
;;               #lang first: it is a dependency like any other, and the one
;;               every module has
;; definitions : (hash symbol srcloc)
;; mentions    : (hash symbol srcloc), first occurrence
(struct source (path requires definitions mentions) #:transparent)

(define (read-source path)
  (define-values (lang-stx body) (module-parts (read-module path)))
  ;; The #lang goes in with the requires, first, so a message about it points
  ;; at the first line — which is where it is written.
  (define lang (and lang-stx (resolve-quietly lang-stx path)))
  (source (simplify-path path)
          (append (if lang (list (cons lang (loc-of lang-stx))) '())
                  (append* (for/list ([form (in-list body)]) (requires-in form path))))
          (definitions-of body)
          (mentions-of body)))

;; Where a name is written in this module, or #f. A struct's accessors appear
;; nowhere by their own name, so the `struct` form records them as it is read
;; — which is why this is a lookup and not a second guess at the same naming
;; rule, run backwards.
(define (source-where src name)
  (hash-ref (source-definitions src) name #f))

;; ---- reading -----------------------------------------------------------------

(define (read-module path)
  (parameterize ([read-accept-reader #t]
                 [read-accept-lang #t])
    (with-module-reading-parameterization
     (λ ()
       (call-with-input-file path
         (λ (in)
           (port-count-lines! in)
           (read-syntax path in)))))))

;; (module name lang body ...) — and the body is sometimes already wrapped in a
;; #%module-begin, which is what a `#lang` built on syntax/module-reader hands
;; back.
(define (module-parts stx)
  (define e (syntax->list stx))
  (cond
    [(and e (>= (length e) 3))
     (define lang (caddr e))
     (define rest (cdddr e))
     (values lang
             (if (and (= 1 (length rest)) (module-begin-form? (car rest)))
                 (cdr (syntax->list (car rest)))
                 rest))]
    [else (values #f '())]))

(define (module-begin-form? stx)
  (define e (and (pair? (syntax-e stx)) (syntax-e (car (syntax-e stx)))))
  (eq? e '#%module-begin))

;; ---- requires ------------------------------------------------------------------

;; The require-spec grammar, as far as this tree writes it. An unknown form is
;; an ERROR and not a shrug: a spec the checker cannot read is a dependency it
;; cannot see, and a check with an invisible hole in it is worse than no check.
(define (requires-in form path)
  (define e (syntax->list form))
  (cond
    [(and e (pair? e) (memq (syntax-e (car e)) '(require)))
     (append* (for/list ([spec (in-list (cdr e))]) (spec-targets spec path)))]
    ;; requires nested in a submodule or a begin-for-syntax are this module's
    ;; too — they are what it needs in order to be itself.
    [(and e (pair? e) (memq (syntax-e (car e)) '(begin begin-for-syntax module module* module+)))
     (append* (for/list ([f (in-list (cdr e))]) (requires-in f path)))]
    [else '()]))

(define (spec-targets spec path)
  (define e (and (pair? (syntax-e spec)) (syntax->list spec)))
  (define head (and e (pair? e) (identifier? (car e)) (syntax-e (car e))))
  (cond
    ;; a bare collection path, or a string beside this file
    [(or (identifier? spec) (string? (syntax-e spec)))
     (define resolved (resolve-quietly spec path))
     (if resolved (list (cons resolved (loc-of spec))) '())]
    ;; the phase shifts and the name filters: what they wrap is the dependency
    [(memq head '(for-syntax for-template for-label combine-in))
     (append* (for/list ([s (in-list (cdr e))]) (spec-targets s path)))]
    [(memq head '(for-meta only-meta-in))
     (append* (for/list ([s (in-list (cddr e))]) (spec-targets s path)))]
    [(memq head '(only-in except-in rename-in relative-in))
     (spec-targets (cadr e) path)]
    [(eq? head 'prefix-in)
     (spec-targets (caddr e) path)]
    ;; (submod "file.rkt" test) depends on the file; (submod "." test) on
    ;; nothing outside this module
    [(eq? head 'submod)
     (if (member (syntax-e (cadr e)) '("." ".."))
         '()
         (spec-targets (cadr e) path))]
    [(memq head '(file lib planet quote))
     (define resolved (resolve-quietly spec path))
     (if resolved (list (cons resolved (loc-of spec))) '())]
    [else
     (error 'arch
            (string-append
             "unreadable require form\n"
             "  ~a:~a:~a\n"
             "  the checker reads require specs itself, and does not know this one: ~s\n"
             "  teach arch/source.rkt the form, or spell the require a way it knows")
            path (or (syntax-line spec) "?") (or (syntax-column spec) "?")
            (syntax->datum spec))]))

;; A spec that names something not installed resolves to nothing; that is a
;; problem for the compiler, not for a layering check.
(define (resolve-quietly spec path)
  (with-handlers ([exn:fail? (λ (_e) #f)])
    (define r (resolve-module-path (syntax->datum spec) path))
    (and (path? r) (simplify-path r))))

;; ---- definitions and mentions ---------------------------------------------------

;; Is this the head of a form that BINDS its second subform?
;;
;; `define`-anything (which covers this repo's own `define-style`,
;; `define-tokens`, `define-stream` …) and `struct` itself. Spelled as a
;; membership test rather than as `^(define|struct)`, because that pattern also
;; matched `struct-out` and `struct-copy` — so `(provide (struct-out task))`
;; recorded `task` as defined at the PROVIDE's line, and every message about a
;; struct pointed at the top of the file instead of at the struct.
(define (definer? head)
  (or (string-prefix? head "define") (string=? head "struct")))

(define (definitions-of body)
  (define out (make-hasheq))
  (define (record! name-stx loc)
    (when (and (identifier? name-stx) (not (hash-has-key? out (syntax-e name-stx))))
      (hash-set! out (syntax-e name-stx) loc)))
  ;; `(define (name arg ...) ...)`, `(define ((name a) b) ...)` — the name is
  ;; at the bottom left of however many argument lists there are.
  (define (record-target! target loc)
    (cond
      [(pair? (syntax-e target))
       (let dig ([t target])
         (if (pair? (syntax-e t)) (dig (car (syntax-e t))) (record! t loc)))]
      [else (record! target loc)]))
  (let walk ([forms body])
    (for ([form (in-list forms)])
      (define e (and (pair? (syntax-e form)) (syntax->list form)))
      (when (and e (>= (length e) 2) (identifier? (car e)))
        (define head (symbol->string (syntax-e (car e))))
        (when (definer? head)
          (define loc (loc-of form))
          (cond
            ;; A struct binds a whole family, and none of the family is written
            ;; down anywhere. Recording them here is what lets `source-where`
            ;; be a lookup rather than a second, backwards guess at the same
            ;; naming rule.
            [(string=? head "struct") (record-struct! record! e loc)]
            ;; (define-values (a b) e) binds every name in the list
            [(and (string-suffix? head "-values") (pair? (syntax-e (cadr e))))
             (for ([n (in-list (or (syntax->list (cadr e)) '()))]) (record! n loc))]
            [else (record-target! (cadr e) loc)]))
        (walk (cdr e)))))
  out)

;; (struct point (x y) …) binds point, point?, make-point, struct:point,
;; point-x, point-y. Over-reaching costs nothing — a name nobody looks up is a
;; hash entry — and under-reaching costs a message pointing at the wrong line.
(define (record-struct! record! parts loc)
  (define name-stx (cadr parts))
  (unless (pair? (syntax-e name-stx))
    (record! name-stx loc)
    (define name (symbol->string (syntax-e name-stx)))
    (define (derived s) (record! (datum->syntax name-stx (string->symbol s)) loc))
    (derived (string-append name "?"))
    (derived (string-append "make-" name))
    (derived (string-append "struct:" name))
    (for ([f (in-list (if (> (length parts) 2) (or (syntax->list (caddr parts)) '()) '()))]
          #:when (identifier? f))
      (derived (string-append name "-" (symbol->string (syntax-e f)))))))

;; Every identifier the module CALLS, and where it first calls it.
;;
;; Called, not merely written: an authority is a power a module exercises, and
;; a module exercises it by putting the name in operator position — `(today)`,
;; `(file-exists? p)`, `(thread proc)`, `[current-directory dir]` inside a
;; `parameterize`. The name appearing anywhere else is usually the opposite of
;; using it: `(define (agenda-groups tasks today) ...)` is a function that takes
;; the day as an argument, which is the thing the rule is FOR, and counting
;; that as a clock read would have made the rule punish the code that obeys it.
;;
;; `(apply subprocess #f #f #f cmd args)` is a call with a word in front of it,
;; so the word after `apply` counts too.
;;
;; What it misses: a spelling handed somewhere as a value — `(map file-exists?
;; ps)`. Nothing in this tree does that with an authority, and the alternative
;; is a scope analysis, which is an expander, which is the cost this whole file
;; exists to avoid.
;;
;; Quoted data is skipped either way: `'(today now)` is a list of two symbols,
;; and the module that tabulates authority spellings would otherwise look like
;; the one module that uses every authority there is.
;;
;; And BINDING positions are skipped, because "the first thing in a pair" is
;; not the same as "the operator of a call". `(for ([today days]) …)`,
;; `(λ (now) …)` and `(let ([now (f)]) …)` all put a name where a call would
;; sit, and every one of them is code taking the thing as an argument — the
;; exact shape check 2 exists to reward. Counting them would have made the rule
;; punish the code that obeys it, which is the failure mode a grammar with
;; arbitrary gaps produces: thrash against a rule nobody can infer.
(define (mentions-of body)
  (define out (make-hasheq))
  (define (record! s)
    (when (and (syntax? s) (symbol? (syntax-e s)) (not (hash-has-key? out (syntax-e s))))
      (hash-set! out (syntax-e s) (loc-of s))))
  (let walk ([s body] [skip (seteq)])
    (cond
      [(list? s) (for ([x (in-list s)]) (walk x skip))]
      [(not (syntax? s)) (void)]
      [(quoted? s) (void)]
      [(set-member? skip s) (void)]
      [else
       (define e (syntax-e s))
       (cond
         [(pair? e)
          (define parts (syntax->list s))
          (define bound (bound-positions parts))
          (record! (car e))
          ;; `(apply subprocess #f #f #f cmd args)` is a call with a word in
          ;; front of it, so the word after `apply` counts too.
          (when (and parts
                     (>= (length parts) 2)
                     (identifier? (car parts))
                     (eq? 'apply (syntax-e (car parts))))
            (record! (cadr parts)))
          (define skip* (if (set-empty? bound) skip (set-union skip bound)))
          (walk (car e) skip*)
          (walk (cdr e) skip*)]
         [(vector? e) (for ([x (in-vector e)]) (walk x skip))]
         [(box? e) (walk (unbox e) skip)]
         [else (void)])]))
  out)

;; The subforms of `parts` that hold NAMES rather than calls.
;;
;; A closed list, and deliberately a short one: it is about Racket's binding
;; forms, not about this repo, and a form nobody listed is walked as ordinary
;; code — which over-reports rather than under-reports, and that is the
;; direction the README already commits to.
(define (bound-positions parts)
  (define head (and parts (pair? parts) (identifier? (car parts))
                    (symbol->string (syntax-e (car parts)))))
  (define (at n) (if (and head (> (length parts) n)) (seteq (list-ref parts n)) (seteq)))
  (cond
    [(not head) (seteq)]
    ;; (lambda (a b) …) — the formals, whole
    [(member head '("lambda" "λ")) (at 1)]
    ;; (define-values (a b) e) — the name list
    [(string-suffix? head "-values") (at 1)]
    ;; (struct point (x y) …) — the field list
    [(member head '("struct" "define-struct")) (at 2)]
    ;; (let ([a e] …) …), (let loop ([a e]) …), and the whole `for` family:
    ;; the first subform of every clause is a name, or a list of them
    [(or (member head '("let" "let*" "letrec"))
         (regexp-match? #px"^for\\*?(/|$)" head))
     (clause-names parts (if (regexp-match? #px"^for\\*?/fold" head) 2 1))]
    [else (seteq)]))

;; The name half of each clause, out of the first `lists` list-shaped subforms
;; — `for/fold` has two clause lists, everything else here has one. A clause
;; that is not a list at all (`#:when e`) binds nothing and is left alone.
(define (clause-names parts lists)
  (for*/fold ([names (seteq)])
             ([group (in-list (take-lists (cdr parts) lists))]
              [clause (in-list group)]
              #:when (pair? (or (syntax->list clause) '())))
    (set-add names (car (syntax->list clause)))))

(define (take-lists stxs n)
  (let loop ([stxs stxs] [n n] [out '()])
    (cond
      [(or (zero? n) (null? stxs)) (reverse out)]
      [(syntax->list (car stxs)) => (λ (l) (loop (cdr stxs) (sub1 n) (cons l out)))]
      [else (loop (cdr stxs) n out)])))

(define (quoted? stx)
  (define e (syntax-e stx))
  (and (pair? e)
       (identifier? (car e))
       (memq (syntax-e (car e)) '(quote quote-syntax))
       #t))

;; `build-source-location` is the distribution's spelling of the same five
;; accessors; the checker has no business owning a second one.
(define loc-of build-source-location)
