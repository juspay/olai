#lang racket/base

;; ARCHIVING: done work leaves the working file without dying.
;;
;; Three layers, and they are tested as three: the text surgery is pure
;; (olai/subtree), where archived work LIVES is one predicate over a file name
;; (olai/archive), and the op that moves a node is the only part that touches a
;; disk (olai/ops). Temp dirs only, never personal data.

(require racket/file
         racket/list
         racket/path
         racket/string
         olai/agenda
         olai/archive
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk find-tasks-by-title resolve-mirrors
                  mirror-site? mirror-site-task)
         olai/load
         olai/ops
         (only-in olai/store call-in-outline-namespace)
         olai/subtree)

(module+ test
  (require rackunit))

(module+ test
  (define (in-dir name proc)
    (define dir (make-temporary-file (string-append name "~a") 'directory))
    (dynamic-wind void (λ () (proc dir)) (λ () (delete-directory/files dir))))

  ;; What a reader does after a write: load in a fresh namespace, or the module
  ;; registry hands back the file as it was before the op moved anything (this
  ;; is one process; a CLI run is not). The same call the store makes.
  (define (loaded . paths)
    (call-in-outline-namespace (λ () (load-set paths))))

  (define (write-outline dir rel body)
    (define p (build-path dir rel))
    (make-parent-directory* p)
    (display-to-file body p #:exists 'truncate/replace)
    p)

  ;; The 0-based index of the line whose trimmed text starts with `s`.
  (define (line-of text s)
    (for/or ([l (in-list (string-split text "\n" #:trim? #f))] [i (in-naturals)])
      (and (string-prefix? (string-trim l) s) i)))

  (define sample
    (string-append "#lang olai\n"
                   "\n"
                   "kitchen remodel ^kitchen\n"
                   "  : the big one\n"
                   "  install\n"
                   "    @done 2026-08-01\n"
                   "\n"
                   "    pick tiles\n"
                   "  paint\n"
                   "garage\n")))

;; ---- the surgery -----------------------------------------------------------

(module+ test
  (test-case "a cut takes the node, its metadata and its children"
    (define-values (rest block parents) (cut-subtree sample (line-of sample "install")))
    (check-equal? block '("install" "  @done 2026-08-01" "" "  pick tiles"))
    (check-equal? parents '("kitchen remodel"))
    ;; what is left is the file minus those lines, parents and all still there
    (check-equal? rest
                  (string-append "#lang olai\n"
                                 "\n"
                                 "kitchen remodel ^kitchen\n"
                                 "  : the big one\n"
                                 "  paint\n"
                                 "garage\n")))

  (test-case "a cut of a top-level node hangs off nothing"
    (define-values (rest block parents) (cut-subtree sample (line-of sample "garage")))
    (check-equal? block '("garage"))
    (check-equal? parents '())
    (check-false (string-contains? rest "garage")))

  ;; The scaffold is a shelf label: the ancestor's title, with the ^anchor left
  ;; behind. A name is unique across the loaded set, so copying one would break
  ;; the very link an archived node keeps resolving through.
  (test-case "an ancestor's anchor does not travel with the scaffold"
    (define-values (_rest _block parents) (cut-subtree sample (line-of sample "paint")))
    (check-equal? parents '("kitchen remodel")))

  (test-case "a graft into an empty archive writes the chain"
    (define-values (text line)
      (graft-subtree "#lang olai\n" '("kitchen remodel") '("install" "  @done 2026-08-01")))
    (check-equal? text
                  (string-append "#lang olai\n"
                                 "\n"
                                 "kitchen remodel\n"
                                 "  install\n"
                                 "    @done 2026-08-01\n"))
    (check-equal? line 4))

  (test-case "a graft into a chain that is already there merges and appends"
    (define-values (text _line)
      (graft-subtree (string-append "#lang olai\n"
                                    "\n"
                                    "kitchen remodel\n"
                                    "  install\n"
                                    "\n"
                                    "garage\n")
                     '("kitchen remodel")
                     '("paint")))
    (check-equal? text
                  (string-append "#lang olai\n"
                                 "\n"
                                 "kitchen remodel\n"
                                 "  install\n"
                                 "  paint\n"
                                 "\n"
                                 "garage\n")))

  ;; Two chains that share nothing stay two, and a deeper one is created whole.
  (test-case "a graft creates every level the archive is missing"
    (define-values (text _line)
      (graft-subtree (string-append "#lang olai\n\nkitchen remodel\n  install\n")
                     '("2026" "August")
                     '("ship it")))
    (check-equal? text
                  (string-append "#lang olai\n"
                                 "\n"
                                 "kitchen remodel\n"
                                 "  install\n"
                                 "\n"
                                 "2026\n"
                                 "  August\n"
                                 "    ship it\n"))))

;; ---- what archived MEANS ---------------------------------------------------

(module+ test
  (test-case "archived is a file, not a state"
    (check-true (archived-file? (string->path "/home/me/notes/Archive.rkt")))
    (check-true (archived-file? "/home/me/notes/Archive.rkt"))
    (check-false (archived-file? "/home/me/notes/Tasks.rkt"))
    (check-false (archived-file? "/home/me/Archive.rkt.bak"))
    (check-false (archived-file? #f))
    ;; beside the outline named, whatever else is in the directory
    (check-equal? (archive-path-for (string->path "/home/me/notes/Tasks.rkt"))
                  (string->path "/home/me/notes/Archive.rkt"))))

;; ---- the op ----------------------------------------------------------------

(module+ test
  (test-case "the node moves, the ancestors are re-created, both files hold"
    (in-dir
     "olai-archive-op"
     (λ (dir)
       (define tasks (write-outline dir "Tasks.rkt" sample))
       (define r (ops-archive! tasks "install" #:commit? #f))
       (define archive (build-path dir "Archive.rkt"))
       (check-equal? (archive-result-file r) (path->string archive))
       (check-equal? (archive-result-from r) (path->string tasks))
       (check-equal? (archive-result-title r) "install")
       (check-equal? (archive-result-parents r) '("kitchen remodel"))
       (check-true (archive-result-created-archive? r))
       (check-false (archive-result-committed? r))
       ;; gone from the working file, parents left standing
       (define left (file->string tasks))
       (check-false (string-contains? left "install") left)
       (check-true (string-contains? left "kitchen remodel ^kitchen") left)
       ;; and readable in the archive, with its state and its children
       (define text (file->string archive))
       (check-true (string-contains? text "kitchen remodel") text)
       (check-true (string-contains? text "@done 2026-08-01") text)
       (check-true (string-contains? text "pick tiles") text)
       ;; the two of them load as one set
       (check-true (linked? (loaded tasks archive))))))

  ;; Archiving is not finishing. An open node that is archived is an open node
  ;; that is somewhere else — no stamp, no checkbox, nothing decided for you.
  (test-case "the op stamps nothing"
    (in-dir
     "olai-archive-nostamp"
     (λ (dir)
       (define tasks (write-outline dir "Tasks.rkt" "#lang olai\nold plan\n  a step\n"))
       (void (ops-archive! tasks "old plan" #:commit? #f))
       (define text (file->string (build-path dir "Archive.rkt")))
       (check-false (string-contains? text "@done") text)
       (check-false (string-contains? text "[x]") text)
       (check-true (string-contains? text "a step") text))))

  (test-case "a second arrival merges into the chain it shares"
    (in-dir
     "olai-archive-merge"
     (λ (dir)
       (define tasks (write-outline dir "Tasks.rkt" sample))
       (void (ops-archive! tasks "install" #:commit? #f))
       (define r (ops-archive! tasks "paint" #:commit? #f))
       (check-false (archive-result-created-archive? r))
       (define text (file->string (build-path dir "Archive.rkt")))
       ;; one scaffold, not two
       (check-equal? (length (regexp-match* #px"(?m:^kitchen remodel$)" text)) 1
                     text)
       (check-true (string-contains? text "  install") text)
       (check-true (string-contains? text "  paint") text))))

  ;; The anchor moves with the node, and the mirror site in a THIRD file goes on
  ;; drawing it — which is the whole reason this feature waited for the linker.
  (test-case "a mirror of an archived node still resolves and still draws it"
    (in-dir
     "olai-archive-mirror"
     (λ (dir)
       (define tasks
         (write-outline dir "Tasks.rkt"
                        "#lang olai\nShip the server ^serve\n  : notes\n"))
       (define week (write-outline dir "Week.rkt" "#lang olai\nNext week\n  *serve\n"))
       (void (ops-archive! tasks "^serve" #:commit? #f))
       (define archive (build-path dir "Archive.rkt"))
       (check-false (string-contains? (file->string tasks) "^serve"))
       ;; the set still links, and the anchor is the archive's now
       (define lk (loaded tasks week archive))
       (check-true (linked? lk) (format "~a" lk))
       (define target (hash-ref (linked-anchors lk) "serve" #f))
       (check-true (task? target))
       (check-true (string-suffix? (task-file target) "Archive.rkt"))
       ;; and the site in Week.rkt draws that node, as it did before
       (define week-out
         (for/or ([o (in-list (linked-outlines lk))])
           (and (string-suffix? (path->string (outline-path o)) "Week.rkt") o)))
       (define drawn (resolve-mirrors (outline-tasks week-out) (linked-anchors lk)))
       (define site (car (task-children (car drawn))))
       (check-true (mirror-site? site))
       (check-equal? (task-title (mirror-site-task site)) "Ship the server"))))

  ;; A write goes to the DEFINING file, as every write does — and the archive
  ;; goes beside the ROOT the command named, never into the fragment's own
  ;; directory, which `serve DIR` would not load.
  (test-case "a node an @include defines is cut from the fragment"
    (in-dir
     "olai-archive-include"
     (λ (dir)
       (define frag
         (write-outline dir (build-path "Daily" "2026-08.rkt")
                        "#lang olai\n2026-08-04\n  ship the thing ^ship\n"))
       (define root
         (write-outline dir "Daily.rkt"
                        "#lang olai\n2026\n  August\n    @include Daily/2026-08.rkt\n"))
       (define r (ops-archive! root "^ship" #:commit? #f))
       (check-equal? (archive-result-from r) (path->string frag))
       (check-equal? (archive-result-file r)
                     (path->string (build-path dir "Archive.rkt")))
       ;; the chain is the one the FRAGMENT draws — the file the write is about
       (check-equal? (archive-result-parents r) '("2026-08-04"))
       (check-false (string-contains? (file->string frag) "ship the thing"))
       (check-true (file-exists? (build-path dir "Archive.rkt")))
       (check-false (file-exists? (build-path dir "Daily" "Archive.rkt")))
       (check-true (linked? (loaded root (build-path dir "Archive.rkt")))))))

  (test-case "archiving what is already archived is refused"
    (in-dir
     "olai-archive-twice"
     (λ (dir)
       (define tasks (write-outline dir "Tasks.rkt" "#lang olai\nShip it ^ship\n"))
       (void (ops-archive! tasks "^ship" #:commit? #f))
       (define e
         (with-handlers ([exn:fail:op? values])
           (ops-archive! tasks "^ship" #:commit? #f)
           #f))
       (check-true (exn:fail:op? e))
       (check-eq? (exn:fail:op-kind e) 'validation)
       (check-true (regexp-match? #px"already archived" (exn-message e))
                   (exn-message e)))))

  (test-case "a miss is a not-found kind of no, and writes nothing"
    (in-dir
     "olai-archive-miss"
     (λ (dir)
       (define tasks (write-outline dir "Tasks.rkt" "#lang olai\nOnly\n"))
       (define e
         (with-handlers ([exn:fail:op? values])
           (ops-archive! tasks "Missing" #:commit? #f)
           #f))
       (check-true (exn:fail:op? e))
       (check-true (regexp-match? #px"no task" (exn-message e)) (exn-message e))
       (check-false (file-exists? (build-path dir "Archive.rkt")))
       (check-equal? (file->string tasks) "#lang olai\nOnly\n")))))

;; ---- what the queries do with it -------------------------------------------

(module+ test
  (test-case "the agenda stops answering with archived work"
    (in-dir
     "olai-archive-agenda"
     (λ (dir)
       (define tasks
         (write-outline dir "Tasks.rkt"
                        (string-append "#lang olai\n"
                                       "Inbox\n"
                                       "  [/] Wire it\n"
                                       "  Buy milk\n"
                                       "    @date 2026-01-15\n")))
       (define (titles . paths)
         (define lk (apply loaded paths))
         (for/list ([g (in-list (agenda-groups-from-files
                                 (for/list ([o (in-list (linked-outlines lk))])
                                   (cons (outline-path o) (outline-tasks o)))
                                 "2026-08-06"))]
                    #:when #t
                    [it (in-list (cdr g))])
           (agenda-item-title it)))
       (check-equal? (sort (titles tasks) string<?) '("Buy milk" "Wire it"))
       (void (ops-archive! tasks "Buy milk" #:commit? #f))
       (define archive (build-path dir "Archive.rkt"))
       ;; loaded, keyed, mirrorable — and off the plate
       (check-equal? (titles tasks archive) '("Wire it"))
       (define lk (loaded tasks archive))
       (define moved
         (for*/or ([o (in-list (linked-outlines lk))]
                   [t (in-list (find-tasks-by-title (outline-tasks o) "Buy milk"))])
           t))
       (check-true (task? moved))
       (check-true (archived-task? moved))
       (check-true (string? (task-key moved)))))))
