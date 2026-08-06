#lang racket/base

;; The counter list: the DRAWER that owns the `clist` region, as the list of
;; counters and as one counter's detail — the same region either way, because
;; the region re-fetches its own address and lifts itself out of the reply.

(require live/dsl
         (only-in "counters.rkt" counts counter-name counter-value counter-step))

(provide counter-href render-list render-detail)

;; The region, declared once. The name IS the element id, so "#clist" is never
;; written: the swap target, the select and every link below derive from this
;; line. Which event redraws it comes from `counts` — the producer's
;; declaration, not a string retyped here — and `counts` declares exactly one,
;; so there is nothing left to choose.
(define-live-region clist #:stream counts)

;; The other end is app.rkt's route table: ("c" (string-arg)).
(define (counter-href name) (string-append "/c/" name))

;; One element per counter, keyed by NAME and never by position. Sorted by
;; value the rows move twice a second, and morph matches old to new by id
;; first: the id is what makes a selection — or focus — follow its counter
;; instead of staying where it was on the screen. `live-item` mints it, so
;; there is no id string in this file to forget.
(define (counter-row c)
  (live-item clist li (counter-name c)
             `(a (,@(live-link clist (counter-href (counter-name c))))
                 ,(counter-name c))
             `(span ((class "v")) ,(number->string (counter-value c)))))

(define (region href . body)
  `(div (,@(live-region clist #:href href)) ,@body))

(define (render-list href cs)
  (region href `(ol ,@(for/list ([c (in-list cs)]) (counter-row c)))))

;; The detail is the same region under a different address, so /c/beta answers
;; with a page containing #clist — one handler serves the first render and
;; every update, and a counts-changed event keeps this value moving too.
(define (render-detail href c)
  (region href
          `(h2 ,(counter-name c))
          `(p "value " (b ,(number->string (counter-value c))))
          `(p "up to " ,(number->string (counter-step c)) " per bump")
          `(p (a (,@(live-link clist "/")) "back"))))
