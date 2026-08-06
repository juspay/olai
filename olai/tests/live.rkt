#lang racket/base

;; What a cursor means to a connection that has been away.
;;
;; The transport carries an opaque id (live/tests/hub.rkt); this is the only
;; module that reads one, and every case below is a client the outline moved
;; without.

(require rackunit
         live/frame
         (only-in live/client live-view-region live-view-event live-view-stream
                  live-view-cursor)
         olai/web/live)

(define (cursor rev) (outline-cursor "boot-1" rev))

;; -> (list name data id) of the single owed frame, or #f for "nothing owed".
(define (owed last-id rev)
  (define fs (outline-catch-up last-id (cursor rev)))
  (and (pair? fs)
       (list (frame-name (car fs)) (frame-data (car fs)) (frame-id (car fs)))))

(module+ test
  ;; A revision counts from one per process, so it names a different outline
  ;; before and after a restart. The cursor names the process too — without
  ;; that, every tab open across a restart is told it is up to date.
  (test-case "a cursor names the server as well as the reload"
    (check-not-equal? (outline-cursor "boot-1" 3) (outline-cursor "boot-2" 3))
    (check-not-equal? (outline-cursor "boot-1" 3) (outline-cursor "boot-1" 4))
    ;; and it is stable: the same state is the same token
    (check-equal? (outline-cursor "boot-1" 3) (outline-cursor "boot-1" 3)))

  (test-case "an outline event carries the cursor twice: payload and id"
    (define f (outline-frame (cursor 7)))
    (check-equal? (frame-name f) outline-event)
    (check-equal? (frame-data f) (cursor 7))
    ;; the id is what comes back as Last-Event-ID after a sleep
    (check-equal? (frame-id f) (cursor 7)))

  (test-case "a connection that has seen nothing is owed nothing"
    ;; there is no state it could be behind: it has not been shown one
    (check-false (owed #f 7)))

  (test-case "a connection at the current cursor is owed nothing"
    (check-false (owed (cursor 7) 7)))

  (test-case "a connection anywhere else is owed one event"
    ;; not a replay: the region re-fetches, so revisions 8 through 41 are
    ;; states nobody needs to have been shown
    (check-equal? (owed (cursor 7) 42)
                  (list outline-event (cursor 42) (cursor 42)))
    ;; a cursor from a previous process cannot be ORDERED against this one,
    ;; and a tab open across a restart is exactly the tab that must catch up
    (check-equal? (owed (outline-cursor "boot-0" 9) 3)
                  (list outline-event (cursor 3) (cursor 3)))
    ;; nor can a client from another version, or a proxy inventing headers.
    ;; Re-fetching is a cheap wrong answer; stale content is an expensive one
    (check-equal? (owed "banana" 3) (list outline-event (cursor 3) (cursor 3))))

  (test-case "the view a page is drawn with names the region and the event"
    (define lv (outline-live-view "/events" #:cursor (cursor 41)))
    (check-equal? (live-view-region lv) live-region-id)
    (check-equal? (live-view-event lv) outline-event)
    (check-equal? (live-view-stream lv) "/events")
    ;; and what the page was drawn from, so its FIRST connection is a
    ;; reconnect like any other: an edit landing between the render and the
    ;; stream opening is a state the page can be told it is behind
    (check-equal? (live-view-cursor lv) (cursor 41)))

  (test-case "the client runtime is mounted somewhere of its own"
    ;; not among olai's assets: those files are the framework's, and a host
    ;; that mixed them in would have to remember which it may edit
    (for ([src (in-list live-script-srcs)])
      (check-true (regexp-match? (regexp (string-append "^" live-asset-prefix)) src)
                  src))))
