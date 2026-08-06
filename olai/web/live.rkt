#lang racket/base

;; What a revision MEANS.
;;
;; The transport (the `live` collection) knows about ids and heartbeats and
;; nothing else: an id is an opaque string to it, and a client that comes back
;; saying "I last saw 41" is a question it hands straight back. This module is
;; the answer, for olai — the one place that knows an id is a STORE REVISION, a
;; counter that only goes up (olai/store), and that a client behind it is owed
;; exactly one thing: "you are behind, re-fetch". Never the content: the live
;; region fetches its own page, so one handler serves the first render and every
;; update, and the stream stays a notification channel rather than a second
;; renderer.
;;
;; It is deliberately pure, and deliberately does not require olai/store: it is
;; told a revision. The store owns the number; this owns what the number means
;; on the wire; olai/web/serve is where the two meet, which is the same place
;; the store, the watcher and the hub have always met.
;;
;; Everything else here is olai's side of the framework's contract — the names
;; the host app is required to pick, in the one place that picks them.

(require racket/contract
         live/client
         live/frame)

(provide (contract-out
          ;; the event that means "the outline moved"
          [outline-event string?]
          ;; the element that redraws itself, by id: stable, addressed by the
          ;; page and by the framework's swap alike
          [live-region-id string?]
          ;; where the client runtime is mounted, and what the page pulls in
          ;; from there
          [live-asset-prefix string?]
          [live-script-srcs (listof string?)]
          ;; the view a page is drawn with: where its stream is, and which
          ;; revision the markup around it came from
          [outline-live-view (-> string? #:cursor (or/c string? #f) live-view?)]
          ;; the token a state of the outlines is named by on the wire
          [outline-cursor (-> string? exact-integer? string?)]
          ;; a reload, as a frame: the cursor is both the payload (so the
          ;; stream is readable by hand) and the stream's id
          [outline-frame (-> string? frame?)]
          ;; what a connection that last saw `last-event-id` is owed when the
          ;; outlines are at `cursor`
          [outline-catch-up (-> (or/c string? #f) string? (listof frame?))]))

(define outline-event "outline")

(define live-region-id "ol-live")

;; Its own prefix, not /static/: these files are the framework's, they are
;; versioned with it, and a host that mounted them among its own would have to
;; remember which of them it may edit.
(define live-asset-prefix "/live/")

(define live-script-srcs (live-script-hrefs live-asset-prefix))

;; The token a state of the outlines goes by on the wire: which SERVER, and
;; which reload of it.
;;
;; The revision alone is not enough, and the missing half is not a detail. It
;; counts from one per process, so "3" names a different outline before and
;; after a restart — and a tab that reconnects to a restarted server saying "I
;; last saw 3" would be told it is up to date, and would sit on markup from the
;; previous process forever. Naming the process too makes every token stand for
;; exactly one state of one server, which is the only property the comparison
;; below needs.
;;
;; `boot` is the shell layer's to mint (web/serve): it is a fact about a
;; process, and this module is told it like every other fact it is told.
(define (outline-cursor boot revision)
  (string-append boot "." (number->string revision)))

;; The cursor travels with the PAGE rather than being read again when the
;; stream connects, and the difference is the whole point: those are two
;; different moments, and an edit between them is exactly what a page cannot
;; find out about by asking later.
(define (outline-live-view stream-href #:cursor cursor)
  (make-live-view #:region live-region-id
                  #:event outline-event
                  #:stream stream-href
                  #:cursor cursor))

(define (outline-frame cursor)
  (make-frame outline-event cursor #:id cursor))

;; A connection is caught up, or it is owed one event — and "caught up" is
;; exactly one thing: it last saw the state the outlines are in now.
;;
;; Not "at or after": anything else is owed a re-fetch, and the asymmetry is
;; deliberate. An id from a previous process, from another version, from a
;; proxy inventing headers — none of those can be ORDERED against this token,
;; and re-fetching is a cheap wrong answer where showing stale content is an
;; expensive one. The one case that must stay quiet is a connection that says
;; nothing at all: it has seen nothing because there is nothing to have seen.
;;
;; One frame, never a replay. The region re-fetches the current state, so the
;; revisions in between are states nobody needs to have been shown.
(define (outline-catch-up last-event-id cursor)
  (if (and last-event-id (not (equal? last-event-id cursor)))
      (list (outline-frame cursor))
      '()))
