#lang racket/base

;; The seams are contracted, and the blame is part of what they promise.
;;
;; A wrong value handed across a module boundary must name the CALLER — this
;; file — and the module whose contract it broke, with a srcloc an agent can
;; jump to. That is the difference between "expected string?, given 42" and a
;; regexp failing four frames deep inside someone else's regexp.

(require rackunit
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/index
         olai/lang/line
         olai/load
         olai/web/events
         olai/web/render
         olai/web/watch)

(define here "tests/contracts.rkt")

;; The caller is blamed, and the module that owns the contract is named.
(define ((blames owner) e)
  (define msg (exn-message e))
  (and (exn:fail:contract? e)
       (string-contains? msg "blaming:")
       (string-contains? msg here)
       (string-contains? msg owner)))

(module+ test
  (test-case "lang/line: a classification is a string away, and says so"
    (check-exn (blames "lang/line.rkt")
               (λ () (classify-line 42)))
    ;; and the other way: a kind predicate wants a classification, not a line
    (check-exn (blames "lang/line.rkt")
               (λ () (line-title? "Inbox"))))

  (test-case "load: try-load-outline takes a path, not a string"
    (check-exn (blames "load.rkt")
               (λ () (try-load-outline "/tmp/olai-no-such-file.rkt")))
    ;; minting keys is over outlines, not over bare task lists
    (check-exn (blames "load.rkt")
               (λ () (mint-outline-keys (list "not an outline")))))

  (test-case "index: files-data in, and a key is a string"
    (check-exn (blames "index.rkt")
               (λ () (outline-index "not files-data")))
    ;; the trail above a node is asked for by key, not by node
    (check-exn (blames "index.rkt")
               (λ () (node-ancestors (hash) (make-task #:title "T" #:key "k")))))

  (test-case "web/render: the renderer draws tasks, not titles"
    (check-exn (blames "render.rkt")
               (λ () (render-node-fragment "Buy milk" #:today "2026-08-04")))
    ;; a zoom is a node and the trail above it, both given: this layer draws
    ;; one, it does not look one up
    (check-exn (blames "render.rkt")
               (λ () (render-zoom "ship" '() #:today "2026-08-04" #:home-href "/")))
    ;; `today` is an argument, and it is a string: no clock, no #f
    (check-exn (blames "render.rkt")
               (λ () (render-node-fragment (make-task #:title "T" #:key "k")
                                           #:today #f))))

  (test-case "web/events: an event is a name and a payload, both strings"
    (check-exn (blames "events.rkt")
               (λ () (sse-frame 'outline "1")))
    (check-exn (blames "events.rkt")
               (λ () (hub-broadcast! (make-hub) "outline" 7))))

  (test-case "web/watch: the midnight boundary is a moment, not a clock reading"
    (check-exn (blames "watch.rkt")
               (λ () (seconds-until-midnight "2026-08-05T00:00")))))
