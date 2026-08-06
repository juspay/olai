#lang racket/base

;; `just arch --explain FILE`: the effective declaration, printed.
;;
;; Tested like a form's expansion, because it is the same kind of thing. A
;; composition a reader cannot see through is one they argue with from memory,
;; and what makes the dump trustworthy is that it says where every line came
;; from — package default or override, and which file said it.

(require racket/string
         arch/churn
         arch/explain
         arch/scope
         arch/tests/tree)

(module+ test
  (require rackunit))

(define (explained dir file)
  (explain (build-path dir file) (find-scopes dir) (read-churn dir 30) dir))

(module+ test
  (test-case "a module that takes the package default"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock settling)\n(owns)\n")
           (cons "core/plain.rkt" "#lang racket/base\n"))
     (λ (dir)
       (define out (explained dir "core/plain.rkt"))
       (check-true (string-contains? out "governed by  core/arch.rkt"))
       (check-true (string-contains? out "clock        settling"))
       (check-true (string-contains? out "(package default)"))
       (check-true (string-contains? out "owns         nothing"))
       (check-true (string-contains? out "requires     nothing else that is declared")))))

  (test-case "a module whose override replaces the clock and adds authority"
    (call-with-tree
     (list (cons "core/arch.rkt"
                 (string-append "#lang arch\n(clock settling)\n(owns)\n"
                                "(override \"dates.rkt\" (clock stable) (owns (clock \"today-string\")))\n"))
           (cons "core/dates.rkt"
                 (string-append "#lang racket/base\n(provide today-string)\n"
                                "(define (today-string) \"\")\n"))
           (cons "core/use.rkt" "#lang racket/base\n(require \"dates.rkt\")\n"))
     (λ (dir)
       (define out (explained dir "core/use.rkt"))
       (check-true (string-contains? out "clock        settling"))
       (check-true (string-contains? out "requires     core/dates.rkt (stable)"))
       (define dates (explained dir "core/dates.rkt"))
       (check-true (string-contains? dates "clock        stable"))
       (check-true (string-contains? dates "(override \"dates.rkt\")"))
       (check-true (string-contains? dates "clock (today-string)")))))

  (test-case "the churn line says what the clock allows"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/plain.rkt" "#lang racket/base\n"))
     (λ (dir)
       (check-true (string-contains? (explained dir "core/plain.rkt")
                                     "no git history here"))
       (git-history! dir (list (list "core/plain.rkt")))
       (check-true (string-contains? (explained dir "core/plain.rkt")
                                     "stable allows up to")))))

  (test-case "a module no arch.rkt governs says so"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "loose/thing.rkt" "#lang racket/base\n"))
     (λ (dir)
       (define out (explained dir "loose/thing.rkt"))
       (check-true (string-contains? out "governed by  nothing"))
       (check-true (string-contains? out "no check applies to it"))))))
