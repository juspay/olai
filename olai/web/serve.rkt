#lang racket/base

;; The read-mostly web view.
;;
;;   GET  /             the html page: sidebar + outline + chat panel
;;   GET  /today        today's Daily day node, zoomed
;;   GET  /events       SSE stream; `outline` (data: store revision) per reload,
;;                      `chat` (data: one JSON frame) per agent frame
;;   POST /chat         prompt the agent (form field `text`) -> 204
;;   POST /chat/new     new chat -> 204
;;   POST /chat/cancel  cancel the turn in flight -> 204
;;   GET  /chat/sessions the agent's stored conversations, as JSON
;;   POST /chat/load    load one of them (form field `id`) -> 204
;;   GET  /api/tree     byte-identical to `olai tree`
;;   GET  /api/agenda   byte-identical to `olai agenda --json`
;;   GET  /static/app.css  the generated stylesheet (olai/web/skin)
;;   GET  /static/*     files from web/static/ (icons, scripts, manifest)
;;   anything else      404, terse text/plain
;;
;; No auth: the network is the auth (Tailscale / Caddy in front of it).
;; Routing, static files, and MIME types come from racket web-server. Outline
;; content comes from olai/store — this module owns routes and responses,
;; never a load.
;;
;; Live updates are three parts that only meet here: the store knows WHAT the
;; outlines are, the watcher knows WHEN they moved, the hub knows WHO is
;; listening. None of them knows about the other two. The agent conversation
;; (web/chat, over olai/acp) is a fourth of the same kind — it pushes
;; `chat` through the same hub and has never heard of HTTP; the /chat routes
;; below are the only place the two meet.
;;
;; The chat routes answer with a STATUS, never with content: what a panel
;; draws arrives over the stream, so every open tab shows the same
;; conversation whichever one typed into it.

(require racket/async-channel
         racket/path
         racket/port
         racket/promise
         racket/string
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
         olai/json/model
         olai/json/reply
         olai/load
         (only-in olai/ops exn:fail:op? exn:fail:op-kind)
         (only-in olai/paths file-label roots-base)
         olai/store
         olai/web/chat
         olai/web/events
         ;; the sheet and its URL; which modules it is made of is skin's
         olai/web/skin
         ;; the facts about the palettes a page carries before the sheet
         ;; lands, from the module that owns them
         (only-in olai/web/theme theme-color-scheme theme-default-paper)
         olai/web/render
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
;; file actually changed), then hand the handler ONE consistent snapshot.
;;
;; A live load error means the file is mid-edit. JSON routes fail loudly —
;; agents must never be handed stale data quietly — while the page keeps the
;; last good content and shows the error in its banner (#:stale-ok? #t). With
;; no last-good snapshot at all, everything fails.
(define (with-snapshot st fail proc #:stale-ok? [stale-ok? #f])
  (store-invalidate! st)
  (define snap (store-snapshot st))
  (define err (store-error st))
  (if (and err (or (not stale-ok?) (null? (snapshot-outlines snap))))
      (fail err)
      (proc snap err)))

(define (load-error->json err)
  (err-hash (load-error-message err)
            #:file (load-error-file err)
            #:line (load-error-line err)
            #:col (load-error-col err)))

(define (json-failure err)
  (json-response (load-error->json err) #:code 500))

(define (error-banner err)
  (render-error-banner (load-error-detail err) #:where (load-error-where err)))

;; Nothing to show at all — the FIRST load failed. Still an SSE page: the
;; next save is what fixes it, and the client should not have to reload to
;; find that out.
(define (page-failure err #:live-href live-href #:chat [chat #f])
  (html-response
   (page->html-string
    (render-page (render-empty-pane "No outline loaded." #:home-href home-href)
                 #:title "olai"
                 #:stylesheet-href stylesheet-href
                 #:color-scheme theme-color-scheme
                 #:theme-color theme-default-paper
                 #:banner (error-banner err)
                 #:sse-connect events-href
                 #:live-href live-href
                 #:body-extra (if chat (list chat) '())))
   #:code 500))

;; ---- the route table ------------------------------------------------------
;;
;; One owner: these are the only URLs the app has, and the renderer is told
;; them rather than guessing (it used to default to a /today that did not
;; exist, so the shipped sidebar link 404'd).

(define home-href "/")
(define today-href "/today")

;; The push channel. A page re-fetches ITSELF on an `outline` event, so the
;; href it re-fetches is whichever of the two above rendered it — handed to
;; the renderer, never guessed by it.
(define events-href "/events")

;; A node's address. There is no zoom route yet, so it is the home page
;; anchored at the node — every node carries id="n-<key>" there.
(define node-href-base "/#n-")

;; The chat panel's verbs. All POST, all 204: the reply the panel renders comes
;; back over `events-href`. The one GET is the picker's list, which is a thing
;; to draw rather than a thing that happened, so it answers with content.
(define chat-href "/chat")
(define chat-new-href "/chat/new")
(define chat-cancel-href "/chat/cancel")
(define chat-sessions-href "/chat/sessions")
(define chat-load-href "/chat/load")

;; ---- handlers: the chat panel ---------------------------------------------

;; Replayed from the conversation's transcript on every page load: frames are
;; ephemeral, and web/chat is the only thing that remembers a turn. No agent,
;; no panel — `serve` refuses to start without one (docs/cli.md), so that is a
;; test's server, not a user's.
(define (chat-panel agent)
  (and agent
       (render-chat-panel (chat-transcript agent)
                          #:busy? (chat-busy? agent)
                          #:send-href chat-href
                          #:new-href chat-new-href
                          #:cancel-href chat-cancel-href
                          #:sessions-href chat-sessions-href
                          #:load-href chat-load-href
                          #:event acp-event-name
                          #:model (chat-model agent)
                          #:session-title (chat-session-title agent)
                          #:commands (chat-commands agent))))

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
  (and (binding:form? b)
       (let ([s (string-trim (bytes->string/utf-8 (binding:form-value b)))])
         (and (non-empty-string? s) s))))

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
                #:live-href live-href
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
                                           #:zoom-base node-href-base)
                 #:banner banner
                 #:sse-connect events-href
                 #:live-href live-href
                 #:body-extra (if chat (list chat) '())))
   #:code code))

(define (page-handler st agent)
  (define chat (chat-panel agent))
  (with-snapshot st (λ (err) (page-failure err #:live-href home-href #:chat chat))
    #:stale-ok? #t
    (λ (snap err)
      (define files-data (snapshot-files-data snap))
      (chrome files-data
              (render-outline files-data #:today (today-iso-string))
              #:title (page-title (store-files st))
              #:live-href home-href
              #:chat chat
              #:banner (and err (error-banner err))))))

;; Today's Daily day node, zoomed. No day node yet is the normal state before
;; the first capture of the day, not an error.
(define (today-handler st agent)
  (define chat (chat-panel agent))
  (with-snapshot st (λ (err) (page-failure err #:live-href today-href #:chat chat))
    #:stale-ok? #t
    (λ (snap err)
      (define today (today-iso-string))
      (define key (snapshot-day-key snap today))
      (chrome (snapshot-files-data snap)
              (if key
                  (render-zoom (snapshot-index snap) key
                               #:today today
                               #:home-href home-href
                               #:zoom-base node-href-base)
                  (render-empty-pane
                   (format "No day node for ~a. Run: olai daily" today)
                   #:home-href home-href))
              #:title (string-append "today " today)
              #:live-href today-href
              #:chat chat
              #:banner (and err (error-banner err))))))

(define (tree-handler st)
  (with-snapshot st json-failure
    (λ (snap _err) (json-response (outlines->jsexpr (snapshot-outlines snap))))))

(define (agenda-handler st)
  (with-snapshot st json-failure
    (λ (snap _err)
      (define today (today-iso-string))
      (define groups
        (agenda-groups-from-files
         (for/list ([o (in-list (snapshot-outlines snap))])
           (cons (outline-path o) (outline-tasks o)))
         today))
      (json-response (agenda-groups->jsexpr groups today)))))

;; ---- dispatch -------------------------------------------------------------

(define (make-router st hub agent)
  (define-values (route _url)
    (dispatch-rules
     [("") (λ (req) (page-handler st agent))]
     [("today") (λ (req) (today-handler st agent))]
     ;; mounted, not understood: what an event MEANS lives in web/events
     [("events") (λ (req) (hub-response hub))]
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

;; /static/foo.css -> the render collection's static/foo.css. make-url->path
;; refuses anything that climbs out of the base ("/static/../..") — we turn
;; that into a plain 404 instead of an error page.
(define static-url->path
  (let ([u->p (make-url->path (web-static-dir))])
    (λ (u)
      (define rest (if (pair? (url-path u)) (cdr (url-path u)) '()))
      (with-handlers ([exn:fail? (λ (_e) (next-dispatcher))])
        (u->p (struct-copy url u [path rest]))))))

;; The stylesheet the page links is generated, not a file (olai/web/skin owns
;; the URL). It wins that path ahead of the static directory, which no longer
;; holds an app.css to serve.
(define (make-dispatcher st hub agent)
  (sequencer:make
   (filter:make (regexp (string-append "^" (regexp-quote stylesheet-href) "$"))
                (lift:make (λ (req) (css-response))))
   ;; before the static dir: the manifest needs a MIME the stock table
   ;; does not know
   (filter:make #rx"^/static/manifest\\.webmanifest$"
                (lift:make (λ (_req) (manifest-response))))
   (filter:make (regexp (string-append "^" (regexp-quote web-static-prefix)))
                (files:make #:url->path static-url->path
                            #:path->mime-type (make-path->mime-type mime-types-path)
                            #:indices '()))
   (lift:make (make-router st hub agent))))

;; ---- server ---------------------------------------------------------------

;; Returns a stop procedure. #:on-listen gets the port actually bound (useful
;; when #:port is 0, i.e. "pick one").
;;
;; #:acp-command is the agent `serve` chats with — #f means there is none, and
;; the CLI never passes #f (it refuses to start without one; see docs/cli.md).
;; #:agent-cwd is the directory it works in; #f means the outlines' own.
;; #:on-agent is handed the conversation once it exists: the seam for tests,
;; and for anything that wants to prompt the agent without an HTTP request.
(define (start-server #:port [port 8080]
                      #:bind [bind "127.0.0.1"]
                      #:files files
                      #:acp-command [acp-command #f]
                      #:agent-cwd [agent-cwd #f]
                      #:on-listen [on-listen void]
                      #:on-agent [on-agent void])
  (define st (make-store files))
  (define hub (make-hub))
  ;; The agent's working directory: the one it was given, else the outlines'
  ;; own — one file means its directory, several mean the deepest one that
  ;; holds them all (the same base node keys are minted against). It is worth
  ;; naming rather than deriving: an agent's stored sessions are keyed by it,
  ;; so a cwd that moves when the file set moves is a conversation history that
  ;; moves with it. Nothing is spawned here; construction stays cheap.
  (define agent
    (and acp-command
         (make-chat #:command acp-command
                    #:cwd (or agent-cwd (roots-base files))
                    #:broadcast (λ (name data) (hub-broadcast! hub name data)))))
  (define confirm (make-async-channel 1))
  (define stop
    (serve #:dispatch (make-dispatcher st hub agent)
           #:port port
           #:listen-ip bind
           #:confirmation-channel confirm))
  (define bound (async-channel-get confirm))
  (when (exn? bound)
    (stop)
    (raise bound))
  ;; Only once there is a listener: a watcher with nobody to tell is a
  ;; thread that reloads outlines for its own amusement.
  ;;
  ;; The payload is the store revision — the browser only needs "re-fetch",
  ;; but a revision makes the stream readable by hand (curl) and gives a
  ;; client something to compare.
  (define stop-watcher
    (start-watcher st
                   #:on-change
                   (λ () (hub-broadcast! hub "outline"
                                         (number->string (store-revision st))))))
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
