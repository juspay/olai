#lang racket/base

;; Which declaration governs which module.
;;
;; An `arch.rkt` governs every `.rkt` beneath it, down to the next `arch.rkt`:
;; `olai/web/serve.rkt` answers to `olai/web/arch.rkt`, not to `olai/arch.rkt`,
;; and nothing has to say so twice. Deepest wins, which is the rule a reader
;; already assumes from where the file sits.
;;
;; A module with no `arch.rkt` above it is not governed and not checked. That
;; is a hole with a shape: it can only be opened by MOVING a module out of a
;; declared package or by DELETING a declaration, and both are lines in a diff
;; somebody reviews. Silence is what the checker refuses; absence, out loud, it
;; can live with. It is also what keeps installed packages under the tree —
;; a `.plt-user` full of somebody else's Racket — from being architecture.

(require racket/contract
         racket/list
         racket/path
         racket/string
         arch/decl)

(provide (struct-out scope)
         (contract-out
          [find-scopes (-> path? (listof scope?))]
          [governing (-> (listof scope?) path? (or/c scope? #f))]
          [scope-modules (-> scope? (listof scope?) (listof path?))]
          [declaration-of (-> (listof scope?) path? (or/c effective? #f))]
          [scope-relative (-> scope? path? string?)]))

;; dir         : the directory the declaration governs, as a directory path
;; file        : the arch.rkt itself
;; declaration : its scope-decl
(struct scope (dir file declaration) #:transparent)

;; Every arch.rkt under `root`, loaded. `compiled` and hidden directories are
;; skipped: one holds bytecode and the other holds tooling, and neither is
;; anybody's architecture.
(define (find-scopes root)
  (sort
   (for/list ([p (in-list (arch-files (simple-form-path root)))])
     (scope (path-only p) p (dynamic-require p 'declaration)))
   >
   #:key (λ (s) (string-length (path->string (scope-dir s))))))

(define (arch-files root)
  (let walk ([dir root])
    (append*
     (for/list ([entry (in-list (directory-list dir #:build? #t))])
       (cond
         [(directory-exists? entry)
          (define name (path->string (file-name-from-path entry)))
          (if (or (string=? name "compiled") (string-prefix? name "."))
              '()
              (walk entry))]
         [(equal? "arch.rkt" (path->string (file-name-from-path entry)))
          (list (simplify-path entry))]
         [else '()])))))

;; The deepest scope whose directory contains `path`. `find-scopes` sorts
;; deepest-first, so this is the first hit.
(define (governing scopes path)
  (define target (simplify-path path))
  (for/first ([s (in-list scopes)] #:when (under? (scope-dir s) target)) s))

(define (under? dir path)
  (define rel (find-relative-path dir path))
  (and (relative-path? rel) (not (string-prefix? (path->string rel) ".."))))

;; Every module this scope actually governs: the .rkt files beneath it that no
;; deeper scope has taken, minus the declarations themselves.
(define (scope-modules s scopes)
  (sort
   (let walk ([dir (scope-dir s)])
     (append*
      (for/list ([entry (in-list (directory-list dir #:build? #t))])
        (define name (path->string (file-name-from-path entry)))
        (cond
          [(directory-exists? entry)
           (if (or (string=? name "compiled") (string-prefix? name "."))
               '()
               (walk entry))]
          [(not (string-suffix? name ".rkt")) '()]
          [(string=? name "arch.rkt") '()]
          [(eq? s (governing scopes entry)) (list (simplify-path entry))]
          [else '()]))))
   string<?
   #:key path->string))

;; The one answer a check asks for: what does this module say about itself,
;; after its package's defaults and its own override.
(define (declaration-of scopes path)
  (define s (governing scopes path))
  (and s (declaration-for (scope-declaration s) (scope-relative s path))))

;; How an override names this module: its path relative to the arch.rkt, in
;; unix spelling, which is what somebody types into the declaration.
(define (scope-relative s path)
  (path->string (find-relative-path (scope-dir s) (simplify-path path))))
