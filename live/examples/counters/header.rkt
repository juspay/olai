#lang racket/base

;; The header: a SECOND drawer, with its own region and its own producer. The
;; ticker is the acceptance criterion — navigating the counter list must not
;; rebuild it — and the input box beside it is the other one: half-typed text
;; has to survive every swap, which it does by sitting outside both regions.

(require live/dsl
         (only-in "clock.rkt" clock))

(provide render-header)

;; Every region is the history element by default, and htmx honours the FIRST
;; one in the document. Two regions on a page is one more than that assumes, so
;; the ticker yields: it is never a navigation target, and Back has to restore
;; the list. `#:history? #f` is how that is said — the decision is page-global
;; and the declaration is where a page-global decision belongs.
(define-live-region ticker #:stream clock #:history? #f)

;; And the other half of that: a navigation swaps the LIST, so this region
;; keeps the hx-get it was drawn with — after a click on beta the ticker still
;; re-fetches "/". Harmless here, because the clock says the same thing on
;; every page; a second region whose content depended on the address would go
;; quietly stale, which is a hazard nothing on this page can check either.

(define (render-header href now)
  `(header
    (div (,@(live-region ticker #:href href)) "now " ,now)
    ;; outside both regions on purpose: a swap that rebuilt this would eat
    ;; whatever somebody was in the middle of typing
    (input ((id "scratch") (placeholder "type here - nothing swaps it away")))
    ;; the health light. The classes are live/client's, written on <html> by
    ;; its runtime; what they LOOK like is this app's (app.rkt's stylesheet).
    (span ((id "health")))))
