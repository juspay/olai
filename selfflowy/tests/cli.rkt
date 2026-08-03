#lang racket/base

(require rackunit
         json
         racket/file
         racket/port
         racket/string
         racket/path
         racket/system)

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

(define (parse-json s)
  (string->jsexpr s))

(module+ test
  (test-case "check example succeeds"
    (define-values (code out err) (run-selfflowy (list "check" (path->string example))))
    (check-equal? code 0 out)
    (check-regexp-match #rx"^ok:" out))

  (test-case "check --json shape"
    (define-values (code out err)
      (run-selfflowy (list "check" "--json" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (check-equal? (hash-ref j 'ok) #t)
    (check-true (hash-has-key? j 'file))
    (check-true (exact-positive-integer? (hash-ref j 'tasks))))

  (test-case "tree --json shape"
    (define-values (code out err)
      (run-selfflowy (list "tree" "--json" (path->string example))))
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
    (check-true (hash-has-key? inbox 'description)))

  (test-case "agenda --json shape"
    (define-values (code out err)
      (run-selfflowy (list "agenda" "--json" (path->string example))))
    (check-equal? code 0 (string-append out err))
    (define j (parse-json out))
    (check-equal? (hash-ref j 'version) 1)
    (check-true (hash-has-key? j 'today))
    (check-true (list? (hash-ref j 'overdue)))
    (check-true (list? (hash-ref j 'today_items)))
    (check-true (list? (hash-ref j 'upcoming)))
    (define item (car (hash-ref j 'overdue)))
    (check-true (hash-has-key? item 'title))
    (check-true (hash-has-key? item 'date))
    (check-true (hash-has-key? item 'breadcrumb)))

  (test-case "check missing file exits 3"
    (define-values (code out err)
      (run-selfflowy (list "check" "/tmp/selfflowy-no-such-file-xyz.rkt")))
    (check-equal? code 3)
    (check-regexp-match #rx"not found" err))

  (test-case "check missing file --json exits 3 with error object"
    (define-values (code out err)
      (run-selfflowy (list "check" "--json" "/tmp/selfflowy-no-such-file-xyz.rkt")))
    (check-equal? code 3)
    (define j (parse-json err))
    (check-equal? (hash-ref j 'ok) #f)
    (check-equal? (hash-ref j 'version) 1)
    (check-true (hash-has-key? (hash-ref j 'error) 'message)))

  (test-case "check invalid date exits 2"
    (define tmp (make-temporary-file "sf~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\nbad\n  @date bogus\n"
        tmp #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy (list "check" "--json" (path->string tmp))))
       (check-equal? code 2)
       (define j (parse-json err))
       (check-equal? (hash-ref j 'ok) #f)
       (define msg (hash-ref (hash-ref j 'error) 'message))
       (check-true (regexp-match? #rx"(?i:date|YYYY)" msg) msg))
     (λ () (delete-file tmp))))

  (test-case "usage error exits 1"
    (define-values (code out err) (run-selfflowy '()))
    (check-equal? code 1))

  (test-case "add creates Inbox and preserves content"
    (define dir (make-temporary-file "sfdir~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\n\nSomeday\n  Later idea\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy
          (list "add" "--json" "--no-commit" "--file" (path->string f)
                "buy" "oat" "milk")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'ok) #t)
       (check-equal? (hash-ref j 'title) "buy oat milk")
       (check-equal? (hash-ref j 'created_inbox) #t)
       (check-equal? (hash-ref j 'committed) #f)
       (define text (file->string f))
       (check-true (string-contains? text "Someday") text)
       (check-true (string-contains? text "Later idea") text)
       (check-true (string-contains? text "Inbox") text)
       (check-true (string-contains? text "buy oat milk") text)
       ;; still loads
       (define-values (c2 o2 e2)
         (run-selfflowy (list "check" "--json" (path->string f))))
       (check-equal? c2 0 e2))
     (λ () (delete-directory/files dir))))

  (test-case "add under existing Inbox"
    (define dir (make-temporary-file "sfdir~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\n\nInbox\n  already here\n\nOther\n  x\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy
          (list "add" "--no-commit" "--file" (path->string f)
                "--date" "2026-09-01" "new task")))
       (check-equal? code 0 (string-append out err))
       (define text (file->string f))
       (check-true (regexp-match? #rx"Inbox\n  already here\n  new task\n    @date 2026-09-01"
                                  text)
                   text)
       (check-true (string-contains? text "Other") text))
     (λ () (delete-directory/files dir))))

  (test-case "add auto-commits in a git repo"
    (define dir (make-temporary-file "sfgit~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (define (sh . args)
         (apply system* (find-executable-path "git") args))
       (parameterize ([current-directory dir])
         (system* (find-executable-path "git") "init" "-q")
         (system* (find-executable-path "git") "config" "user.email" "t@t.test")
         (system* (find-executable-path "git") "config" "user.name" "t")
         (display-to-file "#lang selfflowy\n" f #:exists 'truncate)
         (system* (find-executable-path "git") "add" "Tasks.rkt")
         (system* (find-executable-path "git") "commit" "-q" "-m" "init"))
       (define-values (code out err)
         (run-selfflowy
          (list "add" "--json" "--file" (path->string f) "committed item")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'committed) #t)
       (define log
         (with-output-to-string
           (λ ()
             (parameterize ([current-directory dir])
               (system* (find-executable-path "git") "log" "-1" "--pretty=%s")))))
       (check-true (regexp-match? #rx"capture: committed item" log) log))
     (λ () (delete-directory/files dir))))

  (test-case "add restores on validation failure"
    (define dir (make-temporary-file "sfbad~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (define original "#lang selfflowy\n\nKeepme\n")
       (display-to-file original f #:exists 'truncate)
       ;; Title with only invalid construction is hard; use a date that
       ;; expander rejects by forcing a write of bad meta via --date that
       ;; passes CLI regex but fails expander month check.
       (define-values (code out err)
         (run-selfflowy
          (list "add" "--json" "--no-commit" "--file" (path->string f)
                "--date" "2026-13-01" "bad date task")))
       ;; CLI only checks YYYY-MM-DD shape; expander rejects month 13
       (check-equal? code 2)
       (check-equal? (file->string f) original))
     (λ () (delete-directory/files dir)))))
