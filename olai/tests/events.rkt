#lang racket/base

;; The SSE hub and the watcher's midnight arithmetic — both in isolation,
;; no server and no clock. The wired-up version lives in tests/serve.rkt.

(require rackunit
         gregor
         olai/web/events
         olai/web/watch)

;; -> frame string | #f. Generous: these are all local channel hops.
(define (take-frame s [timeout 5])
  (sync/timeout timeout (subscriber-evt s)))

(module+ test
  ;; ---- framing -------------------------------------------------------------

  (test-case "one event is name, payload, blank line"
    (check-equal? (sse-frame "outline" "7") "event: outline\ndata: 7\n\n")
    (check-equal? (sse-frame "chat" "") "event: chat\ndata: \n\n"))

  (test-case "every line of a multi-line payload gets its own data:"
    ;; the naive one-liner splices the tail into a second, nameless event
    (check-equal? (sse-frame "chat" "one\ntwo\nthree")
                  "event: chat\ndata: one\ndata: two\ndata: three\n\n")
    ;; CRLF and a bare CR are line breaks too, and none of them survive
    (check-equal? (sse-frame "chat" "one\r\ntwo\rthree")
                  "event: chat\ndata: one\ndata: two\ndata: three\n\n"))

  (test-case "the heartbeat is a comment, not an event"
    (check-true (regexp-match? #px"^:" sse-heartbeat))
    (check-true (regexp-match? #px"\n\n$" sse-heartbeat)))

  ;; ---- subscription --------------------------------------------------------

  (test-case "a broadcast reaches every current subscriber"
    (define h (make-hub))
    (check-equal? (hub-subscriber-count h) 0)
    (define a (hub-subscribe! h))
    (define b (hub-subscribe! h))
    (check-equal? (hub-subscriber-count h) 2)
    (hub-broadcast! h "outline" "12")
    (check-equal? (take-frame a) "event: outline\ndata: 12\n\n")
    (check-equal? (take-frame b) "event: outline\ndata: 12\n\n"))

  (test-case "the hub is generic: it fans out whatever it is given"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    (hub-broadcast! h "chat" "hello")
    (check-equal? (take-frame s) "event: chat\ndata: hello\n\n"))

  (test-case "an unsubscribed client stops getting frames"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    (hub-unsubscribe! h s)
    (check-equal? (hub-subscriber-count h) 0)
    (hub-broadcast! h "outline" "1")
    (check-false (take-frame s 0.5)))

  ;; The server KILLS a response thread when its client hangs up, and a
  ;; killed thread runs no cleanup — so the hub cannot rely on being told.
  (test-case "a subscriber whose thread died is pruned by the next broadcast"
    (define h (make-hub))
    (define ready (make-semaphore 0))
    (define thd (thread (λ () (hub-subscribe! h) (semaphore-post ready) (sync never-evt))))
    (sync/timeout 5 ready)
    (check-equal? (hub-subscriber-count h) 1)
    (kill-thread thd)
    (sync/timeout 5 (thread-dead-evt thd))
    (hub-broadcast! h "outline" "1")
    (check-equal? (hub-subscriber-count h) 0))

  ;; Policy: a client that will not drain is dropped, never waited on. Its
  ;; EventSource reconnects and gets a fresh full render, which is the state
  ;; it wanted anyway.
  (test-case "a client that never reads is dropped, and never blocks a broadcast"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    (for ([i (in-range 500)]) (hub-broadcast! h "outline" (number->string i)))
    (check-equal? (hub-subscriber-count h) 0)
    ;; the frames it did take are the FIRST ones: the queue is bounded, not
    ;; a ring, so nothing it was told is a lie
    (check-equal? (take-frame s) "event: outline\ndata: 0\n\n"))

  ;; ---- midnight ------------------------------------------------------------

  (test-case "seconds-until-midnight is the distance to the next local one"
    (check-equal? (seconds-until-midnight (moment 2026 8 4 23 30 0 #:tz "UTC")) 1800)
    (check-equal? (seconds-until-midnight (moment 2026 8 4 0 0 1 #:tz "UTC")) 86399)
    ;; exactly midnight is a full day from the NEXT one, not zero
    (check-equal? (seconds-until-midnight (moment 2026 8 4 0 0 0 #:tz "UTC")) 86400))

  (test-case "midnight is the zone's, not UTC's"
    ;; 23:30 in New York is 03:30 UTC; the boundary that matters is local
    (check-equal? (seconds-until-midnight
                   (moment 2026 8 4 23 30 0 #:tz "America/New_York"))
                  1800))

  (test-case "a DST spring-forward day is 23 hours, and the calendar says so"
    ;; 2026-03-08 is the US spring-forward; midnight to midnight is 82800s
    (check-equal? (seconds-until-midnight
                   (moment 2026 3 8 0 0 0 #:tz "America/New_York"))
                  82800)))
