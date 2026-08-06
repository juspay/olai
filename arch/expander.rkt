#lang racket/base

;; #lang arch — a package's architecture, written down.
;;
;;   #lang arch
;;   (clock settling)
;;   (owns)
;;   (concept file-naming "file-label" "key-label")
;;   (override "store.rkt" (owns filesystem))
;;   (override "cli.rkt"   (clock volatile) (owns (clock "today-iso-string")))
;;
;; Four forms, and the vocabulary inside them is closed (arch/vocabulary). The
;; module's whole value is a `declaration` — one `scope-decl`, provided — and
;; the checker is its only reader.
;;
;; Everything a declaration can get wrong is caught HERE, at compile time, with
;; the srcloc of the offending form: a clock word nobody ratified, an authority
;; that is a typo for a real one, an `(override "moved.rkt" ...)` naming a file
;; that is not there any more. That last one is the same call `@doc` and
;; `@include` make in the outline language, for the same reason — a declaration
;; about a file that does not exist is not a stale comment, it is a form that is
;; wrong, and it should reach an agent through the compiler rather than as
;; silence.
;;
;; The messages are longer than you would write for a human: rule, then what
;; the form takes, then what IS in the vocabulary, then a did-you-mean. That is
;; the shape the research says raises agent success, and it costs nothing —
;; nobody reads these except when something is already broken.

(require arch/decl
         (for-syntax racket/base
                     racket/list
                     racket/path
                     racket/string
                     syntax/parse
                     arch/vocabulary))

(provide (rename-out [module-begin #%module-begin])
         #%app #%datum #%top quote)

(begin-for-syntax

  ;; ---- how a refusal reads ---------------------------------------------------

  ;; Rule first, then one indented line per thing the reader needs. Blamed on
  ;; `stx`, which is always the smallest form that is actually wrong — the
  ;; authority word, not the `owns` around it.
  ;; `who` names the FORM that is refusing, for the cases where the offending
  ;; syntax is a bare string or the whole module and Racket would print `?`.
  (define (arch-error stx rule #:who [who #f] . lines)
    (raise-syntax-error
     who
     (string-join (cons rule (for/list ([l (in-list (flatten lines))])
                               (string-append "  " l)))
                  "\n")
     stx))

  (define (suggestion name candidates)
    (define hit (did-you-mean name candidates))
    (if hit (list (format "did you mean: ~a?" hit)) '()))

  ;; '(a b c) -> '(() (a) (a b)): what had already been seen at each element.
  (define (inits xs)
    (for/list ([i (in-range (length xs))]) (take xs i)))

  (define (head-of stx)
    (and (pair? (syntax-e stx)) (car (syntax-e stx))))

  ;; ---- the closed words ------------------------------------------------------

  (define (parse-clock-word stx)
    (unless (and (identifier? stx) (clock? (syntax-e stx)))
      (arch-error stx
                  "not a clock"
                  "clock takes one of the three ratified words, least volatile first"
                  (format "clocks: ~a" (word-list clocks))
                  (if (identifier? stx) (suggestion (syntax-e stx) clocks) '())))
    (syntax-e stx))

  (define (parse-authority-word stx)
    (unless (and (identifier? stx) (authority? (syntax-e stx)))
      (arch-error stx
                  "not an authority"
                  "owns takes ambient authorities, and the set is closed"
                  (format "authorities: ~a" (word-list authorities))
                  "a new authority is a roadmap proposal, not an edit here"
                  (if (identifier? stx) (suggestion (syntax-e stx) authorities) '())))
    (syntax-e stx))

  ;; `filesystem`, or `(clock "today-iso-string")` — the authority, and the
  ;; local identifiers this module hands it on as.
  (struct pgrant (authority spellings stx) #:transparent)

  (define (parse-grant stx #:in-override? in-override?)
    (syntax-parse stx
      [a:id (pgrant (parse-authority-word #'a) '() stx)]
      [(a s:str ...+)
       ;; A spelling is a claim about ONE module's exports — "I own the clock,
       ;; and here is what I hand it on as". A package default applies to every
       ;; module under it, so the same words there would be a claim about all of
       ;; them at once, which is not a thing anybody means.
       (unless in-override?
         (arch-error stx "a spelling on a package default"
                     "the names an authority is handed on as belong to the module that exports them"
                     (format "move it to an (override \"some.rkt\" (owns (~a ~s)))"
                             (syntax->datum #'a) (syntax-e (car (syntax->list #'(s ...)))))))
       (for ([s (in-list (syntax->list #'(s ...)))])
         (when (string=? "" (syntax-e s))
           (arch-error s "an empty spelling"
                       "a spelling is the identifier this module hands the authority on as")))
       (pgrant (parse-authority-word #'a) (map syntax-e (syntax->list #'(s ...))) stx)]
      [(a)
       (arch-error stx "an empty spelling list"
                   "an authority in parentheses names the identifiers this module hands it on as"
                   (format "write ~a on its own, or (~a \"some-name\")"
                           (syntax->datum #'a) (syntax->datum #'a)))]
      [_
       (arch-error stx "not an authority"
                   "owns takes bare words, or (authority \"spelling\" ...)"
                   (format "authorities: ~a" (word-list authorities)))]))

  ;; ---- clauses ---------------------------------------------------------------

  ;; A clause carries a tag so the assembly below can tell the three apart
  ;; without re-parsing. `loc` is the whole form: what a message points at.
  (struct clause (tag payload loc) #:transparent)

  (define (parse-clause stx #:in-override? [in-override? #f])
    (syntax-parse stx
      #:datum-literals (clock owns concept override)
      [(clock c)
       (clause 'clock (parse-clock-word #'c) stx)]
      [(clock . _)
       (arch-error stx "malformed clock"
                   "clock takes exactly one word: (clock stable)"
                   (format "clocks: ~a" (word-list clocks)))]
      [(owns g ...)
       (define gs (for/list ([g (in-list (syntax->list #'(g ...)))])
                    (parse-grant g #:in-override? in-override?)))
       (for ([g (in-list gs)] [seen (in-list (inits (map pgrant-authority gs)))])
         (when (memq (pgrant-authority g) seen)
           (arch-error (pgrant-stx g) "an authority owned twice"
                       "one entry per authority; a second is either a typo or a merge that went wrong"
                       (format "already owned here: ~a" (word-list seen)))))
       (clause 'owns gs stx)]
      [(concept name:id glob:str ...+)
       (for ([g (in-list (syntax->list #'(glob ...)))])
         (when (string=? "" (syntax-e g))
           (arch-error g "an empty export pattern"
                       "a concept's patterns are export names, `*` allowed: \"mint-*\"")))
       (clause 'concept
               (cons (syntax-e #'name) (map syntax-e (syntax->list #'(glob ...))))
               stx)]
      [(concept name:id)
       (arch-error stx "a concept with no spelling"
                   "concept names the EXPORTS that belong to it, so a check has something to match"
                   (format "write (concept ~a \"~a-*\") — one pattern at least"
                           (syntax->datum #'name) (syntax->datum #'name)))]
      [(concept . _)
       (arch-error stx "malformed concept"
                   "concept takes a name and one or more export patterns"
                   "for example: (concept node-key-minting \"mint-*\")")]
      [(override . _)
       #:when in-override?
       (arch-error stx "an override inside an override"
                   "override names ONE module, and a module has nothing under it"
                   "write a second (override \"other.rkt\" ...) beside this one")]
      [_
       (define head (head-of stx))
       (arch-error (or head stx)
                   (if in-override? "not an override clause" "not an arch form")
                   (if in-override?
                       "an override says how one module differs: clock, owns, concept"
                       "an arch.rkt says clock, owns, concept, override — and nothing else")
                   (if (and head (identifier? head))
                       (suggestion (syntax-e head) '(clock owns concept override))
                       '()))]))

  (define (clock-clause cs)
    (for/first ([c (in-list cs)] #:when (eq? 'clock (clause-tag c))) c))

  (define (check-one-clock cs)
    (define found (for/list ([c (in-list cs)] #:when (eq? 'clock (clause-tag c))) c))
    (when (> (length found) 1)
      (arch-error (clause-loc (cadr found))
                  "a second clock"
                  "one clock per declaration — a module moves at one speed or the other"
                  (format "the first is at line ~a" (or (syntax-line (clause-loc (car found))) "?")))))

  ;; ---- where a form is, as something the runtime can rebuild -----------------

  (define (source-string stx)
    (define s (syntax-source stx))
    (cond
      [(path? s) (path->string (simplify-path s #f))]
      [(string? s) s]
      [else #f]))

  (define (loc-stx stx)
    #`(srcloc #,(source-string stx)
              #,(syntax-line stx) #,(syntax-column stx)
              #,(syntax-position stx) #,(syntax-span stx)))

  ;; ---- clauses -> the constructor calls that build a declaration -------------

  (define (grants-stx cs)
    #`(list #,@(append*
                (for/list ([c (in-list cs)] #:when (eq? 'owns (clause-tag c)))
                  (for/list ([g (in-list (clause-payload c))])
                    #`(grant '#,(pgrant-authority g)
                             '#,(pgrant-spellings g)
                             #,(loc-stx (pgrant-stx g))))))))

  (define (claims-stx cs)
    (define claims (for/list ([c (in-list cs)] #:when (eq? 'concept (clause-tag c))) c))
    (for ([c (in-list claims)]
          [seen (in-list (inits (map (λ (c) (car (clause-payload c))) claims)))])
      (when (memq (car (clause-payload c)) seen)
        (arch-error (clause-loc c) "a concept claimed twice"
                    "one owner per concept, and that includes twice in one file"
                    "merge the two pattern lists into one (concept ...) form")))
    #`(list #,@(for/list ([c (in-list claims)])
                 #`(claim '#,(car (clause-payload c))
                          '#,(cdr (clause-payload c))
                          #,(loc-stx (clause-loc c))))))

  ;; ---- overrides -------------------------------------------------------------

  ;; The filename's syntax is kept beside the generated code: the duplicate and
  ;; missing-file checks can only be made once every override is parsed.
  (struct parsed-override (file-stx code) #:transparent)

  (define (parse-override stx)
    (syntax-parse stx
      #:datum-literals (override)
      [(override file:str clause ...)
       (define cs (for/list ([c (in-list (syntax->list #'(clause ...)))])
                    (parse-clause c #:in-override? #t)))
       (check-one-clock cs)
       (define ck (clock-clause cs))
       (parsed-override
        #'file
        #`(module-decl '#,(syntax-e #'file)
                       #,(if ck #`'#,(clause-payload ck) #'#f)
                       #,(if ck (loc-stx (clause-loc ck)) #'#f)
                       #,(grants-stx cs)
                       #,(claims-stx cs)
                       #,(loc-stx stx)))]
      [(override . _)
       (arch-error stx "malformed override"
                   "override names one module by its path, relative to this arch.rkt"
                   "for example: (override \"web/watch.rkt\" (owns filesystem-events))")]))

  ;; An override names a FILE, and the file has to be there. A rename that
  ;; leaves the declaration behind is the failure this catches, and it is worth
  ;; a compile error rather than a rule that quietly stops applying.
  (define (check-overrides overrides)
    (for ([o (in-list overrides)]
          [seen (in-list (inits (map (λ (o) (syntax-e (parsed-override-file-stx o))) overrides)))])
      (define stx (parsed-override-file-stx o))
      (define file (syntax-e stx))
      (when (member file seen)
        (arch-error stx #:who 'override "a module overridden twice"
                    "one override per module; merge the clauses into one form"
                    (format "already overridden: ~a" (string-join seen ", "))))
      (unless (relative-path? file)
        (arch-error stx #:who 'override "not a relative path"
                    "override names a module underneath this arch.rkt, never an absolute path"))
      (unless (regexp-match? #rx"[.]rkt$" file)
        (arch-error stx #:who 'override "not a module"
                    "override names a .rkt file — the thing that has imports and exports"))
      (define dir (let ([s (syntax-source stx)]) (and (path? s) (path-only s))))
      (when (and dir (not (file-exists? (build-path dir file))))
        (arch-error stx #:who 'override "no such module"
                    (format "there is no ~a beside this arch.rkt" file)
                    "a declaration about a file that moved is a rule that stopped applying")))))

;; ---- the module ---------------------------------------------------------------

(define-syntax (module-begin stx)
  (syntax-parse stx
    #:datum-literals (override)
    [(_ form ...)
     (define-values (over-forms top-forms)
       (partition (λ (f) (syntax-parse f #:datum-literals (override) [(override . _) #t] [_ #f]))
                  (syntax->list #'(form ...))))
     (define top (map parse-clause top-forms))
     (check-one-clock top)
     (unless (clock-clause top)
       (arch-error stx #:who 'arch
                   "no clock"
                   "an arch.rkt says how fast the code under it moves, before anything else"
                   (format "write (clock ~a) at the top; clocks: ~a" (car clocks) (word-list clocks))))
     (define overrides (map parse-override over-forms))
     (check-overrides overrides)
     (with-syntax ([clock-word (clause-payload (clock-clause top))]
                   [clock-loc (loc-stx (clause-loc (clock-clause top)))]
                   [grants (grants-stx top)]
                   [claims (claims-stx top)]
                   [(over ...) (map parsed-override-code overrides)]
                   [source (source-string stx)])
       #'(#%module-begin
          (provide declaration)
          (define declaration
            (scope-decl 'source 'clock-word clock-loc grants claims (list over ...)))))]))
