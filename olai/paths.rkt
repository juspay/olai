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
;; And what a path NAMES, when it names files rather than being one. Three
;; shapes — a starred pattern (`Daily/*.rkt`, what an `@include` writes), a
;; DIRECTORY (what `serve` is pointed at), a FILE (itself) — and one question
;; asked of all three, so nothing downstream tests the shape in its own words:
;;
;;   files-named  which files it names, right now. The answer can change with
;;                no file anybody already read having moved, which is why the
;;                store re-asks it on every staleness probe.
;;   dirs-read    which directories it reads to answer — what a watcher
;;                watches, including ones it has matched nothing in yet.
;;   root-dir     the one directory a root spec hangs off: where the agent
;;                works, the extent of what /media/ can reach, and the base
;;                node keys are minted against.
;;   path-kind    which of the three shapes it has, for the one caller that
;;                has to branch on it rather than ask a question.

(require racket/contract
         racket/list
         racket/path
         ;; the pattern shape: what a starred name matches, and where it reads
         (only-in olai/glob include-glob? hidden-name? glob-expand glob-dir))

(provide (contract-out
          [file-label (-> any/c string?)]
          [roots-base (-> list? path?)]
          [dir-roots (-> (or/c path? string?) (listof path?))]
          [files-named (-> (or/c path? string?) (listof path?))]
          [dirs-read (-> (or/c path? string?) (listof path?))]
          [root-dir (-> (or/c path? string?) path?)]
          [path-kind (-> (or/c path? string?) (or/c (quote pattern) (quote dir) (quote file)))]
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
;; (olai/resolve consults the file's SIBLINGS), and `files-named` below, which
;; asks it at every level of a tree.
(define (dir-roots dir)
  (glob-expand (build-path (simple-form-path (->path dir)) "*.rkt")))

;; ---- a path that names files ------------------------------------------------
;;
;; Three shapes, one question each, and the dispatch lives here once. A
;; PATTERN names what it matches in one directory; a DIRECTORY names the tree
;; of outlines under it; a FILE names itself. What they have in common is what
;; the store's staleness probe cares about: the answer can move while nothing
;; already read has been touched, so it is asked again rather than remembered.

;; Which shape a path has: 'pattern | 'dir | 'file. Exported because a caller
;; that must BRANCH on it — the CLI does, to tell "no outlines in that
;; directory" from "no such file", and to say which it is on the way up —
;; would otherwise state the rule again in its own words.
(define (path-kind spec)
  (define p (->path spec))
  (cond
    [(include-glob? (path->string p)) 'pattern]
    [(directory-exists? p) 'dir]
    [else 'file]))

;; `dir` and every directory under it, outermost first, sorted.
;;
;; A symlinked subdirectory is NOT descended into: a link that points at an
;; ancestor is a walk that never ends, and this one runs on every staleness
;; probe. A dot-prefixed name is skipped at every level, the same rule the
;; glob above keeps.
(define (dir-tree dir)
  (define (subdirs d)
    (for*/list ([name (in-list (sort (map path->string (directory-list d)) string<?))]
                #:unless (hidden-name? name)
                [p (in-value (build-path d name))]
                #:when (and (directory-exists? p) (not (link-exists? p))))
      p))
  (let walk ([d dir])
    (cons d (append-map walk (if (directory-exists? d) (subdirs d) '())))))

;; The files a path names, right now.
;;
;; A directory is every `*.rkt` under it — the one-directory glob above, asked
;; at every level. Recursive, and the double-load a recursive walk used to risk
;; is prevented where it actually lives: a candidate another one `@include`s is
;; not a root (olai/load, load-roots). So a fragment under `Daily/` is loaded
;; once, by the file that splices it, and a stray outline three directories
;; down is still served rather than silently invisible.
(define (files-named spec)
  (define full (simple-form-path (->path spec)))
  (case (path-kind full)
    [(pattern) (glob-expand full)]
    [(dir) (append-map dir-roots (dir-tree full))]
    [else (list full)]))

;; The directories it READS to answer that, which is what a watcher has to
;; watch: a pattern's one directory, the whole tree under a directory (a new
;; outline can appear in any of them, including one that holds none yet), or
;; the directory a file sits in. Watched whether or not anything has matched
;; there yet — the first fragment of a new year is exactly that event.
(define (dirs-read spec)
  (define full (simple-form-path (->path spec)))
  (case (path-kind full)
    [(pattern) (list (glob-dir full))]
    [(dir) (dir-tree full)]
    [else (list (path->directory-path (path-only full)))]))

;; The one directory a root spec hangs off: itself, or the file's own. Always
;; spelled as a directory, so the two answers are the same kind of path — it
;; is the base node keys are minted against (olai/load), and two spellings of
;; one directory would be two bases.
(define (root-dir spec)
  (define full (simple-form-path (->path spec)))
  (path->directory-path (if (eq? (path-kind full) 'dir) full (path-only full))))

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
