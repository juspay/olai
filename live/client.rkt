#lang racket/base

;; The browser half of the contract: what a page carries, what it wears, and
;; what the runtime writes back.
;;
;; The disease this exists to cure is DOM that did not change being replaced
;; anyway. A page that reloads on every link click rebuilds everything it was
;; already showing; a container swapped wholesale on every push throws away
;; scroll position, text selection, focus and CSS transition state along with
;; the markup that happened to be identical. Both are the same mistake at
;; different scales, and both have the same fix: fetch only what moved, and
;; MORPH it onto what is there instead of replacing it.
;;
;; So a live page is three attribute sets and a script bundle:
;;
;;   * the CONNECTION, on an ancestor of everything below (the body): which
;;     extensions are on, and where the stream is.
;;   * the REGION: one element that re-fetches its own page and lifts itself
;;     back out of the reply, morphed into place. It is also the history
;;     element — Back and Forward restore the region, not the page around it,
;;     or every navigation would rebuild the chrome the region was invented to
;;     protect.
;;   * a LINK: the same fetch, aimed at the region, with the address pushed.
;;     The plain href stays on the element, so a browser with no JS — and a
;;     middle-click, and a copied link — navigate the ordinary way.
;;
;; And what comes back: the runtime writes ONE state class on the document
;; element when the stream is not healthy, and nothing when it is. Which is
;; behaviour; how it LOOKS is the host app's, styled from these names. A
;; framework that shipped paint would be a framework you have to override.

(require net/uri-codec
         racket/contract
         racket/runtime-path
         ;; the wire's vocabulary: where a cursor goes when the browser has no
         ;; header to put it in
         (only-in live/frame live-cursor-param))

(provide (contract-out
          [struct live-view ([region string?] [event string?] [stream string?]
                             [cursor (or/c string? #f)])]
          [make-live-view (->* (#:region string? #:event string? #:stream string?)
                               (#:cursor (or/c string? #f))
                               live-view?)]
          ;; the three attribute sets, as xexpr attributes
          [live-connect-attributes (-> live-view? (listof (list/c symbol? string?)))]
          [live-region-attributes (-> live-view? string? (listof (list/c symbol? string?)))]
          [live-link-attributes (-> (or/c live-view? #f) string?
                                    (listof (list/c symbol? string?)))]
          ;; the assets that make the above mean anything: the directory to
          ;; mount, and the files to pull in, IN ORDER (htmx before the
          ;; extensions that register into it)
          [live-static-dir (-> path?)]
          [live-scripts (listof string?)]
          [live-script-hrefs (-> string? (listof string?))]
          ;; what the runtime writes on <html>. Neither class is a healthy
          ;; stream; a host styles these and the framework never does
          [live-connecting-class string?]
          [live-stale-class string?]))

;; ---- the assets -------------------------------------------------------------

(define-runtime-path static-dir "static")
(define (live-static-dir) static-dir)

;; Order is load order, and it matters twice: htmx must exist before an
;; extension can register into it, and `live.js` reads both of the extensions
;; below through htmx's own events rather than their globals.
(define live-scripts
  '("htmx.min.js" "sse.js" "idiomorph.min.js" "live.js"))

;; The host decides where it mounts them; this only spells the names once.
(define (live-script-hrefs prefix)
  (for/list ([name (in-list live-scripts)]) (string-append prefix name)))

;; ---- the state the runtime reports ------------------------------------------

;; Namespaced away from an app's own vocabulary. Absent means the stream is
;; healthy — the quiet state is the one with nothing on it, so a page that
;; never boots the runtime is not permanently mid-reconnect.
(define live-connecting-class "live-connecting")
(define live-stale-class "live-stale")

;; ---- the view ---------------------------------------------------------------

;; region : the id of the element that re-fetches and morphs itself
;; event  : the SSE event name that means "this region is behind"
;; stream : the URL of the event stream
;; cursor : what this PAGE was rendered at, or #f
;;
;; All four are the HOST's: the framework never invents an id, an event name, a
;; route or a revision. What it owns is what they add up to.
;;
;; The cursor closes the gap nobody sees until it bites. A page is rendered at
;; one moment and its EventSource connects at a later one, and an edit that
;; lands in between is broadcast to a connection that does not exist yet — so
;; the page sits on content it can never be told is stale. Naming the state the
;; page was DRAWN from makes the first connection a reconnect like any other:
;; it says where it is, and catch-up answers with what it missed. A host that
;; passes no cursor gets the old behaviour and the old gap.
(struct live-view (region event stream cursor) #:transparent)

(define (make-live-view #:region region #:event event #:stream stream
                        #:cursor [cursor #f])
  (live-view region event stream cursor))

(define (region-selector lv) (string-append "#" (live-view-region lv)))

;; The swap every one of these uses. Morph, not replace: idiomorph walks the
;; new markup against the old and touches only what differs, which is what
;; makes scroll, selection, focus and running transitions survive an update
;; that did not concern them.
(define morph-swap "morph:outerHTML")

;; On the body (or any ancestor of the region and the links): the extensions,
;; and the stream they all share. ONE EventSource for the page — browsers cap
;; them per origin, and a second one would be a second story about health.
;;
;; The cursor goes in the URL because that is the only channel a page has to
;; its own EventSource: the browser sets the reconnect header itself and takes
;; no instruction. It rides every reconnect too, which is harmless — the header
;; is the fresher answer and wins (live/hub).
(define (live-connect-attributes lv)
  (list (list 'hx-ext "sse,morph")
        (list 'sse-connect (stream-href lv))))

(define (stream-href lv)
  (define stream (live-view-stream lv))
  (define cursor (live-view-cursor lv))
  (if cursor
      (string-append stream
                     (if (regexp-match? #rx"[?]" stream) "&" "?")
                     live-cursor-param "=" (uri-encode cursor))
      stream))

;; On the region: it re-fetches `href` — its own page's address, which the host
;; passes down rather than the framework guessing — whenever the stream says
;; the region is behind, and selects itself out of the reply, so ONE handler
;; serves both the first render and every update.
(define (live-region-attributes lv href)
  (list (list 'id (live-view-region lv))
        (list 'hx-get href)
        (list 'hx-trigger (string-append "sse:" (live-view-event lv)))
        (list 'hx-select (region-selector lv))
        (list 'hx-target (region-selector lv))
        (list 'hx-swap morph-swap)
        ;; history is the region's too: restoring a whole page from the
        ;; back button would rebuild exactly the chrome partial navigation
        ;; exists to keep
        (list 'hx-history-elt "")))

;; On a link: the ordinary href AND the partial fetch. `lv` may be #f — a page
;; rendered with no live view at all (a fragment, a test) still makes links,
;; and they are just links.
(define (live-link-attributes lv href)
  (cons (list 'href href)
        (if lv
            (list (list 'hx-get href)
                  (list 'hx-select (region-selector lv))
                  (list 'hx-target (region-selector lv))
                  (list 'hx-swap morph-swap)
                  ;; the address bar is part of what the page shows
                  (list 'hx-push-url "true"))
            '())))
