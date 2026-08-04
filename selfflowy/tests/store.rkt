#lang racket/base

;; The snapshot layer: reload on change (fresh namespace), transitive watch
;; set, last-good on a broken file. Temp dirs only, never personal data.

(require rackunit
         racket/file
         racket/list
         racket/path
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/load
         selfflowy/store)

(define (with-temp-dir proc)
  (define dir (make-temporary-file "sfstore~a" 'directory))
  (dynamic-wind void (λ () (proc dir)) (λ () (delete-directory/files dir))))

(define (write-file! path text)
  (make-parent-directory* path)
  (display-to-file text path #:exists 'truncate/replace))

(define (titles snap)
  (for*/list ([o (in-list (snapshot-outlines snap))]
              [tk (in-list (outline-tasks o))])
    (task-title tk)))

(module+ test
  (test-case "a store reloads a file that changed on disk"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang selfflowy\nInbox\n")
       (define st (make-store (list f)))
       (check-equal? (titles (store-snapshot st)) '("Inbox"))
       (check-false (store-error st))
       ;; the module registry would hand back "Inbox" forever; the store
       ;; reloads through a fresh namespace instead
       (write-file! f "#lang selfflowy\nInbox\nSomeday maybe\n")
       (store-invalidate! st)
       (check-equal? (titles (store-snapshot st)) '("Inbox" "Someday maybe"))
       ;; tasks stay real tasks across the reload (one struct type, attached)
       (check-true (task? (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))))))

  (test-case "a broken file keeps last-good and records file:line:col"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang selfflowy\nInbox\n  Buy milk\n")
       (define st (make-store (list f)))
       (write-file! f "#lang selfflowy\nInbox\n  Buy milk\n    @date nope\n")
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
       (write-file! f "#lang selfflowy\nInbox\n  Buy milk\n  Buy bread\n")
       (store-invalidate! st)
       (check-false (store-error st))
       (check-equal? (length (task-children
                              (car (outline-tasks
                                    (car (snapshot-outlines (store-snapshot st)))))))
                     2))))

  (test-case "watch set covers transitive @include fragments"
    (with-temp-dir
     (λ (dir)
       (define root (build-path dir "Daily.rkt"))
       (define mid (build-path dir "Daily" "2026-08.rkt"))
       (define leaf (build-path dir "Daily" "extra.rkt"))
       (write-file! leaf "#lang selfflowy\n2026-08-04\n")
       (write-file! mid "#lang selfflowy\nAugust\n  @include extra.rkt\n")
       (write-file! root "#lang selfflowy\n2026\n  @include Daily/2026-08.rkt\n")
       (define st (make-store (list root)))
       (define watched (map path->string (snapshot-watch (store-snapshot st))))
       (for ([p (in-list (list root mid leaf))])
         (check-not-false (member (path->string (simple-form-path p)) watched)
                          (format "~a not watched: ~a" p watched)))
       ;; editing a fragment two levels down invalidates the snapshot
       (write-file! leaf "#lang selfflowy\n2026-08-04\n  Ship the store\n")
       (store-invalidate! st)
       (define t (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))
       (define day (car (task-children (car (task-children t)))))
       (check-equal? (map task-title (task-children day)) '("Ship the store")))))

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
       (write-file! f "#lang selfflowy\nProjects\n  Ship it\n    Write the docs\n")
       (define st (make-store (list f)))
       (define before (all-keys (store-snapshot st)))
       (define (key-of pairs title) (cadr (assoc title pairs)))
       ;; rename every ancestor of "Write the docs"
       (write-file! f "#lang selfflowy\nWork\n  Ship the thing\n    Write the docs\n")
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
       (write-file! f "#lang selfflowy\nInbox\n  Call\n    mum\n  Call\n    dad\n")
       (define st (make-store (list f)))
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
       (write-file! f "#lang selfflowy\nInbox\n  Ship it ^ship\n")
       (define st (make-store (list f)))
       (define tk (car (task-children
                        (car (outline-tasks (car (snapshot-outlines (store-snapshot st))))))))
       (check-equal? (task-key tk) "ship")
       ;; moved and renamed: still ^ship
       (write-file! f "#lang selfflowy\nLater\nInbox\n  Sub\n    Ship it now ^ship\n")
       (store-invalidate! st)
       (define snap (store-snapshot st))
       (check-not-false (hash-ref (snapshot-index snap) "ship" #f)))))

  (test-case "an index and merged anchors are derived once per load"
    (with-temp-dir
     (λ (dir)
       (define a (build-path dir "Tasks.rkt"))
       (define b (build-path dir "Roadmap.rkt"))
       (write-file! a "#lang selfflowy\nInbox\n  Buy milk\n")
       (write-file! b "#lang selfflowy\nShip it ^ship\n")
       (define st (make-store (list a b)))
       (define snap (store-snapshot st))
       (check-equal? (length (snapshot-files-data snap)) 2)
       (check-true (hash-has-key? (snapshot-anchors snap) "ship"))
       (check-true (hash-has-key? (snapshot-index snap) "ship"))
       ;; every node is in the index, keyed by its node id
       (check-equal? (hash-count (snapshot-index snap)) 3)))))
