#lang racket/base

(require racket/string
         olai/capture)

(module+ test
  (require rackunit))

(module+ test
  (test-case "format-capture-lines"
    (check-equal? (format-capture-lines "x")
                  '("  x"))
    (check-equal? (format-capture-lines "x" #:date "2026-01-02" #:description "d")
                  '("  x" "    : d" "    @date 2026-01-02")))

  (test-case "append-capture creates Inbox"
    (define-values (new line created?)
      (append-capture "#lang olai\n" "hello"))
    (check-true created?)
    (check-true (string-contains? new "Inbox\n  hello\n") new))

  (test-case "append-capture under existing Inbox preserves neighbors"
    (define src
      "#lang olai\n\nInbox\n  old\n\nOther\n  z\n")
    (define-values (new line created?)
      (append-capture src "new" #:date "2026-02-02"))
    (check-false created?)
    (check-true (string-contains? new "  old\n  new\n    @date 2026-02-02\n") new)
    (check-true (string-contains? new "Other\n  z\n") new)))
