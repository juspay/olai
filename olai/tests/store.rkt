#lang racket/base

;; The snapshot layer: reload on change (fresh namespace), transitive watch
;; set, last-good on a broken file. Temp dirs only, never personal data.

(require racket/file
         racket/list
         racket/path
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/load
         olai/store)

(module+ test
  (require rackunit))

(module+ test
  (define (with-temp-dir proc)
    (define dir (make-temporary-file "sfstore~a" 'directory))
    (dynamic-wind void (λ () (proc dir)) (λ () (delete-directory/files dir))))

  (define (write-file! path text)
    (make-parent-directory* path)
    (display-to-file text path #:exists 'truncate/replace))

  (define (titles snap)
    (for*/list ([o (in-list (snapshot-outlines snap))]
                [tk (in-list (outline-tasks o))])
      (task-title tk))))

(module+ test
  (test-case "a store reloads a file that changed on disk"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n")
       (define st (make-store f))
       (check-equal? (titles (store-snapshot st)) '("Inbox"))
       (check-false (store-error st))
       ;; the module registry would hand back "Inbox" forever; the store
       ;; reloads through a fresh namespace instead
       (write-file! f "#lang olai\nInbox\nSomeday maybe\n")
       (store-invalidate! st)
       (check-equal? (titles (store-snapshot st)) '("Inbox" "Someday maybe"))
       ;; tasks stay real tasks across the reload (one struct type, attached)
       (check-true (task? (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))))))

  (test-case "a broken file keeps last-good and records file:line:col"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n  Buy milk\n")
       (define st (make-store f))
       (write-file! f "#lang olai\nInbox\n  Buy milk\n    @date nope\n")
       (store-invalidate! st)
       (define err (store-error st))
       (check-true (load-error? err))
       (check-true (string-contains? (or (load-error-where err) "") "Tasks.rkt")
                   (format "~a" err))
       (check-true (number? (load-error-line err)) (format "~a" err))
       ;; the detail is the message without the duplicated location prefix
       (check-false (string-prefix? (load-error-detail err)
                                    (load-error-where err))
                    (load-error-detail err))
       ;; last-good is still being served
       (check-equal? (titles (store-snapshot st)) '("Inbox"))
       ;; and the error clears once the file parses again
       (write-file! f "#lang olai\nInbox\n  Buy milk\n  Buy bread\n")
       (store-invalidate! st)
       (check-false (store-error st))
       (check-equal? (length (task-children
                              (car (outline-tasks
                                    (car (snapshot-outlines (store-snapshot st)))))))
                     2))))

  (test-case "the revision moves on a reload and stands still otherwise"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n")
       (define st (make-store f))
       (define r0 (store-revision st))
       (check-true (exact-positive-integer? r0))
       ;; nothing changed on disk: an invalidate is a probe, not a reload
       (store-invalidate! st)
       (check-equal? (store-revision st) r0)
       (write-file! f "#lang olai\nInbox\nSomeday maybe\n")
       (store-invalidate! st)
       (check-true (> (store-revision st) r0))
       ;; a file that BREAKS is a change too — the readers grow a banner
       (define r1 (store-revision st))
       (write-file! f "#lang olai\nInbox\n  @date nope\n")
       (store-invalidate! st)
       (check-true (load-error? (store-error st)))
       (check-true (> (store-revision st) r1))
       ;; and a broken file is retried on the next EDIT, not on every probe
       (define r2 (store-revision st))
       (store-invalidate! st)
       (check-equal? (store-revision st) r2))))

  (test-case "watch set covers transitive @include fragments"
    (with-temp-dir
     (λ (dir)
       (define root (build-path dir "Daily.rkt"))
       (define mid (build-path dir "Daily" "2026-08.rkt"))
       (define leaf (build-path dir "Daily" "extra.rkt"))
       (write-file! leaf "#lang olai\n2026-08-04\n")
       (write-file! mid "#lang olai\nAugust\n  @include extra.rkt\n")
       (write-file! root "#lang olai\n2026\n  @include Daily/2026-08.rkt\n")
       (define st (make-store root))
       (define watched (map path->string (snapshot-watch (store-snapshot st))))
       (for ([p (in-list (list root mid leaf))])
         (check-not-false (member (path->string (simple-form-path p)) watched)
                          (format "~a not watched: ~a" p watched)))
       ;; editing a fragment two levels down invalidates the snapshot
       (write-file! leaf "#lang olai\n2026-08-04\n  Ship the store\n")
       (store-invalidate! st)
       (define t (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))
       (define day (car (task-children (car (task-children t)))))
       (check-equal? (map task-title (task-children day)) '("Ship the store")))))

  ;; ---- a directory is a question, not a list -------------------------------
  ;;
  ;; A store built on a DIRECTORY is built on what that directory holds RIGHT
  ;; NOW. The roots are re-asked on every staleness probe, exactly like a glob
  ;; include, because the file that appears is the one nothing already loaded
  ;; can point at: the first Archive.rkt an `olai archive` writes.

  (define (root-titles st)
    (for*/list ([o (in-list (snapshot-outlines (store-snapshot st)))]
                [tk (in-list (outline-tasks o))])
      (task-title tk)))

  (test-case "an outline created under the served directory is a root, live"
    (with-temp-dir
     (λ (dir)
       (write-file! (build-path dir "Tasks.rkt") "#lang olai\nInbox\n")
       (define st (make-store dir))
       (check-equal? (root-titles st) '("Inbox"))
       (define rev (store-revision st))
       ;; nothing moved: no reload
       (store-invalidate! st)
       (check-equal? (store-revision st) rev)
       ;; a file no watched file's mtime knows anything about
       (write-file! (build-path dir "Archive.rkt") "#lang olai\nPut away\n")
       (store-invalidate! st)
       (check-true (> (store-revision st) rev))
       (check-equal? (root-titles st) '("Put away" "Inbox"))
       ;; and one that goes away is the same news
       (define rev2 (store-revision st))
       (delete-file (build-path dir "Archive.rkt"))
       (store-invalidate! st)
       (check-true (> (store-revision st) rev2))
       (check-equal? (root-titles st) '("Inbox")))))

  (test-case "an outline in a subdirectory is a root when nothing includes it"
    (with-temp-dir
     (λ (dir)
       (write-file! (build-path dir "Tasks.rkt") "#lang olai\nInbox\n")
       (write-file! (build-path dir "notes" "Ideas.rkt") "#lang olai\nDeeper\n")
       (define st (make-store dir))
       (check-equal? (root-titles st) '("Inbox" "Deeper")))))

  ;; The subtraction, which is what makes the recursion safe: a fragment read
  ;; as a root as well as through the file that splices it would define every
  ;; one of its nodes twice — two keys for one node, and an ^anchor the linker
  ;; rightly calls a duplicate.
  (test-case "a file another root includes is not a root of its own"
    (with-temp-dir
     (λ (dir)
       (write-file! (build-path dir "Daily" "2026-08.rkt")
                    "#lang olai\nAugust ^august\n")
       ;; and one beside the root, where "it lives in a subdirectory" would
       ;; not have saved it
       (write-file! (build-path dir "Frag.rkt") "#lang olai\nShared ^shared\n")
       (write-file! (build-path dir "Tasks.rkt")
                    (string-append "#lang olai\nInbox\n"
                                   "  @include Daily/2026-08.rkt\n"
                                   "  @include Frag.rkt\n"))
       (define st (make-store dir))
       (check-false (store-error st) (format "~a" (store-error st)))
       (check-equal? (root-titles st) '("Inbox"))
       ;; one node per anchor, spliced under the root that asked for it
       (define snap (store-snapshot st))
       (check-equal? (length (snapshot-files-data snap)) 1)
       (for ([id (in-list '("august" "shared"))])
         (check-not-false (hash-ref (snapshot-index snap) id #f) id))
       ;; and dropping the include makes the fragment a root, live
       (write-file! (build-path dir "Tasks.rkt")
                    "#lang olai\nInbox\n  @include Frag.rkt\n")
       (store-invalidate! st)
       (check-false (store-error st) (format "~a" (store-error st)))
       (check-equal? (root-titles st) '("Inbox" "August")))))

  ;; ---- glob includes -------------------------------------------------------
  ;;
  ;; The one thing in the module graph that moves without any file the store
  ;; read being touched: a NEW file matching `Daily/*.rkt`. Nothing in the
  ;; watch set changed when it landed, so the probe that finds it has to be
  ;; the pattern itself, asked again.

  (test-case "a file appearing in a glob's directory is a reload"
    (with-temp-dir
     (λ (dir)
       (define root (build-path dir "Daily.rkt"))
       (write-file! (build-path dir "Daily" "2026-08.rkt") "#lang olai\nAugust\n")
       (write-file! root "#lang olai\nDaily\n  @include Daily/*.rkt\n")
       (define st (make-store root))
       (define (days)
         (map task-title
              (task-children
               (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))))
       (check-equal? (days) '("August"))
       (define rev (store-revision st))
       ;; nothing moved: no reload
       (store-invalidate! st)
       (check-equal? (store-revision st) rev)
       ;; a month that did not exist when the outline was loaded
       (write-file! (build-path dir "Daily" "2026-09.rkt") "#lang olai\nSeptember\n")
       (store-invalidate! st)
       (check-true (> (store-revision st) rev))
       (check-equal? (days) '("August" "September"))
       ;; and one that goes away is the same news
       (define rev2 (store-revision st))
       (delete-file (build-path dir "Daily" "2026-08.rkt"))
       (store-invalidate! st)
       (check-true (> (store-revision st) rev2))
       (check-equal? (days) '("September")))))

  ;; A pattern that matched nothing is still a question, and the directory it
  ;; reads is still a place to watch: with no match there is no file in the
  ;; watch set to take a parent of, which is exactly the new-year case.
  (test-case "the snapshot carries the patterns, matched or not"
    (with-temp-dir
     (λ (dir)
       (define root (build-path dir "Daily.rkt"))
       (make-directory* (build-path dir "Daily"))
       (write-file! root "#lang olai\n2027\n  @include Daily/2027-*.rkt\n")
       (define st (make-store root))
       (check-equal? (map path->string (snapshot-globs (store-snapshot st)))
                     (list (path->string
                            (simple-form-path
                             (build-path dir "Daily" "2027-*.rkt")))))
       (define rev (store-revision st))
       (write-file! (build-path dir "Daily" "2027-01.rkt") "#lang olai\nJanuary\n")
       (store-invalidate! st)
       (check-true (> (store-revision st) rev))
       (check-equal?
        (map task-title
             (task-children
              (car (outline-tasks (car (snapshot-outlines (store-snapshot st)))))))
        '("January")))))

  ;; ---- @doc documents ------------------------------------------------------
  ;;
  ;; A document is a file the outline points at, so it is this layer's twice
  ;; over: read once per load (the renderer is pure and gets text, not a path)
  ;; and watched, because editing one is editing what a page shows.

  (test-case "the snapshot carries the documents @doc named, keyed by path"
    (with-temp-dir
     (λ (dir)
       (define doc (build-path dir "notes" "plan.md"))
       (define f (build-path dir "Tasks.rkt"))
       (write-file! doc "# Plan\n\nthe body\n")
       (write-file! f "#lang olai\nShip it\n  @doc notes/plan.md\n")
       (define st (make-store f))
       (define docs (snapshot-docs (store-snapshot st)))
       (check-equal? (hash-ref docs (path->string (simple-form-path doc)) #f)
                     "# Plan\n\nthe body\n")
       ;; and the file is watched, so a save to it is news
       (check-not-false
        (member (path->string (simple-form-path doc))
                (map path->string (snapshot-watch (store-snapshot st))))))))

  (test-case "editing a document reloads the snapshot"
    (with-temp-dir
     (λ (dir)
       (define doc (build-path dir "plan.md"))
       (define f (build-path dir "Tasks.rkt"))
       (write-file! doc "# Plan\n")
       (write-file! f "#lang olai\nShip it\n  @doc plan.md\n")
       (define st (make-store f))
       (define rev (store-revision st))
       ;; nothing changed: no reload, no news
       (store-invalidate! st)
       (check-equal? (store-revision st) rev)
       ;; the outline did not move, and the page still has to redraw
       (write-file! doc "# Plan\n\nrewritten\n")
       (store-invalidate! st)
       (check-true (> (store-revision st) rev))
       (check-equal? (hash-ref (snapshot-docs (store-snapshot st))
                               (path->string (simple-form-path doc)) #f)
                     "# Plan\n\nrewritten\n"))))

  (test-case "a document that goes away breaks the outline, and last-good stands"
    (with-temp-dir
     (λ (dir)
       (define doc (build-path dir "plan.md"))
       (define f (build-path dir "Tasks.rkt"))
       (write-file! doc "# Plan\n")
       (write-file! f "#lang olai\nShip it\n  @doc plan.md\n")
       (define st (make-store f))
       (check-false (store-error st))
       ;; @doc names a file, and the LANGUAGE is what says it has to be there
       (delete-file doc)
       (store-invalidate! st)
       (define err (store-error st))
       (check-true (load-error? err))
       (check-true (regexp-match? #rx"(?i:file not found)" (load-error-message err))
                   (format "~a" err))
       ;; the page keeps drawing what it had
       (check-equal? (titles (store-snapshot st)) '("Ship it")))))

  ;; ---- node identity -------------------------------------------------------

  (define (all-keys snap)
    (for*/list ([o (in-list (snapshot-outlines snap))]
                [tk (in-list (outline-tasks o))]
                [k (in-list (let walk ([x tk])
                              (if (task? x)
                                  (cons (list (task-title x) (task-key x))
                                        (append* (map walk (task-children x))))
                                  '())))])
      k))

  (test-case "renaming an ancestor does not re-key its descendants"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nProjects\n  Ship it\n    Write the docs\n")
       (define st (make-store f))
       (define before (all-keys (store-snapshot st)))
       (define (key-of pairs title) (cadr (assoc title pairs)))
       ;; rename every ancestor of "Write the docs"
       (write-file! f "#lang olai\nWork\n  Ship the thing\n    Write the docs\n")
       (store-invalidate! st)
       (define after (all-keys (store-snapshot st)))
       (check-equal? (key-of after "Write the docs") (key-of before "Write the docs"))
       ;; and the renamed nodes keep their own keys too — identity is position,
       ;; not text
       (check-equal? (key-of after "Ship the thing") (key-of before "Ship it"))
       (check-equal? (key-of after "Work") (key-of before "Projects")))))

  (test-case "same-titled siblings do not collide"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n  Call\n    mum\n  Call\n    dad\n")
       (define st (make-store f))
       (define snap (store-snapshot st))
       (define calls
         (for/list ([c (in-list (task-children
                                 (car (outline-tasks (car (snapshot-outlines snap))))))])
           (task-key c)))
       (check-equal? (length calls) 2)
       (check-not-equal? (car calls) (cadr calls))
       ;; both are addressable: the index keeps each, not just the first
       (for ([k (in-list calls)])
         (check-not-false (hash-ref (snapshot-index snap) k #f) k))
       (check-equal? (hash-count (snapshot-index snap)) 5))))

  (test-case "an ^anchor is the key, wherever the node sits"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n  Ship it ^ship\n")
       (define st (make-store f))
       (define tk (car (task-children
                        (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))))
       (check-equal? (task-key tk) "ship")
       ;; moved and renamed: still ^ship
       (write-file! f "#lang olai\nLater\nInbox\n  Sub\n    Ship it now ^ship\n")
       (store-invalidate! st)
       (define snap (store-snapshot st))
       (check-not-false (hash-ref (snapshot-index snap) "ship" #f)))))

  ;; A node's key comes from its DEFINING file, so the entry point you happen
  ;; to load cannot change it.
  (define (key-in tasks title)
    (for/or ([x (in-list tasks)])
      (and (task? x)
           (if (equal? (task-title x) title)
               (task-key x)
               (key-in (task-children x) title)))))

  (define (key-for st title)
    (key-in (append* (for/list ([o (in-list (snapshot-outlines (store-snapshot st)))])
                       (outline-tasks o)))
            title))

  (test-case "a node keys the same standalone and through the file that includes it"
    (with-temp-dir
     (λ (dir)
       (define frag (build-path dir "frag.rkt"))
       (define root (build-path dir "root.rkt"))
       (write-file! frag "#lang olai\nDayA\n  child\nDayB\n")
       (write-file! root "#lang olai\nParent\n  @include frag.rkt\n")
       (define alone (make-store frag))
       (define via (make-store root))
       (for ([title (in-list '("DayA" "child" "DayB"))])
         (check-equal? (key-for via title) (key-for alone title) title))
       ;; the including root's own node is keyed by root.rkt, not by frag
       (check-not-equal? (key-for via "Parent") (key-for alone "DayA")))))

  (test-case "two roots sharing a fragment agree on its nodes"
    (with-temp-dir
     (λ (dir)
       (define frag (build-path dir "Daily" "2026-08.rkt"))
       (define a (build-path dir "A.rkt"))
       (define b (build-path dir "B.rkt"))
       (write-file! frag "#lang olai\n2026-08-04\n  Ship it\n")
       (write-file! a "#lang olai\nAlpha\n  @include Daily/2026-08.rkt\n")
       (write-file! b "#lang olai\nBeta\n  Filler\n  @include Daily/2026-08.rkt\n")
       ;; both roots in ONE store: the shared node must be one key, so the
       ;; index that keeps first-wins is not hiding a second identity
       (define st (make-store dir))
       (define snap (store-snapshot st))
       (define keys
         (for/list ([o (in-list (snapshot-outlines snap))])
           (key-in (outline-tasks o) "2026-08-04")))
       (check-equal? (length keys) 2)
       (check-equal? (car keys) (cadr keys))
       (check-not-false (hash-ref (snapshot-index snap) (car keys) #f))
       ;; the shared day node's child too, not just its root
       (check-equal? (key-in (outline-tasks (car (snapshot-outlines snap))) "Ship it")
                     (key-in (outline-tasks (cadr (snapshot-outlines snap))) "Ship it")))))

  (test-case "two roots with the same basename do not share keys"
    (with-temp-dir
     (λ (dir)
       (define a (build-path dir "a" "Daily.rkt"))
       (define b (build-path dir "b" "Daily.rkt"))
       (write-file! a "#lang olai\nDay\n")
       (write-file! b "#lang olai\nDay\n")
       (define st (make-store dir))
       (define snap (store-snapshot st))
       (define keys
         (for/list ([o (in-list (snapshot-outlines snap))])
           (task-key (car (outline-tasks o)))))
       (check-not-equal? (car keys) (cadr keys))
       ;; and both are addressable
       (check-equal? (hash-count (snapshot-index snap)) 2))))

  ;; LAYERING (CLAUDE.md): the web view is built ON the core, so the core
  ;; must build without it. The store used to reach up into web/render for a
  ;; basename, which put the whole renderer under `olai tree`.
  (test-case "core modules do not reach into web/"
    (define core-dir
      (simple-form-path
       (build-path (collection-file-path "info.rkt" "olai") 'up)))
    (define (rkt-files dir)
      (for/list ([p (in-list (directory-list dir))]
                 #:when (regexp-match? #px"[.]rkt$" (path->string p)))
        (build-path dir p)))
    ;; cli.rkt is app code and main.rkt is the library surface: both are
    ;; allowed to know about the web view. Everything else is core.
    (define core
      (for/list ([f (in-list (append (rkt-files core-dir)
                                     (rkt-files (build-path core-dir "lang"))))]
                 #:unless (member (path->string (file-name-from-path f))
                                  '("cli.rkt" "main.rkt")))
        f))
    (check-true (> (length core) 10) (format "~a core modules?" (length core)))
    (for ([f (in-list core)])
      (check-false (regexp-match? #px"olai/web" (file->string f))
                   (path->string f))))

  (test-case "the render input and the node index are derived once per load"
    (with-temp-dir
     (λ (dir)
       (define a (build-path dir "Tasks.rkt"))
       (define b (build-path dir "Roadmap.rkt"))
       (write-file! a "#lang olai\nInbox\n  Buy milk\n")
       (write-file! b "#lang olai\nShip it ^ship\n")
       (define st (make-store dir))
       (define snap (store-snapshot st))
       (check-equal? (length (snapshot-files-data snap)) 2)
       (check-true (hash-has-key? (snapshot-index snap) "ship"))
       ;; every node is in the index, keyed by its node id
       (check-equal? (hash-count (snapshot-index snap)) 3)))))
