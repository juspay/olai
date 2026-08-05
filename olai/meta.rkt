#lang racket/base

;; The metadata edit engine: the one algorithm that changes a task's @fields
;; in outline source text.
;;
;; Every such edit is the same four steps — resolve TITLE|^anchor to exactly
;; one title line, take that title's metadata run, drop the lines this op
;; owns, insert the line it writes — and only the field and the line differ.
;; done/undo/set-date/clear-date were two hand-written copies of that (move's
;; helpers were done's, verbatim), so a fix to one was a bug in the other.
;;
;; Byte-preserving by construction: a line nobody dropped is the same string
;; on the way out. The grammar comes from lang/line.rkt; nothing here knows a
;; regexp for what a line is.

(require racket/list
         racket/match
         racket/set
         racket/string
         olai/fail
         olai/lang/line)

(provide (struct-out title-match)
         parse-title-or-anchor
         find-title-matches
         find-anchor-matches
         metadata-indices
         locate-one
         spec-label
         title-match-at
         update-meta!)

;; line: 1-based outline line of the title
;; index: 0-based index into line list
;; indent: leading spaces on the title line
;; already-done?: #t if [x] prefix or @done metadata present
;; title: resolved effective title (checkbox/^anchor stripped)
(struct title-match (line index indent already-done? title) #:transparent)

;; -> (values indent classification): what every scan below wants.
(define (scan s)
  (define-values (ind content) (line-indent+content s))
  (values ind (classify-line content)))

;; 'desc | 'date | 'done | 'bad, or #f when the line is not metadata.
(define (line-field s)
  (define-values (_ind k) (scan s))
  (meta-field k))

;; Lines that are metadata for the title at title-idx (same indent+2, until
;; a child title or dedent). Returns list of 0-based line indices.
;;
;; An @include there is a child node, not metadata — but it sits in the same
;; indented run (a month node in Daily.rkt is exactly that), and a @date
;; written after it is still this title's date, so the run does not stop.
(define (metadata-indices lines title-idx title-indent)
  (define meta-indent (+ title-indent 2))
  (let loop ([i (add1 title-idx)] [acc '()])
    (cond
      [(>= i (length lines)) (reverse acc)]
      [(blank-line? (list-ref lines i))
       (loop (add1 i) acc)]
      [else
       (define-values (ind k) (scan (list-ref lines i)))
       (cond
         [(not (= ind meta-indent)) (reverse acc)]
         [(or (line-meta? k) (line-include? k))
          (loop (add1 i) (cons i acc))]
         [else (reverse acc)])])))

;; k is a (title TEXT FLAG ANCHOR) classification.
(define (title-done? k meta-idxs lines)
  (or (eq? (caddr k) 'done)
      (for/or ([i (in-list meta-idxs)])
        (eq? (line-field (list-ref lines i)) 'done))))

;; Every title line the file has, as title-matches; `keep?` picks the ones
;; the caller asked for.
(define (find-title-lines text keep?)
  (define lines (string-split text "\n" #:trim? #f))
  (filter
   values
   (for/list ([s (in-list lines)] [i (in-naturals)])
     (define-values (ind k) (scan s))
     (and (line-title? k)
          (even? ind)
          (keep? k)
          (let ([meta (metadata-indices lines i ind)])
            (title-match (add1 i) i ind
                         (title-done? k meta lines)
                         (cadr k)))))))

;; Find all title lines whose effective title equals `title` exactly.
(define (find-title-matches text title)
  (find-title-lines text (λ (k) (equal? (cadr k) title))))

;; Find the title line declaring ^anchor (at most one if the file is valid).
(define (find-anchor-matches text anchor)
  (find-title-lines text (λ (k) (equal? (cadddr k) anchor))))

;; 'title | 'anchor
(define (parse-title-or-anchor s)
  (cond
    [(regexp-match #px"^\\^([A-Za-z0-9_-]+)$" (string-trim s))
     => (λ (m) (cons 'anchor (cadr m)))]
    [else (cons 'title s)]))

;; How a spec is quoted in messages: ^anchors bare, titles quoted.
(define (spec-label spec)
  (match (parse-title-or-anchor spec)
    [(cons 'anchor a) (format "^~a" a)]
    [(cons 'title t) (format "~s" t)]))

;; The title-match at a line the resolver already picked (see
;; olai/resolve): no second search, no second ambiguity error.
(define (title-match-at text idx)
  (define lines (string-split text "\n" #:trim? #f))
  (unless (and (exact-nonnegative-integer? idx) (< idx (length lines)))
    (user-fail "line ~a is not in this file" (add1 idx)))
  (define-values (ind k) (scan (list-ref lines idx)))
  (unless (line-title? k)
    (user-fail "line ~a is not a task title" (add1 idx)))
  (title-match (add1 idx) idx ind
               (title-done? k (metadata-indices lines idx ind) lines)
               (cadr k)))

;; The one match a mutation may touch, or an error naming the spec as the
;; user typed it. -> (values title-match label)
(define (locate-one text spec)
  (define matches
    (match (parse-title-or-anchor spec)
      [(cons 'anchor a) (find-anchor-matches text a)]
      [(cons 'title t) (find-title-matches text t)]))
  (define label (spec-label spec))
  (cond
    [(null? matches)
     (user-fail "no task matching ~a" label)]
    [(> (length matches) 1)
     (user-fail "ambiguous title ~a (~a matches); add a ^anchor to disambiguate"
                label (length matches))]
    [else (values (car matches) label)]))

(define (lines->text lines original)
  (define body (string-join lines "\n"))
  (if (regexp-match? #px"\n$" original)
      (if (regexp-match? #px"\n$" body) body (string-append body "\n"))
      body))

;; The engine. An op supplies:
;;   #:at          the title's 0-based line index when a resolver already
;;                 found it; #f to resolve `spec` against this text
;;
;; Everything it can fail with is an answer to the user ("no task matching
;; X"), so it is raised without a who: prefix — see olai/fail.
;;   #:drop-field  the metadata field it replaces ('date, 'done) or #f
;;   #:insert-line (indent-string -> line) or #f for a pure removal
;;   #:check!      (match label dropped-indices -> void) — the op's
;;                 preconditions, raised before anything is rewritten
;;   #:retitle     (line -> line) for the title line itself (undo's [x])
;;
;; -> (values new-text line-1-based resolved-title), where the line is the
;; inserted one when there is one, else the title's.
(define (update-meta! text spec
                      #:at [at #f]
                      #:drop-field [drop-field #f]
                      #:insert-line [insert-line #f]
                      #:check! [check! void]
                      #:retitle [retitle #f])
  (define-values (m label)
    (if at
        (values (title-match-at text at) (spec-label spec))
        (locate-one text spec)))
  (define lines (string-split text "\n" #:trim? #f))
  (define idx (title-match-index m))
  (define ind (title-match-indent m))
  (define meta (metadata-indices lines idx ind))
  (define dropped
    (if drop-field
        (for/list ([i (in-list meta)]
                   #:when (eq? (line-field (list-ref lines i)) drop-field))
          i)
        '()))
  (check! m label dropped)
  ;; Metadata always sits BELOW its title, so dropping it cannot move the
  ;; title line: idx still addresses it in lines*.
  (define drop-set (list->set dropped))
  (define kept
    (for/list ([s (in-list lines)] [i (in-naturals)]
               #:unless (set-member? drop-set i))
      s))
  (define lines*
    (if retitle
        (list-set kept idx (retitle (list-ref kept idx)))
        kept))
  (cond
    [insert-line
     (define meta* (metadata-indices lines* idx ind))
     (define at (if (null? meta*) (add1 idx) (add1 (last meta*))))
     (define line (insert-line (make-string (+ ind 2) #\space)))
     (values (lines->text (append (take lines* at) (list line) (drop lines* at))
                          text)
             (add1 at)
             (title-match-title m))]
    [else
     (values (lines->text lines* text)
             (title-match-line m)
             (title-match-title m))]))
