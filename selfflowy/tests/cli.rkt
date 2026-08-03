#lang racket/base

(require rackunit
         racket/file
         racket/port
         racket/string
         racket/path)

(define root
  (simplify-path
   (build-path (collection-file-path "info.rkt" "selfflowy") 'up 'up)))

(define example (build-path root "examples" "Example.rkt"))

(define (run-selfflowy args)
  (define-values (sp stdout stdin stderr)
    (apply subprocess
           #f #f #f
           (find-executable-path "racket")
           "-l" "selfflowy/cli"
           "--"
           args))
  (close-output-port stdin)
  (define out (port->string stdout))
  (define err (port->string stderr))
  (close-input-port stdout)
  (close-input-port stderr)
  (subprocess-wait sp)
  (values (subprocess-status sp) out err))

(module+ test
  (test-case "check example succeeds"
    (define-values (code out err) (run-selfflowy (list "check" (path->string example))))
    (check-equal? code 0 out)
    (check-regexp-match #rx"^ok:" out)
    (check-regexp-match #rx"task" out))

  (test-case "tree example draws outline and descriptions"
    (define-values (code out err) (run-selfflowy (list "tree" (path->string example))))
    (check-equal? code 0 out)
    (check-true (string-contains? out "Inbox") out)
    (check-true (or (string-contains? out "├")
                    (string-contains? out "└")
                    (string-contains? out "Buy milk"))
                out)
    (check-true (string-contains? out "Quick capture landing zone") out)
    (check-true (string-contains? out "2% if they have it") out))

  (test-case "check missing file fails"
    (define-values (code out err)
      (run-selfflowy (list "check" "/tmp/selfflowy-no-such-file-xyz.rkt")))
    (check-not-equal? code 0)
    (check-regexp-match #rx"not found" err))

  (test-case "check invalid date fails with useful message"
    (define tmp (make-temporary-file "sf~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\n(t \"bad\" #:date \"bogus\")\n"
        tmp #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy (list "check" (path->string tmp))))
       (check-not-equal? code 0)
       (define combined (string-append out err))
       (check-true (regexp-match? #rx"(?i:date|invalid|failed|syntax)" combined)
                   combined))
     (λ () (delete-file tmp)))))
