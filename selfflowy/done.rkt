#lang racket/base

;; Mark / unmark done in outline (#lang selfflowy) source text.
;; Preserves surrounding bytes; only inserts or removes @done lines
;; (and strips [x] prefixes on undo).

(require racket/list
         racket/match
         racket/set
         racket/string
         selfflowy/lang/outline)

(provide find-title-matches
         mark-done-in-text
         undo-done-in-text
         (struct-out title-match))

;; line: 1-based outline line of the title
;; index: 0-based index into line list
;; indent: leading spaces on the title line
;; already-done?: #t if [x] prefix or @done metadata present
(struct title-match (line index indent already-done?) #:transparent)

(define (blank-line? s)
  (regexp-match? #px"^\\s*$" s))

(define (line-indent+content s)
  (define m (regexp-match #px"^( *)(.*)$" s))
  (values (string-length (cadr m)) (caddr m)))

(define (meta-content? content)
  (or (regexp-match? #px"^: " content)
      (regexp-match? #px"^:($|[^ ])" content)
      (regexp-match? #px"^@" content)))

(define (done-meta? content)
  (regexp-match? #px"^@done(\\s|$)" content))

(define (title-content? content)
  (and (not (blank-line? content))
       (not (regexp-match? #px"^#lang\\s" content))
       (not (meta-content? content))))

;; Lines that are metadata for the title at title-idx (same indent+2, until
;; a child title or dedent). Returns list of 0-based line indices.
(define (metadata-indices lines title-idx title-indent)
  (define meta-indent (+ title-indent 2))
  (let loop ([i (add1 title-idx)] [acc '()])
    (cond
      [(>= i (length lines)) (reverse acc)]
      [(blank-line? (list-ref lines i))
       (loop (add1 i) acc)]
      [else
       (define-values (ind content) (line-indent+content (list-ref lines i)))
       (cond
         [(not (= ind meta-indent)) (reverse acc)]
         [(meta-content? content)
          (loop (add1 i) (cons i acc))]
         [else (reverse acc)])])))

(define (title-already-done? content meta-idxs lines)
  (define-values (_title flag)
    (if (regexp-match? #px"^\\\\" content)
        (values (substring content 1) #f)
        (strip-checkbox-prefix content)))
  (or (eq? flag 'done)
      (for/or ([i (in-list meta-idxs)])
        (define-values (_ind c) (line-indent+content (list-ref lines i)))
        (done-meta? c))))

(define (effective-title content)
  (cond
    [(regexp-match? #px"^\\\\" content)
     (substring content 1)]
    [else
     (define-values (t _f) (strip-checkbox-prefix content))
     t]))

;; Find all title lines whose effective title equals `title` exactly.
(define (find-title-matches text title)
  (define lines (string-split text "\n" #:trim? #f))
  (define matches '())
  (for ([i (in-range (length lines))])
    (define s (list-ref lines i))
    (cond
      [(blank-line? s) (void)]
      [(regexp-match? #px"^#lang\\s" s) (void)]
      [else
       (define-values (ind content) (line-indent+content s))
       (when (and (zero? (remainder ind 2))
                  (title-content? content))
         (define eff (effective-title content))
         (when (equal? eff title)
           (define meta (metadata-indices lines i ind))
           (define done? (title-already-done? content meta lines))
           (set! matches
                 (cons (title-match (add1 i) i ind done?) matches))))]))
  (reverse matches))

(define (lines->text lines original)
  (define body (string-join lines "\n"))
  (if (regexp-match? #px"\n$" original)
      (if (regexp-match? #px"\n$" body) body (string-append body "\n"))
      body))

;; Insert `@done DATE` after the title's metadata. Fails if already done.
;; -> (values new-text line-1-based)
(define (mark-done-in-text text title today)
  (define matches (find-title-matches text title))
  (cond
    [(null? matches)
     (error 'mark-done-in-text "no task titled ~s" title)]
    [(> (length matches) 1)
     (error 'mark-done-in-text
            "ambiguous title ~s (~a matches)"
            title (length matches))]
    [else
     (define m (car matches))
     (when (title-match-already-done? m)
       (error 'mark-done-in-text
              "already done: ~s (line ~a)"
              title (title-match-line m)))
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
  (define matches (find-title-matches text title))
  (cond
    [(null? matches)
     (error 'undo-done-in-text "no task titled ~s" title)]
    [(> (length matches) 1)
     (error 'undo-done-in-text
            "ambiguous title ~s (~a matches)"
            title (length matches))]
    [else
     (define m (car matches))
     (unless (title-match-already-done? m)
       (error 'undo-done-in-text
              "not done: ~s (line ~a)"
              title (title-match-line m)))
     (define lines (string-split text "\n" #:trim? #f))
     (define idx (title-match-index m))
     (define ind (title-match-indent m))
     (define meta (metadata-indices lines idx ind))
     ;; Drop @done metadata lines (highest indices first).
     (define drop-set
       (for/set ([i (in-list meta)]
                 #:when (let-values ([(_ c) (line-indent+content (list-ref lines i))])
                          (done-meta? c)))
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
     (define-values (tind tcontent) (line-indent+content title-line))
     (define title-line*
       (cond
         [(regexp-match #px"^( *)\\[[xX]\\] (.*)$" title-line)
          => (λ (m) (string-append (cadr m) (caddr m)))]
         [else title-line]))
     (define new-lines
       (list-set lines* title-idx* title-line*))
     (values (lines->text new-lines text) (title-match-line m))]))
