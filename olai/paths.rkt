#lang racket/base

;; What a file is CALLED. Core, not web: the store builds a node index out of
;; these and must not reach up into web/ for a basename.
;;
;;   file-label  what a human reads — the basename ("Daily.rkt").
;;   key-label   what a node's KEY is minted from: the defining file's path
;;               relative to the root set's common directory
;;               ("Daily/2026-08.rkt"). A basename would let two roots named
;;               Daily.rkt in different directories mint one key for two
;;               different nodes.
;;   dir-roots   which files a DIRECTORY contributes as roots.
;;
;; And what `serve` was POINTED AT — one path, a directory or a file (the
;; ROOT SPEC). Three questions are asked of it and all three are here, so
;; nothing downstream repeats the "is it a directory?" test in its own words:
;;
;;   root-outlines  which files it names — the candidate roots.
;;   root-dirs      which directories it reads — what a watcher watches.
;;   root-dir       the one directory it hangs off — where the agent works,
;;                  and the extent of what /media/ can reach.

(require racket/contract
         racket/list
         racket/path
         racket/string
         ;; which files in a directory a name names — the same question
         ;; `@include Daily/*.rkt` asks, with the pattern already chosen
         (only-in olai/glob glob-expand))

(provide (contract-out
          [file-label (-> any/c string?)]
          [roots-base (-> list? path?)]
          [dir-roots (-> (or/c path? string?) (listof path?))]
          [root-outlines (-> (or/c path? string?) (listof path?))]
          [root-dirs (-> (or/c path? string?) (listof path?))]
          [root-dir (-> (or/c path? string?) path?)]
          [key-label (-> path? any/c string?)]))

(define (->path p)
  (cond
    [(path? p) p]
    [(string? p) (string->path p)]
    [else (string->path (format "~a" p))]))

;; UI name for a file: its basename. A label that is not a path at all (the
;; renderer accepts plain strings) passes through.
(define (file-label label)
  (cond
    [(path? label) (path->string (file-name-from-path label))]
    [(string? label)
     (define-values (base name dir?) (split-path label))
     (if (path-for-some-system? name) (path->string name) label)]
    [else (format "~a" label)]))

;; The directory the loaded files hang off: the deepest directory that
;; contains all of them. Keys are minted relative to it, so the same outline
;; keys the same on another machine (a different $HOME does not re-key it).
(define (roots-base paths)
  (define dirs
    (for/list ([p (in-list paths)])
      (explode-path (path-only (simple-form-path (->path p))))))
  (cond
    [(null? dirs) (current-directory)]
    [else
     (define common
       (for/fold ([acc (car dirs)]) ([d (in-list (cdr dirs))])
         (for/list ([a (in-list acc)] [b (in-list d)]
                    #:break (not (equal? a b)))
           a)))
     (if (null? common)
         (current-directory)
         (apply build-path common))]))

;; The outlines a directory holds directly: its *.rkt, sorted.
;;
;; It is one glob, and it is spelled as one — sorted, files only, no dotfiles
;; — rather than as a second implementation of the same directory read. The
;; dotfile rule comes free with it, so an editor's lock file (`.#Tasks.rkt`,
;; a dangling symlink) is not an outline nobody wrote.
;;
;; Who asks: a write resolving an `^anchor` its own file does not declare
;; (olai/resolve consults the file's SIBLINGS), and `root-outlines` below,
;; which asks it at every level of a tree.
(define (dir-roots dir)
  (glob-expand (build-path (simple-form-path (->path dir)) "*.rkt")))

;; ---- what `serve` was pointed at -------------------------------------------
;;
;; One path, and the two shapes it can have. A DIRECTORY is a tree of
;; outlines; a FILE is one outline. Everything else about the two is the same,
;; which is why the dispatch lives here once.

(define (dir? spec) (directory-exists? (->path spec)))

;; `dir` and every directory under it, outermost first, sorted.
;;
;; A symlinked subdirectory is NOT descended into: a link that points at an
;; ancestor is a walk that never ends, and this one runs on every staleness
;; probe. A dot-prefixed name is skipped at every level, the same rule the
;; glob above keeps.
(define (dir-tree dir)
  (define (subdirs d)
    (for*/list ([name (in-list (sort (map path->string (directory-list d)) string<?))]
                #:unless (string-prefix? name ".")
                [p (in-value (build-path d name))]
                #:when (and (directory-exists? p) (not (link-exists? p))))
      p))
  (let walk ([d dir])
    (cons d (append-map walk (if (directory-exists? d) (subdirs d) '())))))

;; Every outline a root spec names: a file is itself, a directory is every
;; `*.rkt` under it — the one-directory glob above, asked at every level.
;;
;; Recursive, and the double-load a recursive walk used to risk is prevented
;; where it actually lives: a candidate another one `@include`s is not a root
;; (olai/load, load-roots). So a fragment under `Daily/` is loaded once, by
;; the file that splices it, and a stray outline three directories down is
;; still served rather than silently invisible.
(define (root-outlines spec)
  (if (dir? spec)
      (append-map dir-roots (dir-tree (simple-form-path (->path spec))))
      (list (simple-form-path (->path spec)))))

;; Every directory a root spec READS, which is what a watcher has to watch:
;; the whole tree under a directory (a new outline can appear in any of them,
;; including one that holds none yet), or the one directory a file sits in.
(define (root-dirs spec)
  (if (dir? spec)
      (dir-tree (simple-form-path (->path spec)))
      (list (root-dir spec))))

;; The one directory a root spec hangs off: itself, or the file's own. Always
;; spelled as a directory, so the two answers are the same kind of path.
(define (root-dir spec)
  (define full (simple-form-path (->path spec)))
  (path->directory-path (if (dir? full) full (path-only full))))

;; The name of `f` inside a key: relative to `base` when it sits under it,
;; else the full path (a fragment outside the root set still gets a name that
;; cannot collide with anything inside it).
(define (key-label base f)
  (cond
    [(not f) ""]
    [else
     (define full (simple-form-path (->path f)))
     (define rel (find-relative-path base full))
     (path->string (if (absolute-path? rel) full rel))]))
