#lang racket/base

;; The header: a SECOND drawer, with its own region and its own four
;; agreements. The ticker is the acceptance criterion — navigating the counter
;; list must not rebuild it — and the input box beside it is the other one:
;; half-typed text has to survive every swap, which it does by sitting outside
;; both regions.

(require live/client)

(provide ticker-view render-header)

(define (ticker-view href cursor)
  (make-live-view
   ;; convention 1 (region id): the other end is the stylesheet in app.rkt
   ;; (#ticker), and — as on the list — live/client derives the selector for
   ;; the swap from this one string.
   #:region "ticker"
   ;; convention 2 (event name): clock.rkt broadcasts this word.
   #:event "clock-tick"
   ;; convention 4 (events URL): app.rkt's route table serves it, and it is the
   ;; SAME stream as the list's. One page, one EventSource, every event name
   ;; riding it (live/README.md: it does not multiplex).
   #:stream "/events"
   #:href href
   #:cursor cursor))

;; convention 3 (swap mode): live/client's again, and the reason a click on a
;; counter cannot reach this region: a link is built from the view it belongs
;; to, and that view's selector is "#clist".

;; And the other half of that: a navigation swaps the LIST, so this region
;; keeps the hx-get it was drawn with — after a click on beta the ticker still
;; re-fetches "/". Harmless here, because the clock says the same thing on
;; every page; a second region whose content depended on the address would go
;; quietly stale, which is a hazard nothing on this page can check either.

;; live/client makes every region the history element, and htmx honours the
;; FIRST one in the document — which is this one. Two regions on a page is one
;; more than live/ assumes, so the ticker yields: it is never a navigation
;; target, and Back has to restore the list. A ninth agreement, uncounted by
;; the brainstorm and unspellable in live/'s API today.
(define (without-history attrs)
  (filter (λ (a) (not (eq? (car a) 'hx-history-elt))) attrs))

(define (render-header lv now)
  `(header
    (div (,@(without-history (live-region-attributes lv))) "now " ,now)
    ;; outside both regions on purpose: a swap that rebuilt this would eat
    ;; whatever somebody was in the middle of typing
    (input ((id "scratch") (placeholder "type here - nothing swaps it away")))
    ;; the health light. The classes are live/client's, written on <html> by
    ;; its runtime; what they LOOK like is this app's (app.rkt's stylesheet).
    (span ((id "health")))))
