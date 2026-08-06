#lang racket/base

;; The fan-out, and the catch-up seam. No server: a subscriber is a channel,
;; and everything below is a local hop.

(require net/url
         racket/promise
         web-server/http
         live/frame
         live/hub)

(module+ test
  (require rackunit))

(module+ test
  ;; -> frame string | #f. Generous: these are all local channel hops.
  (define (take-frame s [timeout 5])
    (sync/timeout timeout (subscriber-evt s)))

  (define (say name data #:id [id #f]) (make-frame name data #:id id))

  ;; A GET on the stream: `url` may carry the cursor a page put there, `headers`
  ;; the one a reconnecting EventSource sets.
  (define (request-with #:url [u "/events"] . headers)
    (define parsed (string->url u))
    (request #"GET" parsed headers
             (delay (for/list ([q (in-list (url-query parsed))])
                      (binding:form (string->bytes/utf-8 (symbol->string (car q)))
                                    (string->bytes/utf-8 (or (cdr q) "")))))
             #f "1.2.3.4" 80 "1.2.3.4")))

(module+ test
  ;; ---- subscription --------------------------------------------------------

  (test-case "a broadcast reaches every current subscriber"
    (define h (make-hub))
    (check-equal? (hub-subscriber-count h) 0)
    (define a (hub-subscribe! h))
    (define b (hub-subscribe! h))
    (check-equal? (hub-subscriber-count h) 2)
    (hub-broadcast! h (say "outline" "12"))
    (check-equal? (take-frame a) "event: outline\ndata: 12\n\n")
    (check-equal? (take-frame b) "event: outline\ndata: 12\n\n"))

  (test-case "the hub is generic: it fans out whatever it is given"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    (hub-broadcast! h (say "chat" "hello"))
    (check-equal? (take-frame s) "event: chat\ndata: hello\n\n"))

  (test-case "an id rides along, and the hub never reads it"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    ;; not a number, not a date: an id is an opaque string to this layer
    (hub-broadcast! h (say "deploy" "ok" #:id "01J-whatever"))
    (check-equal? (take-frame s) "id: 01J-whatever\nevent: deploy\ndata: ok\n\n"))

  (test-case "an unsubscribed client stops getting frames"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    (hub-unsubscribe! h s)
    (check-equal? (hub-subscriber-count h) 0)
    (hub-broadcast! h (say "outline" "1"))
    (check-false (take-frame s 0.5)))

  ;; The server KILLS a response thread when its client hangs up, and a killed
  ;; thread runs no cleanup — so the hub cannot rely on being told.
  (test-case "a subscriber whose thread died is pruned by the next broadcast"
    (define h (make-hub))
    (define ready (make-semaphore 0))
    (define thd (thread (λ () (hub-subscribe! h) (semaphore-post ready) (sync never-evt))))
    (sync/timeout 5 ready)
    (check-equal? (hub-subscriber-count h) 1)
    (kill-thread thd)
    (sync/timeout 5 (thread-dead-evt thd))
    (hub-broadcast! h (say "outline" "1"))
    (check-equal? (hub-subscriber-count h) 0))

  ;; Policy: a client that will not drain is dropped, never waited on. Its
  ;; EventSource reconnects, and catch-up hands it whatever it missed — which
  ;; is the state it wanted anyway.
  (test-case "a client that never reads is dropped, and never blocks a broadcast"
    (define h (make-hub))
    (define s (hub-subscribe! h))
    (for ([i (in-range 500)]) (hub-broadcast! h (say "outline" (number->string i))))
    (check-equal? (hub-subscriber-count h) 0)
    ;; the frames it did take are the FIRST ones: the queue is bounded, not a
    ;; ring, so nothing it was told is a lie
    (check-equal? (take-frame s) "event: outline\ndata: 0\n\n"))

  ;; ---- the heartbeat -------------------------------------------------------

  (test-case "the heartbeat is an event, and it carries its own cadence"
    ;; a comment keeps a proxy happy but is invisible to EventSource, and a
    ;; client that cannot see the beat cannot notice it stopping
    (define f (heartbeat-frame 15))
    (check-equal? (frame-name f) heartbeat-event)
    (check-equal? (frame-data f) "15")
    (check-false (frame-id f)))

  ;; ---- what a connection last saw ------------------------------------------

  (test-case "Last-Event-ID is read off the request, and a blank one is none"
    (check-equal? (request-last-event-id
                   (request-with (make-header #"Last-Event-ID" #"41")))
                  "41")
    ;; header names are case-insensitive on the wire
    (check-equal? (request-last-event-id
                   (request-with (make-header #"last-event-id" #"41")))
                  "41")
    (check-false (request-last-event-id (request-with)))
    (check-false (request-last-event-id
                  (request-with (make-header #"Last-Event-ID" #"")))))

  ;; The page's own answer to the same question, for a connection the browser
  ;; has nothing to say about yet.
  (test-case "a cursor in the URL stands in for the header"
    (check-equal? (request-last-event-id
                   (request-with #:url "/events?last-event-id=41"))
                  "41")
    (check-false (request-last-event-id (request-with #:url "/events?last-event-id="))))

  ;; A reconnect sends both: the URL is the one the page was rendered with,
  ;; frozen at load, and the header is what this connection actually last saw.
  (test-case "the header wins over the URL"
    (check-equal? (request-last-event-id
                   (request-with #:url "/events?last-event-id=41"
                                 (make-header #"Last-Event-ID" #"57")))
                  "57"))

  ;; ---- the response --------------------------------------------------------
  ;;
  ;; The response body is a procedure; running it against a string port is the
  ;; whole stream, up to the point the hub drops the subscriber.

  ;; Write the stream into a port, hang up after `frames` events have landed.
  ;; -> the bytes written.
  (define (drain resp #:after [after void])
    (define out (open-output-bytes))
    (define done (make-semaphore 0))
    (define thd
      (thread (λ ()
                ((response-output resp) out)
                (semaphore-post done))))
    (sync/timeout 2 (alarm-evt (+ (current-inexact-milliseconds) 200)))
    (after)
    (sync/timeout 2 (alarm-evt (+ (current-inexact-milliseconds) 200)))
    (kill-thread thd)
    (get-output-bytes out))

  (test-case "a stream opens with its reconnect policy and a beat"
    (define h (make-hub))
    (define bytes (drain (hub-response h #:heartbeat-seconds 30)))
    (check-regexp-match #px"^retry: \\d+\n\n" bytes)
    (check-regexp-match #px"event: live:hb\ndata: 30\n\n" bytes))

  (test-case "catch-up is handed the last id and the subscribe thunk, once"
    (define h (make-hub))
    (define seen #f)
    (define resp
      (hub-response h
                    #:last-event-id "41"
                    #:heartbeat-seconds 30
                    #:catch-up (λ (last-id subscribe!)
                                 (set! seen last-id)
                                 (subscribe!)
                                 (list (make-frame "outline" "42" #:id "42")))))
    (define bytes (drain resp))
    (check-equal? seen "41")
    (check-regexp-match #px"id: 42\nevent: outline\ndata: 42\n\n" bytes)
    ;; ONE subscription, not two: the thunk is idempotent, and a catch-up that
    ;; called it is not charged for the stream's own
    (check-equal? (hub-subscriber-count h) 1))

  (test-case "a catch-up that forgot to subscribe still gets a subscription"
    (define h (make-hub))
    (define resp (hub-response h #:catch-up (λ (_id _subscribe!) '())))
    (drain resp)
    (check-equal? (hub-subscriber-count h) 1))

  (test-case "a frame broadcast after the response opened lands on it"
    (define h (make-hub))
    (define bytes
      (drain (hub-response h #:heartbeat-seconds 30)
             #:after (λ () (hub-broadcast! h (say "outline" "9" #:id "9")))))
    (check-regexp-match #px"id: 9\nevent: outline\ndata: 9\n\n" bytes))

  ;; ---- the stream nobody is answering for ------------------------------------
  ;;
  ;; A connect to another process's boot id. It is ANSWERED, because
  ;; EventSource hides an HTTP status from the page and retries a refusal
  ;; forever — a stale tab would knock until somebody closed it.

  (test-case "a stale boot id is answered with one reload frame, then the end"
    (define bytes (drain (live-reload-response)))
    (check-regexp-match #px"^retry: \\d+\n\n" bytes)
    (check-regexp-match (pregexp (string-append "event: " live-reload-event "\n"))
                        bytes)
    ;; the payload is the id this server DOES answer to, so a stream read by
    ;; hand says which two processes disagreed
    (check-regexp-match (pregexp (string-append "data: " live-boot-id "\n\n$")) bytes)
    ;; a 200: the answer is on the stream, and the status carries nothing the
    ;; page could read anyway
    (check-equal? (response-code (live-reload-response)) 200))

  ;; It costs a subscription to nothing: the page is on its way to a new
  ;; document, and a connection held open for it would be a subscriber the hub
  ;; has to reap.
  (test-case "a stale stream joins no hub"
    (define h (make-hub))
    (drain (live-reload-response))
    (check-equal? (hub-subscriber-count h) 0)))
