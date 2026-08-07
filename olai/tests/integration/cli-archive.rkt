#lang racket/base

;; The `archive` path end to end: what the CLI answers, what the two files say
;; afterwards, and what git got. Real subprocess (cli-util.rkt), temp dirs only.

(require json
         racket/file
         racket/port
         racket/string
         "cli-util.rkt")

(module+ test
  (require rackunit))

(module+ test
  (define (in-repo name proc)
    (define dir (make-temporary-file (string-append name "~a") 'directory))
    (dynamic-wind
     void
     (λ ()
       (parameterize ([current-directory dir])
         (git "init" "-q")
         (git "config" "user.email" "t@t.test")
         (git "config" "user.name" "t"))
       (proc dir))
     (λ () (delete-directory/files dir))))

  (define (write-outline dir name body)
    (define p (build-path dir name))
    (display-to-file body p #:exists 'truncate/replace)
    p)

  (define (commit-all dir)
    (parameterize ([current-directory dir])
      (git "add" "-A")
      (git "commit" "-q" "-m" "init"))))

(module+ test
  (test-case "archive moves the subtree, keeps the chain, commits both files"
    (in-repo
     "olai-cli-archive"
     (λ (dir)
       (define tasks
         (write-outline dir "Tasks.rkt"
                        (string-append "#lang olai\n"
                                       "kitchen remodel ^kitchen\n"
                                       "  install\n"
                                       "    @done 2026-08-01\n"
                                       "    [x] pick tiles\n"
                                       "  paint\n")))
       (commit-all dir)
       (define-values (code out err)
         (run-olai (list "archive" "--file" (path->string tasks) "install")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'ok) #t)
       (check-equal? (hash-ref j 'title) "install")
       (check-equal? (hash-ref j 'ancestors) '("kitchen remodel"))
       (check-equal? (hash-ref j 'created_archive) #t)
       (check-equal? (hash-ref j 'committed) #t)
       (check-equal? (hash-ref j 'from) (path->string tasks))
       (define archive (hash-ref j 'file))
       (check-true (string-suffix? archive "Archive.rkt") archive)
       ;; the working file lost the node and kept the parent
       (define left (file->string tasks))
       (check-false (string-contains? left "install") left)
       (check-true (string-contains? left "kitchen remodel ^kitchen") left)
       ;; the archive holds it under a scaffold, its state and children intact
       (define text (file->string archive))
       (check-true (string-contains? text "kitchen remodel") text)
       (check-true (string-contains? text "@done 2026-08-01") text)
       (check-true (string-contains? text "pick tiles") text)
       ;; one change, one commit, naming what moved
       (check-true (string-contains? (git-subject dir) "archive: install")
                   (git-subject dir))
       ;; and both files are in it
       (define touched (committed-files dir))
       (check-true (and (member "Tasks.rkt" touched) #t) (format "~a" touched))
       (check-true (and (member "Archive.rkt" touched) #t) (format "~a" touched))
       (define-values (c2 o2 e2)
         (run-olai (list "check" (path->string tasks) archive)))
       (check-equal? c2 0 (string-append o2 e2))
       ;; the node reads from the archive now, and the JSON says which file
       (define-values (c3 o3 e3)
         (run-olai (list "tree" (path->string tasks) archive)))
       (check-equal? c3 0 e3)
       (define moved
         (for/or ([f (in-list (hash-ref (parse-json o3) 'files))])
           (find-node (hash-ref f 'tasks) "install")))
       (check-true (hash? moved) o3)
       (check-equal? (hash-ref moved 'status) "done"))))

  ;; The reason this feature waited for the linker: an ^anchor that moves into
  ;; the archive goes on resolving from the live files that mirror it.
  (test-case "a live file's mirror of an archived node still resolves"
    (in-repo
     "olai-cli-archive-mirror"
     (λ (dir)
       (define tasks
         (write-outline dir "Tasks.rkt" "#lang olai\nShip the server ^serve\n"))
       (define week
         (write-outline dir "Week.rkt" "#lang olai\nNext week\n  *serve\n"))
       (commit-all dir)
       (define-values (code out err)
         (run-olai (list "archive" "--file" (path->string tasks) "^serve")))
       (check-equal? code 0 (string-append out err))
       (define archive (hash-ref (parse-json out) 'file))
       ;; the set that holds the archive links; the one that does not, does not
       (define-values (c2 o2 e2)
         (run-olai (list "check" (path->string tasks) (path->string week) archive)))
       (check-equal? c2 0 (string-append o2 e2))
       (define-values (c3 o3 e3)
         (run-olai (list "check" (path->string tasks) (path->string week))))
       (check-equal? c3 2 o3)
       (check-true (string-contains? o3 "unknown *serve") o3)
       ;; and the anchor is the archive's node now
       (define-values (c4 o4 _e4)
         (run-olai (list "tree" (path->string tasks) (path->string week) archive)))
       (check-equal? c4 0 o4)
       (define anchor (hash-ref (hash-ref (parse-json o4) 'anchors) 'serve))
       (check-equal? (hash-ref anchor 'title) "Ship the server")
       (check-true (string-suffix? (hash-ref anchor 'file) "Archive.rkt")
                   (hash-ref anchor 'file)))))

  (test-case "archived work is off the agenda and still in the tree"
    (in-repo
     "olai-cli-archive-agenda"
     (λ (dir)
       (define tasks
         (write-outline dir "Tasks.rkt"
                        (string-append "#lang olai\n"
                                       "Inbox\n"
                                       "  Buy milk\n"
                                       "    @date 2026-01-15\n")))
       (define-values (code out err)
         (run-olai (list "archive" "--no-commit" "--file" (path->string tasks)
                         "Buy milk")))
       (check-equal? code 0 (string-append out err))
       (check-equal? (hash-ref (parse-json out) 'committed) #f)
       (define archive (hash-ref (parse-json out) 'file))
       (define-values (c2 o2 e2) (run-olai (list "agenda" (path->string tasks) archive)))
       (check-equal? c2 0 e2)
       (define ag (parse-json o2))
       (check-equal? (hash-ref ag 'overdue) '())
       (check-equal? (hash-ref ag 'today_items) '())
       ;; still loaded, still keyed, just not an answer to "what is on my plate"
       (define-values (c3 o3 e3) (run-olai (list "tree" archive)))
       (check-equal? c3 0 e3)
       (define milk (find-node (hash-ref (parse-json o3) 'tasks) "Buy milk"))
       (check-true (hash? milk) o3)
       (check-true (string? (hash-ref milk 'key))))))

  (test-case "archive with no match exits 2 and writes nothing"
    (in-repo
     "olai-cli-archive-miss"
     (λ (dir)
       (define tasks (write-outline dir "Tasks.rkt" "#lang olai\nOnly\n"))
       (define-values (code out err)
         (run-olai (list "archive" "--no-commit" "--file" (path->string tasks)
                         "Missing")))
       (check-equal? code 2 (string-append out err))
       (define msg (hash-ref (hash-ref (parse-json err) 'error) 'message))
       (check-true (regexp-match? #px"(?i:no task)" msg) msg)
       (check-equal? (file->string tasks) "#lang olai\nOnly\n")
       (check-false (file-exists? (build-path dir "Archive.rkt")))))))
