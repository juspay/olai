#lang racket/base

;; Routes and wiring: the only module that knows there are two of everything.
;; Two producers push onto ONE hub, two drawers each own a region, and one
;; stream carries both event names.
;;
;;   GET /            the page: header (ticker, input, health) + the list
;;   GET /c/<name>    one counter, in the same region the list was in
;;   GET /events      the stream both surfaces ride
;;   GET /*.js        the framework's browser runtime, as itself

(require racket/async-channel
         racket/cmdline
         web-server/web-server
         web-server/http
         web-server/dispatch
         web-server/dispatchers/dispatch
         web-server/dispatchers/filesystem-map
         (prefix-in files: web-server/dispatchers/dispatch-files)
         (prefix-in lift: web-server/dispatchers/dispatch-lift)
         (prefix-in sequencer: web-server/dispatchers/dispatch-sequencer)
         live/client
         live/hub
         "clock.rkt"
         "counters.rkt"
         "header.rkt"
         "list.rkt")

(provide start-counters-server)

;; live ships no CSS: the health states are class names, and what they look
;; like is the app's. Spelled from the bindings live/client exports rather than
;; as literals — the one cross-file agreement here that Racket can check.
(define page-css
  (string-append
   "body{font:14px/1.7 ui-monospace,monospace;margin:2rem;}"
   "header{display:flex;gap:1.5rem;align-items:center;margin-bottom:1.5rem;}"
   "#ticker{font-weight:bold;}"
   "#about{color:#666;max-width:48rem;margin:0 0 1.5rem;}"
   "#clist ol{margin:0;padding-left:2rem;}"
   "#clist .v{margin-left:.75rem;color:#666;}"
   "#health::after{content:'live';color:green;}"
   "html." live-connecting-class " #health::after{content:'reconnecting...';color:orange;}"
   "html." live-stale-class " #health::after{content:'stale - last known state';color:red;}"))

;; Every route draws the same page: the header, and the clist region holding
;; whatever `draw` puts there. Both views are built from the SAME address and
;; the same cursor — the address is what a region re-fetches, and the cursor is
;; the state this markup was drawn from, so a bump landing between rendering
;; the page and its EventSource connecting is not a hole nothing can heal.
(define (page href draw)
  (define cursor (counts-cursor))
  (define ticker (ticker-view href cursor))
  (response/xexpr
   #:preamble #"<!DOCTYPE html>\n"
   `(html
     (head (meta ((charset "utf-8")))
           (title "counters")
           (style () ,page-css)
           ,@(for/list ([src (in-list (live-script-hrefs "/"))])
               `(script ((src ,src) (defer "defer")))))
     ;; the connection is the PAGE's, not a region's: one EventSource for both
     ;; surfaces, and either view spells the same stream and the same cursor
     (body (,@(live-connect-attributes ticker))
           ,(render-header ticker (clock-now))
           ;; what the reader is looking at. Chrome like the header: outside
           ;; both regions, so nothing ever swaps it
           (p ((id "about"))
              "Three counters bump on the server and are listed by value, so"
              " the rows reorder twice a second. The clock has its own producer"
              " and its own event. Click a counter: the address changes and"
              " only the list is swapped — the ticker, and whatever you typed"
              " in the box, are never rebuilt.")
           ,(draw (clist-view href cursor))))))

;; A connection is born mid-story. The counters answer for their own ids; the
;; clock owes nobody anything, because a tick was never a checkpoint.
(define (events-response hub req)
  (hub-response
   hub
   #:last-event-id (request-last-event-id req)
   #:catch-up (λ (last-id subscribe!)
                (subscribe!)
                (counts-catch-up last-id))))

(define (make-router hub)
  (define-values (route _url)
    (dispatch-rules
     [("") (λ (req) (page "/" (λ (lv) (render-list lv (counter-values)))))]
     ;; the other end of counter-href in list.rkt. A name nothing answers to
     ;; falls back to the list rather than to an error page: the counters are
     ;; the app's whole state, and there is nothing else to say.
     [("c" (string-arg))
      (λ (req name)
        (define c (counter-named name))
        (page (counter-href name)
              (λ (lv) (if c (render-detail lv c) (render-list lv (counter-values))))))]
     ;; convention 4 (events URL), the ROUTE's end: list.rkt and header.rkt
     ;; both put "/events" on the page.
     [("events") (λ (req) (events-response hub req))]
     [else (λ (req) (response/output (λ (out) (write-string "404\n" out))
                                     #:code 404
                                     #:mime-type #"text/plain; charset=utf-8"))]))
  route)

;; The framework's four browser files, served as themselves from the directory
;; it ships them in. All JavaScript, so the MIME table is one line; a path that
;; climbs out of that directory is a miss like any other, not a crash.
(define asset-path (make-url->path (live-static-dir)))

(define assets-dispatcher
  (files:make #:url->path (λ (u)
                            (with-handlers ([exn:fail? (λ (_e) (next-dispatcher))])
                              (asset-path u)))
              #:path->mime-type (λ (_p) #"application/javascript; charset=utf-8")
              #:indices '()))

;; -> (values stop bound-port). #:port 0 is "pick one", which is what the smoke
;; test uses.
(define (start-counters-server #:port [port 8080])
  (define hub (make-hub))
  (define confirm (make-async-channel 1))
  (define stop
    (serve #:dispatch (sequencer:make assets-dispatcher (lift:make (make-router hub)))
           #:port port
           #:listen-ip "127.0.0.1"
           #:confirmation-channel confirm))
  (define bound (async-channel-get confirm))
  (when (exn? bound) (stop) (raise bound))
  ;; only once there is a listener: a producer with nobody to tell is a thread
  ;; burning a clock
  (define counters (start-counters! hub))
  (define clock (start-clock! hub))
  (values (λ () (kill-thread counters) (kill-thread clock) (stop)) bound))

(module+ main
  (define port (make-parameter 8080))
  (command-line
   #:program "counters"
   #:once-each
   [("--port") p "port to listen on (default 8080)" (port (string->number p))])
  (define-values (stop bound) (start-counters-server #:port (port)))
  ;; flushed, not just printed: stdout to anything but a terminal is block
  ;; buffered, and this process then sleeps forever with the address in a
  ;; buffer nobody sees
  (printf "counters: http://127.0.0.1:~a/\n" bound)
  (flush-output)
  (with-handlers ([exn:break? (λ (_e) (stop))])
    (sync never-evt)))
