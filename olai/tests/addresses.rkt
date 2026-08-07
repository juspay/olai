#lang racket/base

;; The app's own route table, for the suites that draw a page without serving
;; one.
;;
;; A renderer is HANDED the address of a node (web/routes) rather than a prefix
;; to append a key to, so a test has to hand it one too — and the honest one to
;; hand it is the app's, minted from the same declaration the router dispatches
;; with. A suite that spelled "/n/" for itself would be asserting its own
;; string, which is how a link that pointed nowhere passed for a year.
;;
;; The handlers are here only to be DISTINCT: the table finds a route by the
;; identity of its handler, and nothing in these suites dispatches a request.

(require olai/web/routes)

(provide test-routes test-node-href)

(define (stub) (λ _args (void)))

(define test-routes
  (make-routes #:home (stub) #:node (stub) #:today (stub) #:events (stub)
               #:chat (stub) #:chat-new (stub) #:chat-cancel (stub)
               #:chat-sessions (stub) #:chat-load (stub)
               #:tree (stub) #:agenda (stub) #:not-found (stub)))

;; A node's key -> its own page, the way every drawer gets it.
(define test-node-href (routes-node-href test-routes))
