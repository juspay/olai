#lang racket/base

;; WHERE A NODE IS, and what a link to one wears.
;;
;; Two questions with one answer between them, and no look at all: the DOM id a
;; node carries, and the attributes a link that reaches it gets. Every surface
;; that draws a node or points at one asks here, which is what keeps the answer
;; from being spelled four times.
;;
;; An element id is NOT an address anybody saved. `^anchor` is the permanent
;; name of a node and `/n/<key>` is its permalink; both are untouched by what
;; the DOM calls an element. So the id is the live view's to mint — namespaced
;; by the region that drew it, `live-id` — and a surface that draws the same
;; node twice cannot claim one element for both.

(require racket/contract
         ;; a link into the live region, by the name web/live declares it
         ;; under. Nothing in the web layer writes an htmx attribute by hand
         ;; (live/README.md: raw htmx attributes are banned)
         live/dsl
         (only-in olai/web/live ol-live))

(provide (contract-out
          [node-element-id (->* (string?) (#:site (or/c string? #f)) string?)]
          [note-element-id (->* (string?) (#:site (or/c string? #f)) string?)]
          [site-key (-> (or/c string? #f) string? string?)]
          [node-link-attributes (-> (or/c string? #f) string? list?)]
          [id-safe (-> string? string?)]))

;; A node with an ^anchor is one node rendered at several SITES (its defining
;; site and every *mirror of it). They share a key — they are the same node —
;; but a DOM id has to be unique or an id-addressed swap updates only the
;; first copy. The defining site owns the bare id; a mirror site qualifies it
;; with the site it hangs under. Every site keeps data-fragment-id=<key>, so
;; a swap can address them all as [data-fragment-id="…"].
;;
;; The id is the live view's to mint, and this is the OUTLINE region's: the
;; sidebar draws the same nodes and mints its own (web/sidebar), which is what
;; keeps two surfaces showing one node from claiming one element between them.
;; Nothing here writes a prefix.
(define (node-element-id key #:site [site #f])
  (live-id ol-live (site-key site key)))

;; A node's NOTE is an element of its own, because a control has to name what
;; it opens (aria-controls wants an id). Derived from the node's id rather than
;; minted beside it: a mirror site's note is then its own element for the same
;; reason the site's node is, and the two ids cannot drift apart.
(define (note-element-id key #:site [site #f])
  (string-append (node-element-id key #:site site) "-note"))

(define (site-key site key)
  (if site (string-append site "-" key) key))

;; ids and CSS selectors: keep them to the anchor grammar
(define (id-safe s)
  (regexp-replace* #px"[^A-Za-z0-9_-]" s "_"))

;; Where a node lives, as the attributes a link to it wears: a partial
;; navigation — fetch the region, swap it morphed, push the address — with the
;; plain href still on it, which is what a browser running no JS sees.
;;
;; The region is NAMED, not carried: that is the whole of what the forms buy
;; here. A link that aimed at the wrong surface — the bug that started all of
;; this, a sidebar click rebuilding the chat — is now unwritable rather than
;; merely unwritten.
;;
;; No zoom-base is a page that has no addresses to give, so a node link is a
;; jump to the element instead.
(define (node-link-attributes base fid)
  (live-link ol-live
             (if base
                 (string-append base fid)
                 (string-append "#" (node-element-id fid)))))

