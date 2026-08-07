#lang racket/base

;; What INDENTATION means over several lines: where a node's own lines stop,
;; which line is a given title, and where a new child goes under it.
;;
;; lang/line.rkt says what ONE line is. Everything that edits outline text then
;; needs the sentence above it — a node owns the lines indented deeper than its
;; own, up to the next one that is not — and three modules had written that
;; sentence out in their own words: `daily` (rolling a month into Daily.rkt),
;; `capture` (appending under a parent) and `subtree` (moving a node to the
;; archive). Three scans, one grammar rule, and nothing making them agree about
;; a blank line.
;;
;; PURE, like the line grammar it sits on: lists of lines in, indices out. No
;; srclocs, no raising, no I/O. It answers about POSITIONS and never rewrites
;; anything — who splices what belongs to the module doing the edit.
;;
;; In `lang/` although only the write path reads it, because what it states is
;; the GRAMMAR's: two spaces is a level, and a node owns what is indented under
;; it. It changes when that changes — which is a grammar change — and not when a
;; write command does; the three modules above are consumers of the rule, not
;; authors of it.

(require racket/contract
         olai/lang/line)

;; Indices into a list of lines, so the contracts are flat and the answers are
;; always in range: this runs once per edit, not once per line.
(provide (contract-out
          [indent-of (-> string? exact-nonnegative-integer?)]
          [title-line-text (-> string? (or/c string? #f))]
          [section-end (-> (listof string?) exact-nonnegative-integer?
                           exact-nonnegative-integer?)]
          [append-point (-> (listof string?) exact-nonnegative-integer?
                            exact-nonnegative-integer?
                            exact-nonnegative-integer?)]
          [find-title-line
           (->* ((listof string?) string? exact-nonnegative-integer?)
                (#:from exact-nonnegative-integer?
                 #:to (or/c exact-nonnegative-integer? #f))
                (or/c exact-nonnegative-integer? #f))]))

(define (indent-of s)
  (define-values (ind _content) (line-indent+content s))
  ind)

;; The effective title of a line — checkbox and ^anchor already off — or #f
;; when the line is not one. Odd indentation is nobody's child: nesting is
;; exactly two spaces (docs/syntax.md), so a title at an odd indent is not a
;; level and is not matched as one.
(define (title-line-text s)
  (define-values (ind content) (line-indent+content s))
  (define k (classify-line content))
  (and (line-title? k) (even? ind) (title-text k)))

;; One past the last line belonging to the node whose title is at `idx`:
;; everything indented deeper than it. A BLANK line is inside the section when
;; something deeper follows it and outside when nothing does — a gap between two
;; top-level nodes belongs to the file, not to either of them.
;;
;; The level is read off the line rather than passed in: it is the node's own
;; indentation, and an argument for it is an argument that can disagree with the
;; line it is about.
(define (section-end lines idx)
  (define n (length lines))
  (define child-indent (+ (indent-of (list-ref lines idx)) 2))
  (let loop ([i (add1 idx)] [end (add1 idx)])
    (cond
      [(>= i n) end]
      [(blank-line? (list-ref lines i)) (loop (add1 i) end)]
      [(< (indent-of (list-ref lines i)) child-indent) end]
      [else (loop (add1 i) (add1 i))])))

;; Where a new line goes at the end of [from, to): past the last thing in the
;; section, and BEFORE the blank lines under it. An arrival written after the
;; gap would sit outside the section it was meant to join.
(define (append-point lines from to)
  (let loop ([e to])
    (cond
      [(<= e from) e]
      [(blank-line? (list-ref lines (sub1 e))) (loop (sub1 e))]
      [else e])))

;; The first line in [from, to) that is `title` at exactly `indent`, or #f.
;; Exact title, exact level — the same equality `done TITLE` and `add --parent
;; TITLE` use, so a title that names one node to those names one node here.
(define (find-title-line lines title indent
                         #:from [start 0]
                         #:to [end #f])
  (for/or ([i (in-range start (or end (length lines)))])
    (define s (list-ref lines i))
    (and (= (indent-of s) indent)
         (equal? (title-line-text s) title)
         i)))
