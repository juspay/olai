#lang racket/base

(require racket/file
         racket/path
         racket/string
         racket/port
         json
         (except-in olai/lang/expander #%module-begin)
         olai/load
         olai/json/model
         olai/json/reply
         (only-in olai/paths file-label)
         (only-in olai/query count-tasks)
         olai/status
         olai/daily)

(module+ test
  (require rackunit))

(module+ test
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

  (define (load-include-globs path)
    (dynamic-require `(file ,(path->string path)) 'include-globs))

  ;; What the language said about a form it refused, and where.
  (define (load-failure path)
    (define r (try-load-outline path))
    (check-true (load-error? r) (format "~a" r))
    (values (or (load-error-where r) "") (load-error-message r))))

(module+ test
  (test-case "include splices fragment top-level tasks"
    (define dir (make-temporary-file "sfincl~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt"
                      "#lang olai\nDayA\n  child\nDayB\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang olai\nParent\n  @include frag.rkt\n"))
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
                        "#lang olai\nX\n  @include no-such.rkt\n"))
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
                      "#lang olai\nA\n  @include b.rkt\n")
       (write-outline dir "b.rkt"
                      "#lang olai\nB\n  @include a.rkt\n")
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
                      "#lang olai\nWork ^agent\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang olai\nWeek\n  @include frag.rkt\n  *agent\n"))
       (define tasks (load-tasks root))
       (define anchors (dynamic-require `(file ,(path->string root)) 'anchors))
       (check-true (hash-has-key? anchors "agent"))
       (define week (car tasks))
       (check-true (mirror-ref? (cadr (task-children week))))
       ;; duplicate across root + frag
       (write-outline dir "frag2.rkt"
                      "#lang olai\nOther ^agent\n")
       (define root2
         (write-outline dir "root2.rkt"
                        "#lang olai\n@include frag.rkt\n@include frag2.rkt\n"))
       (check-exn
        (λ (e) (regexp-match? #px"duplicate \\^agent" (exn-message e)))
        (λ () (load-tasks root2))))
     (λ () (delete-directory/files dir))))

  ;; The graph rules are checked at run time once @include is in play, and
  ;; that is exactly when the diagnostic used to lose its srcloc: no
  ;; file:line:col, no anchor names. CLAUDE.md says errors carry the location
  ;; of the offending form — include mode included.
  (test-case "include-mode graph errors keep file:line:col and names"
    (define dir (make-temporary-file "sfloc~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (define (where+detail path)
         (define r (try-load-outline path))
         (check-true (load-error? r) (format "~a" r))
         (values (or (load-error-where r) "") (load-error-message r)))

       (write-outline dir "frag.rkt" "#lang olai\nWork ^agent\n")

       ;; duplicate anchor: the second declaration is in another fragment
       (write-outline dir "frag2.rkt" "#lang olai\nOther\n  Deep ^agent\n")
       (define dup
         (write-outline dir "dup.rkt"
                        "#lang olai\n@include frag.rkt\n@include frag2.rkt\n"))
       (define-values (where2 msg2) (where+detail dup))
       (check-true (string-contains? where2 "frag2.rkt") where2)
       (check-true (string-contains? where2 ":3:") where2)
       (check-true (regexp-match? #px"duplicate \\^agent" msg2) msg2)
       ;; naming where the first one was is the whole point
       (check-true (string-contains? msg2 "frag.rkt") msg2)

       ;; a cycle in a file that uses @include: the compile-time pass steps
       ;; aside there, so this is the runtime checker talking
       (write-outline dir "leaf.rkt" "#lang olai\nLeaf\n")
       (define cyc
         (write-outline dir "cyc.rkt"
                        (string-append "#lang olai\n"
                                       "@include leaf.rkt\n"
                                       "A ^a\n"
                                       "  *b\n"
                                       "B ^b\n"
                                       "  *a\n")))
       (define-values (where3 msg3) (where+detail cyc))
       (check-true (regexp-match? #px"a -> b -> a|b -> a -> b" msg3) msg3)
       (check-true (string-contains? where3 "cyc.rkt") where3)
       ;; the location is one of the two mirror lines, not "somewhere"
       (check-true (or (string-contains? where3 ":4:") (string-contains? where3 ":6:"))
                   where3))
     (λ () (delete-directory/files dir))))

  (test-case "JSON file field on included nodes"
    (define dir (make-temporary-file "sfjson~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt" "#lang olai\nInFrag\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang olai\nRoot\n  @include frag.rkt\n"))
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
                        "#lang olai\nShip it ^ship\n"))
       (define root
         (write-outline dir "root.rkt"
                        "#lang olai\nP\n  @include frag.rkt\n"))
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
        "#lang olai\n\nDaily notes ^daily\n  : scratch\n"
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
         "#lang olai\n\n"
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

  ;; ---- globs ---------------------------------------------------------------
  ;;
  ;; `@include Daily/*.rkt` is one line where a line per month used to be. It
  ;; is the same include: the files it names are spliced flat, in the order
  ;; the pattern matched them, exactly as that many literal lines would.

  (test-case "a glob splices its matches flat, in lexicographic order"
    (define dir (make-temporary-file "sfglob~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       ;; written out of order on purpose: the ANSWER is sorted, not the
       ;; directory's idea of it
       (write-outline dir "Daily/2026-10.rkt" "#lang olai\nOct\n")
       (write-outline dir "Daily/2026-01.rkt" "#lang olai\nJan\n  first\n")
       (write-outline dir "Daily/2026-02.rkt" "#lang olai\nFeb\n")
       (define root
         (write-outline dir "Daily.rkt"
                        "#lang olai\nDaily ^daily\n  @include Daily/*.rkt\n"))
       (define tasks (load-tasks root))
       (check-equal? (map task-title (task-children (car tasks)))
                     '("Jan" "Feb" "Oct"))
       ;; flat where the line sits: the fragment's own nesting is its own
       (check-equal? (map task-title (task-children (car (task-children (car tasks)))))
                     '("first"))
       ;; every match is a spliced file, and the pattern is remembered as one
       (check-equal? (map file-label (load-includes root))
                     '("2026-01.rkt" "2026-02.rkt" "2026-10.rkt"))
       (check-equal? (map file-label (load-include-globs root)) '("*.rkt")))
     (λ () (delete-directory/files dir))))

  ;; The reason a glob does not error on the empty set: `Daily/2027-*.rkt` on
  ;; the first of January names the files that year is about to have, and an
  ;; outline that will not load until one exists is an outline that breaks
  ;; every New Year's Day.
  (test-case "a glob that matches nothing is an empty splice"
    (define dir (make-temporary-file "sfglobz~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "Daily/2026-01.rkt" "#lang olai\nJan\n")
       (define root
         (write-outline dir "Daily.rkt"
                        (string-append "#lang olai\n"
                                       "2026\n"
                                       "  @include Daily/2026-*.rkt\n"
                                       "2027\n"
                                       "  @include Daily/2027-*.rkt\n")))
       (define tasks (load-tasks root))
       (check-equal? (map task-title tasks) '("2026" "2027"))
       (check-equal? (map task-title (task-children (car tasks))) '("Jan"))
       (check-equal? (task-children (cadr tasks)) '())
       ;; and the empty one is still a question the store has to keep asking
       (check-equal? (length (load-include-globs root)) 2))
     (λ () (delete-directory/files dir))))

  ;; The directory part of a pattern is literal, so it is a claim about a
  ;; directory the way a literal @include is a claim about a file. A typo in
  ;; it must not read as "matched nothing".
  (test-case "a glob with no directory to read is an error at the include line"
    (define dir (make-temporary-file "sfglobd~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (define root
         (write-outline dir "Daily.rkt"
                        "#lang olai\nDaily\n  @include Dialy/*.rkt\n"))
       (define-values (where msg) (load-failure root))
       (check-true (string-contains? where "Daily.rkt") where)
       (check-true (string-contains? where ":3:") where)
       (check-true (string-contains? msg "Dialy") msg)
       (check-true (regexp-match? #px"no such directory" msg) msg))
     (λ () (delete-directory/files dir))))

  ;; A closed grammar says no out loud: every spelling a shell would take is
  ;; named and refused, at the line that wrote it, rather than quietly
  ;; matching a file with a bracket in it.
  (test-case "the glob grammar is closed, and says so with a srcloc"
    (define dir (make-temporary-file "sfglobg~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "Daily/2026-01.rkt" "#lang olai\nJan\n")
       ;; every one of these stars something, which is what makes it a
       ;; pattern; a path with no `*` in it is a file name, brackets and all
       (for ([pattern (in-list '("Daily/**/*.rkt"
                                 "Daily/2026-?*.rkt"
                                 "Daily/{2026,2027}-*.rkt"
                                 "Daily/[0-9]*.rkt"
                                 "*/2026-01.rkt"))]
             [i (in-naturals)])
         (define root
           (write-outline dir (format "root~a.rkt" i)
                          (format "#lang olai\nDaily\n  @include ~a\n" pattern)))
         (define-values (where msg) (load-failure root))
         (check-true (string-contains? where ":3:") (format "~a: ~a" pattern where))
         (check-true (regexp-match? #px"glob|starred" msg)
                     (format "~a: ~a" pattern msg))))
     (λ () (delete-directory/files dir))))

  ;; `*` does not match a leading dot, exactly as in a shell — and here that
  ;; is load-bearing: `.#2026-01.rkt` is the lock file Emacs leaves beside a
  ;; file being edited, and it is a dangling symlink.
  (test-case "a glob does not match a dotfile"
    (define dir (make-temporary-file "sfglobh~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "Daily/2026-01.rkt" "#lang olai\nJan\n")
       (write-outline dir "Daily/.#2026-01.rkt" "#lang olai\nLock\n")
       (define root
         (write-outline dir "Daily.rkt"
                        "#lang olai\nDaily\n  @include Daily/*.rkt\n"))
       (check-equal? (map task-title (task-children (car (load-tasks root))))
                     '("Jan")))
     (λ () (delete-directory/files dir))))

  ;; Nothing about a matched file is special: it defines its own nodes, brings
  ;; its own includes, and declares anchors the whole tree can mirror.
  (test-case "a globbed fragment is an ordinary include"
    (define dir (make-temporary-file "sfglobn~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "Daily/nested/deep.rkt" "#lang olai\nDeep ^deep\n")
       (write-outline dir "Daily/2026-01.rkt"
                      "#lang olai\nJan\n  @include nested/deep.rkt\n")
       (define root
         (write-outline dir "Daily.rkt"
                        "#lang olai\nDaily\n  @include Daily/*.rkt\n  *deep\n"))
       (define tasks (load-tasks root))
       (define kids (task-children (car tasks)))
       (check-equal? (map task-title (list (car kids))) '("Jan"))
       (check-true (string-suffix? (task-file (car kids)) "2026-01.rkt")
                   (task-file (car kids)))
       ;; the fragment's own include came with it, and the anchor it declares
       ;; is in scope for a mirror written at the root
       (check-equal? (map task-title (task-children (car kids))) '("Deep"))
       (check-true (mirror-ref? (cadr kids)))
       ;; a module reports the includes it spliced ITSELF: the fragment's own
       ;; were flattened before it exported anything (olai/store walks the
       ;; graph for the rest)
       (check-equal? (map file-label (load-includes root)) '("2026-01.rkt")))
     (λ () (delete-directory/files dir))))

  (test-case "a glob that matches the file it is written in is a cycle"
    (define dir (make-temporary-file "sfglobc~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (define root (write-outline dir "root.rkt" "#lang olai\n@include *.rkt\n"))
       (check-exn
        (λ (e) (regexp-match? #px"include cycle" (exn-message e)))
        (λ () (load-tasks root))))
     (λ () (delete-directory/files dir))))

  (test-case "sexp include form"
    (define dir (make-temporary-file "sfsexp~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (write-outline dir "frag.rkt" "#lang olai\nKid\n")
       (define root
         (write-outline
          dir "root.rkt"
          "#lang olai/sexp\n(t \"P\" (include \"frag.rkt\"))\n"))
       (define tasks (load-tasks root))
       (check-equal? (map task-title (task-children (car tasks))) '("Kid")))
     (λ () (delete-directory/files dir)))))
