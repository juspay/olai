#lang racket/base

;; Web server routes. Boots the real server on an ephemeral port against a
;; temp outline; no personal data, no fixed ports.

(require json
         net/http-client
         racket/file
         racket/path
         racket/port
         racket/string
         racket/tcp
         (only-in live/hub heartbeat-event)
         (only-in olai/web/live live-asset-prefix live-script-srcs outline-event)
         olai/web/serve)

(module+ test
  (require rackunit))

(module+ test
  ;; Sizes differ on every write below: the store's staleness probe is mtime +
  ;; size, and a same-second same-size rewrite is invisible to it.

  (define outline
    (string-append
     "#lang olai\n"
     "Inbox\n"
     "  Buy milk\n"
     "    @date 2026-01-15\n"
     "Ship the server ^serve\n"))

  ;; Run body with the server up: (proc port outline-path). The path is handed
  ;; back so a test can edit the outline underneath a running server. The temp
  ;; dir goes whether or not the server came up, which is a case here.
  (define (with-server proc #:port [port 0] #:port-fallback? [fallback? #f])
    (define dir (make-temporary-file "sfserve~a" 'directory))
    (define f (build-path dir "Tasks.rkt"))
    (display-to-file outline f #:exists 'truncate)
    (dynamic-wind
     void
     (λ ()
       (define bound #f)
       (define stop
         (start-server #:port port
                       #:port-fallback? fallback?
                       #:bind "127.0.0.1"
                       #:files (list f)
                       #:on-listen (λ (p) (set! bound p))))
       (dynamic-wind void (λ () (proc bound f)) stop))
     (λ () (delete-directory/files dir))))

  ;; A port that is already bound, for the two "taken" cases: (proc port).
  (define (with-taken-port proc)
    (define l (tcp-listen 0 4 #t "127.0.0.1"))
    (define-values (_h port _rh _rp) (tcp-addresses l #t))
    (dynamic-wind void (λ () (proc port)) (λ () (tcp-close l))))

  ;; -> (values status-code headers body-string)
  (define (GET port path)
    (define-values (status headers in)
      (http-sendrecv "127.0.0.1" path #:port port #:method #"GET"))
    (define body (port->string in))
    (close-input-port in)
    (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
            (map bytes->string/utf-8 headers)
            body))

  (define (header-value headers name)
    (for/or ([h (in-list headers)])
      (and (string-prefix? (string-downcase h) (string-downcase name))
           h)))

  ;; ---- the SSE stream --------------------------------------------------------

  ;; /events never ends, so this keeps the port: -> (values code headers in).
  ;; net/http-client de-chunks for us, which is the only reason a test can read
  ;; the stream a frame at a time.
  ;;
  ;; #:last-event-id is what a reconnecting EventSource sends: the id of the last
  ;; frame it managed to dispatch before the connection went away. A test that
  ;; passes one is a browser that has been asleep.
  (define (open-events port #:path [path "/events"] #:last-event-id [last-event-id #f])
    (define-values (status headers in)
      (http-sendrecv "127.0.0.1" path #:port port #:method #"GET"
                     #:headers (if last-event-id
                                   (list (string->bytes/utf-8
                                          (string-append "Last-Event-ID: " last-event-id)))
                                   '())))
    (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
            (map bytes->string/utf-8 headers)
            in))

  ;; Next real event on the stream: -> (list name data id) | #f on timeout.
  ;; Heartbeats are skipped — they are the transport keeping itself honest, not
  ;; news about an outline. Waited on, never slept for.
  (define (next-event in #:timeout [timeout 20])
    (define deadline (+ (current-inexact-milliseconds) (* 1000.0 timeout)))
    (let loop ([name #f] [data '()] [id #f])
      (define left (/ (- deadline (current-inexact-milliseconds)) 1000.0))
      (define line (and (positive? left)
                        (sync/timeout left (read-line-evt in 'linefeed))))
      (cond
        [(or (not line) (eof-object? line)) #f]
        [(string=? line "")
         (cond
           [(equal? name heartbeat-event) (loop #f '() #f)]
           [name (list name (string-join (reverse data) "\n") id)]
           [else (loop #f '() #f)])]
        [(string-prefix? line "event: ") (loop (substring line 7) data id)]
        [(string-prefix? line "data: ") (loop name (cons (substring line 6) data) id)]
        [(string-prefix? line "id: ") (loop name data (substring line 4))]
        [else (loop name data id)])))

  ;; The stream a PAGE would open: the URL is the one in its own markup, cursor
  ;; and all. A test that rebuilt that URL itself would be testing its own
  ;; arithmetic; this opens what the browser would.
  (define (open-events/page port page-body)
    (define m (regexp-match #px"sse-connect=\"([^\"]+)\"" page-body))
    (check-not-false m "the page carries no stream")
    (open-events port #:path (cadr m)))

  (define (event-name ev) (car ev))
  (define (event-data ev) (cadr ev))
  (define (event-id ev) (caddr ev)))

(module+ test
  ;; The port the CLI did not have to be told (its default): taken means take
  ;; another one, and on-listen hears which.
  (test-case "a taken port falls back to a free one when it was only a default"
    (with-taken-port
     (λ (taken)
       (with-server
        #:port taken #:port-fallback? #t
        (λ (bound f)
          (check-not-equal? bound taken)
          (define-values (code _h body) (GET bound "/"))
          (check-equal? code 200 body))))))

  ;; A port asked for by name is a request, not a preference.
  (test-case "a taken port without the fallback is an error"
    (with-taken-port
     (λ (taken)
       (check-exn exn:fail:network?
                  (λ () (with-server #:port taken (λ (bound f) (void))))))))

  (test-case "GET / is an html page with the outline in it"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/html")
                   (format "~a" headers))
       (check-true (string-contains? body "Buy milk") body)
       ;; the sheet is generated, so the page is TOLD its href: a route layer
       ;; that forgot would serve an unstyled page and nothing else would say so
       (check-true (string-contains? body "href=\"/static/app.css\"") body)
       ;; PWA surface: installable shell, theme-color for browser chrome
       (check-true (string-contains? body "rel=\"manifest\"") body)
       (check-true (string-contains? body "name=\"theme-color\"") body)
       (check-true (string-contains? body "src=\"/static/pwa.js\"") body))))

  (test-case "GET /static/manifest.webmanifest is installable JSON"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/static/manifest.webmanifest"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "manifest")
                   (format "~a" headers))
       (define j (read-json (open-input-string body)))
       (check-equal? (hash-ref j 'name) "olai")
       (check-equal? (hash-ref j 'display) "standalone")
       (check-equal? (hash-ref j 'start_url) "/")
       (check-true (pair? (hash-ref j 'icons)) body))))

  (test-case "the sidebar Today link is a real route"
    (with-server
     (λ (port f)
       ;; no day node in the outline yet: terse empty state, not a 404
       (define-values (code _h body) (GET port "/today"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "No day node for") body)
       ;; and the link the page ships points here
       (define-values (_c _hh home) (GET port "/"))
       (check-true (string-contains? home "href=\"/today\"") home)
       ;; add today's day node and it zooms to it
       (define today
         (let ()
           (define j (read-json (open-input-string
                                 (let-values ([(_c2 _h2 b) (GET port "/api/agenda")]) b))))
           (hash-ref j 'today)))
       (display-to-file (string-append outline today "\n  Water the plants\n")
                        f #:exists 'truncate)
       (define-values (code2 _h3 body2) (GET port "/today"))
       (check-equal? code2 200 body2)
       (check-true (string-contains? body2 "Water the plants") body2)
       ;; zoomed: the main pane holds that subtree and nothing else
       (define pane (cadr (string-split body2 "<main class=\"ol-main\">")))
       (check-true (string-contains? pane "ol-zoom") pane)
       (check-false (string-contains? pane "Buy milk") pane))))

  ;; ---- zoom ------------------------------------------------------------------

  ;; ^serve is the node's key, so the permalink is one a test can spell.
  (test-case "GET /n/<key> is that node, zoomed, with the trail above it"
    (with-server
     (λ (port f)
       (define-values (code _h body) (GET port "/n/serve"))
       (check-equal? code 200 body)
       (define pane (cadr (string-split body "<main class=\"ol-main\">")))
       (check-true (string-contains? pane "ol-zoom") pane)
       (check-true (string-contains? pane "Ship the server") pane)
       ;; the focused subtree and nothing else
       (check-false (string-contains? pane "Buy milk") pane)
       ;; breadcrumbs: home, then the file it is defined in
       (check-true (string-contains? pane "ol-breadcrumbs") pane)
       (check-true (string-contains? pane "Tasks.rkt") pane)
       (check-true (string-contains? pane "href=\"/\"") pane)
       ;; the tab says which node
       (check-true (string-contains? body "<title>Ship the server</title>") body))))

  (test-case "a node's permalink is its zoom page, not the home page"
    (with-server
     (λ (port f)
       (define-values (_c _h home) (GET port "/"))
       ;; every bullet is a link to that node's page — the sidebar's tree too
       (check-true (string-contains? home "href=\"/n/serve\"") home)
       (check-false (string-contains? home "href=\"/#n-serve\"") home))))

  (test-case "an ancestor crumb links to the ancestor's own zoom page"
    (with-server
     (λ (port f)
       ;; Buy milk is a child of Inbox, so its trail has a node in it. The
       ;; keys come from the JSON surface — the same ones the page draws with
       (define j (read-json (open-input-string
                             (let-values ([(_c _h b) (GET port "/api/tree")]) b))))
       (define inbox (car (hash-ref j 'tasks)))
       (define milk (car (hash-ref inbox 'children)))
       (check-equal? (hash-ref milk 'title) "Buy milk")
       (define-values (code _h2 body) (GET port (string-append "/n/" (hash-ref milk 'key))))
       (check-equal? code 200 body)
       (define pane (cadr (string-split body "<main class=\"ol-main\">")))
       (check-true (string-contains? pane "Buy milk") pane)
       (define crumbs (car (string-split pane "</nav>")))
       ;; home, the file, then the ancestor — a link to ITS page, not an
       ;; in-page anchor on the home page. The plain href is what matters
       ;; here: the partial-navigation attributes beside it are the live
       ;; view's, and tests/render.rkt is where they are asserted
       (check-true (string-contains? crumbs "Tasks.rkt") crumbs)
       (check-true (string-contains?
                    crumbs
                    (string-append "href=\"/n/" (hash-ref inbox 'key) "\""))
                   crumbs)
       (check-true (string-contains? crumbs ">Inbox</a>") crumbs))))

  (test-case "a key the snapshot does not have says so, and stays a page"
    (with-server
     (λ (port f)
       ;; not a 404: a tab zoomed on a node that was deleted re-fetches THIS
       ;; page to find out, and htmx swaps nothing on an error status
       (define-values (code headers body) (GET port "/n/nope"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/html")
                   (format "~a" headers))
       (check-true (string-contains? body "No such node.") body)
       ;; still a live page, still pointing at itself
       (check-true (string-contains? body "id=\"ol-live\" hx-get=\"/n/nope\"") body))))

  (test-case "an edit under a zoomed node lands on the zoom page"
    (with-server
     (λ (port f)
       (define-values (_code _headers in) (open-events port))
       (display-to-file (string-append outline "  Write the docs\n") f #:exists 'truncate)
       (check-not-false (next-event in) "no outline event for the edit")
       ;; the page an open tab re-fetches on that event is this one, and it
       ;; has the new child in it
       (define-values (code _h body) (GET port "/n/serve"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "Write the docs") body)
       (check-true (string-contains? body "id=\"ol-live\" hx-get=\"/n/serve\"") body)
       (close-input-port in))))

  (test-case "GET /api/tree matches the tree JSON contract"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/api/tree"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "application/json")
                   (format "~a" headers))
       (define j (read-json (open-input-string body)))
       (check-equal? (hash-ref j 'version) 1)
       (check-true (hash-has-key? j 'file))
       (define titles (map (λ (t) (hash-ref t 'title)) (hash-ref j 'tasks)))
       (check-equal? titles '("Inbox" "Ship the server"))
       (define inbox (car (hash-ref j 'tasks)))
       (check-equal? (map (λ (t) (hash-ref t 'title)) (hash-ref inbox 'children))
                     '("Buy milk")))))

  (test-case "GET /api/agenda matches the agenda JSON contract"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/api/agenda"))
       (check-equal? code 200 body)
       (define j (read-json (open-input-string body)))
       (check-equal? (hash-ref j 'version) 1)
       (check-true (string? (hash-ref j 'today)))
       (check-true (list? (hash-ref j 'overdue)))
       (check-true (list? (hash-ref j 'today_items)))
       (check-true (list? (hash-ref j 'upcoming)))
       (check-true
        (for/or ([grp (in-list (list (hash-ref j 'overdue)
                                     (hash-ref j 'today_items)
                                     (hash-ref j 'upcoming)))])
          (for/or ([it (in-list grp)])
            (equal? (hash-ref it 'title) "Buy milk")))
        body))))

  (test-case "GET /static/app.css serves the stylesheet"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/static/app.css"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/css")
                   (format "~a" headers))
       ;; a stylesheet, not a page that 200'd: the tokens every rule reads
       (check-true (string-contains? body ":root{") body))))

  (test-case "GET /static/collapse.js serves the collapse script"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/static/collapse.js"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "olai.collapsed") body))))

  (test-case "unknown path is a terse 404"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/nope"))
       (check-equal? code 404)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/plain")
                   (format "~a" headers))
       (check-true (string-contains? body "404") body))))

  (test-case "static path traversal is rejected"
    (with-server
     (λ (port f)
       (for ([p (in-list '("/static/../.."
                           "/static/../serve.rkt"
                           "/static/../../cli.rkt"))])
         (define-values (code headers body) (GET port p))
         (check-equal? code 404 (format "~a -> ~a" p body))
         (check-false (string-contains? body "#lang") body)))))

  ;; This server has no agent (the CLI refuses to start one that way; see
  ;; tests/integration/acp.rkt for the wired-up chat routes). Everything chat
  ;; says so rather than pretending: no panel on the page, 503 on the routes.
  (test-case "without an agent there is no panel, and the chat routes are 503"
    (with-server
     (λ (port f)
       (define-values (_c _h body) (GET port "/"))
       (check-false (string-contains? body "ol-chat-body") body)
       (define-values (status _headers in)
         (http-sendrecv "127.0.0.1" "/chat" #:port port #:method #"POST"
                        #:headers (list #"Content-Type: application/x-www-form-urlencoded")
                        #:data "text=hello"))
       (define reply (port->string in))
       (close-input-port in)
       (check-equal? (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
                     503
                     reply))))

  ;; ---- the store, over HTTP ------------------------------------------------

  (test-case "a saved edit shows up on the next request"
    (with-server
     (λ (port f)
       (define-values (c1 _h1 b1) (GET port "/"))
       (check-false (string-contains? b1 "Water the plants") b1)
       (display-to-file (string-append outline "Water the plants\n")
                        f #:exists 'truncate)
       (define-values (c2 _h2 b2) (GET port "/"))
       (check-equal? c2 200 b2)
       (check-true (string-contains? b2 "Water the plants") b2)
       (check-true (string-contains? b2 "Buy milk") b2)
       ;; the JSON surface sees the same snapshot
       (define j (read-json (open-input-string
                             (let-values ([(_c _h b) (GET port "/api/tree")]) b))))
       (check-true (for/or ([t (in-list (hash-ref j 'tasks))])
                     (equal? (hash-ref t 'title) "Water the plants"))
                   (format "~a" j)))))

  (test-case "a broken file keeps the page and its banner carries file:line:col"
    (with-server
     (λ (port f)
       (display-to-file (string-append outline "Broken\n  @date not-a-date\n")
                        f #:exists 'truncate)
       ;; the page still serves last-good content, with the error in the banner
       (define-values (code _h body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "Buy milk") body)
       (check-true (string-contains? body "ol-error") body)
       (check-true (string-contains? body "Tasks.rkt:") body)
       ;; agents get the failure, not stale data
       (define-values (jcode _jh jbody) (GET port "/api/tree"))
       (check-equal? jcode 500 jbody)
       (define j (read-json (open-input-string jbody)))
       (check-false (hash-ref j 'ok))
       (define e (hash-ref j 'error))
       (check-true (string-contains? (hash-ref e 'file) "Tasks.rkt") jbody)
       (check-true (number? (hash-ref e 'line)) jbody)
       ;; fixing the file un-breaks both
       (display-to-file outline f #:exists 'truncate)
       (define-values (c3 _h3 b3) (GET port "/"))
       (check-equal? c3 200 b3)
       (check-false (string-contains? b3 "ol-error") b3)
       (define-values (c4 _h4 _b4) (GET port "/api/tree"))
       (check-equal? c4 200))))

  ;; ---- live updates --------------------------------------------------------

  (test-case "GET /events opens with a reconnect policy and a beat"
    (with-server
     (λ (port f)
       (define-values (code headers in) (open-events port))
       (check-equal? code 200)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/event-stream")
                   (format "~a" headers))
       ;; bytes before anything happens: a client's `open` waits for them, and
       ;; so does a buffering proxy. The reconnect delay comes first — a
       ;; connection that drops before the first beat should still come back
       ;; promptly — and then the beat the watchdog is armed from, carrying the
       ;; cadence to expect the next one within
       (check-regexp-match #px"^retry: [0-9]+$"
                           (sync/timeout 20 (read-line-evt in 'linefeed)))
       (check-equal? (sync/timeout 20 (read-line-evt in 'linefeed)) "")
       (check-equal? (sync/timeout 20 (read-line-evt in 'linefeed))
                     (string-append "event: " heartbeat-event))
       (check-regexp-match #px"^data: [0-9.]+$"
                           (sync/timeout 20 (read-line-evt in 'linefeed)))
       (close-input-port in))))

  (test-case "the client runtime is served, and from its own prefix"
    (with-server
     (λ (port f)
       (for ([src (in-list live-script-srcs)])
         (define-values (code headers body) (GET port src))
         (check-equal? code 200 src)
         (check-true (string-contains?
                      (or (header-value headers "content-type:") "")
                      "javascript")
                     (format "~a ~a" src headers)))
       ;; and it is a mount, not a hole: nothing climbs out of it
       (define-values (code _h _b) (GET port (string-append live-asset-prefix
                                                            "../olai/info.rkt")))
       (check-equal? code 404))))

  (test-case "the page wires itself to the stream and knows its own href"
    (with-server
     (λ (port f)
       (define-values (_c _h body) (GET port "/"))
       ;; the stream, and the revision the markup around it was drawn from:
       ;; a page whose EventSource connects after an edit is behind, and this
       ;; is the only thing that lets it be told so
       (check-true (string-contains? body "sse-connect=\"/events?last-event-id=")
                   body)
       (check-true (string-contains? body "hx-trigger=\"sse:outline\"") body)
       (check-true (string-contains? body "id=\"ol-live\" hx-get=\"/\"") body)
       ;; /today refreshes /today, not the home page
       (define-values (_c2 _h2 today) (GET port "/today"))
       (check-true (string-contains? today "id=\"ol-live\" hx-get=\"/today\"") today))))

  (test-case "saving an outline pushes an outline event, and the page follows"
    (with-server
     (λ (port f)
       (define-values (_code _headers in) (open-events port))
       (display-to-file (string-append outline "Water the plants\n")
                        f #:exists 'truncate)
       (define ev (next-event in))
       (check-not-false ev "no outline event within the timeout")
       (check-equal? (event-name ev) outline-event)
       ;; the payload is the cursor the outlines are now at, and it is also
       ;; the stream's id — the one thing a client that goes away has to
       ;; remember, and the one thing it hands back on the way in
       (check-true (non-empty-string? (event-data ev)) (event-data ev))
       (check-equal? (event-id ev) (event-data ev))
       ;; what the client re-fetches has the edit in it
       (define-values (_c _h body) (GET port "/"))
       (check-true (string-contains? body "Water the plants") body)
       (close-input-port in))))

  ;; ---- catching up ---------------------------------------------------------
  ;;
  ;; The disease: a laptop sleeps, iOS suspends a tab, a network blips. The
  ;; EventSource dies, the file moves while nobody is listening, and the
  ;; connection that comes back is told nothing — so the page sits on content
  ;; from before the sleep, looking live.

  (test-case "a connection that comes back behind is caught up"
    (with-server
     (λ (port f)
       ;; a page loads and its stream opens
       (define-values (_c1 _h1 in1) (open-events port))
       (display-to-file (string-append outline "Water the plants\n")
                        f #:exists 'truncate)
       (define ev (next-event in1))
       (check-not-false ev "no outline event for the first edit")
       (define seen (event-id ev))
       ;; ...then the connection dies, and the file moves without it
       (close-input-port in1)
       (display-to-file (string-append outline "Water the plants\nFeed the cat\n")
                        f #:exists 'truncate)
       ;; the browser comes back saying what it last saw
       (define-values (_c2 _h2 in2) (open-events port #:last-event-id seen))
       (define caught (next-event in2))
       (check-not-false caught "nothing owed to a connection that was behind")
       (check-equal? (event-name caught) outline-event)
       (check-not-equal? (event-data caught) seen (format "~a -> ~a" seen caught))
       ;; and what it re-fetches is the CURRENT state, not the one it missed
       (define-values (_c3 _h3 body) (GET port "/"))
       (check-true (string-contains? body "Feed the cat") body)
       (close-input-port in2))))

  (test-case "a connection that missed nothing is told nothing"
    (with-server
     (λ (port f)
       (define-values (_c1 _h1 in1) (open-events port))
       (display-to-file (string-append outline "Water the plants\n")
                        f #:exists 'truncate)
       (define ev (next-event in1))
       (check-not-false ev "no outline event for the edit")
       (close-input-port in1)
       ;; back at the same revision: a page that re-fetched here would be
       ;; drawing what it is already showing
       (define-values (_c2 _h2 in2) (open-events port #:last-event-id (event-id ev)))
       (check-false (next-event in2 #:timeout 2)
                    "a caught-up connection was sent an event anyway")
       (close-input-port in2))))

  (test-case "a connection at the page's own revision is not behind"
    (with-server
     (λ (port f)
       ;; the cursor the page carries, taken from the page itself
       (define-values (_c _h body) (GET port "/"))
       (define-values (_c2 _h2 in) (open-events/page port body))
       (check-false (next-event in #:timeout 2)
                    "a page whose stream opened with nothing missed was told to re-fetch")
       (close-input-port in))))

  ;; The hole a Last-Event-ID alone cannot close: a page is RENDERED at one
  ;; moment and its EventSource connects at a later one. An edit in between is
  ;; broadcast to a connection that does not exist yet, and the browser has no
  ;; id to say it is behind with — so the page would sit on pre-edit content
  ;; forever, looking live.
  (test-case "an edit between rendering a page and its stream opening is caught"
    (with-server
     (λ (port f)
       (define-values (_c _h body) (GET port "/"))
       (display-to-file (string-append outline "Feed the cat\n") f #:exists 'truncate)
       ;; the page's stream connects only now, with the cursor it was drawn at
       (define-values (_c2 _h2 in) (open-events/page port body))
       (define caught (next-event in))
       (check-not-false caught "the page was never told about the edit it missed")
       (check-equal? (event-name caught) outline-event)
       (define-values (_c3 _h3 fresh) (GET port "/"))
       (check-true (string-contains? fresh "Feed the cat") fresh)
       (close-input-port in))))

  ;; The acceptance test for the whole work package: a file breaks and heals
  ;; under a running server, and the banner arrives and leaves on its own.
  (test-case "breaking and healing a file both push an event"
    (with-server
     (λ (port f)
       (define-values (_code _headers in) (open-events port))
       (display-to-file (string-append outline "Broken\n  @date not-a-date\n")
                        f #:exists 'truncate)
       ;; a reload that FAILED is still news: the banner has to appear
       (define broke (next-event in))
       (check-not-false broke "no event when the file broke")
       (check-equal? (event-name broke) outline-event)
       (define-values (_c1 _h1 b1) (GET port "/"))
       (check-true (string-contains? b1 "ol-error") b1)
       (display-to-file (string-append outline "Healed\n") f #:exists 'truncate)
       (define healed (next-event in))
       (check-not-false healed "no event when the file healed")
       ;; a different state, so a client sitting on the broken one is behind
       (check-not-equal? (event-data healed) (event-data broke)
                         (format "~a -> ~a" broke healed))
       (define-values (_c2 _h2 b2) (GET port "/"))
       (check-false (string-contains? b2 "ol-error") b2)
       (check-true (string-contains? b2 "Healed") b2)
       (close-input-port in))))

  (test-case "an @include fragment added after startup is watched too"
    (with-server
     (λ (port f)
       (define frag (build-path (path-only f) "Frag.rkt"))
       (define-values (_code _headers in) (open-events port))
       ;; the fragment is not in the watch set until the root names it
       (display-to-file "#lang olai\nFrom the fragment\n" frag)
       (display-to-file (string-append outline "Later\n  @include Frag.rkt\n")
                        f #:exists 'truncate)
       (check-not-false (next-event in) "no event for the root")
       (define-values (_c1 _h1 b1) (GET port "/"))
       (check-true (string-contains? b1 "From the fragment") b1)
       ;; now edit the FRAGMENT: the watch set was re-read, so this lands too
       (display-to-file "#lang olai\nFrom the fragment\n  Deeper still\n"
                        frag #:exists 'truncate)
       (check-not-false (next-event in) "no event for the fragment")
       (define-values (_c2 _h2 b2) (GET port "/"))
       (check-true (string-contains? b2 "Deeper still") b2)
       (close-input-port in)))))
