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

(require racket/contract
         racket/path
         ;; which files in a directory a name names — the same question
         ;; `@include Daily/*.rkt` asks, with the pattern already chosen
         (only-in olai/glob glob-expand))

(provide (contract-out
          [file-label (-> any/c string?)]
          [roots-base (-> list? path?)]
          [dir-roots (-> (or/c path? string?) (listof path?))]
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

;; The outlines a directory holds: its *.rkt at the TOP level only, sorted.
;;
;; Top level only is the outline convention, not a shortcut: roots live in the
;; directory, `@include` fragments live in subdirectories of it (Daily/), so a
;; recursive walk would load every fragment twice.
;;
;; Which is to say it is one glob, and it is spelled as one — sorted, one
;; directory deep, files only, no dotfiles — rather than as a second
;; implementation of the same directory read. `serve DIR` gets the dotfile
;; rule out of that for free, and an editor's lock file (`.#Tasks.rkt`) stops
;; being a root nobody wrote.
(define (dir-roots dir)
  (glob-expand (build-path (simple-form-path (->path dir)) "*.rkt")))

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
