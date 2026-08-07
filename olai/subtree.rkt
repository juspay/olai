#lang racket/base

;; Taking a whole subtree out of one outline text and putting it into another.
;;
;; The other text mutators (olai/meta and the ops over it) change a node's
;; @fields where it stands: one title, its metadata run, one line in or out.
;; This one moves the node and everything under it — and lands it under a
;; SCAFFOLD, the chain of titles it hung off, re-created in the file it arrives
;; in, so the tree still reads the way it read when the work was live.
;;
;; Two halves, and they are separate because only one of them has an opinion:
;;
;;   cut-subtree    the block, and what it hung off. Pure reading plus a
;;                  deletion; the block comes back normalised to indent 0, so
;;                  nothing downstream has to know where it used to sit.
;;   graft-subtree  where it goes: walk the chain, MERGE with a scaffold node
;;                  that is already there, create the ones that are not, and
;;                  append.
;;
;; PURE: strings in, strings out. No files, no clocks, no validation — the
;; language is the only validator, and it runs over what these two wrote
;; (olai/edit). What a line is comes from lang/line and what indentation means
;; over several of them from lang/section; nothing here knows a regexp for
;; either, and neither does `daily` or `capture`, which ask the same module the
;; same questions.

(require racket/contract
         racket/list
         olai/fail
         olai/lang/line
         olai/lang/section)

;; The write path's boundary. Flat checks — text, an index, a list of titles,
;; a list of lines — because the text is walked once by the function itself and
;; a contract that walked it again would double every edit.
(provide (contract-out
          [cut-subtree (-> string? exact-nonnegative-integer? any)]
          [graft-subtree (-> string? (listof string?) (listof string?) any)]))

;; ---- reading lines ---------------------------------------------------------

;; Re-indent by `n` (which may be negative). A blank line has no indentation to
;; move: it comes back empty rather than as a line of spaces.
(define (shift-line s n)
  (cond
    [(blank-line? s) ""]
    [else
     (define-values (ind content) (line-indent+content s))
     (string-append (make-string (max 0 (+ ind n)) #\space) content)]))

;; ---- cut -------------------------------------------------------------------

;; The titles above `at`, outermost first: one per level, the first line at
;; each shallower indent going up. That is the chain as the FILE draws it —
;; which is the chain this write is about. A fragment spliced into two roots
;; hangs off two different things depending on which root you read it through,
;; and a write that picked one of them would be answering a question nobody
;; asked.
(define (ancestor-titles lines at indent)
  (let loop ([i (sub1 at)] [want (- indent 2)] [acc '()])
    (cond
      [(or (< i 0) (< want 0)) acc]
      [else
       (define s (list-ref lines i))
       (define text (and (= (indent-of s) want) (title-line-text s)))
       (if text
           (loop (sub1 i) (- want 2) (cons text acc))
           (loop (sub1 i) want acc))])))

;; Take the node at line `at` (0-based) out of `text`.
;;
;; -> (values new-text block ancestors)
;;    block     the node's own lines, normalised to indent 0
;;    ancestors the titles it hung off, outermost first
;;
;; What is left behind is the rest of the file, byte for byte — including the
;; parents the node hung off. An archive that emptied them would be a second
;; edit nobody asked for, and "the node is gone from here" is the whole of what
;; was asked.
(define (cut-subtree text at)
  (define lines (text-lines text))
  (unless (< at (length lines))
    (user-fail "line ~a is not in this file" (add1 at)))
  (define indent (indent-of (list-ref lines at)))
  (unless (title-line-text (list-ref lines at))
    (user-fail "line ~a is not a task title" (add1 at)))
  ;; the node's own lines are its section: title plus everything under it
  (define end (section-end lines at))
  (values (lines->text (append (take lines at) (drop lines end)) text)
          (for/list ([s (in-list (take (drop lines at) (- end at)))])
            (shift-line s (- indent)))
          (ancestor-titles lines at indent)))

;; ---- graft -----------------------------------------------------------------

;; Where a file's own top-level nodes start: after the #lang line.
(define (body-start lines)
  (or (for/or ([s (in-list lines)] [i (in-naturals)])
        (define-values (_ind content) (line-indent+content s))
        (and (line-lang? (classify-line content)) (add1 i)))
      0))

;; Splice `new` in at `at`, with a blank line above it when `sep?` and there is
;; not one already. -> (values lines index-of-first-new-line)
(define (splice lines at new sep?)
  (define pad
    (if (and sep? (> at 0) (not (blank-line? (list-ref lines (sub1 at)))))
        '("")
        '()))
  (values (append (take lines at) pad new (drop lines at))
          (+ at (length pad))))

;; Put `block` into `text` under `ancestors`, re-creating the chain as it goes.
;;
;; -> (values new-text line-1-based) — where the block's own title landed.
;;
;; MERGE, at every level: a chain node that is already there is descended into
;; rather than written twice, matched by title at that level (lang/section). A
;; scaffold node carries the ancestor's TITLE and nothing else — no ^anchor (a
;; name is unique across the loaded set, and copying one would break the very
;; link this feature is built on), no dates, no notes, no state. It is a shelf
;; label, not a copy of the node.
;;
;; New arrivals APPEND, at the end of the chain node they land under. An
;; archive is a record of what was done, and arrival order is the only order it
;; can honestly claim — a sort key would be a claim about the work.
(define (graft-subtree text ancestors block)
  (define (place lines titles depth from to)
    (define indent (* 2 depth))
    (cond
      [(null? titles)
       (splice lines
               (append-point lines from to)
               (for/list ([s (in-list block)]) (shift-line s indent))
               (zero? depth))]
      [else
       (define found
         (find-title-line lines (car titles) indent #:from from #:to to))
       (cond
         [found
          (place lines (cdr titles) (add1 depth)
                 (add1 found) (section-end lines found))]
         [else
          (define-values (lines* at)
            (splice lines
                    (append-point lines from to)
                    (list (string-append (make-string indent #\space) (car titles)))
                    (zero? depth)))
          ;; a scaffold node born empty: its window is the point just past it
          (place lines* (cdr titles) (add1 depth) (add1 at) (add1 at))])]))
  (define lines (text-lines text))
  (define-values (lines* at)
    (place lines ancestors 0 (body-start lines) (length lines)))
  (values (lines->text lines* text) (add1 at)))
