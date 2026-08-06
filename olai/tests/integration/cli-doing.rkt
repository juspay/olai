#lang racket/base

;; The `doing` path: the round trip, what `done` does to a node already in
;; flight, and what a miss tells the user. Real subprocess (cli-util.rkt),
;; temp dirs only.
;;
;; Every write here is re-validated by the CLI on the way out, which is what
;; makes "done clears doing" more than a text edit: a file left carrying both
;; marks is a form the language rejects, so the op would fail rather than
;; write it.

(require rackunit
         json
         racket/file
         racket/string
         "cli-util.rkt")

(module+ test
  (test-case "doing / undo round-trip with git commit"
    (define dir (make-temporary-file "sfdoing~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (parameterize ([current-directory dir])
         (git "init" "-q")
         (git "config" "user.email" "t@t.test")
         (git "config" "user.name" "t")
         (display-to-file
          "#lang olai\n\nInbox\n  Ship it\n    @date 2026-08-01\n"
          f #:exists 'truncate)
         (git "add" "Tasks.rkt")
         (git "commit" "-q" "-m" "init"))
       (define-values (code out err)
         (run-olai
          (list "doing" "--json" "--file" (path->string f) "Ship" "it")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'ok) #t)
       (check-equal? (hash-ref j 'title) "Ship it")
       (check-equal? (hash-ref j 'undone) #f)
       (check-equal? (hash-ref j 'committed) #t)
       (check-true (string? (hash-ref j 'doing)))
       (check-true (string-contains? (file->string f) "@doing "))
       (check-true (string-contains? (git-subject dir) "doing: Ship it"))

       ;; tree JSON carries the mark and what it means
       (define-values (c2 o2 e2) (run-olai (list "tree" (path->string f))))
       (check-equal? c2 0 e2)
       (define ship (find-node (hash-ref (parse-json o2) 'tasks) "Ship it"))
       (check-true (string? (hash-ref ship 'doing)))
       (check-equal? (hash-ref ship 'done) (json-null))
       (check-equal? (hash-ref ship 'status) "doing")

       ;; and the agenda moves it out of its date bucket into DOING
       (define-values (c3 o3 e3) (run-olai (list "agenda" (path->string f))))
       (check-equal? c3 0 e3)
       (define ag (parse-json o3))
       (check-equal? (map (λ (i) (hash-ref i 'title)) (hash-ref ag 'doing))
                     '("Ship it"))
       (check-equal? (hash-ref ag 'overdue) '())
       (check-equal? (hash-ref (car (hash-ref ag 'doing)) 'status) "doing")

       ;; undo
       (define-values (c4 o4 e4)
         (run-olai
          (list "doing" "--json" "--undo" "--file" (path->string f) "Ship it")))
       (check-equal? c4 0 (string-append o4 e4))
       (define j4 (parse-json o4))
       (check-equal? (hash-ref j4 'undone) #t)
       (check-equal? (hash-ref j4 'doing) (json-null))
       (check-false (string-contains? (file->string f) "@doing"))
       (check-true (string-contains? (git-subject dir) "not-doing: Ship it")))
     (λ () (delete-directory/files dir))))

  ;; Both spellings, because both are what a person's editor leaves behind.
  (test-case "done clears doing, field or checkbox"
    (define dir (make-temporary-file "sfdoingdone~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (for ([src (in-list (list "#lang olai\nShip it\n  : note\n  @doing 2026-08-01\n"
                                 "#lang olai\n[/] Ship it\n  : note\n"))])
         (display-to-file src f #:exists 'truncate)
         (define-values (code out err)
           (run-olai
            (list "done" "--json" "--no-commit" "--file" (path->string f)
                  "Ship it")))
         (check-equal? code 0 (string-append out err))
         (define text (file->string f))
         (check-false (string-contains? text "@doing") text)
         (check-false (string-contains? text "[/]") text)
         (check-true (string-contains? text "@done ") text)
         ;; the note is untouched: this is a metadata edit, not a rewrite
         (check-true (string-contains? text "  : note\n") text)
         ;; and the file still loads, in exactly one state
         (define-values (c2 o2 e2) (run-olai (list "tree" (path->string f))))
         (check-equal? c2 0 e2)
         (define ship (find-node (hash-ref (parse-json o2) 'tasks) "Ship it"))
         (check-equal? (hash-ref ship 'status) "done")
         (check-equal? (hash-ref ship 'doing) (json-null))))
     (λ () (delete-directory/files dir))))

  ;; A sentence about their outline, not the name of the function that
  ;; noticed.
  (test-case "doing says no in user language"
    (define dir (make-temporary-file "sfredoing~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (define (fails-with src args rx)
         (display-to-file src f #:exists 'truncate)
         (define-values (code out err)
           (run-olai (append (list "doing" "--json" "--no-commit"
                                   "--file" (path->string f))
                             args)))
         (check-equal? code 2 (string-append out err))
         (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
         (check-true (regexp-match? rx msg) msg)
         (check-false (string-contains? msg "-in-text") msg))
       ;; already in flight
       (fails-with "#lang olai\nShip it\n  @doing 2026-08-01\n"
                   '("Ship it") #px"(?i:already doing)")
       ;; a done node is refused rather than reopened
       (fails-with "#lang olai\n[x] Ship it\n"
                   '("Ship it") #px"(?i:already done)")
       ;; and nothing to undo
       (fails-with "#lang olai\nShip it\n"
                   '("--undo" "Ship it") #px"(?i:not doing)"))
     (λ () (delete-directory/files dir))))

  (test-case "doing no match exits 2"
    (define dir (make-temporary-file "sfdoingmiss~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nOnly\n" f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "doing" "--json" "--no-commit" "--file" (path->string f)
                "Missing")))
       (check-equal? code 2)
       (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
       (check-true (regexp-match? #px"(?i:no task)" msg) msg))
     (λ () (delete-directory/files dir))))

  (test-case "doing ^anchor reports the resolved title"
    (define dir (make-temporary-file "sfdoinganch~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nShip the agent ^agent\n"
                        f #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "doing" "--json" "--no-commit" "--file" (path->string f)
                "^agent")))
       (check-equal? code 0 (string-append out err))
       (check-equal? (hash-ref (parse-json out) 'title) "Ship the agent"))
     (λ () (delete-directory/files dir)))))
