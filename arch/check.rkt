#lang racket/base

;; The four checks, over declarations and facts. One walk, no judgment calls.
;;
;;   1  dependencies point volatile -> stable, never back
;;   2  ambient authority is used only where it is owned
;;   3  one owner per tagged concept
;;   4  the declarations agree with what git says actually changed
;;
;; Two smaller ones ride along, because each is the part of a bigger check that
;; audits the DECLARATION rather than the code: a spelling handed on for an
;; authority has to be a name the module really exports (check 2 is meaningless
;; otherwise), and a concept has to have exactly one claimant (check 3 is
;; meaningless otherwise).
;;
;; Nothing here reads a file, resolves a path, shells out or knows what git's
;; output looks like. It is handed sources, names and counts, and it answers
;; with findings — which is what lets the messages be tested against fixture
;; trees three lines long.
;;
;; `label` is how a path is SAID: the checks build message text and a message
;; with an absolute path in it is a message that differs on every machine. It
;; arrives as an argument rather than as a parameter, because a checker with
;; ambient state in it would be a poor advertisement for itself.

(require racket/contract
         racket/list
         racket/path
         racket/set
         racket/string
         arch/churn
         arch/decl
         arch/facts
         arch/finding
         arch/scope
         arch/source
         arch/vocabulary)

(provide (struct-out report)
         (struct-out site)
         (contract-out
          [audit (->* (path?) (#:window exact-positive-integer?) report?)]
          [sites-of (-> (listof scope?) (listof site?))]))

;; findings : every violation, in file order
;; notes    : what the run could not do — today only "there was no history to
;;            audit". Printed, never silent: a check that quietly does not run
;;            is the failure mode this whole tool exists to remove.
(struct report (root scopes sites churn findings notes) #:transparent)

;; One governed module, with everything anybody needs to say about it.
(struct site (path source decl) #:transparent)

(define (audit root #:window [window 30])
  (define scopes (find-scopes root))
  (define sites (sites-of scopes))
  (define history (read-churn root window))
  (define spellings (spelling-table sites))
  (define owners (concept-owners scopes))
  (define (label p) (path-label p root))
  (report root
          scopes
          sites
          history
          (sort
           (append
            (spelling-findings sites label)
            (claim-findings owners label)
            (append* (for/list ([s (in-list sites)]) (check-dependencies s scopes label)))
            (append* (for/list ([s (in-list sites)]) (check-authority s sites spellings label)))
            (append* (for/list ([s (in-list sites)]) (check-concepts s owners label)))
            (if history
                (append* (for/list ([s (in-list sites)]) (check-churn s history label)))
                '()))
           finding<?)
          (if history
              '()
              (list (string-append
                     "churn: no git history here, so no declaration was audited against it"
                     " — the other three checks ran")))))

(define (sites-of scopes)
  (append*
   (for/list ([s (in-list scopes)])
     (for/list ([m (in-list (scope-modules s scopes))])
       (site m (read-source m) (declaration-for (scope-declaration s) (scope-relative s m)))))))

(define (finding<? a b)
  (define (key f)
    (define loc (finding-loc f))
    (list (format "~a" (and loc (srcloc-source loc)))
          (or (and loc (srcloc-line loc)) 0)
          (or (and loc (srcloc-column loc)) 0)))
  (define ka (key a))
  (define kb (key b))
  (cond
    [(string<? (car ka) (car kb)) #t]
    [(string>? (car ka) (car kb)) #f]
    [(< (cadr ka) (cadr kb)) #t]
    [(> (cadr ka) (cadr kb)) #f]
    [else (< (caddr ka) (caddr kb))]))

;; ---- 1: dependencies point volatile -> stable ----------------------------------

(define (check-dependencies s scopes label)
  (define mine (site-decl s))
  (for*/list ([entry (in-list (source-requires (site-source s)))]
              [dep (in-value (car entry))]
              #:unless (equal? dep (site-path s))
              [theirs (in-value (declaration-of scopes dep))]
              #:when (and theirs
                          (> (clock-rank (effective-clock theirs))
                             (clock-rank (effective-clock mine)))))
    (finding
     (cdr entry)
     (format "requires ~a: dependency points the wrong way" (label dep))
     (list (declared-line (site-path s) mine label)
           (declared-line dep theirs label)
           (format "~a code must not depend on ~a code — invert the edge, or move the code that reaches across"
                   (effective-clock mine) (effective-clock theirs))))))

(define (declared-line path e label)
  (format "~a is declared ~a (~a)"
          (label path) (effective-clock e) (loc-brief (effective-clock-loc e) label)))

;; ---- 2: authority used only where owned ------------------------------------------

;; identifier -> authority. The base spellings are the language's own; the rest
;; are handed on by the modules that own the authority, which is where the fact
;; that `today-iso-string` reads a clock actually lives.
(define (spelling-table sites)
  (define table (make-hasheq))
  (for* ([a (in-list authorities)] [s (in-list (authority-spellings a))])
    (hash-set! table s a))
  (for* ([s (in-list sites)]
         [g (in-list (effective-grants (site-decl s)))]
         [name (in-list (grant-spellings g))])
    (hash-set! table (string->symbol name) (grant-authority g)))
  table)

;; A spelling is a promise that this module exports that name. When it does
;; not, check 2 is quietly not applying to anybody — so this is the finding
;; that keeps the table honest.
(define (spelling-findings sites label)
  (append*
   (for/list ([s (in-list sites)])
     (define defined (list->seteq (module-defines (site-path s))))
     (append*
      (for/list ([g (in-list (own-grants (site-decl s)))])
        (for/list ([name (in-list (grant-spellings g))]
                   #:unless (set-member? defined (string->symbol name)))
          (finding (grant-loc g)
                   (format "~a: not an export of ~a" name (label (site-path s)))
                   (list (format "an authority's spellings name what THIS module hands ~a on as"
                                 (grant-authority g))
                         "a name nothing exports is a rule that applies to nobody"))))))))

;; Grants from this module's own override, not from the package default: only
;; those can carry spellings (the expander refuses the others), and only those
;; are a claim about one module's exports.
(define (own-grants e)
  (define over (effective-module e))
  (if over (module-decl-grants over) '()))

(define (check-authority s sites spellings label)
  (define src (site-source s))
  (define mine (site-decl s))
  (define visible (imported-names src))
  ;; A module that binds the name itself is calling its own, whatever the
  ;; import brought in. Both halves matter: the source says what it defines
  ;; under any name, and the module system says what a `struct` form defined
  ;; without anybody writing the name down.
  (define defined
    (set-union (list->seteq (hash-keys (source-definitions src)))
               (list->seteq (module-defines (site-path s)))))
  (for*/list ([(name loc) (in-hash (source-mentions src))]
              [a (in-value (hash-ref spellings name #f))]
              #:when (and a
                          (set-member? visible name)
                          (not (set-member? defined name))
                          (not (effective-owns? mine a))))
    (finding loc
             (format "~a: ambient authority `~a` is not owned here" name a)
             (list (format "~a owns: ~a" (label (site-path s)) (word-list (effective-owns mine)))
                   (format "~a is owned by: ~a" a (owners-of a sites label))
                   "take what you need as an argument — or the declaration changes, in review"))))

;; Every name that reaches this module from something it requires, its #lang
;; included. An over-approximation on purpose: `only-in` narrows what arrives
;; and this does not model that, so a module that MENTIONS a name it did not
;; quite import is asked to declare an authority it does not quite use. The
;; error is on the side of declaring, which is the side a reader can check.
(define (imported-names src)
  (for/fold ([names (seteq)]) ([entry (in-list (source-requires src))])
    (set-union names (names-from (car entry)))))

;; Who else has this authority — the line that turns "you may not" into "ask
;; one of these". Capped, because a repo where thirty modules own the
;; filesystem would otherwise answer with a paragraph, and the point of the
;; line is to be read.
(define owners-shown 5)

(define (owners-of a sites label)
  (define who
    (sort (for/list ([s (in-list sites)] #:when (effective-owns? (site-decl s) a))
            (label (site-path s)))
          string<?))
  (cond
    [(null? who) "nobody"]
    [(<= (length who) owners-shown) (string-join who ", ")]
    [else (format "~a, and ~a more"
                  (string-join (take who owners-shown) ", ")
                  (- (length who) owners-shown))]))

;; ---- 3: one owner per concept -----------------------------------------------------

;; A concept and where it is owned. `module` is #f when the whole package owns
;; it, and one path when an override does.
(struct owner (concept globs loc scope module) #:transparent)

(define (concept-owners scopes)
  (append*
   (for/list ([s (in-list scopes)])
     (append
      (for/list ([c (in-list (scope-decl-claims (scope-declaration s)))])
        (owner (claim-concept c) (claim-globs c) (claim-loc c) s #f))
      (append*
       (for/list ([m (in-list (scope-decl-modules (scope-declaration s)))])
         (for/list ([c (in-list (module-decl-claims m))])
           (owner (claim-concept c) (claim-globs c) (claim-loc c) s
                  (simplify-path (build-path (scope-dir s) (module-decl-file m)))))))))))

(define (claim-findings owners label)
  (define seen (make-hasheq))
  (append*
   (for/list ([o (in-list owners)])
     (define prev (hash-ref seen (owner-concept o) #f))
     (hash-set! seen (owner-concept o) o)
     (if prev
         (list (finding (owner-loc o)
                        (format "~a: a concept claimed twice" (owner-concept o))
                        (list (format "already claimed at ~a" (loc-brief (owner-loc prev) label))
                              "one owner per concept, and two claimants is no owner at all")))
         '()))))

(define (check-concepts s owners label)
  (define src (site-source s))
  (define here (site-path s))
  (append*
   (for/list ([name (in-list (module-defines here))])
     (for*/list ([o (in-list owners)]
                 [glob (in-value (matching-glob o name))]
                 #:when (and glob (not (owned-by? o here))))
       (finding (or (source-where src name) (srcloc here 1 0 1 0))
                (format "~a: exports into concept `~a`" name (owner-concept o))
                (list (format "that concept is owned by ~a (~a)"
                              (owner-label o label) (loc-brief (owner-loc o) label))
                      (format "the pattern it matched: \"~a\"" glob)
                      "one owner per concept — require the name from the owner instead"))))))

(define (matching-glob o name)
  (for/first ([g (in-list (owner-globs o))] #:when (glob-matches? g name)) g))

(define (owned-by? o path)
  (if (owner-module o)
      (equal? (owner-module o) path)
      (under-scope? (owner-scope o) path)))

(define (under-scope? s path)
  (define rel (find-relative-path (scope-dir s) path))
  (and (relative-path? rel) (not (string-prefix? (path->string rel) ".."))))

(define (owner-label o label)
  (if (owner-module o)
      (label (owner-module o))
      (format "~a and everything under it" (label (owner-scope-file o)))))

(define (owner-scope-file o) (scope-file (owner-scope o)))

;; ---- 4: the declaration against the history ----------------------------------------

(define (check-churn s history label)
  (define e (site-decl s))
  (define ceiling (clock-churn-ceiling (effective-clock e)))
  (define n (churn-count history (site-path s)))
  (define window (churn-window history))
  (cond
    [(and ceiling (> (/ n window) ceiling))
     (list (finding (effective-clock-loc e)
                    (format "~a: declared ~a, changed in ~a of the last ~a commits"
                            (label (site-path s)) (effective-clock e) n window)
                    (list (format "~a allows up to ~a of ~a"
                                  (effective-clock e)
                                  (inexact->exact (floor (* ceiling window)))
                                  window)
                          "either the code settles or the declaration changes — both are reviewable diffs")))]
    [else '()]))

;; ---- where a declaration is, inside a message line ------------------------------------

(define (loc-brief loc label)
  (if loc
      (format "~a:~a" (label (srcloc-source loc)) (or (srcloc-line loc) "?"))
      "?"))
