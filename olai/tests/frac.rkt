#lang racket/base

(require rackunit
         olai/frac)

(module+ test
  (test-case "ord-first is a mid alphabet key"
    (check-true (ord-string? (ord-first)))
    (check-equal? (string-length (ord-first)) 1))

  (test-case "ord-after is strictly greater"
    (define a (ord-first))
    (define b (ord-after a))
    (check-true (string<? a b))
    (define c (ord-after b))
    (check-true (string<? b c)))

  (test-case "ord-before is strictly less"
    (define a (ord-first))
    (define z (ord-before a))
    (check-true (string<? z a)))

  (test-case "ord-between sits strictly between"
    (define a "a0")
    (define b "a2")
    (define m (ord-between a b))
    (check-true (string<? a m))
    (check-true (string<? m b)))

  (test-case "ord-between adjacent keys lengthens"
    ;; force adjacency at width 1: "0" and "1"
    (define m (ord-between "0" "1"))
    (check-true (string<? "0" m))
    (check-true (string<? m "1"))
    (check-true (>= (string-length m) 1)))

  (test-case "ord-string? rejects empty and bad chars"
    (check-false (ord-string? ""))
    (check-false (ord-string? "a-b"))
    (check-true (ord-string? "a0Z")))

  (test-case "open bounds"
    (check-true (string<? (ord-between #f "V") "V"))
    (check-true (string>? (ord-between "V" #f) "V"))
    (check-true (ord-string? (ord-between #f #f)))))
