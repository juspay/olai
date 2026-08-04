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

(require racket/contract
         racket/list
         racket/path)

(provide (contract-out
          [file-label (-> any/c string?)]
          [roots-base (-> list? path?)]
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
