#lang racket/base

;; The LINKER: an anchor's scope is the loaded SET, not one file.
;;
;; Everything here is about two files held at once — which is the only way a
;; cross-file mirror, a duplicate that spans files, or a cycle through one can
;; exist at all. The single-file half of each rule lives in tests/mirrors.rkt
;; and tests/include.rkt.

(require racket/file
         racket/string
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk find-tasks-by-title
                  mirror-site? mirror-site-of mirror-site-task)
         olai/json/model
         olai/load
         olai/ops
         olai/store
         ;; outlines on disk, and the two answers a load gives
         olai/tests/outlines)

(module+ test
  (require rackunit))

(module+ test
  ;; What every read command does with the paths it was given (olai/load).
  ;; Writing them, and the two answers it can give, are tests/outlines'.
  (define (link . paths) (load-set paths)))

(module+ test
  (test-case "a mirror reaches an anchor another file declares"
    (in-dir
     "olai-link-ok"
     (λ (dir)
       (define tasks-file
         (write-outline dir "Tasks.rkt"
                        "#lang olai\nMeeting prep ^meeting-prep\n  slides\n"))
       (define daily
         (write-outline dir "Daily.rkt"
                        "#lang olai\n2026-08-06\n  *meeting-prep\n"))
       (define lk (linked-or-fail (link tasks-file daily)))
       ;; the index is the SET's: one entry, from the file that declares it
       (check-equal? (hash-keys (linked-anchors lk)) '("meeting-prep"))
       (define target (hash-ref (linked-anchors lk) "meeting-prep"))
       (check-true (string-suffix? (task-file target) "Tasks.rkt")
                   (task-file target))
       ;; and the site in the other file is still a mirror, unbound in the
       ;; durable model — binding is the store's, below
       (define day (car (outline-tasks (cadr (linked-outlines lk)))))
       (check-true (mirror-ref? (car (task-children day)))))))

  ;; The other half of the same rule: loaded ALONE, that file's mirror names
  ;; nothing, and the message says what it looked in. This is also what makes
  ;; `olai check` on one file of a linked pair honest rather than quiet.
  (test-case "an anchor no loaded file declares is an error at the mirror site"
    (in-dir
     "olai-link-unknown"
     (λ (dir)
       (define daily
         (write-outline dir "Daily.rkt"
                        "#lang olai\nToday\n  Standup\n  *meeting-prep\n"))
       (define-values (where msg) (error-of (link daily)))
       (check-true (string-contains? where "Daily.rkt") where)
       (check-true (string-contains? where ":4:") where)
       (check-true (regexp-match? #px"unknown \\*meeting-prep" msg) msg)
       (check-true (string-contains? msg "the loaded set") msg)
       (check-true (string-contains? msg "(none)") msg))))

  ;; A module still LOADS with an unresolved mirror — which is what lets the
  ;; write path validate one file at a time (olai/edit) while the anchor it
  ;; mirrors lives in another.
  (test-case "a file that mirrors another file's anchor loads on its own"
    (in-dir
     "olai-link-open"
     (λ (dir)
       (define daily
         (write-outline dir "Daily.rkt" "#lang olai\nToday\n  *elsewhere\n"))
       (define r (try-load-outline daily))
       (check-true (outline? r) (format "~a" r)))))

  (test-case "a near miss is named"
    (in-dir
     "olai-link-typo"
     (λ (dir)
       (define tasks-file
         (write-outline dir "Tasks.rkt" "#lang olai\nMeeting prep ^meeting-prep\n"))
       (define daily
         (write-outline dir "Daily.rkt" "#lang olai\nToday\n  *meting-prep\n"))
       (define-values (_where msg) (error-of (link tasks-file daily)))
       (check-true (string-contains? msg "did you mean *meeting-prep?") msg)))

    ;; and a name that is nothing like the ones there gets the list, not a guess
    (in-dir
     "olai-link-far"
     (λ (dir)
       (define tasks-file
         (write-outline dir "Tasks.rkt" "#lang olai\nWork ^agent\n"))
       (define daily
         (write-outline dir "Daily.rkt" "#lang olai\nToday\n  *groceries\n"))
       (define-values (_where msg) (error-of (link tasks-file daily)))
       (check-true (string-contains? msg "anchors in the loaded set: agent") msg)
       (check-false (string-contains? msg "did you mean") msg))))

  (test-case "one anchor, two files: both sites are named"
    (in-dir
     "olai-link-dup"
     (λ (dir)
       (define a (write-outline dir "Tasks.rkt" "#lang olai\nWork ^agent\n"))
       (define b (write-outline dir "Other.rkt"
                                "#lang olai\nSomething else\n  Also ^agent\n"))
       (define-values (where msg) (error-of (link a b)))
       ;; the error is AT the second declaration
       (check-true (string-contains? where "Other.rkt") where)
       (check-true (string-contains? where ":3:") where)
       (check-true (regexp-match? #px"duplicate \\^agent" msg) msg)
       ;; and it names the first one
       (check-true (string-contains? msg "Tasks.rkt") msg))))

  (test-case "a cycle now spans files"
    (in-dir
     "olai-link-cycle"
     (λ (dir)
       (define a (write-outline dir "A.rkt" "#lang olai\nA ^a\n  *b\n"))
       (define b (write-outline dir "B.rkt" "#lang olai\nB ^b\n  *a\n"))
       (define-values (where msg) (error-of (link a b)))
       (check-true (regexp-match? #px"a -> b -> a|b -> a -> b" msg) msg)
       (check-true (or (string-contains? where "A.rkt")
                       (string-contains? where "B.rkt"))
                   where))))

  ;; @include splices before the linker runs, so a site under one is checked
  ;; with everything else and keeps the srcloc of the line it was written on.
  (test-case "a dangling mirror under @include still says file:line:col"
    (in-dir
     "olai-link-incl"
     (λ (dir)
       (write-outline dir "frag.rkt" "#lang olai\nWork ^agent\n")
       (define root
         (write-outline dir "root.rkt"
                        "#lang olai\nWeek\n  @include frag.rkt\n  *nope\n"))
       (define-values (where msg) (error-of (link root)))
       (check-true (string-contains? where "root.rkt") where)
       (check-true (string-contains? where ":4:") where)
       (check-true (regexp-match? #px"unknown \\*nope" msg) msg)
       (check-true (string-contains? msg "agent") msg)))))

;; ---- what the set looks like to an agent ------------------------------------

(module+ test
  (test-case "tree JSON: the anchors index spans the set"
    (in-dir
     "olai-link-json"
     (λ (dir)
       (define a (write-outline dir "Tasks.rkt"
                                "#lang olai\nMeeting prep ^meeting-prep\n"))
       (define b (write-outline dir "Daily.rkt"
                                "#lang olai\n2026-08-06\n  *meeting-prep\n"))
       (define j (linked->jsexpr (linked-or-fail (link a b))))
       ;; two files, one index over them
       (check-equal? (length (hash-ref j 'files)) 2)
       (define anchors (hash-ref j 'anchors))
       (check-true (hash-has-key? anchors 'meeting-prep))
       (define anchored (hash-ref anchors 'meeting-prep))
       (check-equal? (hash-ref anchored 'title) "Meeting prep")
       ;; where a write goes, which is the point of an index that spans files
       (check-true (string-suffix? (hash-ref anchored 'file) "Tasks.rkt")
                   (hash-ref anchored 'file))
       ;; the site itself is still a reference, never an inlined subtree
       (define daily (cadr (hash-ref j 'files)))
       (define day (car (hash-ref daily 'tasks)))
       (check-equal? (hash-ref (car (hash-ref day 'children)) 'mirror)
                     "meeting-prep")
       ;; the file's own anchors stay the file's own
       (check-equal? (hash-ref daily 'anchor_count) 0)
       (check-equal? (hash-ref (car (hash-ref j 'files)) 'anchor_count) 1)))))

;; ---- what the page is drawn from -------------------------------------------

(module+ test
  (test-case "the store binds a mirror to the node another file defines"
    (in-dir
     "olai-link-store"
     (λ (dir)
       (define a (write-outline dir "Tasks.rkt"
                                "#lang olai\nMeeting prep ^meeting-prep\n  slides\n"))
       (define b (write-outline dir "Daily.rkt"
                                "#lang olai\n2026-08-06\n  *meeting-prep\n"))
       (define st (make-store dir))
       (define (mirror-site-in-daily)
         (define snap (store-snapshot st))
         (define daily-tasks (cadr (assoc b (snapshot-files-data snap))))
         (car (task-children (car daily-tasks))))
       (define site (mirror-site-in-daily))
       (check-true (mirror-site? site))
       (check-equal? (mirror-site-of site) "meeting-prep")
       (define bound (mirror-site-task site))
       (check-equal? (task-title bound) "Meeting prep")
       ;; the same node, so the same key: the defining site owns it
       ;; by file, never by position: the store is pointed at the DIRECTORY
       ;; and loads what is under it in name order
       (define (tasks-in file)
         (for/or ([o (in-list (snapshot-outlines (store-snapshot st)))])
           (and (equal? (outline-path o) file) (outline-tasks o))))
       (define defining
         (car (find-tasks-by-title (tasks-in a) "Meeting prep")))
       (check-equal? (task-key bound) (task-key defining))
       ;; the subtree came along
       (check-equal? (map task-title (task-children bound)) '("slides"))

       ;; and editing the DEFINING file redraws the mirror site: one node, and
       ;; the page that shows it here is showing that one
       (display-to-file "#lang olai\nMeeting prep, revised ^meeting-prep\n  slides\n"
                        a #:exists 'truncate/replace)
       (store-invalidate! st #:force? #t)
       (check-equal? (task-title (mirror-site-task (mirror-site-in-daily)))
                     "Meeting prep, revised"))))

  ;; A broken set keeps the last good snapshot and records the error, exactly
  ;; as a broken FILE does — the linker's failures are load failures.
  (test-case "a set that stops linking keeps the last good snapshot"
    (in-dir
     "olai-link-store-bad"
     (λ (dir)
       (define a (write-outline dir "Tasks.rkt" "#lang olai\nWork ^agent\n"))
       (define b (write-outline dir "Daily.rkt" "#lang olai\nToday\n  *agent\n"))
       (define st (make-store dir))
       (check-false (store-error st))
       ;; the anchor goes away; the mirror in the other file now names nothing
       (display-to-file "#lang olai\nWork\n" a #:exists 'truncate/replace)
       (store-invalidate! st #:force? #t)
       (define err (store-error st))
       (check-true (load-error? err) (format "~a" err))
       (check-true (regexp-match? #px"unknown \\*agent" (load-error-message err))
                   (load-error-message err))
       (check-true (string-contains? (or (load-error-where err) "") "Daily.rkt")
                   (format "~a" (load-error-where err)))
       ;; last good is still being served
       (check-equal? (length (snapshot-outlines (store-snapshot st))) 2)))))

;; ---- writing through a mirror ----------------------------------------------

(module+ test
  ;; Checking off from the mirror site flips the one real node, which lives in
  ;; the file that declares it. Same routing @include has always had — a write
  ;; goes to a node's defining file — now that an anchor's scope is the set.
  (test-case "done via an anchor another file declares edits that file"
    (in-dir
     "olai-link-write"
     (λ (dir)
       (define a (write-outline dir "Tasks.rkt"
                                "#lang olai\nMeeting prep ^meeting-prep\n"))
       (define b (write-outline dir "Daily.rkt"
                                "#lang olai\n2026-08-06\n  *meeting-prep\n"))
       (define daily-before (file->string b))
       (define r (ops-mark! b 'done "^meeting-prep" "2026-08-06" #:commit? #f))
       ;; the reply names the file it actually wrote
       (check-true (string-suffix? (mark-result-file r) "Tasks.rkt")
                   (mark-result-file r))
       (check-equal? (mark-result-title r) "Meeting prep")
       (check-true (string-contains? (file->string a) "@done 2026-08-06")
                   (file->string a))
       ;; the file the command named is untouched: a mirror is not a node
       (check-equal? (file->string b) daily-before)
       ;; and the set still links afterwards
       (check-true (linked? (link-outlines (list (try-load-outline a)
                                                 (try-load-outline b)))))))))

;; ---- how far a write looks for the file that declares an anchor ------------
;;
;; The same scope `serve DIR` loads: every outline under the directory, at any
;; depth. A node the web view draws and links to is a node a write can reach —
;; two answers to "which files could declare this name" would be two sets.

(module+ test
  (test-case "done via an anchor a SUBDIRECTORY declares edits that file"
    (in-dir
     "olai-link-write-deep"
     (λ (dir)
       (define root (write-outline dir "Daily.rkt"
                                   "#lang olai\n2026-08-06\n  *idea\n"))
       (define deep (write-outline dir "notes/Ideas.rkt"
                                   "#lang olai\nWrite it up ^idea\n"))
       ;; and a .rkt that is not an outline at all, in the way
       (display-to-file "#lang racket/base\n(provide x)\n(define x 1)\n"
                        (build-path dir "helper.rkt") #:exists 'truncate/replace)
       (define r (ops-mark! root 'done "^idea" "2026-08-06" #:commit? #f))
       (check-true (string-suffix? (mark-result-file r) "Ideas.rkt")
                   (mark-result-file r))
       (check-equal? (mark-result-title r) "Write it up")
       (check-true (string-contains? (file->string deep) "@done 2026-08-06")
                   (file->string deep)))))

  ;; Nearest first: the outline beside you wins a name a deeper one also
  ;; claims, so widening the scope cannot move a write that already worked.
  (test-case "an anchor two files declare resolves to the nearer one"
    (in-dir
     "olai-link-write-near"
     (λ (dir)
       (define root (write-outline dir "Daily.rkt"
                                   "#lang olai\n2026-08-06\n  *idea\n"))
       (define near (write-outline dir "Tasks.rkt"
                                   "#lang olai\nBeside you ^idea\n"))
       (define far (write-outline dir "notes/Ideas.rkt"
                                  "#lang olai\nUnder you ^idea\n"))
       (define r (ops-mark! root 'done "^idea" "2026-08-06" #:commit? #f))
       (check-true (string-suffix? (mark-result-file r) "Tasks.rkt")
                   (mark-result-file r))
       (check-equal? (mark-result-title r) "Beside you")))))
