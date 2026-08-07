#lang racket/base

;; How a list of words is said, and what a misspelling was probably reaching
;; for.
;;
;; Split out of arch/vocabulary because the two change for different reasons.
;; The vocabulary changes when a human ratifies a word — rarely, deliberately,
;; and the whole point of keeping it small is that it does not move. This moves
;; whenever a message is reworded, which is whenever somebody watches an agent
;; misread one. Two axes behind one module is a module modified for two
;; unrelated reasons.
;;
;; It is required at phase 1 by the expander and at phase 0 by the checker, so
;; both halves of the tool say a candidate list the same way.

(require racket/contract
         racket/list
         racket/string)

(provide (contract-out
          [word-list (-> (listof symbol?) string?)]
          [did-you-mean (-> symbol? (listof symbol?) (or/c symbol? #f))]))

(define (word-list names)
  (if (null? names)
      "(none)"
      (string-join (for/list ([n (in-list names)]) (format "~a" n)) ", ")))

;; Zero dependencies is a rule here and the distribution ships no edit distance,
;; so this is the textbook two-row Levenshtein — over a handful of candidates,
;; in a branch that only runs when the compile is already failing.
(define (edit-distance a b)
  (define m (string-length b))
  (for/fold ([row (build-list (add1 m) values)] #:result (last row))
            ([i (in-range 1 (add1 (string-length a)))])
    (for/fold ([out (list i)] #:result (reverse out))
              ([j (in-range 1 (add1 m))])
      (cons (min (add1 (car out))                       ; delete
                 (add1 (list-ref row j))                ; insert
                 (+ (list-ref row (sub1 j))             ; substitute
                    (if (char=? (string-ref a (sub1 i)) (string-ref b (sub1 j))) 0 1)))
            out))))

;; Two edits: enough for a transposition (`stabel`) or a dropped letter
;; (`filesystem-event`), tight enough that an unrelated word is never offered.
(define (did-you-mean name candidates)
  (define scored (for/list ([c (in-list candidates)])
                   (cons (edit-distance (symbol->string name) (symbol->string c)) c)))
  (define best (and (pair? scored) (argmin car scored)))
  (and best (<= (car best) 2) (cdr best)))
