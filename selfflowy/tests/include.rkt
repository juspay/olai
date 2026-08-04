#lang racket/base

(require rackunit
         racket/file
         racket/path
         racket/string
         racket/port
         json
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/json-out
         selfflowy/done
         selfflowy/daily)

(define (write-outline dir name body)
  (define p (build-path dir name))
  (make-parent-directory* p)
  (display-to-file body p #:exists 'truncate/replace)
  p)

(define (make-parent-directory* path)
  (define-values (base name dir?) (split-path path))
  (when (path? base) (make-directory* base)))

(define (load-tasks path)
  (dynamic-require `(file ,(path->string path)) 'tasks))

(define (load-includes path)
  (dynamic-require `(file ,(path->string path)) 'includes))

(module+ test
  (test-case "include splices fragment top-level tasks"
    (define dir (make-temporary-file "sfincl~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt"
                      "#lang selfflowy\nDayA\n  child\nDayB\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang selfflowy\nParent\n  @include frag.rkt\n"))
       (define tasks (load-tasks root))
       (check-equal? (length tasks) 1)
       (define parent (car tasks))
       (check-equal? (task-title parent) "Parent")
       (check-equal? (map task-title (task-children parent))
                     '("DayA" "DayB"))
       (define day-a (car (task-children parent)))
       (check-equal? (task-title (car (task-children day-a))) "child")
       ;; defining file is the fragment
       (check-true (string-suffix? (task-file day-a) "frag.rkt")
                   (task-file day-a))
       (define incs (load-includes root))
       (check-equal? (length incs) 1)
       (check-true (string-suffix? (car incs) "frag.rkt")))
     (λ () (delete-directory/files dir))))

  (test-case "include missing file is error"
    (define dir (make-temporary-file "sfmiss~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (define root
         (write-outline dir "root.rkt"
                        "#lang selfflowy\nX\n  @include no-such.rkt\n"))
       (check-exn
        (λ (e) (regexp-match? #px"file not found|no-such" (exn-message e)))
        (λ () (load-tasks root))))
     (λ () (delete-directory/files dir))))

  (test-case "include cycle error"
    (define dir (make-temporary-file "sfcyc~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "a.rkt"
                      "#lang selfflowy\nA\n  @include b.rkt\n")
       (write-outline dir "b.rkt"
                      "#lang selfflowy\nB\n  @include a.rkt\n")
       (check-exn
        (λ (e) (regexp-match? #px"include cycle" (exn-message e)))
        (λ () (load-tasks (build-path dir "a.rkt")))))
     (λ () (delete-directory/files dir))))

  (test-case "cross-include anchors + duplicate"
    (define dir (make-temporary-file "sfanch~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt"
                      "#lang selfflowy\nWork ^agent\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang selfflowy\nWeek\n  @include frag.rkt\n  *agent\n"))
       (define tasks (load-tasks root))
       (define anchors (dynamic-require `(file ,(path->string root)) 'anchors))
       (check-true (hash-has-key? anchors "agent"))
       (define week (car tasks))
       (check-true (mirror-ref? (cadr (task-children week))))
       ;; duplicate across root + frag
       (write-outline dir "frag2.rkt"
                      "#lang selfflowy\nOther ^agent\n")
       (define root2
         (write-outline dir "root2.rkt"
                        "#lang selfflowy\n@include frag.rkt\n@include frag2.rkt\n"))
       (check-exn
        (λ (e) (regexp-match? #px"duplicate \\^agent" (exn-message e)))
        (λ () (load-tasks root2))))
     (λ () (delete-directory/files dir))))

  (test-case "JSON file field on included nodes"
    (define dir (make-temporary-file "sfjson~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt" "#lang selfflowy\nInFrag\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang selfflowy\nRoot\n  @include frag.rkt\n"))
       (define tasks (load-tasks root))
       (define j (outline->jsexpr root tasks (hash) #:includes '("/tmp/x")))
       (define kids (hash-ref (car (hash-ref j 'tasks)) 'children))
       (define frag-node (car kids))
       (check-true (hash-has-key? frag-node 'file))
       (check-true (string-suffix? (hash-ref frag-node 'file) "frag.rkt")
                   (hash-ref frag-node 'file))
       (check-false (hash-has-key? (car (hash-ref j 'tasks)) 'file)))
     (λ () (delete-directory/files dir))))

  (test-case "done routes to defining fragment file"
    (define dir (make-temporary-file "sfdone~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (define frag
         (write-outline dir "frag.rkt"
                        "#lang selfflowy\nShip it ^ship\n"))
       (define root
         (write-outline dir "root.rkt"
                        "#lang selfflowy\nP\n  @include frag.rkt\n"))
       (define root-before (file->string root))
       (define frag-before (file->string frag))
       ;; Simulate CLI routing: load root, find defining file, edit frag
       (define tasks (load-tasks root))
       (define anchors (dynamic-require `(file ,(path->string root)) 'anchors))
       (define tk (hash-ref anchors "ship"))
       (check-true (string-suffix? (task-file tk) "frag.rkt"))
       (define-values (new line)
         (mark-done-in-text (file->string frag) "^ship" "2026-08-04"))
       (display-to-file new frag #:exists 'truncate/replace)
       (check-equal? (file->string root) root-before)
       (check-true (string-contains? (file->string frag) "@done 2026-08-04"))
       (check-not-equal? (file->string frag) frag-before))
     (λ () (delete-directory/files dir))))

  (test-case "daily ensure month+day idempotent"
    (define home (make-temporary-file "sfdaily~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\n\nDaily notes ^daily\n  : scratch\n"
        (build-path home "Daily.rkt")
        #:exists 'truncate)
       (define r1 (ensure-daily-day! home "2026-08-04"))
       (check-equal? (hash-ref r1 'day) "2026-08-04")
       (check-true (hash-ref r1 'created_day))
       (check-true (file-exists? (build-path home "Daily/2026-08.rkt")))
       (define root (file->string (build-path home "Daily.rkt")))
       (check-true (string-contains? root "@include Daily/2026-08.rkt") root)
       (check-true (string-contains? root "2026") root)
       (check-true (string-contains? root "August") root)
       (define r2 (ensure-daily-day! home "2026-08-04"))
       (check-false (hash-ref r2 'created_day))
       (define n (count-tasks (load-tasks (build-path home "Daily.rkt"))))
       (check-true (>= n 3) (format "task count ~a" n))) ; notes + year + month + day
     (λ () (delete-directory/files home))))

  (test-case "migrate monolithic Daily.rkt"
    (define home (make-temporary-file "sfmig~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        (string-append
         "#lang selfflowy\n\n"
         "Daily notes ^daily\n"
         "  : note\n"
         "2026\n"
         "  July\n"
         "    2026-07-31\n"
         "      Wrap\n"
         "        Nested\n"
         "  August\n"
         "    2026-08-03\n"
         "      Setup\n"
         "    2026-08-04\n"
         "      Morning\n")
        (build-path home "Daily.rkt")
        #:exists 'truncate)
       (define counts (migrate-monolithic-daily! home))
       (check-equal? (length counts) 2)
       (check-equal? (car counts) (cadr counts)
                     (format "before=~a after=~a" (car counts) (cadr counts)))
       (check-true (file-exists? (build-path home "Daily/2026-07.rkt")))
       (check-true (file-exists? (build-path home "Daily/2026-08.rkt")))
       (define jul (file->string (build-path home "Daily/2026-07.rkt")))
       (check-true (string-contains? jul "2026-07-31") jul)
       (check-true (string-contains? jul "Nested") jul)
       (define root (file->string (build-path home "Daily.rkt")))
       (check-true (string-contains? root "@include Daily/2026-08.rkt") root)
       (check-false (string-contains? root "2026-07-31") root)
       (void (load-tasks (build-path home "Daily.rkt"))))
     (λ () (delete-directory/files home))))

  (test-case "sexp include form"
    (define dir (make-temporary-file "sfsexp~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt" "#lang selfflowy\nKid\n")
       (define root
         (write-outline
          dir "root.rkt"
          "#lang selfflowy/sexp\n(t \"P\" (include \"frag.rkt\"))\n"))
       (define tasks (load-tasks root))
       (check-equal? (map task-title (task-children (car tasks))) '("Kid")))
     (λ () (delete-directory/files dir)))))
