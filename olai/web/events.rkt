#lang racket/base

;; The event hub: one push channel, many browsers.
;;
;; Server-Sent Events, not websockets: the traffic is one-way (the server
;; says "something moved"), EventSource reconnects by itself, and it is plain
;; HTTP so Caddy or Tailscale in front of it needs no configuration.
;;
;; The hub is GENERIC. It knows event names and payload strings and nothing
;; about outlines — the watcher broadcasts `outline`, the ACP bridge will
;; broadcast `chat`, and neither is spelled here.
;;
;; The rules a fan-out has to get right, and how this one does:
;;
;;   * a broadcast must never block on a slow reader. Each subscriber owns a
;;     BOUNDED async-channel and a put that would block drops the subscriber
;;     instead (see queue-limit) — its stream ends, its EventSource
;;     reconnects, and it gets a fresh full render, which is exactly the
;;     state a client that missed events wants anyway.
;;   * a subscriber whose connection died must go away. Two ways out: a
;;     failed write unsubscribes on the way past, and — because the server
;;     KILLS the response thread when a client hangs up, which runs no
;;     dynamic-wind — a subscriber whose owning thread is dead is pruned by
;;     the next broadcast.
;;   * an idle stream must not look dead to a proxy: a heartbeat comment
;;     goes out every heartbeat-seconds.
;;   * a connection is born mid-story. What it missed is not the hub's to know,
;;     so it ASKS: `hub-response`'s `#:catch-up` is handed the subscribe thunk
;;     and answers with the frames this connection alone is owed (see
;;     web/chat). Subscribing inside it is the point — a caller whose state
;;     moves under a lock takes that lock around both, and then nothing can
;;     fall between the two.

(require racket/async-channel
         racket/contract
         racket/list
         racket/string
         web-server/http)

;; The surface serve.rkt sees is `make-hub`, `hub-broadcast!` and
;; `hub-response`: mount it, push to it. Subscription is exported too because
;; it is the seam the tests (and any non-HTTP consumer) need — but nothing
;; outside this module reaches into a subscriber's channel.
(provide (contract-out
          [make-hub (-> hub?)]
          [hub? (-> any/c boolean?)]
          [hub-broadcast! (-> hub? string? string? void?)]
          [hub-subscriber-count (-> hub? exact-nonnegative-integer?)]
          [hub-subscribe! (-> hub? subscriber?)]
          [hub-unsubscribe! (-> hub? subscriber? void?)]
          [subscriber? (-> any/c boolean?)]
          [subscriber-evt (-> subscriber? evt?)]
          [hub-response (->* (hub?)
                             (#:heartbeat-seconds (>/c 0)
                              #:catch-up (or/c #f (-> (-> any)
                                                      (listof (cons/c string? string?)))))
                             response?)]
          [sse-frame (-> string? string? string?)]
          [sse-heartbeat string?]))

;; How many undelivered frames a subscriber may owe before the hub gives up
;; on it. Small on purpose: these are notifications, not a log.
(define queue-limit 32)

(define default-heartbeat-seconds 15)

;; ---- framing --------------------------------------------------------------

;; One event, WHATWG framing: a blank line ends it, and EVERY line of the
;; payload needs its own `data:`. The naive "data: ~a\n\n" is wrong the first
;; time a payload contains a newline — the tail becomes a second, nameless
;; event — so the split is not optional.
(define (sse-frame name data)
  (apply string-append
         (append (list "event: " name "\n")
                 (for/list ([line (in-list (regexp-split #px"\r\n|\r|\n" data))])
                   (string-append "data: " line "\n"))
                 (list "\n"))))

;; A comment line: syntactically an event with no fields, so a client ignores
;; it, but it is bytes on the wire and that is the whole point.
(define sse-heartbeat ":hb\n\n")

;; ---- the hub --------------------------------------------------------------

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

;; Fan `data` out under `name`. Never blocks: the put is a poll, and a
;; subscriber that cannot take it (or whose thread is gone) is dropped here
;; rather than waited on.
(define (hub-broadcast! h name data)
  (define frame (sse-frame name data))
  (define dropped
    (with-subs
     h
     (λ (subs)
       (define-values (live dead)
         (partition (λ (s)
                      (and (not (thread-dead? (subscriber-owner s)))
                           (sync/timeout 0 (async-channel-put-evt (subscriber-ch s) frame))
                           #t))
                    subs))
       (set-hub-subs! h live)
       dead)))
  (for ([s (in-list dropped)]) (semaphore-post (subscriber-dead s)))
  (void))

;; ---- the response ---------------------------------------------------------

;; A never-terminated response: web-server sees no Content-Length, switches to
;; chunked encoding, and pumps whatever this writes as it is written — and it
;; leases the connection another response-send-timeout on every chunk, which
;; is the other reason the heartbeat exists.
;; #:catch-up is what this connection is owed before the stream proper: it is
;; handed a `subscribe!` thunk to call once (inside whatever lock makes its
;; answer consistent) and returns (name . data) pairs. #f is a subscriber that
;; is owed nothing, which is what the outline stream is.
(define (hub-response h
                      #:heartbeat-seconds [heartbeat-seconds default-heartbeat-seconds]
                      #:catch-up [catch-up #f])
  (response/output
   (λ (out) (stream-events h out heartbeat-seconds catch-up))
   #:code 200
   #:mime-type #"text/event-stream; charset=utf-8"
   ;; no-store for caches; X-Accel-Buffering for an nginx that would
   ;; otherwise hold the stream until it had a bufferful
   #:headers (list (make-header #"Cache-Control" #"no-store")
                   (make-header #"X-Accel-Buffering" #"no"))))

(define (stream-events h out heartbeat-seconds catch-up)
  (define sub #f)
  (define (subscribe!) (unless sub (set! sub (hub-subscribe! h))) sub)
  ;; Asked BEFORE a byte goes out: the answer is read under somebody else's
  ;; lock, and a socket written while that lock is held would stop the thing
  ;; the lock protects. A catch-up that forgot to subscribe still gets one.
  (define owed (if catch-up (catch-up subscribe!) '()))
  (define s (subscribe!))
  (define dead (subscriber-dead-evt s))
  (define (emit! str) (write-string str out) (flush-output out))
  ;; A broken socket is how these streams normally end, not a fault.
  (with-handlers ([exn:fail? void])
    ;; Open the stream before waiting for anything: the client's `open` does
    ;; not fire until bytes land, and neither does a proxy's. One write, owed
    ;; frames and all — they are already in hand, and a flush apiece would be
    ;; a chunk apiece on the wire.
    (emit! (apply string-append
                  sse-heartbeat
                  (for/list ([f (in-list owed)]) (sse-frame (car f) (cdr f)))))
    (let loop ()
      (define woke (sync/timeout heartbeat-seconds (subscriber-evt s) dead))
      (cond
        [(string? woke) (emit! woke) (loop)]
        [(not woke) (emit! sse-heartbeat) (loop)]
        ;; dropped by the hub: end the response, let EventSource come back
        [else (void)])))
  (hub-unsubscribe! h s))
