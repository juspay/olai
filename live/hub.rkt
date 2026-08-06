#lang racket/base

;; The event hub: one push channel, many browsers.
;;
;; Server-Sent Events, not websockets: the traffic is one-way (the server says
;; "something moved"), EventSource reconnects by itself, and it is plain HTTP
;; so Caddy or Tailscale in front of it needs no configuration.
;;
;; The hub is GENERIC, and that is the whole design. It knows event names,
;; payload strings and stream ids; it does not know what any of them MEAN. A
;; host app broadcasts `outline` or `chat` or `deploy`, stamps whatever cursor
;; it can compare later, and answers the one question a transport cannot: what
;; does a connection that comes back saying "I last saw 41" still owe.
;;
;; The rules a fan-out has to get right, and how this one does:
;;
;;   * a broadcast must never block on a slow reader. Each subscriber owns a
;;     BOUNDED async-channel and a put that would block drops the subscriber
;;     instead (see queue-limit) — its stream ends, its EventSource reconnects,
;;     and catch-up hands it whatever it missed, which is exactly the state a
;;     client that fell behind wants.
;;   * a subscriber whose connection died must go away. Two ways out: a failed
;;     write unsubscribes on the way past, and — because the server KILLS the
;;     response thread when a client hangs up, which runs no dynamic-wind — a
;;     subscriber whose owning thread is dead is pruned by the next broadcast.
;;   * an idle stream must not look dead to a proxy, and must not look ALIVE to
;;     a client reading a half-open socket. So the heartbeat is a real event
;;     rather than a comment: a comment keeps the socket warm but is invisible
;;     to EventSource, and a client that cannot see the beat cannot notice it
;;     stopping. It carries its own cadence, so the watchdog on the other end
;;     is sized by the stream instead of by a number copied into a script.
;;   * a connection is born mid-story. What it missed is not the hub's to know,
;;     so it ASKS: `hub-response`'s `#:catch-up` is handed the client's last
;;     seen id and the subscribe thunk, and answers with the frames this
;;     connection alone is owed. Subscribing inside it is the point — a caller
;;     whose state moves under a lock takes that lock around both, and then
;;     nothing can fall between the two.

(require racket/async-channel
         racket/contract
         racket/list
         web-server/http
         live/frame)

;; Mount it, push to it, ask it who is listening. Subscription is exported too
;; because it is the seam tests (and any non-HTTP consumer) need — but nothing
;; outside this module reaches into a subscriber's channel.
(provide (contract-out
          [make-hub (-> hub?)]
          [hub? (-> any/c boolean?)]
          [hub-broadcast! (-> hub? frame? void?)]
          [hub-subscriber-count (-> hub? exact-nonnegative-integer?)]
          [hub-subscribe! (-> hub? subscriber?)]
          [hub-unsubscribe! (-> hub? subscriber? void?)]
          [subscriber? (-> any/c boolean?)]
          [subscriber-evt (-> subscriber? evt?)]
          [hub-response (->* (hub?)
                             (#:last-event-id (or/c string? #f)
                              #:heartbeat-seconds (>/c 0)
                              #:retry-milliseconds exact-positive-integer?
                              #:catch-up (or/c #f (-> (or/c string? #f)
                                                      (-> any)
                                                      (listof frame?))))
                             response?)]
          ;; what THIS connection last saw — the browser's reconnect header, or
          ;; failing that the cursor the page put in the stream's URL. #f is a
          ;; connection that has genuinely seen nothing
          [request-last-event-id (-> request? (or/c string? #f))]
          ;; the beat's name and payload shape, so a client runtime and a test
          ;; spell one binding instead of two matching strings
          [heartbeat-event string?]
          [heartbeat-frame (-> (>/c 0) frame?)]))

;; How many undelivered frames a subscriber may owe before the hub gives up on
;; it. Small on purpose: these are notifications, not a log.
(define queue-limit 32)

(define default-heartbeat-seconds 15)

;; Long enough that a server restart does not become a reconnect storm, short
;; enough that a laptop waking up is live again before the human looks at it.
;; The browser's own default is around three seconds and unstated.
(define default-retry-milliseconds 1000)

;; ---- the heartbeat ----------------------------------------------------------

;; Namespaced away from the host app's event names: a consumer picks its own
;; vocabulary, and the transport must not be able to collide with it.
(define heartbeat-event "live:hb")

;; The beat says how often to expect the next one. A client sizes its watchdog
;; from that, so changing the cadence here changes both ends at once and there
;; is no second place holding a number that has to agree.
(define (heartbeat-frame seconds)
  (make-frame heartbeat-event (number->string seconds)))

;; ---- the hub ----------------------------------------------------------------

;; ch    : bounded async-channel of frame strings
;; dead  : posted when the hub is done with this subscriber
;; owner : the thread that subscribed. A subscriber belongs to it; when that
;;         thread is gone so is the connection it was writing to.
(struct subscriber (ch dead owner))

(struct hub ([subs #:mutable] sema))

(define (make-hub) (hub '() (make-semaphore 1)))

(define (subscriber-evt s) (subscriber-ch s))

;; Ready once the hub has dropped this subscriber; a peek so the writer loop
;; can select on it without consuming it.
(define (subscriber-dead-evt s) (semaphore-peek-evt (subscriber-dead s)))

(define (with-subs h proc)
  (call-with-semaphore (hub-sema h) (λ () (proc (hub-subs h)))))

(define (hub-subscriber-count h)
  (with-subs h length))

(define (hub-subscribe! h)
  (define s (subscriber (make-async-channel queue-limit) (make-semaphore 0) (current-thread)))
  (with-subs h (λ (subs) (set-hub-subs! h (cons s subs))))
  s)

(define (hub-unsubscribe! h s)
  (with-subs h (λ (subs) (set-hub-subs! h (remq s subs))))
  (semaphore-post (subscriber-dead s))
  (void))

;; Fan one frame out to everybody listening. Never blocks: the put is a poll,
;; and a subscriber that cannot take it (or whose thread is gone) is dropped
;; here rather than waited on.
;;
;; A frame and not a name-and-payload, because a frame is what catch-up already
;; deals in: one vocabulary for "something to send", whether it is going to
;; everybody or to the one connection that missed it.
(define (hub-broadcast! h f)
  (define str (frame->string f))
  (define dropped
    (with-subs
     h
     (λ (subs)
       (define-values (live dead)
         (partition (λ (s)
                      (and (not (thread-dead? (subscriber-owner s)))
                           (sync/timeout 0 (async-channel-put-evt (subscriber-ch s) str))
                           #t))
                    subs))
       (set-hub-subs! h live)
       dead)))
  (for ([s (in-list dropped)]) (semaphore-post (subscriber-dead s)))
  (void))

;; ---- the response -----------------------------------------------------------

;; What this connection last saw, from the two places it can say so.
;;
;; The HEADER is the browser's: EventSource sets `Last-Event-ID` on a reconnect,
;; carrying the id of the last frame it managed to dispatch. It is the fresher
;; answer whenever it exists, so it is read first.
;;
;; The QUERY is the page's, put there by live-connect-attributes: the state the
;; page was rendered at, which is what a FIRST connection last saw — everything
;; that markup was drawn from. Without it the window between rendering a page
;; and its stream connecting is a hole nothing can heal, because the client has
;; no id to be behind.
;;
;; Blank counts as absent, from either.
(define (request-last-event-id req)
  (or (header-cursor req) (query-cursor req)))

(define (present s) (and s (positive? (string-length s)) s))

(define (header-cursor req)
  (define h (headers-assq* #"Last-Event-ID" (request-headers/raw req)))
  (and h (present (bytes->string/utf-8 (header-value h) #\?))))

(define cursor-param-bytes (string->bytes/utf-8 live-cursor-param))

(define (query-cursor req)
  (define b (bindings-assq cursor-param-bytes (request-bindings/raw req)))
  (and (binding:form? b)
       (present (bytes->string/utf-8 (binding:form-value b) #\?))))

;; A never-terminated response: web-server sees no Content-Length, switches to
;; chunked encoding, and pumps whatever this writes as it is written — and it
;; leases the connection another response-send-timeout on every chunk, which is
;; the other reason the heartbeat exists.
;;
;; #:catch-up is what this connection is owed before the stream proper. It is
;; handed the client's last seen id (#f on a first connection) and a
;; `subscribe!` thunk to call once, inside whatever lock makes its answer
;; consistent, and returns the frames to send. #f is a stream that owes nobody
;; anything, which is a fan-out with no state behind it.
(define (hub-response h
                      #:last-event-id [last-event-id #f]
                      #:heartbeat-seconds [heartbeat-seconds default-heartbeat-seconds]
                      #:retry-milliseconds [retry-milliseconds default-retry-milliseconds]
                      #:catch-up [catch-up #f])
  (response/output
   (λ (out)
     (stream-events h out heartbeat-seconds retry-milliseconds last-event-id catch-up))
   #:code 200
   #:mime-type #"text/event-stream; charset=utf-8"
   ;; no-store for caches; X-Accel-Buffering for an nginx that would otherwise
   ;; hold the stream until it had a bufferful
   #:headers (list (make-header #"Cache-Control" #"no-store")
                   (make-header #"X-Accel-Buffering" #"no"))))

(define (stream-events h out heartbeat-seconds retry-ms last-event-id catch-up)
  (define sub #f)
  (define (subscribe!) (unless sub (set! sub (hub-subscribe! h))) sub)
  ;; Asked BEFORE a byte goes out: the answer is read under somebody else's
  ;; lock, and a socket written while that lock is held would stop the thing
  ;; the lock protects. A catch-up that forgot to subscribe still gets one.
  (define owed (if catch-up (catch-up last-event-id subscribe!) '()))
  (define s (subscribe!))
  (define dead (subscriber-dead-evt s))
  (define beat (frame->string (heartbeat-frame heartbeat-seconds)))
  (define (emit! str) (write-string str out) (flush-output out))
  ;; A broken socket is how these streams normally end, not a fault.
  (with-handlers ([exn:fail? void])
    ;; Open the stream before waiting for anything: the client's `open` does
    ;; not fire until bytes land, and neither does a proxy's. One write —
    ;; the reconnect policy, a beat to start the watchdog on, and everything
    ;; this connection was owed, which is already in hand.
    (emit! (string-append (sse-retry retry-ms) beat (frames->string owed)))
    (let loop ()
      (define woke (sync/timeout heartbeat-seconds (subscriber-evt s) dead))
      (cond
        [(string? woke) (emit! woke) (loop)]
        [(not woke) (emit! beat) (loop)]
        ;; dropped by the hub: end the response, let EventSource come back
        [else (void)])))
  (hub-unsubscribe! h s))
