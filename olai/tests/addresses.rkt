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

(provide test-routes test-node-href test-search-href)

(define (stub) (λ _args (void)))

(define test-routes
  (make-routes #:home (stub) #:node (stub) #:today (stub) #:archive (stub)
               #:search (stub) #:events (stub)
               #:chat (stub) #:chat-new (stub) #:chat-cancel (stub)
               #:chat-sessions (stub) #:chat-load (stub)
               #:tree (stub) #:not-found (stub)))

;; A node's key -> its own page, the way every drawer gets it.
(define test-node-href (routes-node-href test-routes))

;; And a query -> the page that answers it; #f is the bare route, which is
;; where a query is asked.
(define test-search-href (routes-search-href test-routes))

;; ---- the table against the wire ---------------------------------------------
;;
;; Two claims, and neither has anything else holding it up.
;;
;; The routes are what they have always been. Nothing in the app spells them
;; any more, so a slip in the patterns would break no build and fail no render
;; test — it would break every bookmark anybody has.
;;
;; And each FIELD carries the route it is named for. `make-routes` fills a
;; nine-field struct from nine positional expressions, so swapping two lines
;; type-checks, passes every contract, and ships a panel whose "+ new" cancels
;; the turn. This is the check that would not let it.
(module+ test
  (require rackunit)

  (test-case "every minted address is the route it is named for"
    (check-equal? (routes-home-href test-routes) "/")
    (check-equal? (routes-today-href test-routes) "/today")
    (check-equal? (routes-archive-href test-routes) "/archive")
    (check-equal? (test-node-href "p1234abcd") "/n/p1234abcd")
    ;; an ^anchor is a key too, and the anchor grammar ([A-Za-z0-9_-]+) is
    ;; inside what a path segment may hold — so a minted address is the key,
    ;; unescaped, the way every permalink ever pasted has it
    (check-equal? (test-node-href "meeting-prep") "/n/meeting-prep")
    ;; the one address that carries something which is not a path segment:
    ;; having asked nothing is the bare route, and a query is escaped rather
    ;; than pasted — a search for "a b&c" is one address, not three
    (check-equal? (test-search-href #f) "/search")
    (check-equal? (test-search-href "milk") "/search?q=milk")
    (check-equal? (test-search-href "a b&c") "/search?q=a+b%26c")
    (check-equal? (routes-chat-href test-routes) "/chat")
    (check-equal? (routes-chat-new-href test-routes) "/chat/new")
    (check-equal? (routes-chat-cancel-href test-routes) "/chat/cancel")
    (check-equal? (routes-chat-sessions-href test-routes) "/chat/sessions")
    (check-equal? (routes-chat-load-href test-routes) "/chat/load")))
