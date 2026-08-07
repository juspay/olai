#lang racket/base

;; WHERE DONE WORK GOES — and how everything else knows it went there.
;;
;; Archiving is not a node STATE. A state would be a fourth thing the grammar
;; has to spell, a fourth thing every query has to switch on, and a fourth
;; thing an agent can get wrong; and it would leave the archived subtree in the
;; working file, which is the whole problem. So archived work is work that
;; lives in a FILE — `Archive.rkt`, beside the outline — and "is this
;; archived?" is one question about where a node is defined.
;;
;; That choice is what makes the rest fall out:
;;
;;   * the LINKER already reaches across files, so an `^anchor` that moves in
;;     here goes on resolving from every live file that mirrors it — an archived
;;     node is still one node, still drawn where it was mirrored;
;;   * the load layer needs no rule at all: Archive.rkt is a root like any
;;     other, so `serve DIR` picks it up and `olai tree` still prints it;
;;   * the QUERIES are where exclusion belongs (olai/query), because "what is on
;;     my plate" is a question about live work and nothing else is;
;;   * and the web view can draw it on its own page rather than filtering a
;;     state out of every list.
;;
;; Which is to say the only thing anybody has to agree on is the file's name,
;; and it is agreed on here.

(require racket/contract
         racket/path
         (only-in olai/lang/expander task? task-file)
         ;; one owner for what a file is CALLED (core, not web)
         (only-in olai/paths file-label))

(provide (contract-out
          [archive-file-name string?]
          ;; flat checks: a path in, a path out, and two predicates that read
          ;; one field. Nothing here walks a tree.
          [archive-path-for (-> path? path?)]
          [archived-file? (-> any/c boolean?)]
          [archived-task? (-> any/c boolean?)]
          [live-entries (-> list? list?)]
          [archived-entries (-> list? list?)]))

;; The one spelling. Capitalised like the other roots an outline home holds
;; (Tasks.rkt, Daily.rkt): it IS one of them.
(define archive-file-name "Archive.rkt")

;; The archive that holds what `outline-file` archives: the one beside it.
;;
;; Beside the OUTLINE the command named, never beside the node's defining file
;; — a fragment lives in a subdirectory (`Daily/2026-08.rkt`), and `serve DIR`
;; globs the top level only, so an Archive.rkt down there would be a file the
;; server never loads and every anchor that moved into it would go dark.
(define (archive-path-for outline-file)
  (define dir (path-only outline-file))
  (unless dir
    (error 'archive-path-for "expected a path with a directory, got ~e" outline-file))
  (build-path dir archive-file-name))

(define (archived-file? f)
  (and f (equal? (file-label f) archive-file-name)))

;; A node is archived when the file that DEFINES it is an archive — not the
;; file it was reached through. A mirror site in a live file draws an archived
;; node, and it is still archived; that is the point.
(define (archived-task? x)
  (and (task? x) (archived-file? (task-file x))))

;; The loaded outlines, split the one way a reader cares about. An ENTRY is
;; whatever the caller pairs a path with — `(path . tasks)` to the queries,
;; `(path tasks)` to the renderer — so this asks only about its head, which is
;; the file, which is the whole question.
;;
;; Two names rather than one predicate handed around: the two halves are what
;; every caller actually asks for (draw the live outlines, draw the archive),
;; and a bare `#:when`/`#:unless` at each of them is where the third spelling
;; of this rule would come from.
(define (live-entries entries)
  (filter (λ (e) (not (archived-file? (car e)))) entries))

(define (archived-entries entries)
  (filter (λ (e) (archived-file? (car e))) entries))
