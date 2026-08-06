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
         racket/list
         racket/string
         arch/vocabulary)

(provide (struct-out grant)
         (struct-out claim)
         (struct-out module-decl)
         (struct-out scope-decl)
         (struct-out effective)
         (contract-out
          [declaration-for (-> scope-decl? string? effective?)]
          [effective-owns (-> effective? (listof symbol?))]
          [effective-owns? (-> effective? symbol? boolean?)]
          [glob-matches? (-> string? symbol? boolean?)]))

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
(struct module-decl (file clock clock-loc grants claims loc) #:transparent)

;; One `arch.rkt`. `source` is its own path, so every message can say which
;; declaration it is quoting.
(struct scope-decl (source clock clock-loc grants claims modules) #:transparent)

;; The answer for ONE module: what it may depend on, what it may reach for,
;; what it owns. `scope` is the arch.rkt this came out of; `module` is the
;; override that applied, or #f when the package default stood.
(struct effective (path scope module clock clock-loc grants claims) #:transparent)

;; scope-decl x "web/watch.rkt" -> effective
;;
;; `file` is relative to the arch.rkt's own directory, which is how an override
;; names its module and how the caller has to ask.
(define (declaration-for scope file)
  (define over
    (for/first ([m (in-list (scope-decl-modules scope))]
                #:when (string=? (module-decl-file m) file))
      m))
  (effective file
             scope
             over
             (or (and over (module-decl-clock over)) (scope-decl-clock scope))
             (or (and over (module-decl-clock-loc over)) (scope-decl-clock-loc scope))
             (append (scope-decl-grants scope)
                     (if over (module-decl-grants over) '()))
             (append (scope-decl-claims scope)
                     (if over (module-decl-claims over) '()))))

(define (effective-owns e)
  (sort (remove-duplicates (map grant-authority (effective-grants e))) symbol<?))

(define (effective-owns? e authority)
  (and (memq authority (effective-owns e)) #t))

;; ---- globs -------------------------------------------------------------------

;; `*` and nothing else. A concept names its exports the way a person would say
;; them out loud — `mint-*`, `acp-*` — and anything richer would be a second
;; pattern language for a reader to learn, in a file whose whole point is that
;; it is read at a glance. The literal parts are quoted, so a `.` or a `?` in an
;; export name is a character and not a metacharacter.
(define (glob-matches? pattern name)
  (define rx
    (regexp (string-append "^"
                           (string-join (map regexp-quote (string-split pattern "*" #:trim? #f))
                                        ".*")
                           "$")))
  (regexp-match? rx (symbol->string name)))
