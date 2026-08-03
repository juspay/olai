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
  (read-json (open-input-string s)))

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

  (test-case "tree is always JSON (with or without --json)"
    (define-values (code out err)
      (run-selfflowy (list "tree" (path->string example))))
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
    (check-equal? (hash-ref inbox 'done) (json-null)))
    (define-values (c2 o2 e2)
      (run-selfflowy (list "tree" "--json" (path->string example))))
    (check-equal? c2 0 e2)
    (check-equal? (hash-ref (parse-json o2) 'version) 1))

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

  (test-case "add invalid --date is usage error and leaves file"
    (define dir (make-temporary-file "sfbad~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (define original "#lang selfflowy\n\nKeepme\n")
       (display-to-file original f #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy
          (list "add" "--json" "--no-commit" "--file" (path->string f)
                "--date" "2026-13-01" "bad date task")))
       (check-equal? code 1)
       (check-equal? (file->string f) original))
     (λ () (delete-directory/files dir))))

  (test-case "add leaves original untouched when post-write load fails"
    (define dir (make-temporary-file "sfbad2~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       ;; No #lang — append succeeds as text, load of tmp fails, original kept
       (define original "not a module\n")
       (display-to-file original f #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy
          (list "add" "--json" "--no-commit" "--file" (path->string f)
                "orphan")))
       (check-equal? code 2)
       (check-equal? (file->string f) original))
     (λ () (delete-directory/files dir))))


  (test-case "done / undo round-trip with git commit"
    (define dir (make-temporary-file "sfdone~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (parameterize ([current-directory dir])
         (system* (find-executable-path "git") "init" "-q")
         (system* (find-executable-path "git") "config" "user.email" "t@t.test")
         (system* (find-executable-path "git") "config" "user.name" "t")
         (display-to-file
          "#lang selfflowy\n\nInbox\n  Ship it\n    @date 2026-08-01\n"
          f #:exists 'truncate)
         (system* (find-executable-path "git") "add" "Tasks.rkt")
         (system* (find-executable-path "git") "commit" "-q" "-m" "init"))
       (define-values (code out err)
         (run-selfflowy
          (list "done" "--json" "--file" (path->string f) "Ship" "it")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'ok) #t)
       (check-equal? (hash-ref j 'title) "Ship it")
       (check-equal? (hash-ref j 'undone) #f)
       (check-equal? (hash-ref j 'committed) #t)
       (check-true (string? (hash-ref j 'done)))
       (define text (file->string f))
       (check-true (string-contains? text "@done ") text)
       (define log1
         (with-output-to-string
           (λ ()
             (parameterize ([current-directory dir])
               (system* (find-executable-path "git") "log" "-1" "--pretty=%s")))))
       (check-true (string-contains? log1 "done: Ship it") log1)
       ;; tree JSON has done timestamp
       (define-values (c2 o2 e2)
         (run-selfflowy (list "tree" (path->string f))))
       (check-equal? c2 0 e2)
       (define tree (parse-json o2))
       (define ship
         (car (hash-ref (car (hash-ref tree 'tasks)) 'children)))
       (check-equal? (hash-ref ship 'title) "Ship it")
       (check-true (string? (hash-ref ship 'done)))
       ;; undo
       (define-values (c3 o3 e3)
         (run-selfflowy
          (list "done" "--json" "--undo" "--file" (path->string f) "Ship it")))
       (check-equal? c3 0 (string-append o3 e3))
       (define j3 (parse-json o3))
       (check-equal? (hash-ref j3 'undone) #t)
       (check-equal? (hash-ref j3 'done) (json-null))
       (check-false (string-contains? (file->string f) "@done"))
       (define log2
         (with-output-to-string
           (λ ()
             (parameterize ([current-directory dir])
               (system* (find-executable-path "git") "log" "-1" "--pretty=%s")))))
       (check-true (string-contains? log2 "undone: Ship it") log2))
     (λ () (delete-directory/files dir))))

  (test-case "done no match exits 2"
    (define dir (make-temporary-file "sfnomatch~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang selfflowy\nOnly\n" f #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy
          (list "done" "--json" "--no-commit" "--file" (path->string f)
                "Missing")))
       (check-equal? code 2)
       (define j (parse-json err))
       (check-equal? (hash-ref j 'ok) #f)
       (define msg (hash-ref (hash-ref j 'error) 'message))
       (check-true (regexp-match? #px"(?i:no task)" msg) msg))
     (λ () (delete-directory/files dir))))

  (test-case "done ambiguous lists matches"
    (define dir (make-temporary-file "sfambig~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\nDup\nOther\n  Dup\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-selfflowy
          (list "done" "--json" "--no-commit" "--file" (path->string f)
                "Dup")))
       (check-equal? code 2)
       (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
       (check-true (regexp-match? #px"(?i:ambiguous)" msg) msg)
       (check-true (regexp-match? #px":2" msg) msg)
       (check-true (regexp-match? #px":4" msg) msg)
       (check-equal? (file->string f)
                     "#lang selfflowy\nDup\nOther\n  Dup\n"))
     (λ () (delete-directory/files dir))))
