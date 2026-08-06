#lang racket/base

;; Node addressing: key -> node, and the trail above it. Hand-built trees, no
;; files, no store — this is a pure function of one loaded shape.
;;
;; Keys here are minted the way tests/render.rkt mints them (off the title), so
;; a test reads as "the node called X". Real keys come from the load layer; see
;; tests/store.rkt for those.

(require rackunit
         file/sha1
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk resolve-mirrors)
         olai/index)

(define (title-key title)
  (string-append
   "p" (substring (sha1 (open-input-bytes (string->bytes/utf-8 title))) 0 8)))

(define (tk title kids #:id [id #f])
  (make-task #:title title #:id id #:children kids
             #:key (or id (title-key title))))

(define (files . entries) entries)

(module+ test
  (define fd
    (files (list "/tmp/Tasks.rkt"
                 (list (tk "Inbox" (list (tk "Buy milk" (list (tk "2% please" '())))))
                       (tk "Ship it" '() #:id "ship")))
           (list "/tmp/Daily.rkt" (list (tk "2026-08-04" '())))))

  (define idx (outline-index fd))

  (test-case "every node is indexed, by its own key, with its parent's"
    (check-equal? (hash-count idx) 5)
    (define e (hash-ref idx (title-key "Buy milk")))
    (check-equal? (task-title (node-entry-task e)) "Buy milk")
    (check-equal? (node-entry-parent e) (title-key "Inbox"))
    ;; the file is named the way a human reads it, not by full path
    (check-equal? (node-entry-file e) "Tasks.rkt")
    ;; a top-level node has no parent, and an anchored one keys by its anchor
    (check-equal? (node-entry-parent (hash-ref idx "ship")) #f)
    (check-equal? (node-entry-file (hash-ref idx (title-key "2026-08-04"))) "Daily.rkt"))

  (test-case "the trail above a node is the file, then its ancestors"
    ;; outermost first, and the node itself is NOT in it: a breadcrumb says
    ;; where you are, not that you are here
    (check-equal? (node-ancestors idx (title-key "2% please"))
                  (list "Tasks.rkt"
                        (list "Inbox" (title-key "Inbox"))
                        (list "Buy milk" (title-key "Buy milk"))))
    (check-equal? (node-ancestors idx (title-key "Buy milk"))
                  (list "Tasks.rkt" (list "Inbox" (title-key "Inbox"))))
    ;; a top-level node has only the file above it
    (check-equal? (node-ancestors idx "ship") (list "Tasks.rkt"))
    (check-equal? (node-ancestors idx (title-key "2026-08-04")) (list "Daily.rkt")))

  (test-case "an unknown key has no trail at all"
    ;; a node deleted (or re-keyed) under a tab that was zoomed on it: the
    ;; caller draws "no such node", and has nothing to ask about it
    (check-equal? (node-ancestors idx "pdeadbeef") '())
    (check-false (hash-ref idx "pdeadbeef" #f)))

  (test-case "renaming an ancestor changes the crumb, not the address"
    ;; the trail is derived when it is asked for, so it reads the titles the
    ;; snapshot has now — while the keys, which are what the crumbs link to,
    ;; stay put
    (define renamed
      (files (list "/tmp/Tasks.rkt"
                   (list (make-task #:title "In" #:key (title-key "Inbox")
                                    #:children
                                    (list (tk "Buy milk" '())))))))
    (define idx2 (outline-index renamed))
    (check-equal? (node-ancestors idx2 (title-key "Buy milk"))
                  (list "Tasks.rkt" (list "In" (title-key "Inbox")))))

  (test-case "a mirror site is not a second address for the node"
    ;; a mirror site IS the node it points at; the defining site owns the key,
    ;; and the trail is the one the node is defined at
    (define mirrored
      (files (list "/tmp/Tasks.rkt"
                   (resolve-mirrors
                    (list (tk "Inbox" (list (tk "Ship it" '() #:id "ship")))
                          (tk "Later" (list (mirror-ref "ship" #f))))
                    (hash "ship" (tk "Ship it" '() #:id "ship"))))))
    (define midx (outline-index mirrored))
    (check-equal? (node-ancestors midx "ship")
                  (list "Tasks.rkt" (list "Inbox" (title-key "Inbox"))))
    ;; Inbox, Ship it, Later — the mirror site adds no fourth address
    (check-equal? (hash-count midx) 3)))
