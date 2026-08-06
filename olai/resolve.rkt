#lang racket/base

;; Where is TITLE|^anchor?
;;
;; It used to be answered twice: once against the MODEL (which file defines
;; the node — it may be an @include fragment), then again against the raw
;; TEXT of that file (which line to edit). Two worlds, two ambiguity errors,
;; and nothing making them agree. This module answers once, and the text
;; mutators are handed the line.

(require racket/file
         racket/list
         racket/match
         racket/path
         racket/string
         (only-in olai/lang/expander task-file)
         (only-in olai/lang/walk find-task-by-id find-tasks-by-title)
         olai/fail
         olai/load
         olai/meta
         (only-in olai/paths dir-roots))

(provide (struct-out located)
         locate)

;; file  : path of the file that DEFINES the node (what a write must edit)
;; index : 0-based index of its title line in that file
;; title : the resolved title (never the "^anchor" the user typed)
(struct located (file index title) #:transparent)

;; The files that could hold this node: the defining file of every model
;; match. No match in the model means no candidate, which is the "no task"
;; case — the text is never scanned on a hunch.
(define (candidate-files out spec)
  (define root (outline-path out))
  (define tasks (outline-tasks out))
  (define (file-of tk)
    (simple-form-path (or (task-file tk) root)))
  (remove-duplicates
   (match (parse-title-or-anchor spec)
     [(cons 'anchor a)
      (define tk (or (hash-ref (outline-anchors out) a #f)
                     (find-task-by-id tasks a)))
      (if tk (list (file-of tk)) '())]
     [(cons 'title t)
      (map file-of (find-tasks-by-title tasks t))])
   #:key path->string))

(define (matches-in text spec)
  (match (parse-title-or-anchor spec)
    [(cons 'anchor a) (find-anchor-matches text a)]
    [(cons 'title t) (find-title-matches text t)]))

;; ---- which outline a spec is resolved against ------------------------------
;;
;; A write names ONE file (--file, or the default), and that file is what a
;; TITLE is looked up in: a title is text, and its scope has always been the
;; outline you pointed at. An `^anchor` is not text but a NAME, and since the
;; linker its scope is the loaded set (olai/lang/link) — so `*meeting-prep` in
;; Daily.rkt and the `^meeting-prep` Tasks.rkt defines are one node, and
;; checking it off from either side has to reach the file that defines it.
;;
;; So: the targeted outline, unless the spec is an anchor that outline cannot
;; see — then the sibling root that declares it. Part of `locate` rather than a
;; step before it: "where is this spec" has one answer, and a caller that had
;; to remember to widen first is a caller that can forget.
(define (resolution-outline out spec)
  (define a (anchor-spec spec))
  (cond
    [(or (not a) (hash-ref (outline-anchors out) a #f)) out]
    [else (or (sibling-declaring out a) out)]))

;; The anchor a spec names, or #f when it names a title.
(define (anchor-spec spec)
  (match (parse-title-or-anchor spec)
    [(cons 'anchor a) a]
    [_ #f]))

;; The other roots in this outline's directory, as `serve` globs them: top
;; level only, so @include fragments (which live in subdirectories) are not
;; loaded twice.
;;
;; A sibling that does not load is simply not consulted. It is not the file
;; being written, and one broken outline must not stop every write to the
;; others — the file under the pen is still validated, before and after, like
;; any other write.
(define (sibling-declaring out a)
  (define self (simple-form-path (outline-path out)))
  (for/or ([p (in-list (dir-roots (path-only self)))]
           #:unless (equal? p self))
    (define r (try-load-outline p))
    (and (outline? r) (hash-ref (outline-anchors r) a #f) r)))

;; -> located; raises exn:fail naming file:line for every candidate when the
;; spec does not pick out exactly one node.
;;
;; `out` is the outline the command NAMED; the node may be in another file
;; either way — an @include fragment of this one, or (for an anchor) the
;; sibling root that declares it (resolution-outline above).
(define (locate out0 spec)
  (define out (resolution-outline out0 spec))
  (define hits
    (append*
     (for/list ([f (in-list (candidate-files out spec))])
       (define text (file->string f))
       (for/list ([m (in-list (matches-in text spec))])
         (cons f m)))))
  (define label (spec-label spec))
  (cond
    [(null? hits)
     (user-fail "no task matching ~a in ~a" label (outline-path out))]
    [(> (length hits) 1)
     (user-fail "ambiguous title ~a; matches: ~a; add a ^anchor to disambiguate"
                label
                (string-join
                 (for/list ([h (in-list hits)])
                   (format "~a:~a" (car h) (title-match-line (cdr h))))
                 ", "))]
    [else
     (define f (car (car hits)))
     (define m (cdr (car hits)))
     (located f (title-match-index m) (title-match-title m))]))
