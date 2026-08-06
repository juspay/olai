#lang racket/base

;; BREADCRUMBS: the trail above a zoomed node, and the way back out of it.
;;
;; Given, never found: `path` is the trail olai/index derived, and this draws
;; it. Two shapes and no third — a node (a title, which is Markdown, at the one
;; address nodes have) or the FILE the trail hangs off, which is nothing to
;; click. A crumb never carries a ready-made href either: where a key points is
;; the route layer's answer, handed down as `zoom-base` like every other
;; address the web layer draws.

(require racket/contract
         racket/list
         racket/match
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
         ;; a link into the live region, by the name web/live declares it under
         live/dsl
         (only-in olai/web/live ol-live)
         olai/web/theme
         olai/web/style
         olai/web/markdown
         (only-in olai/web/address node-link-attributes))

(provide (contract-out
          [render-breadcrumbs
           (->* (list? #:home-href (or/c string? #f))
                (#:zoom-base (or/c string? #f))
                list?)]))

;; home is a crumb, and the only one that is not a node: nothing paints it,
;; the shape below does
(define-modifier ol-crumb-home)

(define-style ol-breadcrumbs
  #:display flex
  #:flex-wrap wrap
  #:align-items center
  #:gap 0.375rem
  #:margin-bottom 1rem
  #:font-size 0.8125rem
  #:color ,dim)

(define-style ol-crumb
  #:text-decoration none
  #:color ,dim)

;; only a crumb you can click answers a hover, and a crumb is a link only
;; when it has somewhere to go
(register-fragment!
 (css-expr [(: ,(sel 'a ol-crumb) hover)
            #:color ,ink
            #:text-decoration underline]))

(define-style ol-crumb-sep #:color ,line)

;; path: (listof crumb), two shapes and no third. `(list "Title" key)` is a
;; NODE — a title, which is Markdown, at the one address nodes have; anything
;; else is the FILE the trail hangs off, drawn the way files are named here
;; (olai/paths) and nothing to click. A crumb never carries a ready-made href:
;; where a key points is the route layer's answer, and it hands it down as
;; `zoom-base` like every other address in this module.
(define (render-breadcrumbs path
                            #:home-href home-href
                            #:zoom-base [zoom-base #f])
  (define (crumb->xexpr c)
    (match c
      [(list title key)
       `(a ((class ,ol-crumb) ,@(node-link-attributes zoom-base key))
           ,@(map style-md-xexpr (title->inline-xexprs title)))]
      [file `(span ((class ,ol-crumb)) ,(file-label file))]))
  `(nav ((class ,ol-breadcrumbs) (aria-label "breadcrumbs"))
        ,@(if home-href
              (list `(a ((class ,(classes ol-crumb ol-crumb-home))
                         ,@(live-link ol-live home-href))
                        "home"))
              '())
        ,@(append*
           (for/list ([c (in-list path)])
             (list `(span ((class ,ol-crumb-sep) (aria-hidden "true")) "›")
                   (crumb->xexpr c))))))

