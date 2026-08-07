#lang racket/base

;; Flat-record JSONL: load, check, write, link with .rkt.

(require racket/file
         racket/path
         racket/string
         json
         rackunit
         (except-in olai/lang/expander #%module-begin)
         olai/lang/jsonl
         olai/jsonl-edit
         olai/load
         olai/ops
         olai/paths
         ;; outlines on disk
         olai/tests/outlines)

(module+ test

  (define (write-jsonl dir name body)
    (write-outline dir name body))

  (test-case "load a minimal jsonl tree"
    (in-dir
     "olai-jsonl-min"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          (string-append
           "{\"id\":\"root\",\"ord\":\"a0\",\"title\":\"Root #tag\"}\n"
           "{\"id\":\"kid\",\"parent\":\"root\",\"ord\":\"a0\",\"title\":\"Child\",\"done\":true}\n")))
       (define r (try-load-outline p))
       (check-true (outline? r) (format "~a" r))
       (check-equal? (length (outline-tasks r)) 1)
       (define root (car (outline-tasks r)))
       (check-equal? (task-title root) "Root #tag")
       (check-equal? (task-key root) "root")
       (check-equal? (task-id root) "root")
       (check-equal? (task-tags root) '("tag"))
       (check-equal? (length (task-children root)) 1)
       (define kid (car (task-children root)))
       (check-equal? (task-key kid) "kid")
       (check-equal? (task-done kid) #t)
       (check-equal? (task-status root) 'done) ; derived
       (check-true (task-status-derived? root))
       ;; srcloc fidelity: root is line 1, kid line 2
       (check-equal? (srcloc-line (task-loc root)) 1)
       (check-equal? (srcloc-line (task-loc kid)) 2)
       (check-equal? (srcloc-column (task-loc root)) 0))))

  (test-case "duplicate id is a load error at the second line"
    (in-dir
     "olai-jsonl-dup"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          (string-append
           "{\"id\":\"a\",\"ord\":\"a0\",\"title\":\"One\"}\n"
           "{\"id\":\"a\",\"ord\":\"a1\",\"title\":\"Two\"}\n")))
       (define r (try-load-outline p))
       (check-true (load-error? r) (format "~a" r))
       (check-true (string-contains? (load-error-message r) "duplicate id")
                   (load-error-message r))
       (check-equal? (load-error-line r) 2))))

  (test-case "unknown parent is a load error"
    (in-dir
     "olai-jsonl-parent"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          "{\"id\":\"a\",\"parent\":\"nope\",\"ord\":\"a0\",\"title\":\"Orphan\"}\n"))
       (define r (try-load-outline p))
       (check-true (load-error? r))
       (check-true (string-contains? (load-error-message r) "unknown parent")
                   (load-error-message r)))))

  (test-case "unknown mirror is a linker error with srcloc"
    (in-dir
     "olai-jsonl-mirror"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          (string-append
           "{\"id\":\"root\",\"ord\":\"a0\",\"title\":\"Root\"}\n"
           "{\"id\":\"m1\",\"parent\":\"root\",\"ord\":\"a0\",\"mirror\":\"missing\"}\n")))
       (define-values (where msg) (error-of (load-set (list p))))
       (check-true (string-contains? where "T.jsonl") where)
       (check-true (string-contains? where ":2:") where)
       (check-true (regexp-match? #px"unknown \\*missing" msg) msg))))

  (test-case "mirror resolves across .rkt and .jsonl in one set"
    (in-dir
     "olai-jsonl-cross"
     (λ (dir)
       (define rkt
         (write-outline dir "Tasks.rkt"
                        "#lang olai\nMeeting prep ^meeting-prep\n  slides\n"))
       (define jl
         (write-jsonl
          dir "Daily.jsonl"
          (string-append
           "{\"id\":\"today\",\"ord\":\"a0\",\"title\":\"2026-08-06\"}\n"
           "{\"id\":\"site\",\"parent\":\"today\",\"ord\":\"a0\",\"mirror\":\"meeting-prep\"}\n")))
       (define lk (linked-or-fail (load-set (list rkt jl))))
       ;; every jsonl task id is an anchor; the .rkt one too
       (check-true (hash-has-key? (linked-anchors lk) "meeting-prep"))
       (check-true (hash-has-key? (linked-anchors lk) "today"))
       (define target (hash-ref (linked-anchors lk) "meeting-prep"))
       (check-true (string-suffix? (task-file target) "Tasks.rkt")
                   (task-file target)))))

  (test-case "done above open children is refused"
    (in-dir
     "olai-jsonl-derived"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          (string-append
           "{\"id\":\"p\",\"ord\":\"a0\",\"title\":\"Parent\",\"done\":true}\n"
           "{\"id\":\"c\",\"parent\":\"p\",\"ord\":\"a0\",\"title\":\"Open child\"}\n")))
       (define r (try-load-outline p))
       (check-true (load-error? r) (format "~a" r))
       (check-true (regexp-match? #px"@done|done" (load-error-message r))
                   (load-error-message r)))))

  (test-case "typed edge unknown target is a linker error"
    (in-dir
     "olai-jsonl-edge"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          "{\"id\":\"a\",\"ord\":\"a0\",\"title\":\"A\",\"after\":[\"ghost\"]}\n"))
       (define-values (where msg) (error-of (load-set (list p))))
       (check-true (string-contains? where ":1:") where)
       (check-true (regexp-match? #px"unknown \\^ghost" msg) msg))))

  (test-case "ops-mark! and ops-add! on jsonl"
    (in-dir
     "olai-jsonl-ops"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          (string-append
           "{\"id\":\"inbox\",\"ord\":\"a0\",\"title\":\"Inbox\"}\n"
           "{\"id\":\"milk\",\"parent\":\"inbox\",\"ord\":\"a0\",\"title\":\"Buy milk\"}\n")))
       (define m (ops-mark! p 'done "^milk" "2026-08-07" #:commit? #f))
       (check-equal? (mark-result-title m) "Buy milk")
       (check-false (mark-result-undone? m))
       (define r (try-load-outline p))
       (check-true (outline? r))
       (define milk
         (hash-ref (outline-anchors r) "milk"))
       (check-equal? (task-done milk) "2026-08-07")
       (define a (ops-add! p "Eggs" #:parent "^inbox" #:commit? #f))
       (check-equal? (add-result-title a) "Eggs")
       (define r2 (try-load-outline p))
       (define inbox (hash-ref (outline-anchors r2) "inbox"))
       (check-equal? (length (task-children inbox)) 2))))

  (test-case "ops-move! sets and clears date on jsonl"
    (in-dir
     "olai-jsonl-move"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          "{\"id\":\"t\",\"ord\":\"a0\",\"title\":\"Thing\"}\n"))
       (define mv (ops-move! p "^t" "2026-08-10" #:commit? #f))
       (check-equal? (move-result-date mv) "2026-08-10")
       (define r (try-load-outline p))
       (check-equal? (task-date (car (outline-tasks r))) "2026-08-10")
       (define cl (ops-move! p "^t" #f #:clear? #t #:commit? #f))
       (check-equal? (move-result-date cl) #f)
       (define r2 (try-load-outline p))
       (check-equal? (task-date (car (outline-tasks r2))) #f))))

  (test-case "archive on jsonl is refused clearly"
    (in-dir
     "olai-jsonl-arch"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          "{\"id\":\"t\",\"ord\":\"a0\",\"title\":\"Thing\"}\n"))
       (check-exn
        (λ (e)
          (and (exn:fail:op? e)
               (string-contains? (exn-message e) "jsonl")))
        (λ () (ops-archive! p "^t" #:commit? #f))))))

  (test-case "dir-roots finds jsonl and prefer-jsonl drops rkt twin"
    (in-dir
     "olai-jsonl-roots"
     (λ (dir)
       (write-outline dir "Same.rkt" "#lang olai\nOnly rkt ^only-rkt\n")
       (write-jsonl dir "Same.jsonl"
                    "{\"id\":\"only-jsonl\",\"ord\":\"a0\",\"title\":\"Only jsonl\"}\n")
       (write-jsonl dir "Other.jsonl"
                    "{\"id\":\"other\",\"ord\":\"a0\",\"title\":\"Other\"}\n")
       (define files (outline-files (files-named dir)))
       (define names
         (map (λ (p) (path->string (file-name-from-path p))) files))
       (check-true (and (member "Same.jsonl" names) #t) (format "~a" names))
       (check-false (and (member "Same.rkt" names) #t) (format "~a" names))
       (check-true (and (member "Other.jsonl" names) #t) (format "~a" names))
       (define lk (linked-or-fail (load-set files)))
       (check-true (hash-has-key? (linked-anchors lk) "only-jsonl"))
       (check-false (hash-has-key? (linked-anchors lk) "only-rkt")))))

  (test-case "Roadmap.jsonl loads as the repo demo"
    ;; collection-file-path finds the package; the worktree root is two up
    ;; from olai/info.rkt (olai/ → repo root).
    (define repo
      (simplify-path
       (build-path (collection-file-path "info.rkt" "olai") 'up 'up)))
    (define p (build-path repo "docs" "olai" "Roadmap.jsonl"))
    (define r (try-load-outline p))
    (check-true (outline? r) (format "~a" r))
    (check-true (hash-has-key? (outline-anchors r) "daily-calendar"))
    (check-true (hash-has-key? (outline-anchors r) "serve-one-root"))
    (define cal (hash-ref (outline-anchors r) "daily-calendar"))
    (check-equal? (task-status cal) 'doing)
    (define lk (linked-or-fail (load-set (list p))))
    (check-true (hash-has-key? (linked-anchors lk) "daily-calendar")))

  (test-case "record->line keeps canonical key order"
    (define line
      (record->line
       (hash 'done #t 'title "T" 'id "x" 'ord "a0" 'parent "p")))
    (define j (string->jsexpr line))
    (check-equal? (hash-ref j 'id) "x")
    (check-equal? (hash-ref j 'done) #t)
    ;; key order in the string: id before parent before ord before title before done
    (define id-pos (regexp-match-positions #px"\"id\"" line))
    (define parent-pos (regexp-match-positions #px"\"parent\"" line))
    (define ord-pos (regexp-match-positions #px"\"ord\"" line))
    (define title-pos (regexp-match-positions #px"\"title\"" line))
    (define done-pos (regexp-match-positions #px"\"done\"" line))
    (check-true (< (caar id-pos) (caar parent-pos)))
    (check-true (< (caar parent-pos) (caar ord-pos)))
    (check-true (< (caar ord-pos) (caar title-pos)))
    (check-true (< (caar title-pos) (caar done-pos))))

  (test-case "check-written validates a jsonl temp rewrite"
    (in-dir
     "olai-jsonl-write"
     (λ (dir)
       (define p
         (write-jsonl
          dir "T.jsonl"
          "{\"id\":\"t\",\"ord\":\"a0\",\"title\":\"Thing\"}\n"))
       (define err
         (check-written
          (list p)))
       (check-false err)
       ;; bad rewrite: done above open
       (define bad
         (string-append
          "{\"id\":\"p\",\"ord\":\"a0\",\"title\":\"P\",\"done\":true}\n"
          "{\"id\":\"c\",\"parent\":\"p\",\"ord\":\"a0\",\"title\":\"C\"}\n"))
       (define tmp (build-path dir "bad.jsonl"))
       (display-to-file bad tmp #:exists 'truncate/replace)
       (define err2 (check-written (list tmp)))
       (check-true (load-error? err2) (format "~a" err2))))))
