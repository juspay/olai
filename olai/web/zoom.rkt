#lang racket/base

;; ONE NODE, ZOOMED: the trail above it and the subtree under it.
;;
;; Both are GIVEN — `tk` is the node to draw and `crumbs` the trail olai/index
;; derived — so this draws a zoom, it does not find one, and there is no such
;; thing as a miss at this layer. The empty pane is the same shape with nothing
;; in it: a node that is gone, or a day that has no node yet.

(require racket/contract
         (except-in olai/lang/expander #%module-begin)
         olai/web/theme
         olai/web/style
         (only-in olai/web/node render-node-fragment)
         (only-in olai/web/document ol-empty)
         (only-in olai/web/outline ol-pane ol-outline)
         (only-in olai/web/crumbs render-breadcrumbs))

(provide (contract-out
          [render-zoom
           (->* (task? list? #:today string?
                 #:home-href string? #:node-href (-> string? string?))
                (#:toggle-base (or/c string? #f)
                 #:docs hash?)
                list?)]
          ;; the same two addresses every pane is drawn with, so the empty one
          ;; is the zoom with nothing in it rather than a second shape
          [render-empty-pane
           (-> string? #:home-href string? #:node-href (-> string? string?)
               list?)]))

;; The zoomed pane, and its root list: hooks the swap and the tests address,
;; and the two rules below hang off them.
(define-modifier ol-zoom ol-zoom-root)

;; A pane with nothing to show: breadcrumbs home, one line saying why.
(define (render-empty-pane message #:home-href home-href #:node-href node-href)
  `(div ((class ,(classes ol-pane ol-zoom)) (id "ol-outline"))
        ,(render-breadcrumbs '() #:home-href home-href #:node-href node-href)
        (p ((class ,ol-empty)) ,message)))

;; Breadcrumbs + the focused subtree.
;;
;; Both are GIVEN: `tk` is the node to draw, `crumbs` the trail above it
;; (olai/index, node-ancestors). Which node a key names, and what sits above
;; it, are answered before anything gets here — this draws a zoom, it does not
;; find one, so there is no such thing as a miss at this layer.
(define (render-zoom tk crumbs
                     #:today today
                     #:home-href home-href
                     #:node-href node-href
                     #:toggle-base [toggle-base #f]
                     #:docs [docs (hash)])
  `(div ((class ,(classes ol-pane ol-zoom)) (id "ol-outline"))
        ,(render-breadcrumbs crumbs
                             #:node-href node-href
                             #:home-href home-href)
        (ul ((class ,(classes ol-outline ol-zoom-root)))
            ,(render-node-fragment tk
                                   #:today today
                                   #:node-href node-href
                                   #:toggle-base toggle-base
                                   #:docs docs
                                   ;; the page IS this node: its document is
                                   ;; what you came here to read
                                   #:doc-expanded? #t))))
