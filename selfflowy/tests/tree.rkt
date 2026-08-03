#lang racket/base

(require rackunit
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/tree)

(define (tk title date desc kids)
  (task title date desc '() kids))

(module+ test
  (test-case "render-tree uses box drawing for nested nodes"
    (define tasks
      (list
       (tk "Root"
           #f
           #f
           (list (tk "Child A" "2026-08-04" #f '())
                 (tk "Child B" #f #f
                     (list (tk "Grand" #f #f '())))))))
    (define out (render-tree tasks))
    (check-true (string-contains? out "Root"))
    (check-true (string-contains? out "├── Child A"))
    (check-true (string-contains? out "└── Child B"))
    (check-true (string-contains? out "└── Grand"))
    (check-true (string-contains? out "[2026-08-04]")))

  (test-case "render-tree shows description under title"
    (define tasks
      (list (tk "Root" #f "a note"
                (list (tk "Kid" #f "kid note" '())))))
    (define out (render-tree tasks))
    (check-true (string-contains? out "a note") out)
    (check-true (string-contains? out "kid note") out)
    (check-true (regexp-match? #rx"Root\n.*a note" out) out)
    (check-true (regexp-match? #rx"Kid\n.*kid note" out) out))

  (test-case "no ANSI when stdout is not a terminal"
    (define tasks (list (tk "Root" #f "dim me" '())))
    (define out
      (let ([sp (open-output-string)])
        (parameterize ([current-output-port sp])
          (render-tree tasks))))
    (check-true (string-contains? out "dim me") out)
    (check-false (regexp-match? #rx"\x1b" out) out))

  (test-case "title tags stay plain when not a TTY"
    (define tasks (list (task "Ship #lang work" #f #f '("lang") '())))
    (define out
      (let ([sp (open-output-string)])
        (parameterize ([current-output-port sp])
          (render-tree tasks))))
    (check-true (string-contains? out "Ship #lang work") out)
    (check-false (regexp-match? #rx"\x1b" out) out)))
