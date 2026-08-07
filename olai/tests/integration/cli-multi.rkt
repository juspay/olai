#lang racket/base

;; More than one file on the command line — and `daily`, which is the command
;; that writes across two of them at once. Real subprocess (cli-util.rkt),
;; temp dirs only.

(require racket/file
         racket/port
         racket/string
         racket/system
         "cli-util.rkt")

(module+ test
  (require rackunit))

(module+ test
  (test-case "multi-file check: both ok + one-good-one-bad"
    (define dir (make-temporary-file "sfmulti~a" 'directory))
    (define good (build-path dir "good.rkt"))
    (define bad (build-path dir "bad.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nA\n" good #:exists 'truncate)
       (display-to-file "#lang olai\nB\n" (build-path dir "other.rkt")
                        #:exists 'truncate)
       (define other (build-path dir "other.rkt"))
       (define-values (c1 o1 e1)
         (run-olai
          (list "check" "--json"
                (path->string good) (path->string other))))
       (check-equal? c1 0 (string-append o1 e1))
       (define j1 (parse-json o1))
       (check-equal? (hash-ref j1 'ok) #t)
       (check-true (list? (hash-ref j1 'files)))
       (check-equal? (length (hash-ref j1 'files)) 2)
       ;; one bad
       (display-to-file "#lang olai\nX\n  @date bogus\n" bad
                        #:exists 'truncate)
       (define-values (c2 o2 e2)
         (run-olai
          (list "check" "--json"
                (path->string good) (path->string bad))))
       (check-equal? c2 2)
       (define j2 (parse-json o2))
       (check-equal? (hash-ref j2 'ok) #f)
       (define files (hash-ref j2 'files))
       (check-equal? (length files) 2)
       (check-equal? (hash-ref (car files) 'ok) #t)
       (check-equal? (hash-ref (cadr files) 'ok) #f)
       ;; per-file errors ride the array on stdout; stderr stays empty
       (check-equal? (string-trim e2) "" e2)
       (define err2 (hash-ref (cadr files) 'error))
       (check-true (hash-has-key? err2 'message))
       (check-true (regexp-match? #rx"(?i:date)" (hash-ref err2 'message))
                   (hash-ref err2 'message)))
     (λ () (delete-directory/files dir))))

  (test-case "multi-file tree JSON shape"
    (define dir (make-temporary-file "sftree2~a" 'directory))
    (define a (build-path dir "a.rkt"))
    (define b (build-path dir "b.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nA\n" a #:exists 'truncate)
       (display-to-file "#lang olai\nB\n" b #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "tree" (path->string a) (path->string b))))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'version) 1)
       (check-true (list? (hash-ref j 'files)))
       (check-equal? (length (hash-ref j 'files)) 2)
       (check-false (hash-has-key? j 'tasks)))
     (λ () (delete-directory/files dir))))

  (test-case "multi-file agenda merges with file-rooted breadcrumbs"
    (define dir (make-temporary-file "sfag~a" 'directory))
    (define a (build-path dir "Tasks.rkt"))
    (define b (build-path dir "Roadmap.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang olai\nMilk\n  @date 2026-07-01\n"
        a #:exists 'truncate)
       (display-to-file
        "#lang olai\nLater\n  @date 2026-12-01\n"
        b #:exists 'truncate)
       (define-values (code out err)
         (run-olai
          (list "agenda" "--json" (path->string a) (path->string b))))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (define ov (car (hash-ref j 'overdue)))
       (define up (car (hash-ref j 'upcoming)))
       (check-true (string-contains? (hash-ref ov 'breadcrumb) "Tasks.rkt")
                   (hash-ref ov 'breadcrumb))
       (check-true (string-contains? (hash-ref up 'breadcrumb) "Roadmap.rkt")
                   (hash-ref up 'breadcrumb)))
     (λ () (delete-directory/files dir))))

  ;; The set is what an anchor's scope is, so the paths on the command line
  ;; are what a `*mirror` may reach — and a set that does not link fails as a
  ;; set: every file is fine, the reply is not.
  (test-case "cross-file mirror: linked as a set, refused one at a time"
    (define dir (make-temporary-file "sfxfile~a" 'directory))
    (define tasks-file (build-path dir "Tasks.rkt"))
    (define daily (build-path dir "Daily.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nMeeting prep ^meeting-prep\n  @date 2026-07-01\n"
                        tasks-file #:exists 'truncate)
       (display-to-file "#lang olai\n2026-08-06\n  *meeting-prep\n"
                        daily #:exists 'truncate)
       ;; both files: the set links
       (define-values (c1 o1 e1)
         (run-olai (list "check" (path->string tasks-file) (path->string daily))))
       (check-equal? c1 0 (string-append o1 e1))
       (check-equal? (hash-ref (parse-json o1) 'ok) #t)

       ;; the tree carries one anchors index over the set, and the site stays
       ;; a reference to it
       (define-values (c2 o2 e2)
         (run-olai (list "tree" (path->string tasks-file) (path->string daily))))
       (check-equal? c2 0 (string-append o2 e2))
       (define j (parse-json o2))
       (define anchored (hash-ref (hash-ref j 'anchors) 'meeting-prep))
       (check-true (string-contains? (hash-ref anchored 'file) "Tasks.rkt")
                   (hash-ref anchored 'file))
       (define day (car (hash-ref (cadr (hash-ref j 'files)) 'tasks)))
       (check-equal? (hash-ref (car (hash-ref day 'children)) 'mirror)
                     "meeting-prep")

       ;; one node, so one agenda item
       (define-values (c3 o3 e3)
         (run-olai (list "agenda" (path->string tasks-file) (path->string daily))))
       (check-equal? c3 0 (string-append o3 e3))
       (check-equal? (length (hash-ref (parse-json o3) 'overdue)) 1)

       ;; checking it off from the file that only MIRRORS it edits the file
       ;; that defines it
       (define-values (c4 o4 e4)
         (run-olai (list "done" "--no-commit" "--file" (path->string daily)
                         "^meeting-prep")))
       (check-equal? c4 0 (string-append o4 e4))
       (check-true (string-contains? (hash-ref (parse-json o4) 'file) "Tasks.rkt")
                   o4)
       (check-true (string-contains? (file->string tasks-file) "@done") o4)

       ;; and the mirroring file alone is a set of one: the anchor is not in it
       (define-values (c5 o5 e5) (run-olai (list "check" (path->string daily))))
       (check-equal? c5 2 (string-append o5 e5))
       (define err (hash-ref (parse-json e5) 'error))
       (check-true (regexp-match? #rx"unknown \\*meeting-prep"
                                  (hash-ref err 'message))
                   (hash-ref err 'message))
       (check-true (string-contains? (hash-ref err 'file) "Daily.rkt")
                   (hash-ref err 'file))
       (check-equal? (hash-ref err 'line) 3))
     (λ () (delete-directory/files dir))))

  ;; Two files that each parse and still do not make a set. The failure is the
  ;; reply's, not any one file's.
  (test-case "multi-file check: a set that does not link"
    (define dir (make-temporary-file "sflink~a" 'directory))
    (define a (build-path dir "a.rkt"))
    (define b (build-path dir "b.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang olai\nWork ^agent\n" a #:exists 'truncate)
       (display-to-file "#lang olai\nAlso ^agent\n" b #:exists 'truncate)
       (define-values (code out err)
         (run-olai (list "check" (path->string a) (path->string b))))
       (check-equal? code 2 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'ok) #f)
       ;; each file is fine on its own terms
       (for ([f (in-list (hash-ref j 'files))])
         (check-equal? (hash-ref f 'ok) #t))
       (define e (hash-ref j 'error))
       (check-true (regexp-match? #rx"duplicate \\^agent" (hash-ref e 'message))
                   (hash-ref e 'message))
       (check-true (string-contains? (hash-ref e 'file) "b.rkt")
                   (hash-ref e 'file)))
     (λ () (delete-directory/files dir))))

  ;; daily used to be the one write command that changed the outline behind
  ;; git's back; the day and the @include that reaches it are one commit.
  (test-case "daily auto-commits in a git repo"
    (define home (make-temporary-file "sfdailygit~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (parameterize ([current-directory home])
         (system* (find-executable-path "git") "init" "-q")
         (system* (find-executable-path "git") "config" "user.email" "t@t.test")
         (system* (find-executable-path "git") "config" "user.name" "t")
         (display-to-file "#lang olai\n" (build-path home "Daily.rkt")
                          #:exists 'truncate)
         (system* (find-executable-path "git") "add" "Daily.rkt")
         (system* (find-executable-path "git") "commit" "-q" "-m" "init"))
       (define-values (code out err)
         (run-olai
          (list "daily" "--json" "--home" (path->string home)
                "--date" "2026-08-04")))
       (check-equal? code 0 (string-append out err))
       (define j (parse-json out))
       (check-equal? (hash-ref j 'committed) #t)
       (define (log-subjects)
         (with-output-to-string
           (λ ()
             (parameterize ([current-directory home])
               (system* (find-executable-path "git") "log" "--pretty=%s")))))
       (check-true (string-contains? (log-subjects) "daily: 2026-08-04")
                   (log-subjects))
       ;; the fragment and the root it is included from land in ONE commit
       (check-equal? (length (regexp-match* #rx"daily: 2026-08-04" (log-subjects)))
                     1)
       (define dirty
         (with-output-to-string
           (λ ()
             (parameterize ([current-directory home])
               (system* (find-executable-path "git") "status" "--porcelain")))))
       (check-equal? (string-trim dirty) "" dirty)
       ;; nothing to do the second time: nothing to commit either
       (define-values (c2 o2 e2)
         (run-olai
          (list "daily" "--json" "--home" (path->string home)
                "--date" "2026-08-04")))
       (check-equal? c2 0 (string-append o2 e2))
       (check-equal? (hash-ref (parse-json o2) 'committed) #f)
       ;; and --no-commit leaves the change uncommitted
       (define-values (c3 o3 e3)
         (run-olai
          (list "daily" "--json" "--no-commit" "--home" (path->string home)
                "--date" "2026-08-05")))
       (check-equal? c3 0 (string-append o3 e3))
       (check-equal? (hash-ref (parse-json o3) 'committed) #f))
     (λ () (delete-directory/files home)))))
