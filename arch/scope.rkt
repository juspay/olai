#lang racket/base

;; Which declaration governs which module.
;;
;; An `arch.rkt` governs every `.rkt` beneath it, down to the next `arch.rkt`:
;; `olai/web/serve.rkt` answers to `olai/web/arch.rkt`, not to `olai/arch.rkt`,
;; and nothing has to say so twice. Deepest wins, which is the rule a reader
;; already assumes from where the file sits.
;;
;; `survey` is one walk down the tree carrying the nearest declaration with it,
;; so a module is assigned as it is met rather than looked up afterwards
;; against every scope in the repo. That is why there is no `in-directory`
;; here: the walk has to see a directory's own `arch.rkt` before it descends
;; into it, and a sequence hands out the files with nothing carried down.
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
          [survey (-> path? (values (listof scope?) (listof (cons/c scope? path?))))]
          [governing (-> (listof scope?) path? (or/c scope? #f))]
          [scope-covers? (-> scope? path? boolean?)]
          [effective-for (-> scope? path? effective?)]))

;; dir         : the directory the declaration governs, as a directory path
;; file        : the arch.rkt itself
;; declaration : its scope-decl
(struct scope (dir file declaration) #:transparent)

;; Every declaration under `root`, and every module each one governs. One walk:
;; a directory's own arch.rkt becomes the nearest declaration for everything
;; below it, and a module is assigned to whatever that is when the walk reaches
;; it. `compiled` and hidden directories are skipped — one holds bytecode and
;; the other holds tooling, and neither is anybody's architecture.
(define (survey root)
  (define scopes '())
  (define modules '())
  (let walk ([dir (simple-form-path root)] [nearest #f])
    (define entries (sort (directory-list dir #:build? #t) path<?))
    (define here
      (cond
        [(for/first ([e (in-list entries)] #:when (declaration-file? e)) e)
         => (λ (file)
              (define s (scope dir (simplify-path file) (dynamic-require file 'declaration)))
              (set! scopes (cons s scopes))
              s)]
        [else nearest]))
    (for ([e (in-list entries)])
      (define name (path->string (file-name-from-path e)))
      (cond
        [(directory-exists? e)
         (unless (or (string=? name "compiled") (string-prefix? name "."))
           (walk e here))]
        [(and here (string-suffix? name ".rkt") (not (string=? name "arch.rkt")))
         (set! modules (cons (cons here (simplify-path e)) modules))]
        [else (void)])))
  (values (reverse scopes) (reverse modules)))

(define (declaration-file? entry)
  (and (not (directory-exists? entry))
       (equal? "arch.rkt" (path->string (file-name-from-path entry)))))

;; The deepest scope whose directory contains `path` — for the one caller that
;; has a module and no walk to hang it off, `--explain`.
(define (governing scopes path)
  (for/fold ([best #f]) ([s (in-list scopes)] #:when (scope-covers? s path))
    (if (and best (> (depth (scope-dir best)) (depth (scope-dir s)))) best s)))

(define (depth dir) (length (explode-path dir)))

;; Does this declaration sit above that path? Check 3 asks the same question of
;; a package-level concept — "is this module inside the scope that claimed it"
;; — and two spellings of "under" is one too many.
(define (scope-covers? s path)
  (define rel (find-relative-path (scope-dir s) (simplify-path path)))
  (and (relative-path? rel) (not (string-prefix? (path->string rel) ".."))))

;; The one answer a check asks for: what this scope says about that module,
;; after its defaults and the module's own override. Every caller goes through
;; here, so "effective declaration" is composed in one place AND asked for in
;; one way.
(define (effective-for s path)
  (declaration-for (scope-declaration s)
                   ;; how an override names it: relative to the arch.rkt, in
                   ;; the spelling somebody types into the declaration
                   (path->string (find-relative-path (scope-dir s) (simplify-path path)))))
