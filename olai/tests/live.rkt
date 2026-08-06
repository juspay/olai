#lang racket/base

;; What a cursor means to a connection that has been away.
;;
;; The transport carries an opaque id (live/tests/hub.rkt); this is the only
;; module that reads one, and every case below is a client the outline moved
;; without.

(require rackunit
         racket/string
         live/frame
         (only-in live/hub live-boot-id)
         (only-in live/client live-view-region live-view-event live-view-stream
                  live-view-href live-view-cursor)
         olai/web/live)

;; -> (list name data id) of the single owed frame, or #f for "nothing owed".
(define (owed last-id rev)
  (define fs (outline-catch-up last-id (outline-cursor rev)))
  (and (pair? fs)
       (list (frame-name (car fs)) (frame-data (car fs)) (frame-id (car fs)))))

(define (frame-of rev) (list outline-event (outline-cursor rev) (outline-cursor rev)))

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

  (test-case "the view a page is drawn with names the region and the event"
    (define lv (outline-live-view "/events" #:href "/today" #:cursor "boot.41"))
    (check-equal? (live-view-region lv) live-region-id)
    (check-equal? (live-view-event lv) outline-event)
    (check-equal? (live-view-stream lv) "/events")
    ;; the page's own address, which is what the region re-fetches — a
    ;; per-page fact, on the per-page value
    (check-equal? (live-view-href lv) "/today")
    ;; and what the page was drawn from, so its FIRST connection is a
    ;; reconnect like any other: an edit landing between the render and the
    ;; stream opening is a state the page can be told it is behind
    (check-equal? (live-view-cursor lv) "boot.41"))

  (test-case "the client runtime is mounted somewhere of its own"
    ;; not among olai's assets: those files are the framework's, and a host
    ;; that mixed them in would have to remember which it may edit
    (for ([src (in-list live-script-srcs)])
      (check-true (string-prefix? src live-asset-prefix) src))))
