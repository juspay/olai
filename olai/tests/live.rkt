#lang racket/base

;; What a cursor means to a connection that has been away.
;;
;; The transport carries an opaque id (live/tests/hub.rkt); this is the only
;; module that reads one, and every case below is a client the outline moved
;; without.

(require racket/string
         live/dsl
         live/frame
         (only-in live/hub live-boot-id)
         olai/web/live)

(module+ test
  (require rackunit))

(module+ test
  ;; -> (list name data id) of the single owed frame, or #f for "nothing owed".
  (define (owed last-id rev)
    (define fs (outline-catch-up last-id (outline-cursor rev)))
    (and (pair? fs)
         (list (frame-name (car fs)) (frame-data (car fs)) (frame-id (car fs)))))

  ;; The event's name comes off the declaration (`outline-events`, web/live)
  ;; rather than out of a literal here: the point of declaring it is that this
  ;; file cannot be the second place it is spelled.
  (define outline-event (stream-event outline-events 'outline))

  (define (frame-of rev) (list outline-event (outline-cursor rev) (outline-cursor rev))))

(module+ test
  ;; A revision counts from one per process, so it names a different outline
  ;; before and after a restart. The cursor names the process too — without
  ;; that, every tab open across a restart is told it is up to date. That half
  ;; is the transport's answer to its own contract clause (live-boot-id), so
  ;; the only thing olai adds is the pairing.
  (test-case "a cursor names the server as well as the reload"
    (check-true (string-prefix? (outline-cursor 3) live-boot-id))
    (check-not-equal? (outline-cursor 3) (outline-cursor 4))
    ;; and it is stable: the same state is the same token
    (check-equal? (outline-cursor 3) (outline-cursor 3)))

  (test-case "an outline event carries the cursor twice: payload and id"
    (define f (outline-frame (outline-cursor 7)))
    (check-equal? (frame-name f) outline-event)
    (check-equal? (frame-data f) (outline-cursor 7))
    ;; the id is what comes back as Last-Event-ID after a sleep
    (check-equal? (frame-id f) (outline-cursor 7)))

  (test-case "a connection that has seen nothing is owed nothing"
    ;; there is no state it could be behind: it has not been shown one
    (check-false (owed #f 7)))

  (test-case "a connection at the current cursor is owed nothing"
    (check-false (owed (outline-cursor 7) 7)))

  (test-case "a connection anywhere else is owed one event"
    ;; not a replay: the region re-fetches, so revisions 8 through 41 are
    ;; states nobody needs to have been shown
    (check-equal? (owed (outline-cursor 7) 42) (frame-of 42))
    ;; a cursor from a previous process cannot be ORDERED against this one,
    ;; and a tab open across a restart is exactly the tab that must catch up
    (check-equal? (owed "1700000000000.9" 3) (frame-of 3))
    ;; nor can a client from another version, or a proxy inventing headers.
    ;; Re-fetching is a cheap wrong answer; stale content is an expensive one
    (check-equal? (owed "banana" 3) (frame-of 3)))

  ;; The stream's vocabulary is declared here and referenced everywhere else,
  ;; so `outline` is spelled once in the whole app. What a page WEARS because
  ;; of that is tests/render.rkt's; this only pins the declaration.
  (test-case "the outline stream declares one event and a cadence"
    (check-equal? (stream-event outline-events 'outline) "outline")
    ;; the beat the client sizes its watchdog by, off the declaration rather
    ;; than out of the response's default
    (check-equal? outline-heartbeat-seconds (stream-heartbeat outline-events))
    (check-true (positive? outline-heartbeat-seconds)))

  (test-case "the client runtime is mounted somewhere of its own"
    ;; not among olai's assets: those files are the framework's, and a host
    ;; that mixed them in would have to remember which it may edit
    (for ([src (in-list live-script-srcs)])
      (check-true (string-prefix? src live-asset-prefix) src))))
