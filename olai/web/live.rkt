#lang racket/base

;; What a revision MEANS.
;;
;; The transport (the `live` collection) knows about ids and heartbeats and
;; nothing else: an id is an opaque string to it, and a client that comes back
;; saying "I last saw this" is a question it hands straight back. This module is
;; the answer, for olai — the one place that knows an id names a state of the
;; outlines, and that a client anywhere else is owed exactly one thing: "you are
;; behind, re-fetch". Never the content: the live region fetches its own page,
;; so one handler serves the first render and every update, and the stream stays
;; a notification channel rather than a second renderer.
;;
;; It is deliberately pure, and deliberately does not require olai/store: it is
;; told a revision. The store owns the number; this owns what the number means
;; on the wire; olai/web/serve is where the two meet, which is the same place
;; the store, the watcher and the hub have always met.
;;
;; Everything else here is olai's side of the framework's contract — the names
;; the host app is required to pick, in the one place that picks them. Since
;; the forms landed that is literal: `outline-events` below is the declaration,
;; and web/render draws its region from the binding rather than from a string
;; that has to match one.

(require racket/contract
         ;; the declare-and-check forms: this module is the outline stream's
         ;; PRODUCER, so the vocabulary is declared here and every other
         ;; appearance of it is a reference (live/README.md)
         live/dsl
         (only-in live/client live-script-hrefs)
         live/frame
         ;; a string this process alone will use: the transport's answer to
         ;; "two different states must never be called the same thing"
         (only-in live/hub live-boot-id))

;; The stream the outlines move on. One event, and its whole meaning is "the
;; region you are showing is behind" — never content, because the region
;; re-fetches its own page and one handler serves the first render and every
;; update. web/render draws the region from this binding; nothing spells the
;; word "outline" twice.
;;
;; The chat rides the same connection under its own vocabulary (web/chat) —
;; one page, one EventSource, every event name on it.
(define-stream outline-events #:events (outline) #:heartbeat 15)

;; And the region that redraws on it. The binding's name IS the element id, so
;; `#ol-live` is never written: the swap target, the select and every link on
;; the page are derived from this line.
;;
;; It is declared HERE rather than in the module that draws the element,
;; because four of them need it — web/page draws it, and web/node, web/crumbs
;; and web/sidebar each aim links at it. A region is a fact about the PAGE, and
;; this is the module that holds the page's live vocabulary. (The sidebar's own
;; region is the other way round: one module draws it and nothing links to it,
;; so it is declared where it is drawn.)
(define-live-region ol-live #:stream outline-events)

(provide outline-events ol-live)

(provide (contract-out
          ;; where the client runtime is mounted, and what the page pulls in
          ;; from there
          [live-asset-prefix string?]
          [live-script-srcs (listof string?)]
          ;; the token a state of the outlines is named by on the wire
          [outline-cursor (-> exact-integer? string?)]
          ;; a reload, as a frame: the cursor is both the payload (so the
          ;; stream is readable by hand) and the stream's id
          [outline-frame (-> string? frame?)]
          ;; what a connection that last saw `last-event-id` is owed when the
          ;; outlines are at `cursor`
          [outline-catch-up (-> (or/c string? #f) string? (listof frame?))]
          ;; the beat this app answers its stream with, off the declaration
          [outline-heartbeat-seconds (>/c 0)]))

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
;; previous process forever. `live-boot-id` is the transport's answer to
;; exactly that hazard (a string this process alone will use), so the pairing
;; here is the whole of what olai has to say about it.
(define (outline-cursor revision)
  (string-append live-boot-id "." (number->string revision)))

;; How often the stream beats, off the declaration rather than out of the
;; response's default: the number is the cadence the client sizes its watchdog
;; by, and it is worth being able to point at the line that chose it.
(define outline-heartbeat-seconds (stream-heartbeat outline-events))

(define (outline-frame cursor)
  (stream-frame outline-events 'outline cursor #:id cursor))

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
