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

(require net/url
         racket/contract
         racket/runtime-path
         ;; the wire's vocabulary: where a cursor goes when the browser has no
         ;; header to put it in
         (only-in live/frame live-cursor-param))

(provide (contract-out
          [struct live-view ([region string?] [event string?] [stream string?]
                             [href string?] [cursor (or/c string? #f)])]
          [make-live-view (->* (#:region string? #:event string? #:stream string?
                                #:href string?)
                               (#:cursor (or/c string? #f))
                               live-view?)]
          ;; the three attribute sets, as xexpr attributes
          [live-connect-attributes (-> live-view? (listof (list/c symbol? string?)))]
          ;; the same connection, from the two facts it is actually made of —
          ;; where the stream is, and what the page was drawn at. A page has
          ;; one connection and may have several regions, so the connection is
          ;; not any one region's to speak for
          [live-stream-attributes (-> string? (or/c string? #f)
                                      (listof (list/c symbol? string?)))]
          ;; #:history? is the one page-global decision a region takes part in;
          ;; see below
          [live-region-attributes (->* (live-view?) (#:history? boolean?)
                                       (listof (list/c symbol? string?)))]
          ;; a link needs only the region it aims at, so it takes either the
          ;; view or the region's id
          [live-link-attributes (-> (or/c live-view? string? #f) string?
                                    (listof (list/c symbol? string?)))]
          ;; the same fetch, made by an INPUT as it is typed in: the element's
          ;; own value is the query, and the region it aims at is named the
          ;; same way a link's is
          [live-query-attributes (->* ((or/c live-view? string? #f) string?)
                                      (#:delay-ms (>=/c 0))
                                      (listof (list/c symbol? string?)))]
          ;; how long a query waits for the typing to stop, when nobody says
          [live-default-query-delay-ms (>=/c 0)]
          ;; the id of one thing INSIDE a region, minted from the region and a
          ;; key the app already has. Morph matches old to new by id first, so
          ;; this is what makes a selection follow its row through a reorder
          [live-item-id (-> string? string? string?)]
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
;; href   : this PAGE's own address — what the region re-fetches
;; cursor : what this PAGE was rendered at, or #f
;;
;; All five are the HOST's: the framework never invents an id, an event name, a
;; route or a revision. What it owns is what they add up to.
;;
;; A live view is a PER-PAGE value, not a per-app one: `href` and `cursor` are
;; both facts about the page being drawn, and they have the same lifetime.
;; Carrying the address here rather than passing it beside the view is what
;; makes "a live view with nowhere to re-fetch from" unspellable rather than
;; guarded against.
;;
;; The cursor closes the gap nobody sees until it bites. A page is rendered at
;; one moment and its EventSource connects at a later one, and an edit that
;; lands in between is broadcast to a connection that does not exist yet — so
;; the page sits on content it can never be told is stale. Naming the state the
;; page was DRAWN from makes the first connection a reconnect like any other:
;; it says where it is, and catch-up answers with what it missed. A host that
;; passes no cursor gets the old behaviour and the old gap.
(struct live-view (region event stream href cursor) #:transparent)

(define (make-live-view #:region region #:event event #:stream stream #:href href
                        #:cursor [cursor #f])
  (live-view region event stream href cursor))

;; A view, or just the region's id: what a link aims at is the region, and the
;; view is only where the id usually comes from.
(define (region-id r) (if (live-view? r) (live-view-region r) r))

(define (region-selector r) (string-append "#" (region-id r)))

;; One row, one card, one anything inside a region. Namespaced by the region so
;; two regions on a page cannot mint the same id for two different things, and
;; derived rather than written so a drawer cannot forget it: an id that is
;; absent, or that re-keys itself on every render, morphs correctly and
;; preserves nothing.
(define (live-item-id region key) (string-append region "-" key))

;; The swap every one of these uses. Morph, not replace: idiomorph walks the
;; new markup against the old and touches only what differs, which is what
;; makes scroll, selection, focus and running transitions survive an update
;; that did not concern them.
(define morph-swap "morph:outerHTML")

;; A FETCH THAT LANDS IN A REGION, which is the one thing all three attribute
;; sets below are: where to get it, what to lift out of the reply, what to put
;; it on, and how it goes on. They differ only in what makes it happen — the
;; stream says so, a click says so, a keystroke says so — so the landing is
;; said once here and the trigger is each caller's own line.
(define (region-fetch-attributes r href)
  (list (list 'hx-get href)
        (list 'hx-select (region-selector r))
        (list 'hx-target (region-selector r))
        (list 'hx-swap morph-swap)))

;; On the body (or any ancestor of the region and the links): the extensions,
;; and the stream they all share. ONE EventSource for the page — browsers cap
;; them per origin, and a second one would be a second story about health.
;;
;; The cursor goes in the URL because that is the only channel a page has to
;; its own EventSource: the browser sets the reconnect header itself and takes
;; no instruction. It rides every reconnect too, which is harmless — the header
;; is the fresher answer and wins (live/hub).
(define (live-connect-attributes lv)
  (live-stream-attributes (live-view-stream lv) (live-view-cursor lv)))

(define (live-stream-attributes stream cursor)
  (list (list 'hx-ext "sse,morph")
        (list 'sse-connect (stream-href stream cursor))))

;; net/url composes it: a stream URL is a URL, it may already have a query, and
;; a cursor is an opaque string that may hold anything a URL cannot. Guessing
;; at "?" versus "&" and escaping by hand is a URL builder, and there is one.
(define (stream-href stream cursor)
  (cond
    [(not cursor) stream]
    [else
     (define u (string->url stream))
     (url->string
      (struct-copy url u
                   [query (append (url-query u)
                                  (list (cons (string->symbol live-cursor-param)
                                              cursor)))]))]))

;; On the region: it re-fetches its own page's address — which the host put on
;; the view rather than the framework guessing — whenever the stream says the
;; region is behind, and selects itself out of the reply, so ONE handler serves
;; both the first render and every update.
;; #:history? is the one thing a region cannot decide alone. htmx honours the
;; FIRST history element in the document, so a page with two regions has to say
;; which of them Back restores — and the answer is a fact about the PAGE, not
;; about either region. Default yes, because one region is the common case and
;; a page with no history element at all restores the chrome the region exists
;; to protect. A second region says no.
(define (live-region-attributes lv #:history? [history? #t])
  (append
   (list (list 'id (live-view-region lv)))
   (region-fetch-attributes lv (live-view-href lv))
   (list (list 'hx-trigger (string-append "sse:" (live-view-event lv))))
   ;; history is the region's too: restoring a whole page from the back
   ;; button would rebuild exactly the chrome partial navigation exists to
   ;; keep
   (if history? (list (list 'hx-history-elt "")) '())))

;; On an INPUT whose value is a query: as it is typed, the region re-fetches
;; `href` with this element's value on it, and morphs the reply onto itself.
;; The same fetch a link makes, aimed the same way, triggered by typing.
;;
;; Three things it does NOT do, each for a reason. It pushes no address: a
;; region redrawing its own content is not a navigation, and a history entry
;; per keystroke is a Back button nobody can get out of — the LINKS in the
;; results are where the address moves. It carries no plain fallback of its
;; own: the input belongs in a form, and that form's action is what a browser
;; running no JS submits. And it names no event but the two below — `input`
;; covers typing, pasting and every other way a value changes, `search` is the
;; native clear button on a type=search input, and `changed` is what keeps an
;; arrow key from re-asking the same question.
;;
;; The delay is the debounce, in milliseconds: what the element waits for the
;; typing to stop before it asks. A page that wants no debounce says 0.
(define live-default-query-delay-ms 200)

(define (live-query-attributes r href #:delay-ms [delay-ms live-default-query-delay-ms])
  (if r
      (append (region-fetch-attributes r href)
              (list (list 'hx-trigger (query-trigger delay-ms))))
      '()))

(define (query-trigger delay-ms)
  (format "input changed delay:~ams, search" delay-ms))

;; On a link: the ordinary href AND the partial fetch. `r` is the region this
;; link aims at — a view, or just its id, since nothing else about the view is
;; read here. It may also be #f: a page rendered with no live view at all (a
;; fragment, a test) still makes links, and they are just links.
(define (live-link-attributes r href)
  (cons (list 'href href)
        (if r
            (append (region-fetch-attributes r href)
                    ;; the address bar is part of what the page shows
                    (list (list 'hx-push-url "true")))
            '())))
