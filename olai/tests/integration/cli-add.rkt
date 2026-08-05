#lang racket/base

;; The capture path: `add`, what it leaves on disk, and what the write path
;; refuses. Real subprocess (cli-util.rkt), temp dirs only.

(require rackunit
         racket/file
         racket/port
         racket/string
         racket/system
         "cli-util.rkt")

(module+ test
  (test-case "add creates Inbox and preserves content"
    (define dir (make-temporary-file "sfdir~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang olai\n\nSomeday\n  Later idea\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
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
         (run-olai (list "check" "--json" (path->string f))))
       (check-equal? c2 0 e2))
     (λ () (delete-directory/files dir))))

  (test-case "add under existing Inbox"
    (define dir (make-temporary-file "sfdir~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang olai\n\nInbox\n  already here\n\nOther\n  x\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
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
       (parameterize ([current-directory dir])
         (system* (find-executable-path "git") "init" "-q")
         (system* (find-executable-path "git") "config" "user.email" "t@t.test")
         (system* (find-executable-path "git") "config" "user.name" "t")
         (display-to-file "#lang olai\n" f #:exists 'truncate)
         (system* (find-executable-path "git") "add" "Tasks.rkt")
         (system* (find-executable-path "git") "commit" "-q" "-m" "init"))
       (define-values (code out err)
         (run-olai
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
       (define original "#lang olai\n\nKeepme\n")
       (display-to-file original f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
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
         (run-olai
          (list "add" "--json" "--no-commit" "--file" (path->string f)
                "orphan")))
       (check-equal? code 2)
       (check-equal? (file->string f) original))
     (λ () (delete-directory/files dir))))

  ;; There is no default home. With OLAI_HOME unset and nothing named, the
  ;; command that would have needed it says so and touches nothing — usage
  ;; error on both sides of the CLI, JSON on stderr when asked for.
  (test-case "unset OLAI_HOME is a usage error"
    (parameterize ([current-environment-variables
                    (let ([e (environment-variables-copy
                              (current-environment-variables))])
                      (environment-variables-set! e #"OLAI_HOME" #f)
                      e)])
      (define-values (code out err) (run-olai (list "add" "--no-commit" "x")))
      (check-equal? code 1 (string-append out err))
      (check-true (regexp-match? #px"OLAI_HOME" err) err)
      (define-values (c2 o2 e2) (run-olai (list "check" "--json")))
      (check-equal? c2 1 (string-append o2 e2))
      (define j (parse-json e2))
      (check-equal? (hash-ref j 'ok) #f)
      (define msg (hash-ref (hash-ref j 'error) 'message))
      (check-true (regexp-match? #px"OLAI_HOME" msg) msg)))

  ;; Every writer emits outline syntax, so the write path refuses a sexp file
  ;; rather than each command remembering to.
  (test-case "writes refuse a #lang olai/sexp file"
    (define dir (make-temporary-file "sfsexpguard~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (define original "#lang olai/sexp\n(t \"Ship it\")\n")
       (display-to-file original f #:exists 'truncate)
       (for ([args (in-list (list (list "add" "--json" "--no-commit"
                                        "--file" (path->string f) "new")
                                  (list "done" "--json" "--no-commit"
                                        "--file" (path->string f) "Ship it")))])
         (define-values (code out err) (run-olai args))
         (check-equal? code 2 (string-append out err))
         (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
         (check-true (regexp-match? #px"sexp" msg) msg))
       (check-equal? (file->string f) original))
     (λ () (delete-directory/files dir)))))
