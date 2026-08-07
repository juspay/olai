#lang racket/base

;; THE ROUTE TABLE: one declaration, two readings.
;;
;; `dispatch-rules` answers with a dispatcher AND a url generator minted from
;; the same patterns. This module is the one place that holds both, so a route
;; is spelled once: the pattern that MATCHES a request is the pattern that
;; WRITES every href pointing at it. The old arrangement kept the generator and
;; threw it away (`_url`), and every drawer got a prefix to append a key to —
;; which is a second spelling of the route, in a module that cannot see the
;; first.
;;
;; What comes back is a `routes`: the dispatcher, and one field per address the
;; app DRAWS. A node's is a procedure — the whole of "the address of a node",
;; and the reason a drawer can no longer assemble one. `/api/tree` and
;; `/api/agenda` are dispatched and have no field, which is not an oversight:
;; nothing on a page links to them, and an address nobody draws is an address
;; nobody needs minted.
;;
;; It knows nothing about what any route DOES. The handlers are arguments, and
;; they are what makes the table's entries distinct — `url` finds a route by
;; the identity of its handler, so two rules sharing one procedure would share
;; one address. web/serve is where the handlers and this table are tied.

(require racket/contract
         web-server/dispatch)

(provide (contract-out
          [make-routes
           (-> #:home procedure? #:node procedure? #:today procedure?
               #:events procedure?
               #:chat procedure? #:chat-new procedure? #:chat-cancel procedure?
               #:chat-sessions procedure? #:chat-load procedure?
               #:tree procedure? #:agenda procedure?
               #:not-found procedure?
               routes?)]
          ;; Flat checks on the way out, like every other boundary here: a
          ;; `->` on the handlers would wrap them, and a wrapper is a second
          ;; procedure for a table that matches routes by identity.
          [struct routes ([dispatch procedure?]
                          [home-href string?]
                          [today-href string?]
                          ;; a node's key -> its own page. The one address that
                          ;; takes an argument, and the only way to write one
                          [node-href procedure?]
                          [chat-href string?]
                          [chat-new-href string?]
                          [chat-cancel-href string?]
                          [chat-sessions-href string?]
                          [chat-load-href string?])]))

;; The dispatcher, and the addresses drawn on a page. One value, because the
;; two are one declaration and a surface handed only half of it would be a
;; surface that can disagree with the router.
(struct routes (dispatch
                home-href
                today-href
                node-href
                chat-href
                chat-new-href
                chat-cancel-href
                chat-sessions-href
                chat-load-href)
  #:transparent)

;; The whole of the app's URL space.
;;
;;   /              the html page: sidebar + outline + chat panel
;;   /n/<key>       one node, zoomed, at the key the load layer minted. Stable
;;                  across a rename — that is what makes it a permalink — and
;;                  across an ancestor's; NOT stable across an unanchored node
;;                  moving to a new ordinal, which is what ^anchor is for
;;                  (docs/cli.md)
;;   /today         today's Daily day node, zoomed
;;   /live/<boot>/events
;;                  the SSE stream. Mounted here and addressed nowhere: its
;;                  address is the TRANSPORT's (live-stream-path), because it
;;                  carries the identity of the process that drew the page. So
;;                  there is no field for it — a route this module minted an
;;                  href for would be this module claiming a name live/ owns
;;   /chat…         the panel's verbs, all POST but the picker's list
;;   /api/tree      byte-identical to `olai tree`
;;   /api/agenda    byte-identical to `olai agenda`
;;
;; Handlers take a request and whatever the pattern captured, the way
;; `dispatch-rules` calls them.
(define (make-routes #:home home #:node node #:today today
                     #:events events
                     #:chat chat #:chat-new chat-new #:chat-cancel chat-cancel
                     #:chat-sessions chat-sessions #:chat-load chat-load
                     #:tree tree #:agenda agenda
                     #:not-found not-found)
  (define-values (dispatch url)
    (dispatch-rules
     [("") home]
     [("n" (string-arg)) node]
     [("today") today]
     [("live" (string-arg) "events") events]
     [("chat") #:method "post" chat]
     [("chat" "new") #:method "post" chat-new]
     [("chat" "cancel") #:method "post" chat-cancel]
     [("chat" "sessions") chat-sessions]
     [("chat" "load") #:method "post" chat-load]
     [("api" "tree") tree]
     [("api" "agenda") agenda]
     [else not-found]))
  (routes dispatch
          (url home)
          (url today)
          (λ (key) (url node key))
          (url chat)
          (url chat-new)
          (url chat-cancel)
          (url chat-sessions)
          (url chat-load)))
