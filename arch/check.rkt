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
         racket/set
         racket/string
         arch/churn
         arch/decl
         arch/facts
         arch/finding
         arch/scope
         arch/source
         arch/vocabulary
         arch/wording)

(provide (struct-out report)
         (struct-out site)
         (contract-out
          [audit (->* (path?) (#:window exact-positive-integer?) report?)]))

;; findings : every violation, in file order
;; notes    : what the run could not do — today only "there was no history to
;;            audit". Printed, never silent: a check that quietly does not run
;;            is the failure mode this whole tool exists to remove.
(struct report (scopes sites findings notes) #:transparent)

;; One governed module, with everything anybody needs to say about it — read
;; once, declared once, asked once. `defines` is what it exports AND defines,
;; which three of the four checks want; deriving it per check was the same list
;; built three times.
(struct site (path source defines decl) #:transparent)

(define (audit root #:window [window default-churn-window])
  (define-values (scopes governed) (survey root))
  (define sites
    (for/list ([entry (in-list governed)])
      (define path (cdr entry))
      (site path
            (read-source path)
            (sort (module-defines path) symbol<?)
            (effective-for (car entry) path))))
  ;; A dependency is a path, and check 1 asks about ~900 of them. Deriving the
  ;; far end's effective declaration again at each edge would be the same value
  ;; computed a second way, which is the bug this tool is named after.
  (define by-path (for/hash ([s (in-list sites)]) (values (site-path s) s)))
  (define history (read-churn root window))
  (define spellings (spelling-table sites))
  (define owners (concept-owners sites))
  (define label (make-labeller root))
  (report scopes
          sites
          (sort-findings
           (append
            (spelling-findings sites label)
            (claim-findings owners label)
            (append* (for/list ([s (in-list sites)]) (check-dependencies s by-path label)))
            (append* (for/list ([s (in-list sites)]) (check-authority s sites spellings label)))
            (append* (for/list ([s (in-list sites)]) (check-concepts s owners label)))
            (if history
                (append* (for/list ([s (in-list sites)]) (check-churn s history label)))
                '())))
          (if history
              '()
              (list (string-append
                     "churn: no git history here, so no declaration was audited against it"
                     " — the other three checks ran")))))

;; File, then line, then column. `sort` is stable, so three passes in reverse
;; key order say that in three lines and stay right when a fourth key is wanted.
(define (sort-findings fs)
  (define (part f get) (or (let ([loc (finding-loc f)]) (and loc (get loc))) 0))
  (sort (sort (sort fs < #:key (λ (f) (part f srcloc-column)))
              < #:key (λ (f) (part f srcloc-line)))
        string<?
        #:key (λ (f) (format "~a" (let ([loc (finding-loc f)]) (and loc (srcloc-source loc)))))
        #:cache-keys? #t))

;; ---- 1: dependencies point volatile -> stable ----------------------------------

(define (check-dependencies s by-path label)
  (define mine (site-decl s))
  (for*/list ([entry (in-list (source-requires (site-source s)))]
              [dep (in-value (car entry))]
              #:unless (equal? dep (site-path s))
              [far (in-value (hash-ref by-path dep #f))]
              [theirs (in-value (and far (site-decl far)))]
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
     (append*
      (for/list ([g (in-list (own-grants (site-decl s)))])
        (for/list ([name (in-list (grant-spellings g))]
                   #:unless (memq (string->symbol name) (site-defines s)))
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
  (define (bound-here? name)
    (or (hash-has-key? (source-definitions src) name) (memq name (site-defines s))))
  (for*/list ([(name loc) (in-hash (source-mentions src))]
              [a (in-value (hash-ref spellings name #f))]
              #:when (and a
                          (set-member? visible name)
                          (not (bound-here? name))
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

;; A concept, and the modules that may spell it.
;;
;; Read off `effective-claims`, exactly the way check 2 reads `effective-owns?`
;; — so a package-level `(concept …)` reaches the modules that package governs
;; and no further, which is what a package-level `(owns …)` already did.
;; Deriving ownership from `scope-decl-modules` instead had made concepts the
;; one thing in the tool that ignored nesting: `olai/arch.rkt` would own a
;; concept inside `olai/web/`, where it owns no authority, and an override
;; naming a module some deeper arch.rkt governs was dead for three checks and
;; live for this one.
;;
;; sites : every module whose effective declaration carries this claim
(struct owner (concept matchers loc sites) #:transparent)

(define (concept-owners sites)
  ;; One entry per DECLARATION, not per module: a package default is inherited
  ;; by everything under it, and all of those are one claim wearing one srcloc.
  (define by-loc (make-hash))
  (for* ([s (in-list sites)] [c (in-list (effective-claims (site-decl s)))])
    (hash-update! by-loc (claim-loc c)
                  (λ (prev) (cons (car prev) (cons s (cdr prev))))
                  (λ () (cons c '()))))
  (for/list ([(loc entry) (in-hash by-loc)])
    (define c (car entry))
    (owner (claim-concept c) (map matcher (claim-globs c)) loc (reverse (cdr entry)))))

;; A pattern and the regexp it is, compiled once when the claim is read rather
;; than once per (export name x pattern) — which was twenty thousand identical
;; compilations of thirty-one patterns.
(struct matcher* (glob rx) #:transparent)

;; `*` and nothing else. A concept names its exports the way a person would say
;; them out loud — `mint-*`, `acp-*` — and anything richer would be a second
;; pattern language for a reader to learn, in a file whose whole point is that
;; it is read at a glance. The literal parts are quoted, so a `.` or a `?` in an
;; export name is a character and not a metacharacter.
(define (matcher glob)
  (matcher* glob
            (regexp (string-append "^"
                                   (string-join (map regexp-quote (string-split glob "*" #:trim? #f))
                                                ".*")
                                   "$"))))

(define (claim-findings owners label)
  (define seen (make-hasheq))
  (append*
   (for/list ([o (in-list (sort owners string<? #:key (λ (o) (loc-brief (owner-loc o) label))))])
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
  (define mine (map claim-concept (effective-claims (site-decl s))))
  (for*/list ([name (in-list (site-defines s))]
              [o (in-list owners)]
              #:unless (memq (owner-concept o) mine)
              [hit (in-value (matching o name))]
              #:when hit)
    (finding (or (source-where src name) (srcloc (site-path s) 1 0 1 0))
             (format "~a: exports into concept `~a`" name (owner-concept o))
             (list (format "that concept is owned by ~a (~a)"
                           (owner-label o label) (loc-brief (owner-loc o) label))
                   (format "the pattern it matched: \"~a\"" (matcher*-glob hit))
                   "one owner per concept — require the name from the owner instead"))))

(define (matching o name)
  (define s (symbol->string name))
  (for/first ([m (in-list (owner-matchers o))] #:when (regexp-match? (matcher*-rx m) s)) m))

;; One module owns it, or a package does — which is exactly "how many modules
;; carry this claim", so the message does not need a second field to say it.
(define (owner-label o label)
  (define sites (owner-sites o))
  (if (= 1 (length sites))
      (label (site-path (car sites)))
      (format "~a and everything under it" (label (srcloc-source (owner-loc o))))))

;; ---- 4: the declaration against the history ----------------------------------------

(define (check-churn s history label)
  (define e (site-decl s))
  (define window (churn-window history))
  (define allowed (clock-allows (effective-clock e) window))
  (define n (churn-count history (site-path s)))
  (cond
    [(and allowed (> n allowed))
     (list (finding (effective-clock-loc e)
                    (format "~a: declared ~a, changed in ~a of the last ~a commits"
                            (label (site-path s)) (effective-clock e) n window)
                    (list (format "~a allows up to ~a of ~a" (effective-clock e) allowed window)
                          "either the code settles or the declaration changes — both are reviewable diffs")))]
    [else '()]))

;; ---- where a declaration is, inside a message line ------------------------------------

(define (loc-brief loc label)
  (if loc
      (format "~a:~a" (label (srcloc-source loc)) (or (srcloc-line loc) "?"))
      "?"))
