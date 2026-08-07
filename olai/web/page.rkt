#lang racket/base

;; THE PAGE: the document every route answers with, and the region inside it.
;;
;; The composition, and the one thing on the page that is not a component: the
;; <head> (meta, icons, the boot script, the stylesheet, the scripts), the body
;; the stream connects on, and the live region that holds the banner slot and
;; whatever pane the route drew. Everything with a LOOK of its own is somebody
;; else's module; this places them.
;;
;; It is TOLD its addresses — the page's own href, the stylesheet's, the
;; sidebar it should carry — because a renderer that guessed one would be
;; guessing a URL, which is how the sidebar's Today link once came to 404.

(require racket/contract
         (only-in xml cdata xexpr->string)
         ;; the page's connection and its region, by the names web/live
         ;; declares them under. No htmx attribute here is written by hand
         live/dsl
         (only-in olai/web/live outline-events ol-live live-script-srcs)
         olai/web/theme
         olai/web/style
         (only-in olai/web/assets web-scripts static-href)
         ;; the pill this places, outside every region
         (only-in olai/web/stream render-stream-status)
         ;; the inline script that has to run before the first paint
         (only-in olai/web/prefs prefs-boot-js))

(provide (contract-out
          [render-page
           (->* (any/c)
                (#:title string?
                 #:stylesheet-href (or/c string? #f)
                 ;; what the browser should assume before the sheet lands
                 ;; (web/theme's theme-color-scheme), or #f for no such meta
                 #:color-scheme (or/c string? #f)
                 ;; browser chrome colour before the sheet / pwa.js rewrites it
                 ;; from --paper. #f means no theme-color meta (fragment tests)
                 #:theme-color (or/c string? #f)
                 #:sidebar (or/c list? #f)
                 #:banner (or/c list? #f)
                 ;; the two per-page facts the live view is made of: THIS
                 ;; page's address, which the region re-fetches, and the state
                 ;; its markup was drawn from, which its stream connects with
                 #:href string?
                 #:cursor (or/c string? #f)
                 ;; and the node it is about, which the chrome outside the
                 ;; region reads back after every swap
                 #:current-key (or/c string? #f)
                 #:head-extra list?
                 #:body-extra list?)
                list?)]
          [page->html-string (-> any/c string?)]
          ;; the outline pane's class: the chat panel is the one thing that
          ;; moves it, so the one thing that needs its name
          [ol-main string?]))

;; What the live region holds: the banner slot AND the pane, in one container,
;; because a save can change either and they must not be able to disagree about
;; which snapshot they are showing. The chat panel and the health pill sit
;; outside it and are never rebuilt; the sidebar is a region of its own, and
;; swaps on its own account (web/sidebar).
;;
;; A fixed slot for the banner: empty while the outlines load clean, filled
;; while a file is mid-edit. The page keeps showing the last good content
;; underneath, and an empty slot must not leave a gap where the banner would be.
(define-style ol-banner-slot [(: & empty) #:display none])

;; WHICH NODE THIS PAGE IS ABOUT rides on the region, as an ordinary data
;; attribute, and it is the only thing on the page that says so after a
;; navigation.
;;
;; A link swaps THIS region and nothing else — the chrome around it is never
;; rebuilt, which is the whole point of the live view (docs/live.md). So chrome
;; that shows you where you are cannot be told by the server past the first
;; render: the sidebar it drew is the one from the page you came from. What IS
;; current after every swap is this element, because the swap is what replaced
;; it. `static/calendar.js` reads it and marks the day; a browser running no JS
;; still gets the server's mark on the page it loaded.
;;
;; Not an htmx attribute and not an address: a key, the same one every
;; permalink carries, on the element that already carries this page's identity.
(define (region-xexpr href banner main current-key)
  (define slot
    ;; fixed slot: the banner is swapped in and out, so it must exist
    ;; (empty) even on a healthy page
    `(div ((class ,ol-banner-slot) (id "ol-banner"))
          ,@(if banner (list banner) '())))
  `(div (,@(live-region ol-live #:href href)
         (data-current-key ,(or current-key "")))
        ,slot
        ,main))

;; The reading column: it takes what the sidebar leaves and stops growing
;; where a line stops being readable.
(define-style ol-main
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (2rem 2rem 6rem)
  #:max-width 56rem
  ;; room under the outline for the chat toggle, plus the home-indicator inset
  [@ media (#:max-width ,phone-max)
     #:padding (1rem 1rem (apply calc (+ 5rem (apply env safe-area-inset-bottom))))])

(define (render-page main
                     #:title [title "olai"]
                     ;; the generated sheet's URL, from the route layer (see
                     ;; olai/web/skin). #f is a page with no skin at all — a
                     ;; fragment test, never a served page.
                     #:stylesheet-href [stylesheet-href #f]
                     ;; What the browser should assume BEFORE the sheet lands.
                     ;; The palettes decide it (web/theme, theme-color-scheme)
                     ;; and the route layer passes it, like every other fact
                     ;; this renderer is told rather than knows. Once the sheet
                     ;; is in, each theme says which one it is and that wins.
                     #:color-scheme [color-scheme #f]
                     ;; Browser chrome colour before the sheet lands and before
                     ;; pwa.js rewrites it from --paper. Same standing as
                     ;; color-scheme: the route layer is told the default
                     ;; paper, and a fragment test passes nothing.
                     #:theme-color [theme-color #f]
                     #:sidebar [sidebar #f]
                     #:banner [banner #f]
                     ;; This page's own address — what the region re-fetches,
                     ;; so one handler serves the first render and every
                     ;; update. The route layer knows it; the renderer is told.
                     #:href [href "/"]
                     ;; and the state this markup was drawn from. #f is the old
                     ;; gap: a page rendered at one moment whose stream
                     ;; connects at a later one cannot be told what landed in
                     ;; between. Every route passes one; a fragment test need
                     ;; not care.
                     #:cursor [cursor #f]
                     ;; the node this page is ABOUT, or #f: chrome that draws
                     ;; that node too has to be able to say you are on it, and
                     ;; after a swap the region is the only thing that knows
                     #:current-key [current-key #f]
                     #:head-extra [head-extra '()]
                     #:body-extra [body-extra '()])
  ;; No data-theme here: which theme you read in is the BROWSER's, and the boot
  ;; script below is the only thing that writes it.
  `(html ((lang "en"))
         (head
          (meta ((charset "utf-8")))
          ;; viewport-fit=cover puts the page under the notch and the home bar
          ;; (the insets are then real). interactive-widget says what an
          ;; on-screen keyboard should do to it: shrink the viewport, so a
          ;; panel fixed to the bottom stays above the keyboard. Where it is
          ;; honoured that is the whole fix; iOS ignores it, and static/chat.js
          ;; measures visualViewport for those (web/chat-panel, --visible-*).
          (meta ((name "viewport")
                 (content ,(string-append "width=device-width, initial-scale=1"
                                          ", viewport-fit=cover"
                                          ", interactive-widget=resizes-content"))))
          ,@(if color-scheme
                (list `(meta ((name "color-scheme") (content ,color-scheme))))
                '())
          ,@(if theme-color
                (list `(meta ((name "theme-color") (content ,theme-color))))
                '())
          (title ,title)
          ;; PWA install surface: manifest, icons, iOS "Add to Home Screen".
          ;; All under /static/ — same owner as the scripts. pwa.js only keeps
          ;; theme-color in step with the picked theme; there is no offline
          ;; shell (live view is live-or-nothing).
          (link ((rel "manifest") (href ,(static-href "manifest.webmanifest"))))
          (link ((rel "icon") (href ,(static-href "icon.svg")) (type "image/svg+xml")))
          (link ((rel "apple-touch-icon") (href ,(static-href "apple-touch-icon.png"))))
          (meta ((name "mobile-web-app-capable") (content "yes")))
          (meta ((name "apple-mobile-web-app-capable") (content "yes")))
          (meta ((name "apple-mobile-web-app-status-bar-style") (content "default")))
          (meta ((name "apple-mobile-web-app-title") (content "olai")))
          ;; before the sheet: it is the first paint this is racing
          (script () ,(cdata #f #f (prefs-boot-js)))
          ,@(if stylesheet-href
                (list `(link ((rel "stylesheet") (href ,stylesheet-href))))
                '())
          ;; the client runtime first, then what leans on it: an extension
          ;; cannot register into an htmx that has not been defined, and
          ;; chat.js listens to the SSE extension's events
          ,@(for/list ([src (in-list (append live-script-srcs
                                             (map static-href web-scripts)))])
              `(script ((src ,src) (defer "defer"))))
          ,@head-extra)
         ;; ONE EventSource for the page, at the transport's own address —
         ;; which carries the boot id of the process that drew this markup, so
         ;; a tab open across a deploy is told to reload rather than left
         ;; subscribed to a server that is gone (live/frame).
         ;;
         ;; Only the outline's vocabulary is named here. The conversation rides
         ;; the same connection under its own (web/chat declares it) and is
         ;; drawn by web/chat-panel, which is what keeps this module from
         ;; having heard of the agent at all.
         (body ((class ,ol-body)
                ,@(live-connect outline-events #:cursor cursor))
               ,@(if sidebar (list sidebar) '())
               (main ((class ,ol-main))
                     ,(region-xexpr href banner main current-key))
               ,(render-stream-status)
               ,@body-extra)))

;; Serve this, not a bare xexpr: without the doctype browsers fall into
;; quirks mode and the layout collapses. Fragments need no doctype —
;; xexpr->string is enough for those.
(define (page->html-string page)
  (string-append "<!DOCTYPE html>\n" (xexpr->string page)))

