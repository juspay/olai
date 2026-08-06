#lang racket/base

;; THE STREAM'S HEALTH: one pill, three states, always on the page.
;;
;; A page whose stream is down looks exactly like a page nobody has edited, and
;; that is the one lie this view can tell. The framework's runtime knows the
;; difference — a clean drop, or a beat that never came — and says so by
;; writing one class on <html>; what that LOOKS like is olai's.
;;
;; Chrome, and outside every live region: this is about the CONNECTION rather
;; than the content, and a swap that replaced it would be the swap it exists to
;; report the absence of.

(require racket/contract
         ;; the two classes the client runtime writes on <html>. The paint here
         ;; is olai's, and these names are the whole border between the two
         (only-in live/client live-connecting-class live-stale-class)
         olai/web/theme
         olai/web/style)

(provide (contract-out
          [render-stream-status (-> list?)]))

;; The pill is ALWAYS on the page, in one of three states. An indicator that
;; only appears when something is wrong is an indicator you cannot trust when
;; it is absent: quiet and broken read the same, and the reader has no way to
;; tell "the stream is fine" from "the light never worked". So healthy is a
;; state with a colour of its own — green, and quiet enough to sit under a
;; page all day — rather than the absence of the other two.

(define-style ol-stream
  #:position fixed
  #:left 1rem
  #:bottom (apply calc (+ 1rem (apply env safe-area-inset-bottom)))
  #:z-index 18
  #:padding (0.375rem 0.75rem)
  #:border-radius ,radius
  ;; the healthy look, and the default: no class on <html> is a live stream
  #:border (1px solid (apply color-mix (in srgb) (,green 45%) transparent))
  #:background (apply color-mix (in srgb) (,green 10%) ,paper)
  #:color ,green
  #:font-size 0.75rem
  #:box-shadow (0 2px 8px (apply color-mix (in srgb) (,ink 12%) transparent)))

;; One line per state, and the state on <html> picks which. `live` shows by
;; default — the healthy page carries no class at all — and the other two take
;; over when their class arrives.
(define-style ol-stream-live #:display inline)
(define-style (ol-stream-connecting ol-stream-stale) #:display none)

(register-fragment!
 (css-expr
  [(,(sel 'html live-connecting-class) ,(sel ol-stream))
   #:border-color ,amber-fg
   #:background ,amber-bg
   #:color ,amber-fg]
  [(,(sel 'html live-connecting-class) ,(sel ol-stream-live)) #:display none]
  [(,(sel 'html live-connecting-class) ,(sel ol-stream-connecting)) #:display inline]
  [(,(sel 'html live-stale-class) ,(sel ol-stream))
   #:border-color ,rose-fg
   #:background ,rose-bg
   #:color ,rose-fg]
  [(,(sel 'html live-stale-class) ,(sel ol-stream-live)) #:display none]
  [(,(sel 'html live-stale-class) ,(sel ol-stream-stale)) #:display inline]))

;; role=status, not alert: this is a condition to notice, not one to interrupt
;; for, and all three sentences are already on the page for a reader to reach.
(define (render-stream-status)
  `(div ((class ,ol-stream) (id "ol-stream") (role "status") (aria-live "polite"))
        (span ((class ,ol-stream-live)) "live")
        (span ((class ,ol-stream-connecting)) "reconnecting…")
        (span ((class ,ol-stream-stale)) "showing last known state")))
