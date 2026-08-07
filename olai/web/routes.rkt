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
         ;; a query in an address is escaped by the library that owns the
         ;; escaping, never by hand
         (only-in net/uri-codec alist->form-urlencoded)
         web-server/dispatch)

(provide (contract-out
          ;; The handlers are checked FLAT, and that is not laziness: a `->`
          ;; contract wraps a procedure, and a wrapper is a second procedure —
          ;; while the table below finds a route by the identity of its
          ;; handler. What each one is called with is the dispatcher's
          ;; business, and web-server's.
          [make-routes
           (-> #:home procedure? #:node procedure? #:today procedure?
               #:search procedure? #:events procedure?
               #:chat procedure? #:chat-new procedure? #:chat-cancel procedure?
               #:chat-sessions procedure? #:chat-load procedure?
               #:tree procedure? #:agenda procedure?
               #:not-found procedure?
               routes?)]
          [struct routes ([dispatch procedure?]
                          [home-href string?]
                          [today-href string?]
                          ;; a node's key -> its own page. The one address that
                          ;; takes an argument, and the only way to write one —
                          ;; so it is the one that says its shape, where the
                          ;; handlers above cannot
                          [node-href (-> string? string?)]
                          ;; a query -> the page that answers it, and #f -> the
                          ;; bare route, which is where a query is ASKED (the
                          ;; box's form action). A procedure for the same reason
                          ;; a node's is, and one field rather than two: having
                          ;; asked nothing is an argument, not a second address
                          [search-href (-> (or/c string? #f) string?)]
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
                search-href
                chat-href
                chat-new-href
                chat-cancel-href
                chat-sessions-href
                chat-load-href)
  #:transparent)

;; A minted path, plus what was typed into the box that asked for it. Having
;; asked NOTHING is the bare path: an address with an empty query in it says
;; the same thing at more length, and the two would then be two addresses for
;; one page. `dispatch-rules` mints paths and knows nothing about query
;; strings, which is why this line is here and not in the generator.
(define (query-href path query)
  (if query
      (string-append path "?" (alist->form-urlencoded (list (cons 'q query))))
      path))

;; The whole of the app's URL space.
;;
;;   /              the html page: sidebar + outline + chat panel
;;   /n/<key>       one node, zoomed, at the key the load layer minted. Stable
;;                  across a rename — that is what makes it a permalink — and
;;                  across an ancestor's; NOT stable across an unanchored node
;;                  moving to a new ordinal, which is what ^anchor is for
;;                  (docs/cli.md)
;;   /today         today's Daily day node, zoomed
;;   /search?q=…    the same outline with the search palette open on what the
;;                  query names. The one route whose address carries something
;;                  that is not a path segment, so it is the one field that
;;                  writes a query string — escaped by net/uri-codec, here,
;;                  where the route it belongs to is
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
                     #:search search #:events events
                     #:chat chat #:chat-new chat-new #:chat-cancel chat-cancel
                     #:chat-sessions chat-sessions #:chat-load chat-load
                     #:tree tree #:agenda agenda
                     #:not-found not-found)
  (define-values (dispatch url)
    (dispatch-rules
     [("") home]
     [("n" (string-arg)) node]
     [("today") today]
     [("search") search]
     [("live" (string-arg) "events") events]
     [("chat") #:method "post" chat]
     [("chat" "new") #:method "post" chat-new]
     [("chat" "cancel") #:method "post" chat-cancel]
     [("chat" "sessions") chat-sessions]
     [("chat" "load") #:method "post" chat-load]
     [("api" "tree") tree]
     [("api" "agenda") agenda]
     [else not-found]))
  ;; One line per field, each naming the handler it is minted from, in the
  ;; struct's own order — a swap here would put the cancel route in the field
  ;; the panel's "+ new" reads. Nothing in Racket makes that mechanical, so
  ;; the module's own test walks every field against the wire.
  (routes dispatch
          (url home)
          (url today)
          (λ (key) (url node key))
          (λ (query) (query-href (url search) query))
          (url chat)
          (url chat-new)
          (url chat-cancel)
          (url chat-sessions)
          (url chat-load)))
