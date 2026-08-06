#lang racket/base

;; THE ERROR BANNER: what a file being broken looks like.
;;
;; Every save passes through a moment where the outline does not parse. The
;; page keeps the last good content and says so here, with the file:line:col of
;; the offending form — the same location the JSON errors carry, because the
;; language is the only validator and there is only one answer to give.
;;
;; It is drawn INSIDE the live region (web/page's slot), so a save that fixes
;; the file takes it away in the same swap that brings the content back.

(require racket/contract
         olai/web/theme
         olai/web/style)

(provide (contract-out
          [render-error-banner (->* (string?) (#:where (or/c string? #f)) list?)]))

(define-component (render-error-banner detail #:where [where #f])
  #:class ol-error
  #:css (#:display flex
         #:flex-wrap wrap
         #:gap 0.5rem
         #:align-items baseline
         #:margin-bottom 1.5rem
         #:padding (0.625rem 0.875rem)
         #:border (1px solid ,rose-fg)
         #:border-radius ,radius
         #:background ,rose-bg
         #:color ,rose-fg
         #:font-size 0.8125rem)
  `(div ((class ,ol-error) (role "alert"))
        ,@(if where
              (list `(span ((class ,ol-error-where)) ,where))
              '())
        (span ((class ,ol-error-detail)) ,detail)))

;; file:line:col — long, and the one part worth wrapping anywhere
(define-style ol-error-where
  #:font-family ,mono
  #:font-size 0.75rem
  #:opacity 0.85
  #:overflow-wrap anywhere)

(define-style ol-error-detail #:font-family ,mono #:overflow-wrap anywhere)

