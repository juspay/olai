#lang racket/base

;; The read-mostly web view: what each route ANSWERS, and the socket it
;; answers on.
;;
;; The routes themselves are next door (web/routes) and are not restated here —
;; an enumeration of the URL space in a comment is the same second spelling
;; this module used to keep in code. This one hands that table its handlers and
;; gets back both a dispatcher and every address a page draws; nothing here,
;; and nothing under here, assembles a path out of a prefix and a key.
;;
;; Three things ARE mounted here rather than routed, because each is a
;; directory or a generated file rather than a page: /static/* (web/assets),
;; /live/* (the framework's client runtime), /media/* (pictures beside the
;; outlines), and the generated stylesheet at web/skin's own URL. Each is owned
;; by the module that WRITES the src; this one only mounts them. Anything else
;; is a 404, terse text/plain.
;;
;; No auth: the network is the auth (Tailscale / Caddy in front of it).
;; Routing, static files, and MIME types come from racket web-server. Outline
;; content comes from olai/store — this module owns handlers and responses,
;; never a load.
;;
;; Live updates are four parts that only meet here: the store knows WHAT the
;; outlines are, the watcher knows WHEN they moved, the hub (the `live`
;; collection — a framework, and olai is its first consumer) knows WHO is
;; listening, and web/live knows what a revision MEANS to a client that has
;; been away. None of them knows about the others. The agent conversation
;; (web/chat, over olai/acp) is a fifth of the same kind — it pushes `chat`
;; through the same hub and has never heard of HTTP; the /chat routes below are
;; the only place the two meet.
;;
;; The chat routes answer with a STATUS, never with content: what a panel
;; draws arrives over the stream, so every open tab shows the same
;; conversation whichever one typed into it — including the tab that has just
;; opened, which the stream catches up before anything else.

(require racket/async-channel
         racket/match
         racket/path
         racket/port
         racket/promise
         racket/string
         racket/tcp
         (for-syntax racket/base)
         json
         net/url
         racket/runtime-path
         web-server/web-server
         web-server/http
         web-server/dispatchers/dispatch
         web-server/dispatchers/filesystem-map
         (prefix-in files: web-server/dispatchers/dispatch-files)
         (prefix-in filter: web-server/dispatchers/dispatch-filter)
         (prefix-in lift: web-server/dispatchers/dispatch-lift)
         (prefix-in sequencer: web-server/dispatchers/dispatch-sequencer)
         (only-in web-server/private/mime-types make-path->mime-type)
         ;; which of the loaded outlines is the archive: the home page draws
         ;; the others, and one page draws it
         (only-in olai/archive live-entries archived-entries)
         olai/dates
         ;; a node's title, for the tab a zoom page opens in
         (only-in olai/lang/expander task-title)
         ;; key -> node, and the trail above it (what a breadcrumb is drawn from)
         (only-in olai/index node-entry-task node-ancestors)
         olai/json/model
         olai/json/reply
         olai/load
         (only-in olai/ops exn:fail:op? exn:fail:op-kind)
         (only-in olai/paths file-label root-dir)
         ;; what the typed-edge graph is asked: which nodes are waiting
         (only-in olai/query blocked-nodes)
         ;; which nodes a query names: a pure question about the snapshot
         (only-in olai/search search-outlines)
         olai/store
         ;; the transport, and the assets that drive it in the browser: a
         ;; framework this app is only a consumer of (live/README.md)
         live/hub
         (only-in live/frame make-frame live-boot-current?)
         (only-in live/client live-static-dir)
         olai/web/chat
         ;; olai's side of that contract: the event name, the region's id, and
         ;; what a store revision means on the wire, and to a client that has
         ;; been away
         olai/web/live
         ;; the one declaration every URL in this app comes out of: the
         ;; dispatcher and every href pointing at it, minted together
         olai/web/routes
         ;; the sheet and its URL; which modules it is made of is skin's
         olai/web/skin
         ;; the facts about the palettes a page carries before the sheet
         ;; lands, from the module that owns them
         (only-in olai/web/theme theme-color-scheme theme-default-paper)
         olai/web/render
         ;; where the pictures a note draws are asked for; the module that
         ;; writes the src owns the prefix, this one mounts it
         (only-in olai/web/markdown media-prefix media-extensions)
         (only-in olai/web/chat-panel render-chat-panel)
         (only-in olai/web/search render-search-panel)
         olai/web/watch)

(provide start-server)

;; static files: render owns the directory and the URL prefix (it also
;; writes the <head> that links them); this module only mounts them.
(define-runtime-path mime-types-path
  (list 'lib "default-web-root/mime.types" "web-server"))

;; ---- responses ------------------------------------------------------------

(define (html-response str #:code [code 200])
  (response/output
   (λ (out) (write-string str out))
   #:code code
   #:mime-type #"text/html; charset=utf-8"))

;; write-json + newline: the same bytes the CLI writes to stdout.
(define (json-response js #:code [code 200])
  (response/output
   (λ (out)
     (write-json js out)
     (newline out))
   #:code code
   #:mime-type #"application/json; charset=utf-8"))

;; The skin is code, and it is the same string for the life of the process:
;; built once, on the first request that asks for it.
(define the-stylesheet (delay (stylesheet)))

;; no-cache is not "do not cache": it is "ask first". The sheet changes when
;; the Racket modules do, which a URL that never moves cannot say, so a browser
;; that kept a copy has to revalidate before it trusts it.
(define (css-response)
  (response/output
   (λ (out) (write-string (force the-stylesheet) out))
   #:headers (list (make-header #"Cache-Control" #"no-cache"))
   #:mime-type #"text/css; charset=utf-8"))

;; application/manifest+json is not in the stock mime.types table, and a
;; browser that gets application/octet-stream will not install. The bytes
;; live next to the other assets; only the MIME is special.
(define (manifest-response)
  (define path (build-path (web-static-dir) "manifest.webmanifest"))
  (response/output
   (λ (out)
     (call-with-input-file path
       (λ (in) (copy-port in out))))
   #:headers (list (make-header #"Cache-Control" #"no-cache"))
   #:mime-type #"application/manifest+json; charset=utf-8"))

(define (text-response str #:code [code 200])
  (response/output
   (λ (out) (write-string str out))
   #:code code
   #:mime-type #"text/plain; charset=utf-8"))

(define (not-found-response)
  (text-response "404 not found\n" #:code 404))

;; Accepted, nothing to say: no body, and no Content-Type to lie about one.
(define (no-content-response)
  (response/output void #:code 204 #:mime-type #f))

;; ---- the store ------------------------------------------------------------

;; Every route starts here: refresh the store (a cheap mtime probe unless a
;; file actually changed), then hand the handler ONE consistent snapshot and
;; the revision it is.
;;
;; The revision is read BEFORE the snapshot, and that order is not a
;; preference. The watcher reloads on its own thread; read the other way round,
;; a reload landing between the two reads would have a page claiming a revision
;; NEWER than the markup it is showing — and a page that claims to be current
;; is a page nothing will ever tell to catch up. Read this way the worst case
;; is a page that understates where it is, and is told to re-fetch something it
;; already has.
;;
;; A live load error means the file is mid-edit. JSON routes fail loudly —
;; agents must never be handed stale data quietly — while the page keeps the
;; last good content and shows the error in its banner (#:stale-ok? #t). With
;; no last-good snapshot at all, everything fails.
(define (with-snapshot st fail proc #:stale-ok? [stale-ok? #f])
  (store-invalidate! st)
  (define rev (store-revision st))
  (define snap (store-snapshot st))
  (define err (store-error st))
  (if (and err (or (not stale-ok?) (null? (snapshot-outlines snap))))
      (fail rev err)
      (proc rev snap err)))

(define (load-error->json err)
  (err-hash (load-error-message err)
            #:file (load-error-file err)
            #:line (load-error-line err)
            #:col (load-error-col err)))

;; A JSON route has no live view and no page: the revision is a fact about a
;; page's markup, and there is none here.
(define (json-failure _rev err)
  (json-response (load-error->json err) #:code 500))

(define (error-banner err)
  (render-error-banner (load-error-detail err) #:where (load-error-where err)))

;; The state the outlines are in right now, as the wire names it. Both the
;; broadcast and the catch-up ask this, so neither can invent a spelling.
(define (cursor-now st) (outline-cursor (store-revision st)))

;; What the graph says is not actionable yet, of the snapshot a handler already
;; holds. Asked here rather than by the store, which says WHEN the outlines are
;; what they are and answers no questions about them — the CLI composes these
;; same two calls for the same reason (olai/cli).
(define (blocked-of snap) (blocked-nodes (snapshot-edges snap)))

;; ---- reading a request ------------------------------------------------------

;; What a request CARRIES, as opposed to what its address says. Two surfaces
;; read one — a chat message and a query — and both mean the same thing by a
;; field that is missing, empty, or nothing but spaces: nothing was said. So
;; there is one answer to it, #f, and nothing downstream holds an opinion about
;; the empty string. The query string and a posted form are the same table as
;; far as `request-bindings/raw` is concerned, which is why one reader serves
;; both.
(define (form-field req name)
  (define b (bindings-assq name (request-bindings/raw req)))
  (cond
    [(binding:form? b)
     (define s (string-trim (bytes->string/utf-8 (binding:form-value b))))
     (and (non-empty-string? s) s)]
    [else #f]))

;; ---- handlers: the chat panel ---------------------------------------------

;; The panel's chrome, and nothing about the conversation: what a page load
;; could say about one is only as current as the moment it was drawn, and the
;; agent boots in its own thread. The conversation arrives on the stream, which
;; catches a connection up on the way in (web/chat) — which is also why this is
;; one value rather than a render: every page gets the same markup, and only
;; the routes it names could ever change it, and those are minted once beside
;; the dispatcher. No agent, no panel — `serve` refuses to start without one
;; (docs/cli.md), so that is a test's server, not a user's.
;;
;; All POST, all 204: the reply the panel renders comes back over the stream.
;; The one GET is the picker's list, which is a thing to draw rather than a
;; thing that happened, so it answers with content.
(define (chat-panel rs)
  (render-chat-panel #:send-href (routes-chat-href rs)
                     #:new-href (routes-chat-new-href rs)
                     #:cancel-href (routes-chat-cancel-href rs)
                     #:sessions-href (routes-chat-sessions-href rs)
                     #:load-href (routes-chat-load-href rs)
                     #:event chat-event-name))

;; The conversation's failure kinds, as statuses: 'busy is a second prompt
;; while a turn runs, 'validation is an agent that has been stopped. Terse
;; text/plain bodies — the panel shows them as one inline line.
(define (with-agent-op proc)
  (with-handlers ([exn:fail:op?
                   (λ (e)
                     (text-response (string-append (exn-message e) "\n")
                                    #:code (case (exn:fail:op-kind e)
                                             [(busy) 409]
                                             [else 503])))])
    (proc)))

(define (no-agent-response)
  (text-response "no agent\n" #:code 503))

(define (chat-handler agent req)
  (cond
    [(not agent) (no-agent-response)]
    [else
     (define text (form-field req #"text"))
     (if text
         (with-agent-op (λ () (chat-prompt! agent text) (no-content-response)))
         (text-response "chat: a message is required\n" #:code 400))]))

;; New chat and cancel say nothing either: the `reset` / `done` frame that
;; follows is what every open panel acts on.
(define (chat-new-handler agent)
  (if agent
      (with-agent-op (λ () (chat-reset! agent) (no-content-response)))
      (no-agent-response)))

(define (chat-cancel-handler agent)
  (if agent
      (with-agent-op (λ () (chat-cancel! agent) (no-content-response)))
      (no-agent-response)))

;; The picker's two routes. The list is asked of the AGENT on every request —
;; it is the only thing that knows what it has stored, and a cached copy would
;; be wrong the moment another client wrote a session.
(define (chat-sessions-handler agent)
  (if agent
      (with-agent-op
       (λ () (json-response (hash 'sessions (chat-sessions agent)))))
      (no-agent-response)))

;; Picking one says nothing either: the reset, the replayed turns and the
;; session frame all arrive on the stream, so every open tab repopulates.
(define (chat-load-handler agent req)
  (cond
    [(not agent) (no-agent-response)]
    [else
     (define id (form-field req #"id"))
     (if id
         (with-agent-op (λ () (chat-load! agent id) (no-content-response)))
         (text-response "chat: a session id is required\n" #:code 400))]))

;; ---- handlers: pages and JSON ---------------------------------------------

;; What the tab says: the outline's own name when the server is showing one,
;; else the app's. Asked of the SNAPSHOT and not of what the server was
;; started on — a directory's roots are discovered as they appear, so a second
;; outline showing up is a page that stops being named after the first.
(define (page-title snap)
  (match (snapshot-files-data snap)
    [(list (list file _tasks)) (file-label file)]
    [_ "olai"]))

;; EVERY page this module answers with, and the one altitude the <head>, the
;; sheet and the palettes are decided at: a route hands over the pane it drew
;; and what goes around it. The failure page is this too — a pane saying there
;; is nothing loaded, no sidebar to draw one from, and a 500 — so there is one
;; place a page's shape is stated rather than two that can come to differ.
;;
;; The overlays sit in body-extra, OUTSIDE #ol-live: an outline event re-swaps
;; the live region, and neither a chat mid-turn nor a search box mid-word may
;; be swapped out from under the person typing into it.
(define (chrome main
                #:title title
                #:href href
                #:cursor cursor
                #:sidebar [sidebar #f]
                #:banner [banner #f]
                #:overlays [overlays '()]
                #:code [code 200])
  (html-response
   (page->html-string
    (render-page main
                 #:title title
                 #:stylesheet-href stylesheet-href
                 #:color-scheme theme-color-scheme
                 #:theme-color theme-default-paper
                 #:sidebar sidebar
                 #:banner banner
                 #:href href
                 #:cursor cursor
                 #:body-extra overlays))
   #:code code))

;; The file tree and the chrome above it, over one snapshot. `files-data` is
;; the LIVE outlines: the archive has a page of its own and is not in the tree
;; on any of them (olai/archive), this one included — the sidebar is a region,
;; and the tree it holds has to say the same thing whichever address answered.
(define (page-sidebar rs files-data #:href href)
  (render-sidebar files-data
                  #:home-href (routes-home-href rs)
                  #:today-href (routes-today-href rs)
                  #:archive-href (routes-archive-href rs)
                  #:href href
                  #:node-href (routes-node-href rs)))

;; The palette, on every page: `/` opens it wherever you are, so it is chrome
;; and not a page of its own. What a query NAMES is a question about the
;; snapshot the page was drawn from — which is why this is built per request,
;; where the chat panel is one value for the life of the process. Both of its
;; addresses come off the one field the route table mints them from: the bare
;; route is where a query is asked, and this query's own address is what the
;; results region re-fetches when a file moves.
(define (search-panel rs snap query)
  (define search-href (routes-search-href rs))
  (render-search-panel #:action-href (search-href #f)
                       #:results-href (search-href query)
                       #:query query
                       #:hits (if (and snap query)
                                  (search-outlines (snapshot-files-data snap) query)
                                  '())
                       #:node-href (routes-node-href rs)))

;; Everything a page carries outside its regions, in the order they are drawn.
;; `snap` is #f when there is nothing loaded at all — the palette is still on
;; the page, with nothing to find in it.
(define (page-overlays rs snap query chat)
  (cons (search-panel rs snap query) (if chat (list chat) '())))

;; Every page here is the same shape: one snapshot, the chrome around it, and a
;; live region that re-fetches THIS url on an `outline` event. `view` is handed
;; the snapshot — and the live outlines out of it, which the chrome needed
;; anyway — and answers (values main title), the only thing four pages differ
;; in. It is handed nothing about the live view: every link on the page names
;; the region it aims at (web/render declares it), so there is no longer a
;; per-page value for a drawer to be given, or to forget.
;;
;; `rs` is the route table, and it is what every page draws its links out of.
;; `chat` is the panel, or #f when there is no agent to talk to.
;;
;; Nothing loaded AT ALL — the first load failed — is the same page with the
;; pane saying so, no tree to draw a sidebar from, and a 500. Still live: the
;; next save is what fixes it, and the client should not have to reload to find
;; that out.
;;
;; `#:query` is what the search box was drawn with — #f on every page but the
;; one a query asked for.
(define (outline-page st rs chat live-href view #:query [query #f])
  (with-snapshot st
    (λ (rev err)
      (chrome (empty-pane rs "No outline loaded.")
              #:title "olai"
              #:href live-href
              #:cursor (outline-cursor rev)
              #:overlays (page-overlays rs #f query chat)
              #:banner (error-banner err)
              #:code 500))
    #:stale-ok? #t
    (λ (rev snap err)
      ;; The LIVE outlines, once per page: the sidebar draws them on every one
      ;; of them, the archive page included, and the home page's own pane is
      ;; the same list.
      (define live (live-entries (snapshot-files-data snap)))
      (define-values (main title) (view snap live))
      (chrome main
              #:title title
              #:href live-href
              #:cursor (outline-cursor rev)
              #:sidebar (page-sidebar rs live #:href live-href)
              ;; the palette searches the LIVE outlines too: archived work has
              ;; a page of its own and is not an answer to a query (Roadmap,
              ;; archive; olai/search)
              #:overlays (page-overlays rs snap query chat)
              #:banner (and err (error-banner err))))))

;; One node, zoomed: the node and the trail above it, both asked of the
;; snapshot's index — the only thing that knows either.
(define (zoom-pane rs snap entry today)
  (render-zoom (node-entry-task entry)
               (node-ancestors (snapshot-index snap) entry)
               #:today today
               #:home-href (routes-home-href rs)
               #:node-href (routes-node-href rs)

               ;; the @doc documents as of this snapshot; the renderer opens
               ;; no files (web/render)
               #:docs (snapshot-docs snap)
               ;; and what the graph says is not actionable yet, from the same
               ;; snapshot: one load, one answer, on every page that draws a
               ;; node
               #:blocked (blocked-of snap)))

;; "Nothing here", with the addresses every pane is drawn with: the trail is
;; empty, and home is still somewhere to go.
(define (empty-pane rs message)
  (render-empty-pane message
                     #:home-href (routes-home-href rs)
                     #:node-href (routes-node-href rs)))

;; The key a page was asked for, as a node, or #f. Both zoom routes go through
;; here, and each says in its own words what #f means.
(define (node-at index key)
  (and key (hash-ref index key #f)))

;; The whole outline, as a pane. The home page is this, and so is a search:
;; the palette is over the page you were reading, not instead of it.
;; The live outlines, as a pane. The home page is this, and so is a search:
;; the palette is over the page you were reading, not instead of it.
(define (outline-pane rs snap live)
  (render-outline live
                  #:today (today-iso-string)
                  #:node-href (routes-node-href rs)
                  #:docs (snapshot-docs snap)
                  #:blocked (blocked-of snap)))

(define (page-handler st rs chat)
  (outline-page st rs chat (routes-home-href rs)
   (λ (snap live)
     (values (outline-pane rs snap live) (page-title snap)))))

;; A query, as a page.
;;
;; It answers with the outline and a palette open over it, which makes
;; /search?q=… a permalink to a query: what a browser running no JS gets when
;; it submits the box, and what a shared link opens. A browser that IS running
;; it rarely loads this page — the box re-fetches the results region alone, and
;; the page it is on never moves.
;;
;; `q` missing and `q` blank are the same request: nothing was asked. One
;; spelling for it (#f) all the way down, so nothing below has to hold an
;; opinion about the empty string.
(define (search-handler st rs chat req)
  (define q (form-field req #"q"))
  (outline-page st rs chat ((routes-search-href rs) q) #:query q
   (λ (snap live)
     (values (outline-pane rs snap live)
             (if q (string-append "search " q) "olai")))))

;; What was archived, on a page of its own.
;;
;; A page rather than a filter with a toggle: archived work is not a state of
;; the outline you are reading, it is another outline — one file, drawn the
;; ordinary way, with the ordinary permalinks under it. Nothing about it is
;; special except that the home page does not draw it, and every node on it is
;; still zoomable, still mirrorable, still there.
(define (archive-handler st rs chat)
  (outline-page st rs chat (routes-archive-href rs)
   (λ (snap _live)
     (define entries (archived-entries (snapshot-files-data snap)))
     (values (if (null? entries)
                 (empty-pane rs "Nothing archived yet.")
                 (render-outline entries
                                 #:today (today-iso-string)
                                 #:node-href (routes-node-href rs)
                                 #:docs (snapshot-docs snap)))
             "archive"))))

;; A node's permalink.
;;
;; A key the snapshot has no node for is not a 404: a node can be deleted, or
;; an unanchored one re-keyed, while a tab sits zoomed on it, and that tab
;; re-fetches this very page to find out. An error status would leave it
;; showing a node that is gone. The snapshot is the source of truth about what
;; exists; this route only asks it, and says what it heard.
(define (node-handler st rs chat key)
  (outline-page st rs chat ((routes-node-href rs) key)
   (λ (snap _live)
     (define entry (node-at (snapshot-index snap) key))
     (if entry
         ;; a tab zoomed on one node should say which
         (values (zoom-pane rs snap entry (today-iso-string))
                 (task-title (node-entry-task entry)))
         (values (empty-pane rs "No such node.") "olai")))))

;; Today's Daily day node, zoomed. Finding today's key is a question about the
;; DAY; the answer goes through the same zoom pane as any permalink, and
;; nothing under this line knows what day it is.
;;
;; It stays a page rather than a redirect to /n/<key>: the key it resolves to
;; changes at local midnight (the watcher pushes an `outline` event then, which
;; this page re-fetches on), and before the first capture of the day there is
;; no key to redirect to. Both are ordinary states of "today", and a page
;; frozen to the key today HAD would be neither.
(define (today-handler st rs chat)
  (outline-page st rs chat (routes-today-href rs)
   (λ (snap _live)
     (define today (today-iso-string))
     (define entry (node-at (snapshot-index snap) (snapshot-day-key snap today)))
     (values (if entry
                 (zoom-pane rs snap entry today)
                 ;; no day node yet is the normal state before the first
                 ;; capture of the day, not an error
                 (empty-pane rs
                             (format "No day node for ~a. Run: olai daily" today)))
             (string-append "today " today)))))

(define (tree-handler st)
  (with-snapshot st json-failure
    (λ (_rev snap _err) (json-response (linked->jsexpr (snapshot-linked snap))))))

;; ---- handlers: the stream -------------------------------------------------

;; What a connection is owed before the stream proper — the one place the
;; outline's story and the conversation's are told to the same socket.
;;
;; ORDER IS THE CONTRACT, and it is subscribe-then-read, both times. The chat
;; subscribes inside its own lock, which is what makes its answer exact
;; (web/chat). The revision is read AFTER that subscription exists, and that
;; direction is not a preference: a revision read first could move — and be
;; broadcast to nobody — in the gap before subscribing, and this connection
;; would sit on stale content with nothing coming. Read second, the worst case
;; is a duplicate `outline`, which costs one re-fetch of what is already right.
;;
;; `store-invalidate!` first for the same reason every route starts with it:
;; the revision this answers with has to be the revision of the files as they
;; are now, not as they were when something last asked.
(define (events-handler st hub agent req)
  (hub-response
   hub
   #:last-event-id (request-last-event-id req)
   ;; the cadence off the declaration, not out of a default: the client sizes
   ;; its watchdog by this number, and it is worth being able to point at the
   ;; line that chose it (web/live)
   #:heartbeat-seconds outline-heartbeat-seconds
   #:catch-up
   (λ (last-event-id subscribe!)
     ;; web/chat answers in the same (name . data) pairs it broadcasts in — it
     ;; has never heard of the transport, and this is the one line that turns a
     ;; conversation into wire. No ids: a chat frame is not a checkpoint, and
     ;; moving the cursor to one would tell a reconnect it had seen an outline
     ;; revision it never did.
     (define chat-frames
       (for/list ([p (in-list (if agent (chat-catch-up agent subscribe!) '()))])
         (make-frame (car p) (cdr p))))
     (subscribe!)
     (store-invalidate! st)
     (append (outline-catch-up last-event-id (cursor-now st))
             chat-frames))))

;; ---- dispatch -------------------------------------------------------------

;; The route table, with this server's handlers in it. What comes back
;; dispatches a request AND writes every href that points at one of these
;; routes — one declaration, so a link cannot name an address the router does
;; not answer at.
;;
;; A handler needs the table (it draws links out of it) and the table needs the
;; handlers (it finds a route by the identity of one), so the two are defined
;; in one scope and the cycle is broken by WHEN each is read. Building the
;; table calls no handler; a handler runs only on a request, which is after
;; this function has returned. The panel is drawn once, on the line after the
;; table exists, from the addresses in it.
;;
;; The push channel is in the table and has no href in it, which is the point:
;; its address is the transport's (`live-stream-path`, /live/<boot-id>/events),
;; it carries the identity of the process that drew the page, and web/page puts
;; it on the body. This layer only answers at it — and answers a request naming
;; some OTHER process with one frame that means reload, never a refusal:
;; EventSource hides an HTTP status from the page and would retry one forever.
;;
;; A page re-fetches ITSELF on an `outline` event, so the href it re-fetches is
;; whichever of the three page routes drew it — minted here, never guessed.
(define (make-router st hub agent)
  (define rs
    (make-routes
     #:home (λ (req) (page-handler st rs panel))
     ;; one page per node, addressed by the key the load layer minted
     #:node (λ (req key) (node-handler st rs panel key))
     #:today (λ (req) (today-handler st rs panel))
     ;; done work, on demand and nowhere else
     #:archive (λ (req) (archive-handler st rs panel))
     ;; the palette, as an address: `q` is what was typed into it
     #:search (λ (req) (search-handler st rs panel req))
     ;; Mounted, not understood: the hub moves frames and web/live and web/chat
     ;; say what any of them mean. All this layer knows is that a connection is
     ;; born mid-story, and who to ask what it missed.
     #:events (λ (req boot)
                (if (live-boot-current? boot)
                    (events-handler st hub agent req)
                    (live-reload-response)))
     ;; the chat panel's verbs. What they DO lives in web/chat; this layer
     ;; only turns a request into a call and a failure into a status.
     #:chat (λ (req) (chat-handler agent req))
     #:chat-new (λ (req) (chat-new-handler agent))
     #:chat-cancel (λ (req) (chat-cancel-handler agent))
     #:chat-sessions (λ (req) (chat-sessions-handler agent))
     #:chat-load (λ (req) (chat-load-handler agent req))
     #:tree (λ (req) (tree-handler st))
     #:not-found (λ (req) (not-found-response))))
  (define panel (and agent (chat-panel rs)))
  rs)

;; /<prefix>/foo.js -> that directory's foo.js. make-url->path refuses anything
;; that climbs out of the base ("/static/../..") — we turn that into a plain
;; 404 instead of an error page. Three directories are mounted this way and
;; they have different owners: /static/ is olai's own assets, /live/ is the
;; framework's client runtime, which this app ships and never edits, and
;; /media/ is the user's own — the directory the outlines are in.
;; make-url->path is built ONCE per mount, not once per request: it is the
;; per-directory part, and the λ below is the per-request part.
(define (dir-url->path dir)
  (define u->p (make-url->path dir))
  (λ (u)
    (define rest (if (pair? (url-path u)) (cdr (url-path u)) '()))
    (with-handlers ([exn:fail? (λ (_e) (next-dispatcher))])
      (u->p (struct-copy url u [path rest])))))

(define static-url->path (dir-url->path (web-static-dir)))
(define live-url->path (dir-url->path (live-static-dir)))

;; One MIME table for every mount; building it walks a file, so it is built
;; once rather than per request.
(define the-mime-type (delay (make-path->mime-type mime-types-path)))

;; A directory, mounted: what matches `rx` is served out of it, anything else
;; is somebody else's request. One helper, so the three mounts cannot come to
;; differ in what a directory means (no indices, one MIME table).
(define (files-dispatcher rx url->path)
  (filter:make rx
               (files:make #:url->path url->path
                           #:path->mime-type (λ (p) ((force the-mime-type) p))
                           #:indices '())))

(define (prefix-rx prefix) (regexp (string-append "^" (regexp-quote prefix))))

;; The pictures a note draws: the directory the OUTLINES are in, so
;; `![](shot.png)` in a note is the file beside them.
;;
;; Three things bound it, and the route is only one of them. web/markdown will
;; not write a src that is not a relative path to a picture; a request that
;; arrives anyway meets the same make-url->path that refuses to climb out of
;; /static/; and what is left is this filter — the same list of formats, from
;; the same module, because this route hands bytes to a browser with no reading
;; of them and a document that can script is not a picture. Anything else under
;; the prefix falls through to the 404 a missing file gets.
(define media-file-rx
  (regexp (string-append "^" (regexp-quote media-prefix)
                         "(?i:.*\\.(" (string-join media-extensions "|") "))$")))

;; The stylesheet the page links is generated, not a file (olai/web/skin owns
;; the URL). It wins that path ahead of the static directory, which no longer
;; holds an app.css to serve.
(define (make-dispatcher st hub agent media-dir)
  (sequencer:make
   (filter:make (regexp (string-append "^" (regexp-quote stylesheet-href) "$"))
                (lift:make (λ (req) (css-response))))
   ;; before the static dir: the manifest needs a MIME the stock table
   ;; does not know
   (filter:make #rx"^/static/manifest\\.webmanifest$"
                (lift:make (λ (_req) (manifest-response))))
   (files-dispatcher (prefix-rx web-static-prefix) static-url->path)
   (files-dispatcher (prefix-rx live-asset-prefix) live-url->path)
   (files-dispatcher media-file-rx (dir-url->path media-dir))
   (lift:make (routes-dispatch (make-router st hub agent)))))

;; ---- server ---------------------------------------------------------------

;; Bind the dispatcher. -> (values stop bound-port). #:port 0 means "pick
;; one"; fallback? means the port asked for is a preference, not a request —
;; taken, we take a free one instead. Without it a taken port is an error,
;; which is what a port asked for by name deserves.
;;
;; The probe is what keeps the fallback quiet: the web server's listener
;; thread re-raises a failed bind after reporting it, so walking into one
;; dumps a stack trace on the way to an ordinary "that port was taken". The
;; handler is still there, for the race between probing and binding.
(define (listen dispatch port bind fallback?)
  (define (free? port)
    (with-handlers ([exn:fail:network? (λ (_e) #f)])
      (tcp-close (tcp-listen port 4 #t bind))
      #t))
  (define (go port)
    (define confirm (make-async-channel 1))
    (define stop
      (serve #:dispatch dispatch
             #:port port
             #:listen-ip bind
             #:confirmation-channel confirm))
    (define bound (async-channel-get confirm))
    (when (exn? bound)
      (stop)
      (raise bound))
    (values stop bound))
  (with-handlers ([(λ (e) (and fallback? (exn:fail:network? e)))
                   (λ (_e) (go 0))])
    (go (if (and fallback? (not (free? port))) 0 port))))

;; Returns a stop procedure. #:on-listen gets the port actually bound (useful
;; when #:port is 0, i.e. "pick one", or when #:port-fallback? took over).
;;
;; #:root is the ONE thing this server was pointed at: a directory whose
;; outlines it serves — re-asked as they change, so a new one is picked up
;; without a restart — or a single outline file.
;;
;; #:acp-command is the agent `serve` chats with — #f means there is none, and
;; the CLI never passes #f (it refuses to start without one; see docs/cli.md).
;; #:on-agent is handed the conversation once it exists: the seam for tests,
;; and for anything that wants to prompt the agent without an HTTP request.
(define (start-server #:port [port 8080]
                      #:port-fallback? [port-fallback? #f]
                      #:bind [bind "127.0.0.1"]
                      #:root root
                      #:acp-command [acp-command #f]
                      #:on-listen [on-listen void]
                      #:on-agent [on-agent void])
  (define st (make-store root))
  (define hub (make-hub))
  ;; Where the outlines LIVE: the directory the root spec hangs off — itself
  ;; when it is one, else the file's own. It is the whole extent of what
  ;; /media/ can reach, and it is the directory the AGENT works in, which is
  ;; what makes "the session you were last in" survive a restart: Claude Code
  ;; keys its stored conversations by it. One root, one directory, so neither
  ;; is derived from a file set that can move under it.
  (define outline-dir (root-dir root))
  ;; Nothing is spawned here; construction stays cheap.
  (define agent
    (and acp-command
         (make-chat #:command acp-command
                    #:cwd outline-dir
                    ;; the conversation speaks (name, payload) and has never
                    ;; heard of the transport; this is where that becomes wire
                    #:broadcast (λ (name data)
                                  (hub-broadcast! hub (make-frame name data))))))
  (define-values (stop bound)
    (listen (make-dispatcher st hub agent outline-dir) port bind port-fallback?))
  ;; Only once there is a listener: a watcher with nobody to tell is a
  ;; thread that reloads outlines for its own amusement.
  ;;
  ;; The revision goes out twice — as the payload, which makes the stream
  ;; readable by hand (curl) and gives a client something to compare, and as
  ;; the stream's ID, which is what a browser hands back on the way in after
  ;; it has been asleep. Both spellings are web/live's; this only pushes it.
  (define stop-watcher
    (start-watcher st
                   #:on-change
                   (λ () (hub-broadcast! hub (outline-frame (cursor-now st))))))
  (when agent (on-agent agent))
  ;; And only once there is a listener here too: the agent boots in its own
  ;; thread, so pages serve while the agent starts and the last conversation
  ;; replays into them. A failure is a frame, not a server that did not come up.
  (when agent (chat-boot! agent))
  (on-listen bound)
  (λ ()
    (stop-watcher)
    (when agent (chat-stop! agent))
    (stop)))
