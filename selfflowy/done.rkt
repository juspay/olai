#lang racket/base

;; Mark / unmark done in outline (#lang selfflowy) source text.
;; Preserves surrounding bytes; only inserts or removes @done lines
;; (and strips [x] prefixes on undo).

(require racket/list
         racket/match
         racket/set
         racket/string
         selfflowy/lang/line) ; the one owner of what a line IS

(provide find-title-matches
         find-anchor-matches
         metadata-indices
         mark-done-in-text
         undo-done-in-text
         parse-title-or-anchor
         (struct-out title-match))

;; line: 1-based outline line of the title
;; index: 0-based index into line list
;; indent: leading spaces on the title line
;; already-done?: #t if [x] prefix or @done metadata present
;; title: resolved effective title (checkbox/^anchor stripped)
(struct title-match (line index indent already-done? title) #:transparent)

;; -> (values indent classification): what every scan below actually wants.
(define (scan s)
  (define-values (ind content) (line-indent+content s))
  (values ind (classify-line content)))

(define (done-line? s)
  (define-values (_ind k) (scan s))
  (eq? (meta-field k) 'done))

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
(define (title-already-done? k meta-idxs lines)
  (or (eq? (caddr k) 'done)
      (for/or ([i (in-list meta-idxs)])
        (done-line? (list-ref lines i)))))

;; 'title | 'anchor
(define (parse-title-or-anchor s)
  (cond
    [(regexp-match #px"^\\^([A-Za-z0-9_-]+)$" (string-trim s))
     => (λ (m) (cons 'anchor (cadr m)))]
    [else (cons 'title s)]))

;; Every title line the file has, as title-matches, newest scan order.
;; `keep?` decides which ones the caller wanted.
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
                         (title-already-done? k meta lines)
                         (cadr k)))))))

;; Find all title lines whose effective title equals `title` exactly.
(define (find-title-matches text title)
  (find-title-lines text (λ (k) (equal? (cadr k) title))))

;; Find the title line declaring ^anchor (at most one if file is valid).
(define (find-anchor-matches text anchor)
  (find-title-lines text (λ (k) (equal? (cadddr k) anchor))))

(define (lines->text lines original)
  (define body (string-join lines "\n"))
  (if (regexp-match? #px"\n$" original)
      (if (regexp-match? #px"\n$" body) body (string-append body "\n"))
      body))

(define (resolve-matches text title-or-anchor)
  (define kind (parse-title-or-anchor title-or-anchor))
  (match kind
    [(cons 'anchor a)
     (values (find-anchor-matches text a) (format "^~a" a))]
    [(cons 'title t)
     (values (find-title-matches text t) t)]))

;; Insert `@done DATE` after the title's metadata. Fails if already done.
;; title may be a plain title or ^anchor.
;; -> (values new-text line-1-based)
(define (mark-done-in-text text title today)
  (define-values (matches label) (resolve-matches text title))
  (cond
    [(null? matches)
     (error 'mark-done-in-text "no task matching ~s" label)]
    [(> (length matches) 1)
     (error 'mark-done-in-text
            "ambiguous title ~s (~a matches); add a ^anchor to disambiguate"
            label (length matches))]
    [else
     (define m (car matches))
     (when (title-match-already-done? m)
       (error 'mark-done-in-text
              "already done: ~s (line ~a)"
              label (title-match-line m)))
     (define lines (string-split text "\n" #:trim? #f))
     (define idx (title-match-index m))
     (define ind (title-match-indent m))
     (define meta (metadata-indices lines idx ind))
     (define insert-at
       (if (null? meta) (add1 idx) (add1 (last meta))))
     (define meta-indent (+ ind 2))
     (define done-line
       (string-append (make-string meta-indent #\space) "@done " today))
     (define new-lines
       (append (take lines insert-at)
               (list done-line)
               (drop lines insert-at)))
     (values (lines->text new-lines text) (add1 insert-at))]))

;; Remove done state: strip @done metadata and [x]/[X] title prefix.
;; -> (values new-text line-1-based)
(define (undo-done-in-text text title)
  (define-values (matches label) (resolve-matches text title))
  (cond
    [(null? matches)
     (error 'undo-done-in-text "no task matching ~s" label)]
    [(> (length matches) 1)
     (error 'undo-done-in-text
            "ambiguous title ~s (~a matches); add a ^anchor to disambiguate"
            label (length matches))]
    [else
     (define m (car matches))
     (unless (title-match-already-done? m)
       (error 'undo-done-in-text
              "not done: ~s (line ~a)"
              label (title-match-line m)))
     (define lines (string-split text "\n" #:trim? #f))
     (define idx (title-match-index m))
     (define ind (title-match-indent m))
     (define meta (metadata-indices lines idx ind))
     ;; Drop @done metadata lines (highest indices first).
     (define drop-set
       (for/set ([i (in-list meta)]
                 #:when (done-line? (list-ref lines i)))
         i))
     (define lines*
       (for/list ([i (in-range (length lines))]
                  #:unless (set-member? drop-set i))
         (list-ref lines i)))
     ;; Recompute title index after deletions before it.
     (define removed-before
       (for/sum ([i (in-list (set->list drop-set))]
                 #:when (< i idx))
         1))
     (define title-idx* (- idx removed-before))
     (define title-line (list-ref lines* title-idx*))
     (define title-line*
       (cond
         [(regexp-match #px"^( *)\\[[xX]\\] (.*)$" title-line)
          => (λ (m) (string-append (cadr m) (caddr m)))]
         [else title-line]))
     (define new-lines
       (list-set lines* title-idx* title-line*))
     (values (lines->text new-lines text) (title-match-line m))]))
