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
;; task  : the node itself, out of the loaded tree — what a write asks about
;;         the SHAPE it is editing (does this node have children, and what
;;         state are they in). #f when the model cannot name exactly one node
;;         in that file, which the text scan below can still resolve; a guard
;;         that asks then simply has nothing to go on and lets the write
;;         through to the language.
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
;; splice has already happened, not the text, where it has not. A file with
;; exactly one match pairs unambiguously with the one title line the scan finds
;; there; more than one and the pairing would be a guess, so there is none.
;; -> (listof (cons path (or/c task #f)))
(define (candidate-files out want)
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
  (for/list ([f (in-list (remove-duplicates (map file-of found)
                                            #:key path->string))])
    (define here (filter (λ (tk) (equal? (path->string (file-of tk))
                                         (path->string f)))
                         found))
    (cons f (and (= (length here) 1) (car here)))))

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
     (for/list ([c (in-list (candidate-files out want))])
       (define f (car c))
       (define text (file->string f))
       (for/list ([m (in-list (matches-in text want))])
         (list f m (cdr c))))))
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
