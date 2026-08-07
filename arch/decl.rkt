#lang racket/base

;; What a declaration IS, and how a package's defaults and a module's override
;; compose into the one answer a check asks for.
;;
;; Two shapes, because a declaration is written at two altitudes: a `scope-decl`
;; is what an `arch.rkt` says about everything under it, and a `module-decl` is
;; the `(override "file.rkt" ...)` that one module carries when it differs. The
;; merge is `declaration-for`, and it is the only place the two meet — a check
;; never sees a default and an override separately, which is what keeps
;; "effective declaration" from being computed twice, differently.
;;
;; Composition, spelled out because it is the part a reader has to trust:
;;
;;   clock   — the override REPLACES. A module is at one clock or another.
;;   owns    — the override ADDS. The package says what is ordinary; the
;;             exceptions declare themselves, and a default of `(owns)` plus a
;;             module that owns the filesystem reads the way it is meant to.
;;   concept — ADDS, same reason. A package-level concept is owned by the whole
;;             directory; a concept on an override is owned by that one file.
;;
;; Nothing here reads a file, expands anything or knows what a check is. This
;; is the vocabulary's grammar in struct form, and every consumer — the
;; expander that builds one, the checker that reads one, `--explain` that
;; prints one — goes through these accessors.

(require racket/contract
         racket/list)

(provide (struct-out grant)
         (struct-out claim)
         (struct-out module-decl)
         (struct-out scope-decl)
         (struct-out effective)
         (contract-out
          [declaration-for (-> scope-decl? string? effective?)]
          [effective-owns (-> effective? (listof symbol?))]
          [effective-owns? (-> effective? symbol? boolean?)]))

;; One authority, owned here.
;;
;; `spellings` is the door this module opens onto it: `olai/dates.rkt` owns the
;; clock and hands it on as `today-iso-string`, so a module that calls THAT is
;; reading the clock as surely as one that calls `(today)`. Declared on the
;; owner because the owner is where the fact is — the checker ships the base
;; spellings of the language it is checking, and nothing else.
;;
;; loc: the srcloc of the form, for the message that says where a thing was
;;      declared.
(struct grant (authority spellings loc) #:transparent)

;; One concept, owned here. `globs` are the export names that belong to it —
;; `mint-*` for node-key minting — and matching one from anywhere else is the
;; violation.
(struct claim (concept globs loc) #:transparent)

;; One `(override "file.rkt" ...)`. `clock` is #f when the override did not
;; mention one, which is the ordinary case: a module usually differs in what it
;; owns, not in how fast it moves.
(struct module-decl (file clock clock-loc grants claims) #:transparent)

;; One `arch.rkt`, whole.
(struct scope-decl (clock clock-loc grants claims modules) #:transparent)

;; The answer for ONE module: what it may depend on, what it may reach for,
;; what it owns. `module` is the override that applied, or #f when the package
;; default stood — which is the one thing `--explain` needs in order to say
;; where a line came from.
(struct effective (module clock clock-loc grants claims) #:transparent)

;; scope-decl x "web/watch.rkt" -> effective
;;
;; `file` is relative to the arch.rkt's own directory, which is how an override
;; names its module and how the caller has to ask.
(define (declaration-for scope file)
  (define over
    (for/first ([m (in-list (scope-decl-modules scope))]
                #:when (string=? (module-decl-file m) file))
      m))
  (effective over
             (or (and over (module-decl-clock over)) (scope-decl-clock scope))
             (or (and over (module-decl-clock-loc over)) (scope-decl-clock-loc scope))
             (append (scope-decl-grants scope)
                     (if over (module-decl-grants over) '()))
             (append (scope-decl-claims scope)
                     (if over (module-decl-claims over) '()))))

;; What it owns, for a message: sorted and said once each.
(define (effective-owns e)
  (sort (remove-duplicates (map grant-authority (effective-grants e))) symbol<?))

;; Whether it owns one thing, which is a different question and asked far more
;; often — once per authority-bearing identifier in the tree. A scan over at
;; most seven grants, not a sort of them.
(define (effective-owns? e authority)
  (for/or ([g (in-list (effective-grants e))]) (eq? authority (grant-authority g))))
