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
         (only-in olai/lang/expander task-file task-loc)
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
;; task  : the node itself, out of the loaded tree — what a write asks about
;;         the SHAPE it is editing (does this node have children, and what
;;         state are they in). Joined to the title line by srcloc, so it is
;;         the node written there and not a node that looked like it. #f only
;;         for a `#lang olai/sexp` file, whose forms are not lines — and a
;;         write to one of those is refused before it gets here.
(struct located (file index title task) #:transparent)

;; Everything below takes the spec ALREADY parsed — `(cons 'anchor a)` or
;; `(cons 'title t)` (olai/meta). Four of them used to re-parse the same
;; string, which is four places to disagree about what the user typed.

;; The files that could hold this node, each with the nodes the MODEL found in
;; it. No match in the model means no candidate, which is the "no task" case —
;; the text is never scanned on a hunch.
;;
;; The nodes ride along because a caller wants more than a line number: a write
;; that guards on what a node CONTAINS has to ask the tree, where an @include
;; splice has already happened, not the text, where it has not. Which of them
;; is which title line is `task-at-line` below.
;; -> (listof (cons path (listof task)))
(define (candidates out want)
  (define root (outline-path out))
  (define tasks (outline-tasks out))
  (define (file-of tk)
    (simple-form-path (or (task-file tk) root)))
  (define found
    (match want
      [(cons 'anchor a)
       (define tk (or (hash-ref (outline-anchors out) a #f)
                      (find-task-by-id tasks a)))
       (if tk (list tk) '())]
      [(cons 'title t) (find-tasks-by-title tasks t)]))
  ;; grouped by defining file, in the order the files first turn up
  (for/list ([grp (in-list (group-by (λ (tk) (path->string (file-of tk))) found))])
    (cons (file-of (car grp)) grp)))

;; Which of a file's model nodes is the title line the text scan found: the one
;; whose form was written there. Every node carries the srcloc of its own form
;; (olai/lang/expander), and a title line is where a node's form starts, so the
;; two worlds are joined by a number rather than by a count — a fragment
;; spliced into one root twice yields two model nodes and one title line, and
;; they are the SAME node, defined once, at that line.
;;
;; #f when nothing matches, which is what a `#lang olai/sexp` file gives (its
;; forms are not lines) — and writes to one are refused anyway.
(define (task-at-line tasks line)
  (for/first ([tk (in-list tasks)]
              #:when (and (task-loc tk) (equal? (srcloc-line (task-loc tk)) line)))
    tk))

(define (matches-in text want)
  (match want
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
(define (resolution-outline out want)
  (match want
    [(cons 'anchor a)
     #:when (not (hash-ref (outline-anchors out) a #f))
     (or (sibling-declaring out a) out)]
    [_ out]))

;; The other roots in this outline's directory, as `serve` globs them: top
;; level only, so @include fragments (which live in subdirectories) are not
;; loaded twice.
;;
;; This is deliberately weaker than the linker: first declaration wins, and a
;; sibling that does not load is simply not consulted. A READ answers about a
;; set, and must refuse one that does not link; a WRITE answers about one node,
;; and must not be hostage to a file it is not touching. The file under the pen
;; is validated before and after, like any other write.
;;
;; A caller that already HOLDS the set — the web mutation routes, over the
;; store's snapshot — should hand its index down instead of making this reach
;; for the disk again; that is the seam to widen when they land.
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
  (define want (parse-title-or-anchor spec))
  (define out (resolution-outline out0 want))
  (define hits
    (append*
     (for/list ([c (in-list (candidates out want))])
       (define f (car c))
       (define text (file->string f))
       (for/list ([m (in-list (matches-in text want))])
         (list f m (task-at-line (cdr c) (title-match-line m)))))))
  (define label (spec-label spec))
  (cond
    [(null? hits)
     (user-fail "no task matching ~a in ~a" label (outline-path out))]
    [(> (length hits) 1)
     (user-fail "ambiguous title ~a; matches: ~a; add a ^anchor to disambiguate"
                label
                (string-join
                 (for/list ([h (in-list hits)])
                   (format "~a:~a" (car h) (title-match-line (cadr h))))
                 ", "))]
    [else
     (match-define (list f m tk) (car hits))
     (located f (title-match-index m) (title-match-title m) tk)]))
