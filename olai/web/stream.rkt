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

;; It is ALWAYS on the page, in one of three states. An indicator that only
;; appears when something is wrong is an indicator you cannot trust when it is
;; absent: quiet and broken read the same, and the reader has no way to tell
;; "the stream is fine" from "the light never worked".
;;
;; But healthy has nothing to SAY. It is a dot — green, small, and quiet enough
;; to sit under a page all day — because a light that is fine should read at a
;; glance and a sentence does not. The other two have something to explain, so
;; they are a pill with words in it.
;;
;; Which means the box belongs to the states that wear it, not to the container:
;; each state paints itself, and nothing has to un-paint the one before it.

(define-style ol-stream
  #:position fixed
  #:left 1rem
  #:bottom (apply calc (+ 1rem (apply env safe-area-inset-bottom)))
  #:z-index 18
  #:font-size 0.75rem
  #:line-height 1)

;; The healthy state, and the default: a page with no class on <html> is a page
;; whose stream is fine.
(define-style ol-stream-live
  #:display inline-block
  #:width 0.5rem
  #:height 0.5rem
  #:border-radius 50%
  #:background ,green
  ;; enough of a ring to stay visible on the palettes whose paper is close to
  ;; the green, without becoming a second shape
  #:box-shadow (0 0 0 1px (apply color-mix (in srgb) (,green 35%) transparent)))

;; The two that have something to explain: hidden until their class arrives,
;; and each one is the whole pill when it does.
(define-style (ol-stream-connecting ol-stream-stale)
  #:display none
  #:padding (0.375rem 0.75rem)
  #:border-radius ,radius
  #:border (1px solid currentColor)
  #:box-shadow (0 2px 8px (apply color-mix (in srgb) (,ink 12%) transparent)))

(register-fragment!
 (css-expr
  [(,(sel 'html live-connecting-class) ,(sel ol-stream-live)) #:display none]
  [(,(sel 'html live-connecting-class) ,(sel ol-stream-connecting))
   #:display inline-block
   #:background ,amber-bg
   #:color ,amber-fg]
  [(,(sel 'html live-stale-class) ,(sel ol-stream-live)) #:display none]
  [(,(sel 'html live-stale-class) ,(sel ol-stream-stale))
   #:display inline-block
   #:background ,rose-bg
   #:color ,rose-fg]))

;; role=status, not alert: this is a condition to notice, not one to interrupt
;; for. The dot carries its own name — an empty circle announces nothing, and
;; a status region with nothing to announce is a status region that lies.
(define (render-stream-status)
  `(div ((class ,ol-stream) (id "ol-stream") (role "status") (aria-live "polite"))
        (span ((class ,ol-stream-live) (role "img") (aria-label "live")))
        (span ((class ,ol-stream-connecting)) "reconnecting…")
        (span ((class ,ol-stream-stale)) "showing last known state")))
