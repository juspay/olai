#lang racket/base

;; The counter list: the DRAWER that owns the `clist` region, as the list of
;; counters and as one counter's detail — the same region either way, because
;; the region re-fetches its own address and lifts itself out of the reply.

(require live/client
         (only-in "counters.rkt" counter-name counter-value counter-step))

(provide clist-view counter-href render-list render-detail)

;; The view every counter link and the region itself are built from. Four
;; strings, and the four agreements the doc counts, marked where they are
;; spelled:
(define (clist-view href cursor)
  (make-live-view
   ;; convention 1 (region id): the other end is the stylesheet in app.rkt
   ;; (#clist). live/client derives "#clist" for the swap target, the select
   ;; and every link built from this view, so nothing in Racket spells it
   ;; twice — the agreement the doc counts three times is one string here.
   #:region "clist"
   ;; convention 2 (event name): counters.rkt broadcasts this word.
   #:event "counts-changed"
   ;; convention 4 (events URL): app.rkt's route table is what serves it.
   #:stream "/events"
   #:href href
   #:cursor cursor))

;; convention 3 (swap mode): morph, and live/client's to spell — the region and
;; every link built from this view take "morph:outerHTML" from the same value.
;; A link that repaints what an event morphs is not merely unwritten here; with
;; the functional API it is unwritable.

;; The other end is app.rkt's route table: ("c" (string-arg)).
(define (counter-href name) (string-append "/c/" name))

;; One element per counter, keyed by NAME and never by position. Sorted by
;; value the rows move twice a second, and morph matches old to new by id
;; first: the id is what makes a selection — or focus — follow its counter
;; instead of staying where it was on the screen.
(define (counter-row lv c)
  `(li ((id ,(string-append "row-" (counter-name c))))
       (a (,@(live-link-attributes lv (counter-href (counter-name c))))
          ,(counter-name c))
       (span ((class "v")) ,(number->string (counter-value c)))))

(define (region lv . body)
  `(div (,@(live-region-attributes lv)) ,@body))

(define (render-list lv cs)
  (region lv `(ol ,@(for/list ([c (in-list cs)]) (counter-row lv c)))))

;; The detail is the same region under a different address, so /c/beta answers
;; with a page containing #clist — one handler serves the first render and
;; every update, and a counts-changed event keeps this value moving too.
(define (render-detail lv c)
  (region lv
          `(h2 ,(counter-name c))
          `(p "value " (b ,(number->string (counter-value c))))
          `(p "up to " ,(number->string (counter-step c)) " per bump")
          `(p (a (,@(live-link-attributes lv "/")) "back"))))
