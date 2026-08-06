#lang racket/base

;; What #lang arch refuses, and where it says the problem is.
;;
;; Both halves are the contract. A message that names the rule and lists the
;; vocabulary is what makes the language teachable; a `file:line:col` on the
;; OFFENDING form — the authority word, not the `owns` around it — is what
;; makes it fixable. Neither is worth having without the other, so every case
;; here checks both.

(require racket/list
         racket/string
         arch/tests/tree)

(module+ test
  (require rackunit))

;; Compiling the declaration is what raises, so the fixture is a directory with
;; one arch.rkt in it and whatever modules its overrides name.
(define (refusal body #:beside [beside '()])
  (call-with-tree
   (append beside (list (cons "arch.rkt" (string-append "#lang arch\n" body))))
   (λ (dir)
     (with-handlers ([exn:fail:syntax?
                      (λ (e)
                        (define stx (and (pair? (exn:fail:syntax-exprs e))
                                         (car (exn:fail:syntax-exprs e))))
                        (list (exn-message e)
                              (and stx (syntax-line stx))
                              (and stx (syntax-column stx))))])
       (dynamic-require (build-path dir "arch.rkt") 'declaration)
       (list "no refusal" #f #f)))))

(define (message r) (car r))
(define (line r) (cadr r))
(define (column r) (caddr r))

(module+ test
  (test-case "not a clock"
    (define r (refusal "(clock stabel)\n(owns)\n"))
    (check-true (string-contains? (message r) "not a clock"))
    (check-true (string-contains? (message r) "clocks: stable, settling, volatile"))
    (check-true (string-contains? (message r) "did you mean: stable?"))
    ;; the WORD, not the form around it
    (check-equal? (line r) 2)
    (check-equal? (column r) 7))

  (test-case "not an authority"
    (define r (refusal "(clock stable)\n(owns filesytem)\n"))
    (check-true (string-contains? (message r) "not an authority"))
    (check-true (string-contains? (message r) "filesystem-events"))
    (check-true (string-contains? (message r) "a new authority is a roadmap proposal"))
    (check-true (string-contains? (message r) "did you mean: filesystem?"))
    (check-equal? (line r) 3)
    (check-equal? (column r) 6))

  (test-case "no clock"
    (define r (refusal "(owns)\n"))
    (check-true (string-contains? (message r) "no clock"))
    (check-true (string-contains? (message r) "(clock stable)")))

  (test-case "a second clock"
    (define r (refusal "(clock stable)\n(clock volatile)\n"))
    (check-true (string-contains? (message r) "a second clock"))
    (check-true (string-contains? (message r) "the first is at line 2"))
    (check-equal? (line r) 3))

  (test-case "not an arch form"
    (define r (refusal "(clock stable)\n(layer web)\n"))
    (check-true (string-contains? (message r) "not an arch form"))
    (check-true (string-contains? (message r) "clock, owns, concept, override"))
    (check-equal? (line r) 3)
    (check-equal? (column r) 1))

  (test-case "an override naming a module that is not there"
    (define r (refusal "(clock stable)\n(override \"gone.rkt\" (owns clock))\n"))
    (check-true (string-contains? (message r) "no such module"))
    (check-true (string-contains? (message r) "there is no gone.rkt beside this arch.rkt"))
    ;; the STRING that named it
    (check-equal? (line r) 3)
    (check-equal? (column r) 10))

  (test-case "a module overridden twice"
    (define r (refusal (string-append "(clock stable)\n"
                                      "(override \"a.rkt\" (owns clock))\n"
                                      "(override \"a.rkt\" (owns threads))\n")
                       #:beside (list (cons "a.rkt" "#lang racket/base\n"))))
    (check-true (string-contains? (message r) "a module overridden twice"))
    (check-equal? (line r) 4))

  (test-case "an authority owned twice"
    (define r (refusal "(clock stable)\n(owns clock threads clock)\n"))
    (check-true (string-contains? (message r) "an authority owned twice"))
    (check-true (string-contains? (message r) "already owned here: clock, threads"))
    (check-equal? (line r) 3)
    (check-equal? (column r) 20))

  (test-case "a concept with no spelling"
    (define r (refusal "(clock stable)\n(concept node-key-minting)\n"))
    (check-true (string-contains? (message r) "a concept with no spelling"))
    (check-true (string-contains? (message r) "(concept node-key-minting \"node-key-minting-*\")")))

  (test-case "a concept claimed twice in one file"
    (define r (refusal (string-append "(clock stable)\n"
                                      "(concept keys \"mint-*\")\n"
                                      "(concept keys \"key-*\")\n")))
    (check-true (string-contains? (message r) "a concept claimed twice"))
    (check-equal? (line r) 4))

  (test-case "a spelling on a package default"
    (define r (refusal "(clock stable)\n(owns (clock \"today-iso-string\"))\n"))
    (check-true (string-contains? (message r) "a spelling on a package default"))
    (check-true (string-contains? (message r) "(override \"some.rkt\" (owns (clock \"today-iso-string\"))")))

  (test-case "an override inside an override"
    (define r (refusal "(clock stable)\n(override \"a.rkt\" (override \"b.rkt\" (owns clock)))\n"
                       #:beside (list (cons "a.rkt" "#lang racket/base\n")
                                      (cons "b.rkt" "#lang racket/base\n"))))
    (check-true (string-contains? (message r) "an override inside an override")))

  (test-case "a declaration that is fine says so by loading"
    (define r (refusal (string-append "(clock settling)\n"
                                      "(owns)\n"
                                      "(concept keys \"mint-*\")\n"
                                      "(override \"a.rkt\" (clock stable) (owns (filesystem \"read-it\")))\n")
                       #:beside (list (cons "a.rkt" "#lang racket/base\n"))))
    (check-equal? (message r) "no refusal")))
