#lang racket/base

;; Set / rewrite @date on an outline title (TITLE or ^anchor).
;; Same byte-preserving style as done.rkt.

(require racket/list
         racket/match
         racket/set
         racket/string
         selfflowy/done
         selfflowy/dates
         selfflowy/lang/line)

(provide set-date-in-text
         clear-date-in-text)

(define (date-line? s)
  (define-values (_ind content) (line-indent+content s))
  (eq? (meta-field (classify-line content)) 'date))

(define (lines->text lines original)
  (define body (string-join lines "\n"))
  (if (regexp-match? #px"\n$" original)
      (if (regexp-match? #px"\n$" body) body (string-append body "\n"))
      body))

(define (resolve-one text title-or-anchor who)
  (define kind (parse-title-or-anchor title-or-anchor))
  (define matches
    (match kind
      [(cons 'anchor a) (find-anchor-matches text a)]
      [(cons 'title t) (find-title-matches text t)]))
  (define label
    (match kind
      [(cons 'anchor a) (format "^~a" a)]
      [(cons 'title t) t]))
  (cond
    [(null? matches)
     (error who "no task matching ~s" label)]
    [(> (length matches) 1)
     (error who
            "ambiguous title ~s (~a matches); add a ^anchor to disambiguate"
            label (length matches))]
    [else (values (car matches) label)]))

;; -> (values new-text line-1-based resolved-title)
(define (set-date-in-text text title-or-anchor date-str)
  (unless (valid-iso-date-string? date-str)
    (error 'set-date-in-text
           "invalid date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]"
           date-str))
  (define date* (normalize-date-string date-str))
  (define-values (m label) (resolve-one text title-or-anchor 'set-date-in-text))
  (define lines (string-split text "\n" #:trim? #f))
  (define idx (title-match-index m))
  (define ind (title-match-indent m))
  (define meta (metadata-indices lines idx ind))
  (define meta-indent (+ ind 2))
  (define date-line
    (string-append (make-string meta-indent #\space) "@date " date*))
  ;; Drop existing @date lines, then insert one after remaining meta.
  (define drop-set
    (for/set ([i (in-list meta)]
              #:when (date-line? (list-ref lines i)))
      i))
  (define lines*
    (for/list ([i (in-range (length lines))]
               #:unless (set-member? drop-set i))
      (list-ref lines i)))
  (define removed-before
    (for/sum ([i (in-list (set->list drop-set))] #:when (< i idx)) 1))
  (define title-idx* (- idx removed-before))
  ;; Recompute meta after drop
  (define meta*
    (metadata-indices lines* title-idx* ind))
  (define insert-at
    (if (null? meta*) (add1 title-idx*) (add1 (last meta*))))
  (define new-lines
    (append (take lines* insert-at)
            (list date-line)
            (drop lines* insert-at)))
  (values (lines->text new-lines text)
          (add1 insert-at)
          (title-match-title m)
          date*))

(define (clear-date-in-text text title-or-anchor)
  (define-values (m label) (resolve-one text title-or-anchor 'clear-date-in-text))
  (define lines (string-split text "\n" #:trim? #f))
  (define idx (title-match-index m))
  (define ind (title-match-indent m))
  (define meta (metadata-indices lines idx ind))
  (define drop-set
    (for/set ([i (in-list meta)]
              #:when (date-line? (list-ref lines i)))
      i))
  (when (set-empty? drop-set)
    (error 'clear-date-in-text "no @date on ~s (line ~a)" label (title-match-line m)))
  (define lines*
    (for/list ([i (in-range (length lines))]
               #:unless (set-member? drop-set i))
      (list-ref lines i)))
  (values (lines->text lines* text)
          (title-match-line m)
          (title-match-title m)))
