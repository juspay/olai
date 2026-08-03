#lang racket/base

(require rackunit
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/tree)

(module+ test
  (test-case "render-tree uses box drawing for nested nodes"
    (define tasks
      (list
       (task "Root"
             #f
             #f
             (list (task "Child A" "2026-08-04" #f '())
                   (task "Child B" #f #f
                         (list (task "Grand" #f #f '())))))))
    (define out (render-tree tasks))
    (check-true (string-contains? out "Root"))
    (check-true (string-contains? out "├── Child A"))
    (check-true (string-contains? out "└── Child B"))
    (check-true (string-contains? out "└── Grand"))
    (check-true (string-contains? out "[2026-08-04]")))

  (test-case "render-tree shows description under title"
    (define tasks
      (list (task "Root" #f "a note"
                  (list (task "Kid" #f "kid note" '())))))
    (define out (render-tree tasks))
    (check-true (string-contains? out "a note") out)
    (check-true (string-contains? out "kid note") out)
    ;; description sits on its own line under the title
    (check-true (regexp-match? #rx"Root\n.*a note" out) out)
    (check-true (regexp-match? #rx"Kid\n.*kid note" out) out)))
