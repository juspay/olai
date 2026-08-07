#lang racket/base

;; Fractional indexing for sibling `ord` strings.
;;
;; Children of one parent sort by `ord` with plain string comparison. A writer
;; that inserts between two existing siblings needs a key that compares
;; strictly between them — without renumbering the neighbourhood. That is what
;; this module produces.
;;
;; Alphabet is 0-9 A-Z a-z (base 62). Keys are non-empty strings over it.
;; `ord-between` answers a midpoint; `ord-after` / `ord-before` cover the open
;; ends (append at the end / prepend at the start). The algorithm is the usual
;; digit-wise mid with a trailing digit when two keys are adjacent.

(require racket/contract
         racket/list
         racket/string)

(provide (contract-out
          [ord-alphabet string?]
          [ord-char? (-> any/c boolean?)]
          [ord-string? (-> any/c boolean?)]
          [ord-first (-> string?)]
          [ord-after (-> (or/c string? #f) string?)]
          [ord-before (-> (or/c string? #f) string?)]
          [ord-between (-> (or/c string? #f) (or/c string? #f) string?)]))

(define ord-alphabet
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")

(define ord-base (string-length ord-alphabet))

(define (ord-char? c)
  (and (char? c) (string-contains? ord-alphabet (string c))))

(define (ord-string? s)
  (and (string? s)
       (positive? (string-length s))
       (for/and ([c (in-string s)]) (ord-char? c))))

(define (digit->int c)
  (define i
    (for/or ([ch (in-string ord-alphabet)] [n (in-naturals)])
      (and (char=? ch c) n)))
  (unless i (error 'olai/frac "not an ord digit: ~v" c))
  i)

(define (int->digit n)
  (string-ref ord-alphabet n))

;; First key a fresh sibling list gets: mid of the alphabet.
(define (ord-first)
  (string (int->digit (quotient ord-base 2))))

;; Pad `s` on the right with zeros so both strings share a length for
;; digit-wise arithmetic. Zeros sort first, so padding is a no-op on order.
(define (pad-right s n)
  (string-append s (make-string (max 0 (- n (string-length s))) #\0)))

;; Integer value of a digit string, left-to-right big-endian over the alphabet.
(define (digits->int ds)
  (for/fold ([acc 0]) ([d (in-list ds)])
    (+ (* acc ord-base) d)))

(define (int->digits n width)
  (let loop ([n n] [left width] [acc '()])
    (if (zero? left)
        acc
        (loop (quotient n ord-base)
              (sub1 left)
              (cons (remainder n ord-base) acc)))))

;; Midpoint of two digit lists of equal length. When they are adjacent
;; (mid rounds to `lo`), append a mid digit so the result still sits between.
(define (mid-digits lo-ds hi-ds)
  (define width (length lo-ds))
  (define lo (digits->int lo-ds))
  (define hi (digits->int hi-ds))
  (unless (< lo hi)
    (error 'olai/frac "ord-between: lower bound not less than upper"))
  (define mid (quotient (+ lo hi) 2))
  (if (= mid lo)
      (append lo-ds (list (quotient ord-base 2)))
      (int->digits mid width)))

(define (digits->string ds)
  ;; strip trailing zeros for a shorter stable spelling; keep at least one
  (define trimmed
    (let loop ([xs (reverse ds)])
      (cond
        [(null? xs) '(0)]
        [(zero? (car xs)) (loop (cdr xs))]
        [else (reverse xs)])))
  (list->string (map int->digit trimmed)))

(define (string->digits s width)
  (map digit->int (string->list (pad-right s width))))

;; `lo` exclusive lower bound (#f = open below); `hi` exclusive upper (#f = open
;; above). Both present => strict between; one open => step past the bound.
(define (ord-between lo hi)
  (when (and lo (not (ord-string? lo)))
    (error 'olai/frac "ord-between: bad lower bound: ~v" lo))
  (when (and hi (not (ord-string? hi)))
    (error 'olai/frac "ord-between: bad upper bound: ~v" hi))
  (when (and lo hi (not (string<? lo hi)))
    (error 'olai/frac "ord-between: ~v is not less than ~v" lo hi))
  (cond
    [(and (not lo) (not hi)) (ord-first)]
    [(not lo)
     ;; open below: a key that compares less than hi
     (define width (string-length hi))
     (define hi-ds (string->digits hi width))
     (define hi-n (digits->int hi-ds))
     (cond
       [(zero? hi-n)
        ;; hi is the smallest possible at this width — go longer with mid digit
        (string-append (make-string width #\0)
                       (string (int->digit (quotient ord-base 2))))]
       [else
        (digits->string (int->digits (quotient hi-n 2) width))])]
    [(not hi)
     ;; open above: a key that compares greater than lo
     (define width (string-length lo))
     (define lo-ds (string->digits lo width))
     (define lo-n (digits->int lo-ds))
     (define max-n (sub1 (expt ord-base width)))
     (cond
       [(>= lo-n max-n)
        (string-append lo (string (int->digit (quotient ord-base 2))))]
       [else
        (define mid (quotient (+ lo-n max-n) 2))
        (if (= mid lo-n)
            (string-append lo (string (int->digit (quotient ord-base 2))))
            (digits->string (int->digits mid width)))])]
    [else
     (define width (max (string-length lo) (string-length hi)))
     (digits->string
      (mid-digits (string->digits lo width)
                  (string->digits hi width)))]))

(define (ord-after lo) (ord-between lo #f))
(define (ord-before hi) (ord-between #f hi))
