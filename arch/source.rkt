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
         syntax/modread
         syntax/modresolve)

(provide (struct-out source)
         (contract-out
          [read-source (-> path? source?)]
          [source-where (-> source? symbol? (or/c srcloc? #f))]))

;; path        : the module, absolute and simplified
;; lang        : the resolved path of its #lang, or #f when that is not a file
;;               (racket/base and friends resolve to files too — everything
;;               outside the tree is dropped by the caller, not here)
;; requires    : (listof (cons path srcloc)) — resolved, in source order
;; definitions : (hash symbol srcloc)
;; mentions    : (hash symbol srcloc), first occurrence
(struct source (path lang requires definitions mentions) #:transparent)

(define (read-source path)
  (define-values (lang-stx body) (module-parts (read-module path)))
  ;; The #lang is a dependency like any other, and the one every module has.
  ;; It is listed first so a message about it points at the first line, which
  ;; is where it is written.
  (define lang (and lang-stx (resolve-quietly lang-stx path)))
  (source (simplify-path path)
          lang
          (append (if lang (list (cons lang (loc-of lang-stx))) '())
                  (append* (for/list ([form (in-list body)]) (requires-in form path))))
          (definitions-of body)
          (mentions-of body)))

;; Where a name is written in this module: its definition if it has one, else
;; the struct it comes off (an accessor is defined by the `struct` form and
;; appears nowhere by that name), else nothing.
(define (source-where src name)
  (define defs (source-definitions src))
  (or (hash-ref defs name #f)
      (for/or ([(defined loc) (in-hash defs)])
        (define d (symbol->string defined))
        (define n (symbol->string name))
        (and (or (string-prefix? n (string-append d "-"))
                 (string=? n (string-append d "?"))
                 (string=? n (string-append "make-" d))
                 (string=? n (string-append "struct:" d)))
             loc))))

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

(define definer-rx #px"^(define|struct)")

(define (definitions-of body)
  (define out (make-hasheq))
  (define (record! name-stx loc)
    (when (and (identifier? name-stx) (not (hash-has-key? out (syntax-e name-stx))))
      (hash-set! out (syntax-e name-stx) loc)))
  (let walk ([forms body])
    (for ([form (in-list forms)])
      (define e (and (pair? (syntax-e form)) (syntax->list form)))
      (when (and e (>= (length e) 2) (identifier? (car e)))
        (define head (symbol->string (syntax-e (car e))))
        (when (regexp-match? definer-rx head)
          (define target (cadr e))
          (cond
            ;; (define (name arg ...) ...) and (define ((name a) b) ...)
            [(pair? (syntax-e target))
             (let dig ([t target])
               (if (pair? (syntax-e t)) (dig (car (syntax-e t))) (record! t (loc-of form))))]
            [else (record! target (loc-of form))]))
        (walk (cdr e)))))
  out)

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
(define (mentions-of body)
  (define out (make-hasheq))
  (define (record! s)
    (when (and (syntax? s) (symbol? (syntax-e s)) (not (hash-has-key? out (syntax-e s))))
      (hash-set! out (syntax-e s) (loc-of s))))
  (let walk ([s body])
    (cond
      [(list? s) (for-each walk s)]
      [(not (syntax? s)) (void)]
      [(quoted? s) (void)]
      [else
       (define e (syntax-e s))
       (cond
         [(pair? e)
          (define parts (syntax->list s))
          (record! (car e))
          (when (and parts
                     (>= (length parts) 2)
                     (identifier? (car parts))
                     (eq? 'apply (syntax-e (car parts))))
            (record! (cadr parts)))
          (walk (car e))
          (walk (cdr e))]
         [(vector? e) (for-each walk (vector->list e))]
         [(box? e) (walk (unbox e))]
         [else (void)])]))
  out)

(define (quoted? stx)
  (define e (syntax-e stx))
  (and (pair? e)
       (identifier? (car e))
       (memq (syntax-e (car e)) '(quote quote-syntax))
       #t))

(define (loc-of stx)
  (srcloc (syntax-source stx) (syntax-line stx) (syntax-column stx)
          (syntax-position stx) (syntax-span stx)))
