#lang racket/base

;; The `done` path: the round trip, and what a miss tells the user. Real
;; subprocess (cli-util.rkt), temp dirs only.

(require rackunit
         json
         racket/file
         racket/port
         racket/string
         racket/system
         "cli-util.rkt")

(module+ test
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
          "#lang olai\n\nInbox\n  Ship it\n    @date 2026-08-01\n"
          f #:exists 'truncate)
         (system* (find-executable-path "git") "add" "Tasks.rkt")
         (system* (find-executable-path "git") "commit" "-q" "-m" "init"))
       (define-values (code out err)
         (run-olai
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
         (run-olai (list "tree" (path->string f))))
       (check-equal? c2 0 e2)
       (define tree (parse-json o2))
       (define ship
         (car (hash-ref (car (hash-ref tree 'tasks)) 'children)))
       (check-equal? (hash-ref ship 'title) "Ship it")
       (check-true (string? (hash-ref ship 'done)))
       (check-equal? (hash-ref ship 'status) "done")
       ;; undo
       (define-values (c3 o3 e3)
         (run-olai
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

  ;; What a user (and an agent's JSON) gets told is a sentence about their
  ;; outline, not the name of the function that noticed.
  (test-case "done on a done task says so in user language"
    (define dir (make-temporary-file "sfredone~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nShip it\n  @done 2026-08-01\n"
                        f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "done" "--json" "--no-commit" "--file" (path->string f)
                "Ship it")))
       (check-equal? code 2 (string-append out err))
       (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
       (check-true (regexp-match? #px"(?i:already done)" msg) msg)
       (check-false (string-contains? msg "mark-done-in-text") msg)
       (check-false (string-contains? msg "-in-text") msg)
       ;; and the same for the other direction
       (display-to-file "#lang olai\nShip it\n" f #:exists 'truncate)
       (define-values (c2 o2 e2)
         (run-olai
          (list "done" "--json" "--undo" "--no-commit" "--file" (path->string f)
                "Ship it")))
       (check-equal? c2 2 (string-append o2 e2))
       (define msg2 (hash-ref (hash-ref (parse-json e2) 'error) 'message))
       (check-true (regexp-match? #px"(?i:not done)" msg2) msg2)
       (check-false (string-contains? msg2 "undo-done-in-text") msg2))
     (λ () (delete-directory/files dir))))

  (test-case "done no match exits 2"
    (define dir (make-temporary-file "sfnomatch~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nOnly\n" f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
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
        "#lang olai\nDup\nOther\n  Dup\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "done" "--json" "--no-commit" "--file" (path->string f)
                "Dup")))
       (check-equal? code 2)
       (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
       (check-true (regexp-match? #px"(?i:ambiguous)" msg) msg)
       (check-true (regexp-match? #px":2" msg) msg)
       (check-true (regexp-match? #px":4" msg) msg)
       (check-equal? (file->string f)
                     "#lang olai\nDup\nOther\n  Dup\n"))
     (λ () (delete-directory/files dir))))

  (test-case "done ^anchor reports resolved title in JSON"
    (define dir (make-temporary-file "sfanch~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang olai\nShip the agent ^agent\n"
        f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "done" "--json" "--no-commit" "--file" (path->string f)
                "^agent")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'title) "Ship the agent")
       (check-false (equal? (hash-ref j 'title) "^agent")))
     (λ () (delete-directory/files dir)))))
