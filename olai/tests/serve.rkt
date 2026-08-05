#lang racket/base

;; Web server routes. Boots the real server on an ephemeral port against a
;; temp outline; no personal data, no fixed ports.

(require rackunit
         json
         net/http-client
         racket/file
         racket/path
         racket/port
         racket/string
         selfflowy/web/serve)

;; Sizes differ on every write below: the store's staleness probe is mtime +
;; size, and a same-second same-size rewrite is invisible to it.

(define outline
  (string-append
   "#lang selfflowy\n"
   "Inbox\n"
   "  Buy milk\n"
   "    @date 2026-01-15\n"
   "Ship the server ^serve\n"))

;; Run body with the server up: (proc port outline-path). The path is handed
;; back so a test can edit the outline underneath a running server.
(define (with-server proc)
  (define dir (make-temporary-file "sfserve~a" 'directory))
  (define f (build-path dir "Tasks.rkt"))
  (display-to-file outline f #:exists 'truncate)
  (define bound #f)
  (define stop
    (start-server #:port 0
                  #:bind "127.0.0.1"
                  #:files (list f)
                  #:on-listen (λ (p) (set! bound p))))
  (dynamic-wind
   void
   (λ () (proc bound f))
   (λ ()
     (stop)
     (delete-directory/files dir))))

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
(define (open-events port)
  (define-values (status headers in)
    (http-sendrecv "127.0.0.1" "/events" #:port port #:method #"GET"))
  (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
          (map bytes->string/utf-8 headers)
          in))

;; Next real event on the stream: -> (cons name data) | #f on timeout.
;; Heartbeat comments are skipped — they are framing, not news. Waited on,
;; never slept for.
(define (next-event in #:timeout [timeout 20])
  (define deadline (+ (current-inexact-milliseconds) (* 1000.0 timeout)))
  (let loop ([name #f] [data '()])
    (define left (/ (- deadline (current-inexact-milliseconds)) 1000.0))
    (define line (and (positive? left)
                      (sync/timeout left (read-line-evt in 'linefeed))))
    (cond
      [(or (not line) (eof-object? line)) #f]
      [(string=? line "")
       (if name (cons name (string-join (reverse data) "\n")) (loop #f '()))]
      [(string-prefix? line "event: ") (loop (substring line 7) data)]
      [(string-prefix? line "data: ") (loop name (cons (substring line 6) data))]
      [else (loop name data)])))

(module+ test
  (test-case "GET / is an html page with the outline in it"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/html")
                   (format "~a" headers))
       (check-true (string-contains? body "Buy milk") body))))

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
       (define pane (cadr (string-split body2 "<main class=\"sf-main\">")))
       (check-true (string-contains? pane "sf-zoom") pane)
       (check-false (string-contains? pane "Buy milk") pane))))

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
       (check-true (string-contains? body "selfflowy") body))))

  (test-case "GET /static/collapse.js serves the collapse script"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/static/collapse.js"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "selfflowy.collapsed") body))))

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
  ;; tests/acp.rkt for the wired-up chat routes). Everything chat says so
  ;; rather than pretending: no panel on the page, 503 on the routes.
  (test-case "without an agent there is no panel, and the chat routes are 503"
    (with-server
     (λ (port f)
       (define-values (_c _h body) (GET port "/"))
       (check-false (string-contains? body "sf-chat-body") body)
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
       (check-true (string-contains? body "sf-error") body)
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
       (check-false (string-contains? b3 "sf-error") b3)
       (define-values (c4 _h4 _b4) (GET port "/api/tree"))
       (check-equal? c4 200))))

  ;; ---- live updates --------------------------------------------------------

  (test-case "GET /events is an event stream that opens with a heartbeat"
    (with-server
     (λ (port f)
       (define-values (code headers in) (open-events port))
       (check-equal? code 200)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/event-stream")
                   (format "~a" headers))
       ;; bytes before anything happens: a client's `open` waits for them,
       ;; and so does a buffering proxy
       (check-equal? (sync/timeout 20 (read-line-evt in 'linefeed)) ":hb")
       (close-input-port in))))

  (test-case "the page wires itself to the stream and knows its own href"
    (with-server
     (λ (port f)
       (define-values (_c _h body) (GET port "/"))
       (check-true (string-contains? body "sse-connect=\"/events\"") body)
       (check-true (string-contains? body "hx-trigger=\"sse:outline\"") body)
       (check-true (string-contains? body "id=\"sf-live\" hx-get=\"/\"") body)
       ;; /today refreshes /today, not the home page
       (define-values (_c2 _h2 today) (GET port "/today"))
       (check-true (string-contains? today "id=\"sf-live\" hx-get=\"/today\"") today))))

  (test-case "saving an outline pushes an outline event, and the page follows"
    (with-server
     (λ (port f)
       (define-values (_code _headers in) (open-events port))
       (display-to-file (string-append outline "Water the plants\n")
                        f #:exists 'truncate)
       (define ev (next-event in))
       (check-not-false ev "no outline event within the timeout")
       (check-equal? (car ev) "outline")
       ;; the payload is the store revision: a number that moved
       (check-true (exact-positive-integer? (string->number (cdr ev))) (cdr ev))
       ;; what the client re-fetches has the edit in it
       (define-values (_c _h body) (GET port "/"))
       (check-true (string-contains? body "Water the plants") body)
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
       (check-equal? (car broke) "outline")
       (define-values (_c1 _h1 b1) (GET port "/"))
       (check-true (string-contains? b1 "sf-error") b1)
       (display-to-file (string-append outline "Healed\n") f #:exists 'truncate)
       (define healed (next-event in))
       (check-not-false healed "no event when the file healed")
       (check-true (> (string->number (cdr healed)) (string->number (cdr broke)))
                   (format "~a -> ~a" broke healed))
       (define-values (_c2 _h2 b2) (GET port "/"))
       (check-false (string-contains? b2 "sf-error") b2)
       (check-true (string-contains? b2 "Healed") b2)
       (close-input-port in))))

  (test-case "an @include fragment added after startup is watched too"
    (with-server
     (λ (port f)
       (define frag (build-path (path-only f) "Frag.rkt"))
       (define-values (_code _headers in) (open-events port))
       ;; the fragment is not in the watch set until the root names it
       (display-to-file "#lang selfflowy\nFrom the fragment\n" frag)
       (display-to-file (string-append outline "Later\n  @include Frag.rkt\n")
                        f #:exists 'truncate)
       (check-not-false (next-event in) "no event for the root")
       (define-values (_c1 _h1 b1) (GET port "/"))
       (check-true (string-contains? b1 "From the fragment") b1)
       ;; now edit the FRAGMENT: the watch set was re-read, so this lands too
       (display-to-file "#lang selfflowy\nFrom the fragment\n  Deeper still\n"
                        frag #:exists 'truncate)
       (check-not-false (next-event in) "no event for the fragment")
       (define-values (_c2 _h2 b2) (GET port "/"))
       (check-true (string-contains? b2 "Deeper still") b2)
       (close-input-port in)))))
