#lang racket/base

;; The read-mostly web view.
;;
;;   GET  /             the html page: sidebar + outline + chat panel
;;   GET  /n/<key>      one node, zoomed: breadcrumbs + that subtree
;;   GET  /today        today's Daily day node, zoomed
;;   GET  /live/<boot>/events
;;                      SSE stream, under the boot id of the process that drew
;;                      the page (a stale one gets one reload frame and the end
;;                      of the stream); `outline` (data and id: the cursor the
;;                      outlines are at) per reload, `chat` (data: one JSON
;;                      frame) per agent frame — and, first, whatever this
;;                      connection missed: the conversation it was not there
;;                      for, and an `outline` if the file moved while it was
;;                      away (docs/live.md)
;;   POST /chat         prompt the agent (form field `text`) -> 204
;;   POST /chat/new     new chat -> 204
;;   POST /chat/cancel  cancel the turn in flight -> 204
;;   GET  /chat/sessions the agent's stored conversations, as JSON
;;   POST /chat/load    load one of them (form field `id`) -> 204
;;   GET  /api/tree     byte-identical to `olai tree`
;;   GET  /api/agenda   byte-identical to `olai agenda --json`
;;   GET  /static/app.css  the generated stylesheet (olai/web/skin)
;;   GET  /static/*     files from web/static/ (icons, scripts, manifest)
;;   GET  /media/*      pictures from the outlines' own directory, and only
;;                      those: what a note's `![](shot.png)` asks for
;;   anything else      404, terse text/plain
;;
;; No auth: the network is the auth (Tailscale / Caddy in front of it).
;; Routing, static files, and MIME types come from racket web-server. Outline
;; content comes from olai/store — this module owns routes and responses,
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
         web-server/dispatch
         web-server/dispatchers/dispatch
         web-server/dispatchers/filesystem-map
         (prefix-in files: web-server/dispatchers/dispatch-files)
         (prefix-in filter: web-server/dispatchers/dispatch-filter)
         (prefix-in lift: web-server/dispatchers/dispatch-lift)
         (prefix-in sequencer: web-server/dispatchers/dispatch-sequencer)
         (only-in web-server/private/mime-types make-path->mime-type)
         olai/agenda
         olai/dates
         ;; a node's title, for the tab a zoom page opens in
         (only-in olai/lang/expander task-title)
         ;; key -> node, and the trail above it (what a breadcrumb is drawn from)
         (only-in olai/index node-entry-task node-ancestors)
         olai/json/model
         olai/json/reply
         olai/load
         (only-in olai/ops exn:fail:op? exn:fail:op-kind)
         (only-in olai/paths file-label roots-base)
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

;; Nothing to show at all — the FIRST load failed. Still a live page: the next
;; save is what fixes it, and the client should not have to reload to find that
;; out.
(define (page-failure rev err #:live-href live-href #:chat [chat #f])
  (html-response
   (page->html-string
    (render-page (render-empty-pane "No outline loaded."
                                    #:home-href home-href)
                 #:title "olai"
                 #:stylesheet-href stylesheet-href
                 #:color-scheme theme-color-scheme
                 #:theme-color theme-default-paper
                 #:banner (error-banner err)
                 #:href live-href
                 #:cursor (outline-cursor rev)
                 #:body-extra (if chat (list chat) '())))
   #:code 500))

;; ---- the route table ------------------------------------------------------
;;
;; One owner: these are the only URLs the app has, and the renderer is told
;; them rather than guessing (it used to default to a /today that did not
;; exist, so the shipped sidebar link 404'd).

(define home-href "/")
(define today-href "/today")

;; The push channel is NOT in this table, and that is the point: its address is
;; the transport's (`live-stream-path`, /live/<boot-id>/events), it carries the
;; identity of the process that drew the page, and web/render puts it on the
;; body. This layer only answers at it — and answers a request naming some
;; other process with one frame that means reload (see the route below).
;;
;; A page re-fetches ITSELF on an `outline` event, so the href it re-fetches is
;; whichever of the two above rendered it — handed to the renderer, never
;; guessed by it.

;; The state the outlines are in right now, as the wire names it. Both the
;; broadcast and the catch-up ask this, so neither can invent a spelling.
(define (cursor-now st) (outline-cursor (store-revision st)))

;; A node's address: its own zoom page, keyed by the key the load layer minted
;; (olai/load). Stable across a rename — that is what makes it a permalink —
;; and across an ancestor's rename; NOT stable across an unanchored node moving
;; to a new ordinal, which is what ^anchor is for (docs/cli.md).
(define node-href-base "/n/")
(define (node-href key) (string-append node-href-base key))

;; The chat panel's verbs. All POST, all 204: the reply the panel renders comes
;; back over `events-href`. The one GET is the picker's list, which is a thing
;; to draw rather than a thing that happened, so it answers with content.
(define chat-href "/chat")
(define chat-new-href "/chat/new")
(define chat-cancel-href "/chat/cancel")
(define chat-sessions-href "/chat/sessions")
(define chat-load-href "/chat/load")

;; ---- handlers: the chat panel ---------------------------------------------

;; The panel's chrome, and nothing about the conversation: what a page load
;; could say about one is only as current as the moment it was drawn, and the
;; agent boots in its own thread. The conversation arrives on the stream, which
;; catches a connection up on the way in (web/chat) — which is also why this is
;; one value rather than a render: every page gets the same markup, and only
;; the routes it names could ever change it. No agent, no panel — `serve`
;; refuses to start without one (docs/cli.md), so that is a test's server, not
;; a user's.
(define the-chat-panel
  (render-chat-panel #:send-href chat-href
                     #:new-href chat-new-href
                     #:cancel-href chat-cancel-href
                     #:sessions-href chat-sessions-href
                     #:load-href chat-load-href
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

;; A form field, trimmed, or #f when it is missing or blank.
(define (form-field req name)
  (define b (bindings-assq name (request-bindings/raw req)))
  (cond
    [(binding:form? b)
     (define s (string-trim (bytes->string/utf-8 (binding:form-value b))))
     (and (non-empty-string? s) s)]
    [else #f]))

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

(define (page-title files)
  (if (= (length files) 1)
      (file-label (car files))
      "olai"))

;; The panel sits in body-extra, OUTSIDE #ol-live: an outline event re-swaps
;; the live region, and a chat mid-turn must not be swapped out from under
;; the person typing into it.
(define (chrome files-data main
                #:title title
                #:href href
                #:cursor cursor
                #:banner [banner #f]
                #:chat [chat #f]
                #:code [code 200])
  (html-response
   (page->html-string
    (render-page main
                 #:title title
                 #:stylesheet-href stylesheet-href
                 #:color-scheme theme-color-scheme
                 #:theme-color theme-default-paper
                 #:sidebar (render-sidebar files-data
                                           #:home-href home-href
                                           #:today-href today-href
                                           #:href href
                                           #:zoom-base node-href-base)
                 #:banner banner
                 #:href href
                 #:cursor cursor
                 #:body-extra (if chat (list chat) '())))
   #:code code))

;; Every page here is the same shape: one snapshot, the chrome around it, and a
;; live region that re-fetches THIS url on an `outline` event. `view` is handed
;; the snapshot and answers (values main title) — the only thing three pages
;; differ in. It is handed nothing about the live view: every link on the page
;; names the region it aims at (web/render declares it), so there is no longer
;; a per-page value for a drawer to be given, or to forget.
(define (outline-page st agent live-href view)
  (define chat (and agent the-chat-panel))
  (with-snapshot st
    (λ (rev err) (page-failure rev err #:live-href live-href #:chat chat))
    #:stale-ok? #t
    (λ (rev snap err)
      (define-values (main title) (view snap))
      (chrome (snapshot-files-data snap) main
              #:title title
              #:href live-href
              #:cursor (outline-cursor rev)
              #:chat chat
              #:banner (and err (error-banner err))))))

;; One node, zoomed: the node and the trail above it, both asked of the
;; snapshot's index — the only thing that knows either.
(define (zoom-pane snap entry today)
  (render-zoom (node-entry-task entry)
               (node-ancestors (snapshot-index snap) entry)
               #:today today
               #:home-href home-href
               #:zoom-base node-href-base

               ;; the @doc documents as of this snapshot; the renderer opens
               ;; no files (web/render)
               #:docs (snapshot-docs snap)))

;; The key a page was asked for, as a node, or #f. Both zoom routes go through
;; here, and each says in its own words what #f means.
(define (node-at index key)
  (and key (hash-ref index key #f)))

(define (page-handler st agent)
  (outline-page st agent home-href
   (λ (snap)
     (values (render-outline (snapshot-files-data snap)
                             #:today (today-iso-string)
                             #:zoom-base node-href-base
                             #:docs (snapshot-docs snap))
             (page-title (store-files st))))))

;; A node's permalink.
;;
;; A key the snapshot has no node for is not a 404: a node can be deleted, or
;; an unanchored one re-keyed, while a tab sits zoomed on it, and that tab
;; re-fetches this very page to find out. An error status would leave it
;; showing a node that is gone. The snapshot is the source of truth about what
;; exists; this route only asks it, and says what it heard.
(define (node-handler st agent key)
  (outline-page st agent (node-href key)
   (λ (snap)
     (define entry (node-at (snapshot-index snap) key))
     (if entry
         ;; a tab zoomed on one node should say which
         (values (zoom-pane snap entry (today-iso-string))
                 (task-title (node-entry-task entry)))
         (values (render-empty-pane "No such node."
                                    #:home-href home-href)
                 "olai")))))

;; Today's Daily day node, zoomed. Finding today's key is a question about the
;; DAY; the answer goes through the same zoom pane as any permalink, and
;; nothing under this line knows what day it is.
;;
;; It stays a page rather than a redirect to /n/<key>: the key it resolves to
;; changes at local midnight (the watcher pushes an `outline` event then, which
;; this page re-fetches on), and before the first capture of the day there is
;; no key to redirect to. Both are ordinary states of "today", and a page
;; frozen to the key today HAD would be neither.
(define (today-handler st agent)
  (outline-page st agent today-href
   (λ (snap)
     (define today (today-iso-string))
     (define entry (node-at (snapshot-index snap) (snapshot-day-key snap today)))
     (values (if entry
                 (zoom-pane snap entry today)
                 ;; no day node yet is the normal state before the first
                 ;; capture of the day, not an error
                 (render-empty-pane
                  (format "No day node for ~a. Run: olai daily" today)
                  #:home-href home-href))
             (string-append "today " today)))))

(define (tree-handler st)
  (with-snapshot st json-failure
    (λ (_rev snap _err) (json-response (linked->jsexpr (snapshot-linked snap))))))

(define (agenda-handler st)
  (with-snapshot st json-failure
    (λ (_rev snap _err)
      (define today (today-iso-string))
      (define groups
        (agenda-groups-from-files
         (for/list ([o (in-list (snapshot-outlines snap))])
           (cons (outline-path o) (outline-tasks o)))
         today))
      (json-response (agenda-groups->jsexpr groups today)))))

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

(define (make-router st hub agent)
  (define-values (route _url)
    (dispatch-rules
     [("") (λ (req) (page-handler st agent))]
     ;; one page per node, addressed by the key the load layer minted
     [("n" (string-arg)) (λ (req key) (node-handler st agent key))]
     [("today") (λ (req) (today-handler st agent))]
     ;; Mounted, not understood: the hub moves frames and the two modules
     ;; below say what any of them mean. All this layer knows is that a
     ;; connection is born mid-story, and who to ask what it missed.
     ;;
     ;; Under the boot id of the process that drew the page. One that names
     ;; some OTHER process is a tab that outlived a restart: its markup, its
     ;; scripts and this address all belong to a server that is gone, so it is
     ;; ANSWERED — one frame that means reload — and never refused. EventSource
     ;; hides an HTTP status from the page and would retry a refusal forever.
     [("live" (string-arg) "events")
      (λ (req boot)
        (if (live-boot-current? boot)
            (events-handler st hub agent req)
            (live-reload-response)))]
     ;; the chat panel's verbs. What they DO lives in web/chat; this layer
     ;; only turns a request into a call and a failure into a status.
     [("chat") #:method "post" (λ (req) (chat-handler agent req))]
     [("chat" "new") #:method "post" (λ (req) (chat-new-handler agent))]
     [("chat" "cancel") #:method "post" (λ (req) (chat-cancel-handler agent))]
     [("chat" "sessions") (λ (req) (chat-sessions-handler agent))]
     [("chat" "load") #:method "post" (λ (req) (chat-load-handler agent req))]
     [("api" "tree") (λ (req) (tree-handler st))]
     [("api" "agenda") (λ (req) (agenda-handler st))]
     [else (λ (req) (not-found-response))]))
  route)

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
   (lift:make (make-router st hub agent))))

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
;; #:acp-command is the agent `serve` chats with — #f means there is none, and
;; the CLI never passes #f (it refuses to start without one; see docs/cli.md).
;; #:agent-cwd is the directory it works in; #f means the outlines' own.
;; #:on-agent is handed the conversation once it exists: the seam for tests,
;; and for anything that wants to prompt the agent without an HTTP request.
(define (start-server #:port [port 8080]
                      #:port-fallback? [port-fallback? #f]
                      #:bind [bind "127.0.0.1"]
                      #:files files
                      #:acp-command [acp-command #f]
                      #:agent-cwd [agent-cwd #f]
                      #:on-listen [on-listen void]
                      #:on-agent [on-agent void])
  (define st (make-store files))
  (define hub (make-hub))
  ;; Where the outlines LIVE: the deepest directory that holds them all (the
  ;; same base node keys are minted against). It is the whole extent of what
  ;; /media/ can reach, which is why it is derived from the FILES and from
  ;; nothing that can be pointed elsewhere.
  (define outline-dir (roots-base files))
  ;; The agent's working directory: the one it was given, else the outlines'
  ;; own. It is worth naming rather than deriving: an agent's stored sessions
  ;; are keyed by it, so a cwd that moves when the file set moves is a
  ;; conversation history that moves with it. Nothing is spawned here;
  ;; construction stays cheap.
  (define agent
    (and acp-command
         (make-chat #:command acp-command
                    #:cwd (or agent-cwd outline-dir)
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
