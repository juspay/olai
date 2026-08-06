#lang racket/base

;; Read-only commands over one file: check / tree / agenda, and the exit codes
;; a bad invocation earns. The CLI runs as a real subprocess (cli-util.rkt).

(require json
         racket/file
         "cli-util.rkt")

(module+ test
  (require rackunit))

(module+ test
  ;; There is no plain mode left to test: the reply is JSON with or without
  ;; the flag agents already type.
  (test-case "check is always JSON (with or without --json)"
    (define-values (code out err) (run-olai (list "check" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (check-equal? (hash-ref j 'ok) #t)
    (check-true (hash-has-key? j 'file))
    (check-true (exact-positive-integer? (hash-ref j 'tasks)))
    (define-values (c2 o2 e2)
      (run-olai (list "check" "--json" (path->string example))))
    (check-equal? c2 0 (string-append o2 e2))
    (check-equal? (hash-ref (parse-json o2) 'ok) #t))

  (test-case "agenda is always JSON"
    (define-values (code out err)
      (run-olai (list "agenda" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (check-true (list? (hash-ref j 'overdue))))

  (test-case "calendar is always JSON"
    (define-values (code out err)
      (run-olai (list "calendar" "--month" "2026-08" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (check-equal? (hash-ref j 'month) "2026-08")
    (check-true (list? (hash-ref j 'days))))

  ;; The retired commands are gone, not quietly ignored.
  (test-case "css is not a command"
    (define-values (code out err) (run-olai (list "css")))
    (check-equal? code 1)
    (check-true (regexp-match? #rx"unknown command" err) err))

  (test-case "tree is always JSON (with or without --json)"
    (define-values (code out err)
      (run-olai (list "tree" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (define tasks (hash-ref j 'tasks))
    (check-true (list? tasks))
    (define inbox (car tasks))
    (check-true (hash-has-key? inbox 'title))
    (check-true (hash-has-key? inbox 'tags))
    (check-true (hash-has-key? inbox 'children))
    (check-true (hash-has-key? inbox 'date))
    (check-true (hash-has-key? inbox 'description))
    (check-true (hash-has-key? inbox 'done))
    (check-equal? (hash-ref inbox 'done) (json-null))
    ;; the stored fields and what they mean travel together
    (check-true (hash-has-key? inbox 'doing))
    (check-equal? (hash-ref inbox 'doing) (json-null))
    (check-equal? (hash-ref inbox 'status) "open")
    (define-values (c2 o2 e2)
      (run-olai (list "tree" "--json" (path->string example))))
    (check-equal? c2 0 e2)
    (check-equal? (hash-ref (parse-json o2) 'version) 1))

  (test-case "agenda --json shape"
    (define-values (code out err)
      (run-olai (list "agenda" "--json" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (check-true (hash-has-key? j 'today))
    (check-true (list? (hash-ref j 'overdue)))
    (check-true (list? (hash-ref j 'doing)))
    (check-true (list? (hash-ref j 'today_items)))
    (check-true (list? (hash-ref j 'upcoming)))
    (define item (car (hash-ref j 'overdue)))
    (check-true (hash-has-key? item 'title))
    (check-true (hash-has-key? item 'date))
    (check-true (hash-has-key? item 'breadcrumb))
    (check-equal? (hash-ref item 'status) "open")
    ;; the demo outline has nodes in flight, and they group on their own
    (define doing (car (hash-ref j 'doing)))
    (check-equal? (hash-ref doing 'status) "doing")
    (check-true (hash-has-key? doing 'breadcrumb)))

  ;; Errors are the error object on stderr, flag or no flag.
  (test-case "check missing file exits 3 with error object"
    (for ([args (in-list (list (list "check" "/tmp/olai-no-such-file-xyz.rkt")
                               (list "check" "--json"
                                     "/tmp/olai-no-such-file-xyz.rkt")))])
      (define-values (code out err) (run-olai args))
      (check-equal? code 3)
      (define j (parse-json err))
      (check-equal? (hash-ref j 'ok) #f)
      (check-equal? (hash-ref j 'version) 1)
      (check-true (hash-has-key? (hash-ref j 'error) 'message))))

  (test-case "check invalid date exits 2"
    (define tmp (make-temporary-file "sf~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang olai\nbad\n  @date bogus\n"
        tmp #:exists 'truncate)
       (define-values (code out err)
         (run-olai (list "check" "--json" (path->string tmp))))
       (check-equal? code 2)
       (define j (parse-json err))
       (check-equal? (hash-ref j 'ok) #f)
       (define msg (hash-ref (hash-ref j 'error) 'message))
       (check-true (regexp-match? #rx"(?i:date|YYYY)" msg) msg))
     (λ () (delete-file tmp))))

  (test-case "usage error exits 1"
    (define-values (code out err) (run-olai '()))
    (check-equal? code 1)))
