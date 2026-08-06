#lang racket/base

;; What `@include Daily/*.rkt` NAMES.
;;
;; A literal include is a CLAIM about one file; a glob is a QUERY over one
;; directory, and everything that differs between the two follows from that. A
;; query answers with a set — the empty one included — and its answer can
;; change without any file the outline already read being touched. Acting on
;; either is somebody else's job (the expander splices the set, the store
;; re-asks the query, the watcher watches the directory it reads); this module
;; is the only one that knows how to ask.
;;
;; The grammar is smaller than a shell's, on purpose. `*` stands for any run
;; of characters inside ONE file name; the directory part is literal, so a
;; pattern names exactly one directory — which is what makes "watch where this
;; reads" a single answerable question. `**`, `?`, character classes and
;; braces are rejected BY NAME rather than quietly taken as literal
;; characters: a closed grammar says no out loud.

(require racket/contract
         racket/path
         racket/string)

(provide (contract-out
          [include-glob? (-> string? boolean?)]
          [include-glob-problem (-> string? (or/c string? #f))]
          [glob-absolute (-> string? (or/c path? #f) path?)]
          [glob-dir (-> path? path?)]
          [glob-expand (-> path? (listof path?))]
          [glob-match-rel (-> string? path? string?)]))

;; A path the source wrote is a glob when it stars something. Nothing else
;; promotes one: a file really called `notes[1].rkt` is a file, and an
;; @include naming it is a literal include. The other metacharacters are only
;; policed once a `*` says a pattern was meant (include-glob-problem).
(define (include-glob? rel)
  (string-contains? rel "*"))

;; The file name a pattern matches, and the directory part it reads it from —
;; both as the source wrote them. `#f` name when the pattern ends in a
;; separator (it names a directory, not files in one).
(define (pattern-parts rel)
  (define-values (base name dir?) (split-path (string->path rel)))
  (values (if (path? base) base #f)
          (and (not dir?)
               (path-for-some-system? name)
               (path->string name))))

;; #f when `rel` is a pattern this language will answer, else why not. Only
;; ever asked of a string include-glob? already said yes to.
(define (include-glob-problem rel)
  (define-values (base name) (pattern-parts rel))
  (cond
    [(string-contains? rel "**")
     "** is not a glob here: * matches inside one file name, never across directories"]
    [(for/or ([c (in-string "?[]{}")])
       (and (string-contains? rel (string c)) c))
     => (λ (c)
          (format "~a is not a glob character here; * is the only one" c))]
    [(not name)
     "a glob names files in a directory, so it must end in a file name pattern"]
    [(and base (string-contains? (path->string base) "*"))
     "only the file name may be starred; the directory part of an @include is literal"]
    [else #f]))

;; The pattern as an absolute path, resolved against the file that wrote it —
;; the same resolution a literal @include gets, because a glob is relative for
;; the same reason: a fragment spliced into two roots reads the same directory
;; from either one.
(define (glob-absolute rel base-dir)
  (define dir (or base-dir (current-directory)))
  (simplify-path (path->complete-path (build-path dir rel) dir)))

;; The one directory an absolute pattern reads. This is the thing to watch:
;; the files in it are what the pattern's answer is made of.
(define (glob-dir pattern)
  (or (path-only pattern) pattern))

(define (pattern-name pattern)
  (define-values (_base name _dir?) (split-path pattern))
  (path->string name))

;; `*` is any run of characters; everything else in the name is itself.
(define (name-rx name)
  (pregexp
   (string-append "^"
                  (string-join (map regexp-quote (string-split name "*" #:trim? #f))
                               ".*")
                  "$")))

;; What the pattern matches, right now, sorted lexicographically — which is
;; what makes date-named fragments (2026-01.rkt, 2026-02.rkt, ...) splice in
;; the order they were lived in, by construction rather than by a rule about
;; dates.
;;
;; A missing directory answers with the empty list rather than raising: this
;; is the function the store calls on every staleness check, and a directory
;; that went away between two loads is a reload, not a crash. The LANGUAGE is
;; where a pattern with no directory to read is rejected (lang/expander).
;;
;; A leading dot is not something `*` matches, exactly as in a shell — and
;; here that is load-bearing rather than a convention: `.#2026-08.rkt` is the
;; lock file Emacs leaves beside a file it is editing, it is a dangling
;; symlink, and globbing it in would break an outline nobody had touched.
(define (glob-expand pattern)
  (define dir (glob-dir pattern))
  (define rx (name-rx (pattern-name pattern)))
  (cond
    [(not (directory-exists? dir)) '()]
    [else
     (sort (for*/list ([p (in-list (directory-list dir))]
                       [name (in-value (path->string p))]
                       #:unless (string-prefix? name ".")
                       #:when (regexp-match? rx name)
                       [full (in-value (build-path dir p))]
                       #:when (file-exists? full))
             full)
           string<?
           #:key path->string)]))

;; What one match is CALLED: the path the source would have written for it, so
;; an error about a matched file names it the way the outline names its
;; siblings ("Daily/2026-01.rkt", not the whole absolute path).
(define (glob-match-rel rel matched)
  (define-values (base _name) (pattern-parts rel))
  (define name (file-name-from-path matched))
  (path->string (cond
                  [(and base name) (build-path base name)]
                  [name name]
                  [else matched])))
