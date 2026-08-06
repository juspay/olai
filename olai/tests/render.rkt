#lang racket/base

;; xexpr-level tests for the web renderers. No files, no server, no clocks:
;; `today` is always passed in.

(require rackunit
         json
         racket/file
         racket/string
         xml
         file/sha1
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk resolve-mirrors)
         olai/web/render
         ;; the list the picker draws: the themes the sheet carries, and the
         ;; one a page that picked nothing reads in
         (only-in olai/web/theme theme-names theme-default theme-default-paper)
         ;; the chat panel is its own module now: presentation for the agent's
         ;; conversation, sitting on top of the outline's skin
         olai/web/chat-panel
         olai/web/markdown)

;; Hand-built tasks, so the key has to be minted here too. Keying off the
;; title keeps these tests readable: two `tk` calls with the same title stand
;; for the same node. Real keys come from the expander (see tests/expander).
(define (title-key title)
  (string-append
   "p" (substring (sha1 (open-input-bytes (string->bytes/utf-8 title))) 0 8)))

(define (tk title date desc kids
            #:tags [tags '()] #:done [done #f] #:id [id #f] #:key [key #f])
  (make-task #:title title #:date date #:description desc #:done done
             #:id id #:tags tags #:children kids
             #:key (or key id (title-key title))))

(define (xstr x) (xexpr->string x))

(define (xstr* xs) (string-join (map xstr xs) ""))

(define (files . entries) entries)

;; The sidebar over one trivial outline — what the prefs tests below read. The
;; outline is not the subject there; the chrome around it is.
(define (sidebar-html)
  (xstr (render-sidebar (files (list "/tmp/Tasks.rkt" (list (tk "Inbox" #f #f '()))))
                        #:home-href "/"
                        #:today-href "/today")))

(module+ test

  ;; ---- node fragment ------------------------------------------------------

  (test-case "node fragment wraps in n-{task-key}"
    (define fid (task-key (tk "Leaf" #f #f '())))
    (define s (xstr (render-node-fragment (tk "Leaf" #f #f '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s (string-append "id=\"n-" fid "\"")) s)
    (check-true (string-contains? s (string-append "data-fragment-id=\"" fid "\"")) s)
    (check-true (string-contains? s "class=\"ol-node\"") s)
    (check-true (string-contains? s "Leaf") s)
    ;; leaf: no children list, no live toggle
    (check-false (string-contains? s "ol-children") s)
    (check-true (string-contains? s "ol-toggle-empty") s))

  (test-case "parent gets a toggle, a children list and nested node ids"
    (define parent (tk "Parent" #f #f (list (tk "Child" #f #f '()))))
    (define s (xstr (render-node-fragment parent
                                          #:today "2026-08-04")))
    (define kid-id (task-key (tk "Child" #f #f (quote ()))))
    (check-true (string-contains? s "ol-node has-children") s)
    (check-true (string-contains? s "class=\"ol-toggle\"") s)
    (check-true (string-contains? s "aria-expanded=\"true\"") s)
    (check-true (string-contains? s "<ul class=\"ol-children\">") s)
    ;; only parents get a collapse key, and it is the fragment id
    (check-true (string-contains?
                 s (string-append "data-collapse-key=\""
                                  (task-key parent) "\""))
                s)
    (check-false (string-contains?
                  s (string-append "data-collapse-key=\"" kid-id "\""))
                 s)
    (check-true (string-contains? s (string-append "id=\"n-" kid-id "\"")) s)
    (check-true (string-contains? s "Child") s))

  (test-case "collapsed node carries is-collapsed and aria-expanded=false"
    (define s (xstr (render-node-fragment (tk "P" #f #f (list (tk "C" #f #f '())))
                                          #:collapsed? #t
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "is-collapsed") s)
    (check-true (string-contains? s "aria-expanded=\"false\"") s))

  (test-case "anchored node keeps a plain #anchor target for mirror links"
    (define s (xstr (render-node-fragment (tk "Ship" #f #f (quote ()) #:id "ship")
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "id=\"n-ship\"") s)
    (check-true (string-contains? s "class=\"ol-anchor\" id=\"ship\"") s))

  ;; The renderer is handed a RESOLVED tree: binding happens in core (see
  ;; lang/walk, resolve-mirrors), and this module never holds an anchors hash.
  (test-case "mirror site renders the node it carries, with a mirror link"
    (define target (tk "Anchored" #f #f '() #:id "a1"))
    (define parent (tk "Holder" #f #f (list (mirror-ref "a1" #f))))
    (define bound (car (resolve-mirrors (list parent) (hash "a1" target))))
    (define s (xstr (render-node-fragment bound #:today "2026-08-04")))
    (check-true (string-contains? s "Anchored") s)
    (check-true (string-contains? s "class=\"ol-mirror\"") s)
    (check-true (string-contains? s "href=\"#a1\"") s)
    ;; an anchor that names nothing is a state the marker is drawn in
    (define loose
      (car (resolve-mirrors (list (tk "Holder" #f #f (list (mirror-ref "nope" #f))))
                            (hash))))
    (define s2 (xstr (render-node-fragment loose #:today "2026-08-04")))
    (check-true (string-contains? s2 "ol-unresolved") s2)
    (check-true (string-contains? s2 "(unresolved)") s2))

  (test-case "toggle-base wires htmx check-off; default is inert"
    (define plain (xstr (render-node-fragment (tk "T" #f #f (quote ())  #:id "t1")
                                              #:today "2026-08-04")))
    (check-false (string-contains? plain "hx-post") plain)
    (check-true (string-contains? plain "<span class=\"ol-check\"") plain)
    (define hx (xstr (render-node-fragment (tk "T" #f #f (quote ()) #:id "t1")
                                           #:today "2026-08-04"
                                           #:toggle-base "/toggle/")))
    (check-true (string-contains? hx "hx-post=\"/toggle/t1\"") hx)
    (check-true (string-contains? hx "hx-target=\"#n-t1\"") hx)
    (check-true (string-contains? hx "hx-swap=\"outerHTML\"") hx))

  (test-case "zoom-base makes the bullet a zoom link"
    (define s (xstr (render-node-fragment (tk "T" #f #f (quote ()) #:id "t1")
                                          #:today "2026-08-04"
                                          #:zoom-base "/z/")))
    (check-true (string-contains? s "href=\"/z/t1\"") s)
    (define s2 (xstr (render-node-fragment (tk "T" #f #f (quote ()) #:id "t1")
                                           #:today "2026-08-04")))
    (check-false (string-contains? s2 "ol-bullet-link") s2))

  ;; ---- done / dates / tags (carried over from the old html tests) ---------

  (test-case "done task renders checked box and strikethrough class"
    (define s (xstr (render-node-fragment (tk "Done item" #f #f (quote ()) #:done #t)
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "☑") s)
    (check-true (string-contains? s "ol-check is-done") s)
    (check-true (string-contains? s "ol-title is-done") s)
    (check-true (string-contains? s "Done item") s)
    (define s2 (xstr (render-node-fragment (tk "Stamped" "2026-01-01" #f (quote ())
                                               #:done "2026-01-02")
                                           #:today "2026-08-04")))
    (check-true (string-contains? s2 "☑") s2)
    (check-true (string-contains? s2 "ol-node is-done") s2))

  (test-case "date pill and description present; undone box is empty"
    (define s (xstr (render-node-fragment (tk "T" "2026-01-02" "a **note**" '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "ol-pill ol-date") s)
    (check-true (string-contains? s "title=\"2026-01-02\"") s)
    (check-true (string-contains? s "Fri, Jan 2") s)
    (check-true (string-contains? s "ol-note") s)
    (check-true (string-contains? s "<strong") s)
    (check-true (string-contains? s "☐") s)
    (check-false (string-contains? s "is-done") s))

  (test-case "today's date pill is ringed; timed dates keep the clock"
    (define s (xstr (render-node-fragment (tk "T" "2026-08-04T18:00" #f '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "ol-date is-today") s)
    (check-true (string-contains? s "18:00") s))

  (test-case "bare ISO day title renders a friendly pill, not mangled hyphens"
    (define s (xstr (render-node-fragment (tk "2026-08-03" #f #f '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "Mon, Aug 3") s)
    (check-true (string-contains? s "title=\"2026-08-03\"") s)
    ;; day nodes stay linkable as #YYYY-MM-DD
    (check-true (string-contains? s "class=\"ol-anchor\" id=\"2026-08-03\"") s)
    (check-false (string-contains? s "ndash") s)
    (check-false (regexp-match? #rx">2026-08-03<" s) s)
    (define s-today (xstr (render-node-fragment (tk "2026-08-03" #f #f '())
                                                #:today "2026-08-03")))
    (check-true (string-contains? s-today "data-today") s-today)
    (check-true (string-contains? s-today "is-today") s-today)
    ;; month / year titles stay plain text
    (define s-month (xstr (render-node-fragment (tk "August" #f #f '())
                                                #:today "2026-08-03")))
    (check-true (string-contains? s-month "August") s-month)
    (check-false (string-contains? s-month "data-today") s-month)
    (define s-year (xstr (render-node-fragment (tk "2026" #f #f '())
                                               #:today "2026-08-03")))
    (check-true (string-contains? s-year "2026") s-year)
    (check-false (string-contains? s-year "ol-day") s-year))

  (test-case "tag pills outside code; code keeps #tag text"
    (define s1 (xstr (render-node-fragment (tk "Ship #lang work" #f #f (quote ()))
                                           #:today "2026-08-04")))
    (check-true (string-contains? s1 "ol-pill ol-tag") s1)
    (check-true (string-contains? s1 "#lang") s1)
    (define s2 (xstr* (title->inline-xexprs "see `code #notag` please")))
    (check-true (string-contains? s2 "<code") s2)
    (check-true (string-contains? s2 "#notag") s2)
    (check-false (regexp-match? #rx"ol-tag[^>]*>#notag" s2) s2))

  ;; ---- markdown / escaping -----------------------------------------------

  ;; A title is inline, so Markdown's BLOCK syntax is just text in one: a
  ;; leading #tag is a tag, not an <h1> with the "#" eaten.
  (test-case "leading block markers in a title stay text"
    (define pill (xstr* (map style-md-xexpr (title->inline-xexprs "#tag first"))))
    (check-true (string-contains? pill "ol-pill ol-tag") pill)
    (check-true (string-contains? pill "#tag") pill)
    (check-false (regexp-match? #rx"<h[1-6]" pill) pill)
    (define dash (xstr* (title->inline-xexprs "- not a list")))
    (check-true (string-contains? dash "- not a list") dash)
    (check-false (string-contains? dash "<ul") dash)
    (check-false (string-contains? dash "<li") dash)
    (define quoted (xstr* (title->inline-xexprs "> quoted")))
    (check-true (string-contains? quoted "&gt; quoted") quoted)
    (check-false (string-contains? quoted "<blockquote") quoted)
    (define numbered (xstr* (title->inline-xexprs "1. one")))
    (check-true (string-contains? numbered "1. one") numbered)
    (check-false (string-contains? numbered "<ol") numbered)
    ;; and a node built from such a title draws the text, not a heading
    (define node (xstr (render-node-fragment (tk "#tag first" #f #f '())
                                             #:today "2026-08-04")))
    (check-true (string-contains? node "#tag") node)
    (check-false (regexp-match? #rx"<h[1-6]" node) node)
    ;; NOTES are still full Markdown: blocks are the point of a note
    (define note (xstr* (note->xexprs "# heading\n\n- one\n- two\n")))
    (check-true (string-contains? note "<h1") note)
    (check-true (string-contains? note "<ul") note)
    (check-true (string-contains? note "one") note))

  (test-case "title bold italic code"
    (define s (xstr* (title->inline-xexprs "**bold** and *i* and `code`")))
    (check-true (string-contains? s "<strong") s)
    (check-true (string-contains? s "<em") s)
    (check-true (string-contains? s "<code") s)
    (check-true (string-contains? s "bold") s))

  (test-case "ISO date titles keep plain hyphens (no smart dashes)"
    (define s (xstr* (title->inline-xexprs "2026-07-31")))
    (check-true (string-contains? s "2026-07-31") s)
    (check-false (string-contains? s "ndash") s)
    (check-false (string-contains? s "–") s)
    (check-false (string-contains? s "—") s))

  (test-case "quotes and apostrophes stay straight"
    (define s (xstr* (title->inline-xexprs "don't \"quote\" me")))
    (check-true (string-contains? s "don't") s)
    (check-true (string-contains? s "\"quote\"") s)
    (check-false (string-contains? s "rsquo") s)
    (check-false (string-contains? s "’") s)
    (define note-s (xstr* (note->xexprs "it's a -- test")))
    (check-true (string-contains? note-s "it's a -- test") note-s)
    (check-false (string-contains? note-s "mdash") note-s))

  (test-case "entity symbols expand to characters/ASCII, not names"
    (define s (xstr (sanitize-xexpr `(p "2026" ndash "07" ndash "31"))))
    (check-true (string-contains? s "2026-07-31") s)
    (check-false (string-contains? s "ndash") s)
    (define s2 (xstr (sanitize-xexpr `(p "don" rsquo "t"))))
    (check-true (string-contains? s2 "don't") s2)
    (define s3 (xstr (sanitize-xexpr `(p "a" nbsp "b"))))
    (check-true (string-contains? s3 "a b") s3)
    (check-false (string-contains? s3 "nbsp") s3))

  (test-case "title link and fenced note block"
    (define s (xstr* (map style-md-xexpr
                          (title->inline-xexprs "[hi](https://example.com)"))))
    (check-true (string-contains? s "href=\"https://example.com\"") s)
    (check-true (string-contains? s "ol-link") s)
    (define n (xstr* (note->xexprs "intro\n\n```\nblock\n```\n")))
    (check-true (string-contains? n "<pre class=\"ol-pre\"") n)
    (check-true (string-contains? n "block") n))

  (test-case "script, raw HTML and javascript: hrefs are stripped, & is escaped"
    (define s (xstr* (title->inline-xexprs "hi <script>alert(1)</script> & ok")))
    (check-false (string-contains? s "<script") s)
    (check-true (string-contains? s "alert(1)") s)
    (define node (xstr (render-node-fragment (tk "A <b>x</b> & y \"q\"" #f #f (quote ()))
                                             #:today "2026-08-04")))
    (check-false (regexp-match? #rx"<b[ >]" node) node)
    (check-true (string-contains? node "&amp;") node)
    (check-true (string-contains? node "x") node)
    (define bad (xstr* (title->inline-xexprs "[x](javascript:alert(1))")))
    (check-false (string-contains? bad "javascript:") bad)
    ;; a scripted title cannot escape its attribute either
    (define attrs (xstr (render-node-fragment (tk "2026-08-03" #f #f (quote ()) #:id "q\"x")
                                              #:today "2026-08-04")))
    (check-false (regexp-match? #rx"id=\"q\"x\"" attrs) attrs))

  (test-case "note markdown lists survive sanitizing"
    (define n (xstr* (note->xexprs "- one\n- two\n")))
    (check-true (string-contains? n "<ul") n)
    (check-true (string-contains? n "one") n))

  ;; ---- outline ------------------------------------------------------------

  (test-case "outline renders one section per file with nested lists"
    (define x (render-outline
               (files (list (string->path "/tmp/Tasks.rkt")
                            (list (tk "Milk" #f #f (list (tk "2%" #f #f '())))))
                      (list (string->path "/tmp/Roadmap.rkt")
                            (list (tk "Ship" #f #f '()))))
               #:today "2026-08-04"))
    (define s (xstr x))
    (check-true (string-contains? s "data-file=\"Tasks.rkt\"") s)
    (check-true (string-contains? s "data-file=\"Roadmap.rkt\"") s)
    (check-true (string-contains? s "<ul class=\"ol-outline\">") s)
    (check-true (string-contains? s "Milk") s)
    (check-true (string-contains? s "Ship") s)
    ;; roots are keyed off the file label
    (define fid (task-key (tk "Milk" #f #f (quote ()))))
    (check-true (string-contains? s (string-append "id=\"n-" fid "\"")) s))

  ;; ---- sidebar ------------------------------------------------------------

  (test-case "sidebar lists Today, Starred placeholder and file roots"
    (define s (xstr (render-sidebar
                     (files (list "/tmp/Tasks.rkt"
                                  (list (tk "Inbox" #f #f
                                            (list (tk "Deep" #f #f
                                                      (list (tk "Deeper" #f #f '())))))
                                        (tk "Someday" #f #f '())))
                            (list "/tmp/Roadmap.rkt" (list (tk "WP2" #f #f '()))))
                     #:home-href "/"
                     #:today-href "/today")))
    (check-true (string-contains? s "href=\"/today\"") s)
    (check-true (string-contains? s "Today") s)
    (check-true (string-contains? s "Starred") s)
    (check-true (string-contains? s "Nothing starred yet") s)
    (check-true (string-contains? s "Home") s)
    (check-true (string-contains? s "Tasks.rkt") s)
    (check-true (string-contains? s "Roadmap.rkt") s)
    (check-true (string-contains? s "Inbox") s)
    (check-true (string-contains? s "Someday") s)
    (check-true (string-contains? s "WP2") s)
    ;; disclosure only: no bullets, no notes, no checkboxes in the sidebar
    (check-false (string-contains? s "ol-bullet") s)
    (check-false (string-contains? s "ol-check") s)
    (check-true (string-contains? s "ol-toggle") s)
    ;; deeper levels start collapsed
    (check-true (string-contains? s "ol-node is-tree has-children is-collapsed") s)
    ;; sidebar collapse state is namespaced away from the main pane's
    (check-true (string-contains? s "data-collapse-key=\"tree-") s))

  ;; Every theme the sheet carries, and nothing else. Generated from
  ;; theme-names, so a theme added to the table shows up in the picker or fails
  ;; here. There is no chip for "auto" and nothing to defer to: a page that
  ;; picked nothing reads in the row's default, and prefs.js lights that chip.
  (test-case "the sidebar's prefs list the theme row: one chip per theme"
    (define s (sidebar-html))
    (check-true (string-contains? s "Prefs") s)
    (check-true (string-contains? s "ol-prefs") s)
    ;; one row per pref, named, carrying where this browser stores it and what
    ;; is in force until it stores anything: the script reads all three, and
    ;; never spells a class per pref, a key, or a theme
    (check-true (string-contains?
                 s (string-append
                    "<div class=\"ol-pref\" data-pref=\"theme\""
                    " data-store-key=\"olai.theme\""
                    " data-default=\"" theme-default "\">"))
                s)
    (check-false (string-contains? s "data-value=\"auto\"") s)
    (check-true (pair? theme-names))
    (for ([t (in-list theme-names)])
      (check-true (string-contains? s (string-append "data-value=\"" t "\"")) s))
    ;; exactly the themes: no sixth chip from anywhere
    (check-equal? (length (regexp-match* #px"data-value=\"" s)) (length theme-names) s)
    ;; nothing is picked on the server: which theme you read in is the
    ;; browser's, and prefs.js is what marks it
    (check-false (string-contains? s "is-on") s))

  ;; ---- breadcrumbs / zoom -------------------------------------------------

  (test-case "breadcrumbs link the pairs and leave bare strings plain"
    (define s (xstr (render-breadcrumbs (list "Tasks.rkt" (list "Inbox" "p1234abcd"))
                                        #:home-href "/")))
    (check-true (string-contains? s "ol-breadcrumbs") s)
    (check-true (string-contains? s "href=\"/\"") s)
    (check-true (string-contains? s "<span class=\"ol-crumb\">Tasks.rkt</span>") s)
    (check-true (string-contains? s "href=\"#n-p1234abcd\"") s)
    (define z (xstr (render-breadcrumbs (list (list "Inbox" "p1234abcd"))
                                        #:home-href "/"
                                        #:zoom-base "/z/")))
    (check-true (string-contains? z "href=\"/z/p1234abcd\"") z))

  ;; A zoom is GIVEN its node and the trail above it (olai/index answers which
  ;; node a key names; tests/index.rkt asks it). Here both are literals.
  (test-case "zoom shows breadcrumbs plus the focused subtree only"
    (define milk (tk "Buy milk" #f #f (list (tk "2% please" #f #f '()))))
    (define inbox-key (task-key (tk "Inbox" #f #f '())))
    (define (zoom-of #:zoom-base [zoom-base #f])
      (xstr (render-zoom milk (list "Tasks.rkt" (list "Inbox" inbox-key))
                         #:today "2026-08-04"
                         #:home-href "/"
                         #:zoom-base zoom-base)))
    (define s (zoom-of))
    (check-true (string-contains? s "ol-breadcrumbs") s)
    (check-true (string-contains? s "Tasks.rkt") s)
    (check-true (string-contains? s "Inbox") s)
    (check-true (string-contains? s (string-append "id=\"n-" (task-key milk) "\"")) s)
    (check-true (string-contains? s "2% please") s)
    ;; the focused subtree, and only it
    (check-false (string-contains? s "Elsewhere") s)
    ;; the ancestor crumb is clickable, the file is not
    (check-true (string-contains? s (string-append "href=\"#n-" inbox-key "\"")) s)
    ;; and with a zoom base, every ancestor crumb is that ancestor's own page
    (define z (zoom-of #:zoom-base "/n/"))
    (check-true (string-contains? z (string-append "href=\"/n/" inbox-key "\"")) z))

  (test-case "a file crumb is drawn by its basename, whole path or not"
    ;; the trail carries the file as the loaded set named it (olai/index); how
    ;; it READS is this module's call
    (define s (xstr (render-zoom (tk "Kid" #f #f '() #:id "kid")
                                 (list (string->path "/tmp/outlines/Tasks.rkt"))
                                 #:today "2026-08-04" #:home-href "/")))
    (check-true (string-contains? s "id=\"n-kid\"") s)
    (check-true (string-contains? s "<span class=\"ol-crumb\">Tasks.rkt</span>") s)
    (check-false (string-contains? s "/tmp/outlines") s))

  ;; ---- page shell ---------------------------------------------------------

  (test-case "page shell links the static assets and composes sidebar + main"
    (define fd (files (list "Tasks.rkt" (list (tk "Milk" #f #f '())))))
    (define s (xstr (render-page (render-outline fd #:today "2026-08-04")
                                 #:title "olai"
                                 #:stylesheet-href "/static/app.css"
                                 #:sidebar (render-sidebar fd #:home-href "/"
                                                           #:today-href "/today"))))
    (check-true (string-contains? s "<title>olai</title>") s)
    (check-true (string-contains? s "href=\"/static/app.css\"") s)
    (check-true (string-contains? s "src=\"/static/htmx.min.js\"") s)
    (check-true (string-contains? s "src=\"/static/sse.js\"") s)
    (check-true (string-contains? s "src=\"/static/collapse.js\"") s)
    (check-true (string-contains? s "src=\"/static/prefs.js\"") s)
    (check-true (string-contains? s "src=\"/static/chat.js\"") s)
    (check-true (string-contains? s "src=\"/static/pwa.js\"") s)
    (check-false (string-contains? s "tailwind") s)
    (check-false (string-contains? s "cdn.") s)
    (check-true (string-contains? s "<aside class=\"ol-sidebar\"") s)
    (check-true (string-contains? s "<main class=\"ol-main\">") s)
    ;; PWA install surface: manifest + icons + iOS home-screen meta
    (check-true (string-contains? s "rel=\"manifest\"") s)
    (check-true (string-contains? s "href=\"/static/manifest.webmanifest\"") s)
    (check-true (string-contains? s "href=\"/static/icon.svg\"") s)
    (check-true (string-contains? s "apple-touch-icon") s)
    (check-true (string-contains? s "mobile-web-app-capable") s)
    ;; ONE inline script, and it is the prefs boot: everything else is a
    ;; cacheable file under /static/. (A stored pref has to be on <html>
    ;; before the first paint, and a deferred file lands after it.)
    (check-equal? (length (regexp-match* #px"<script" s))
                  (add1 (length web-scripts)) s)
    (check-true (string-contains? s "localStorage.getItem") s)
    ;; served form carries the doctype (no quirks mode)
    (check-true (string-prefix? (page->html-string (render-page '(div))) "<!DOCTYPE html>")))

  (test-case "the page has a banner slot; the banner keeps file:line:col"
    (define plain (xstr (render-page '(div))))
    (check-true (string-contains? plain "id=\"ol-banner\"") plain)
    (check-false (string-contains? plain "ol-error") plain)
    (define s (xstr (render-page '(div)
                                 #:banner (render-error-banner
                                           "expected ISO date"
                                           #:where "/tmp/Tasks.rkt:3:4"))))
    (check-true (string-contains? s "ol-error") s)
    (check-true (string-contains? s "/tmp/Tasks.rkt:3:4") s)
    (check-true (string-contains? s "expected ISO date") s))

  (test-case "sse-connect opts the body into the htmx sse extension"
    (define s (xstr (render-page '(div) #:sse-connect "/events")))
    (check-true (string-contains? s "hx-ext=\"sse\"") s)
    (check-true (string-contains? s "sse-connect=\"/events\"") s)
    (check-false (string-contains? (xstr (render-page '(div))) "sse-connect") s))

  (test-case "collapse script stays tiny and framework-free"
    (define js
      (file->string (build-path (web-static-dir) "collapse.js")))
    (check-true (< (length (string-split js "\n")) 40) js)
    (check-false (string-contains? js "require") js)
    (check-true (string-contains? js "olai.collapsed") js)
    (check-true (string-contains? js "localStorage") js))

  ;; A pref is client state, like the collapse state: a value on <html>, stored
  ;; here, never sent anywhere. The storage key is no longer spelled in either
  ;; script — Racket builds it (olai/web/prefs) and hands it to both, the row in
  ;; data-store-key and the boot script in its table — so what is left to check
  ;; is that every row the sidebar draws is one the boot script restores.
  (test-case "prefs script stays tiny, and the boot script names every row"
    (define js (file->string (build-path (web-static-dir) "prefs.js")))
    (define boot (xstr (render-page '(div))))
    (check-true (< (length (string-split js "\n")) 40) js)
    (check-false (string-contains? js "require") js)
    (check-true (string-contains? js "localStorage") js)
    (check-true (string-contains? js "ol-pref") js)
    ;; a hyphenated pref name is not a dataset key: both sides write the
    ;; attribute itself, or the setter throws
    (check-true (string-contains? js "setAttribute") js)
    (check-true (string-contains? boot "setAttribute") boot)
    (for ([name (in-list (regexp-match* #px"data-pref=\"([a-z-]+)\"" (sidebar-html)
                                        #:match-select cadr))])
      (check-true (string-contains? boot (string-append "\"" name "\"")) boot)
      (check-true (string-contains? boot (string-append "\"olai." name "\"")) boot)))

  ;; The page never names a theme: which one you read in is the BROWSER's, and
  ;; the boot script is the only thing that writes data-theme. What the page
  ;; does carry is what to assume before the sheet lands, and it is TOLD that.
  (test-case "the page names no theme, and carries the color-scheme it is told"
    (define s (xstr (render-page '(div) #:color-scheme "light dark")))
    (check-true (string-contains? s "<html lang=\"en\">") s)
    (check-false (string-contains? s "data-theme=") s)
    (check-true (string-contains? s "content=\"light dark\"") s)
    ;; told nothing, it says nothing: a fragment test, never a served page
    (check-false (string-contains? (xstr (render-page '(div))) "color-scheme")
                 "an untold page invented a color-scheme"))

  (test-case "theme-color meta is only the colour it is told"
    (define s (xstr (render-page '(div) #:theme-color theme-default-paper)))
    (check-true (string-contains?
                 s (string-append "name=\"theme-color\" content=\""
                                  theme-default-paper "\""))
                s)
    (check-true (regexp-match? #px"^#[0-9A-Fa-f]{6}$" theme-default-paper)
                theme-default-paper)
    (check-false (string-contains? (xstr (render-page '(div))) "theme-color")
                 "an untold page invented a theme-color"))

  (test-case "PWA static assets exist beside the scripts"
    (for ([name (in-list '("manifest.webmanifest" "icon.svg" "icon-192.png"
                           "icon-512.png" "icon-maskable-512.png"
                           "apple-touch-icon.png" "pwa.js"))])
      (check-true (file-exists? (build-path (web-static-dir) name)) name))
    (define man (file->string (build-path (web-static-dir) "manifest.webmanifest")))
    (check-true (string-contains? man "\"name\": \"olai\"") man)
    (check-true (string-contains? man "\"display\": \"standalone\"") man)
    (check-true (string-contains? man "icon-192.png") man)
    (define pwa (file->string (build-path (web-static-dir) "pwa.js")))
    (check-true (string-contains? pwa "theme-color") pwa)
    (check-false (string-contains? pwa "serviceWorker") pwa))

  ;; ---- chat panel ----------------------------------------------------------
  ;;
  ;; The panel is rendered from the bridge's transcript (jsexprs; see
  ;; tests/integration/acp.rkt for the real ones). Hand-built here so the
  ;; drawing is the only thing under test.

  (define (turn text agent
                #:tools [tools '()] #:status [status "done"]
                #:stop [stop "end_turn"] #:error [err (json-null)])
    (hash 'type "turn" 'text text 'agent agent 'tools tools
          'status status 'stopReason stop 'error err))

  (define (panel transcript #:model [model #f] #:commands [commands '()]
                 #:session-title [session-title #f] #:busy? [busy? #f])
    (xstr (render-chat-panel transcript
                             #:busy? busy?
                             #:send-href "/chat"
                             #:new-href "/chat/new"
                             #:cancel-href "/chat/cancel"
                             #:sessions-href "/chat/sessions"
                             #:load-href "/chat/load"
                             #:event "chat"
                             #:model model
                             #:session-title session-title
                             #:commands commands)))

  ;; The commands ride in an attribute as JSON, which means two escapings meet
  ;; there. Reading it back the way a browser does is the only assertion that
  ;; says the round trip works.
  (define (unescape s)
    (for/fold ([s s]) ([pair (in-list '(("&quot;" "\"") ("&lt;" "<") ("&gt;" ">")
                                        ;; last: an escaped ampersand is what
                                        ;; the others are made of
                                        ("&amp;" "&")))])
      (string-replace s (car pair) (cadr pair))))

  (define (panel-commands s)
    (define m (regexp-match #rx"data-commands=\"([^\"]*)\"" s))
    (and m (string->jsexpr (unescape (cadr m)))))

  (test-case "an empty panel is a form, a sink and the routes it was told"
    (define s (panel '()))
    (check-true (string-contains? s "id=\"ol-chat\"") s)
    (check-true (string-contains? s "action=\"/chat\"") s)
    (check-true (string-contains? s "data-post=\"/chat/new\"") s)
    (check-true (string-contains? s "data-post=\"/chat/cancel\"") s)
    ;; frames arrive on the page's own connection, under the name it is given
    (check-true (string-contains? s "sse-swap=\"chat\"") s)
    (check-false (string-contains? s "sse-connect") s)
    ;; an open panel covers the floating toggle, so the header carries a way
    ;; out of its own — two buttons, one toggle path
    (check-equal? (length (regexp-match* #rx"data-chat-toggle" s)) 2 s)
    ;; idle: the input is live and there is nothing to stop
    (check-false (string-contains? s "is-busy") s)
    (check-false (string-contains? s "disabled") s))

  (test-case "a finished turn replays: user text verbatim, agent text Markdown"
    (define s (panel (list (turn "do **not** bold me" "and **this** is bold"
                                 #:tools (list (hash 'id "call-1"
                                                     'title "read Tasks.rkt"
                                                     'status "completed"))))))
    ;; what the user typed is a string, not a document
    (check-true (string-contains? s "do **not** bold me") s)
    ;; what the agent said gets the same treatment a note gets
    (check-true (string-contains? s "<strong>this</strong>") s)
    (check-true (string-contains? s "data-tool-id=\"call-1\"") s)
    (check-true (string-contains? s "data-status=\"completed\"") s)
    (check-true (string-contains? s "✓") s)
    ;; end_turn is the ordinary ending: it says nothing
    (check-false (string-contains? s "ol-chat-note") s))

  (test-case "a running turn comes up busy, with its text still verbatim"
    (define s (panel (list (turn "go" "half a **sent"
                                 #:status "running" #:stop (json-null)))
                     #:busy? #t))
    (check-true (string-contains? s "ol-chat is-busy") s)
    ;; an open panel hides the toggle that breathes, so the header carries the
    ;; working dot — drawn either way, and shown by that is-busy class
    (check-true (string-contains? s "ol-chat-working") s)
    (check-true (string-contains? (panel '()) "ol-chat-working") s)
    (check-true (string-contains? s "disabled=\"disabled\"") s)
    ;; mid-stream text is a fragment; Markdown waits for the done frame
    (check-true (string-contains? s "half a **sent") s)
    (check-false (string-contains? s "<strong") s))

  (test-case "a failed turn keeps its error, and an odd ending says which"
    (define s (panel (list (turn "go" "" #:status "error" #:stop (json-null)
                                 #:error "the agent exited (code 1)")
                           (turn "again" "" #:stop "cancelled"))))
    (check-true (string-contains? s "the agent exited (code 1)") s)
    (check-true (string-contains? s "ol-chat-msg is-error") s)
    (check-true (string-contains? s "cancelled") s))

  (test-case "markers draw a break in the conversation, not a turn"
    (define s (panel (list (hash 'type "reset" 'message (json-null))
                           (hash 'type "restart" 'message "the agent exited"))))
    (check-true (string-contains? s "ol-chat-sep") s)
    (check-true (string-contains? s "new chat") s)
    (check-true (string-contains? s "the agent exited") s)
    (check-false (string-contains? s "ol-chat-turn") s))

  ;; User text and tool titles are never Markdown and never HTML. The xexpr
  ;; is what guarantees it, so this is the test that says so.
  (test-case "script payloads land as text, in messages and tool titles alike"
    (define s (panel (list (turn "<script>alert(1)</script>" "<b>no</b>"
                                 #:tools (list (hash 'id "c<1"
                                                     'title "rm -rf <script>"
                                                     'status "failed"))))))
    (check-false (string-contains? s "<script>") s)
    (check-true (string-contains? s "&lt;script&gt;alert(1)&lt;/script&gt;") s)
    ;; the agent's Markdown is sanitized by the markdown module, raw HTML and all
    (check-false (regexp-match? #rx"<b[ >]" s) s)
    (check-true (string-contains? s "data-tool-id=\"c&lt;1\"") s)
    (check-true (string-contains? s "✗") s))

  ;; The model is the agent's word, replayed. Unknown is not "unknown": the
  ;; span is there for a `model` frame to fill, and empty until one lands.
  (test-case "the header names the model when there is one, and omits it when not"
    (define named (panel '() #:model "fake-model-1"))
    (check-true (string-contains? named "agent · claude code") named)
    (check-true (string-contains? named
                                  "<span class=\"ol-chat-model\" id=\"ol-chat-model\">fake-model-1</span>")
                named)
    (define bare (panel '()))
    (check-true (string-contains? bare "id=\"ol-chat-model\"") bare)
    (check-false (string-contains? bare "fake-model") bare)
    (check-false (string-contains? bare "unknown") bare))

  ;; Which conversation, same discipline as the model: the agent's word for it,
  ;; replayed, and an empty span waiting for a `session` frame when there is
  ;; none. The picker's button carries the routes it drives.
  (test-case "the header names the conversation when it has one, and offers the others"
    (define named (panel '() #:session-title "the last conversation"))
    (check-true (string-contains?
                 named
                 "<span class=\"ol-chat-session\" id=\"ol-chat-session\">the last conversation</span>")
                named)
    (check-true (string-contains? named "data-chat-sessions=\"/chat/sessions\"") named)
    (check-true (string-contains? named "data-chat-load=\"/chat/load\"") named)
    (define bare (panel '()))
    (check-true (string-contains? bare "id=\"ol-chat-session\"") bare)
    (check-false (string-contains? bare "conversation") bare))

  ;; The agent's slash commands, replayed so a reloaded page completes before
  ;; the agent says anything. An empty list is an empty list, not a missing
  ;; attribute: chat.js parses one thing.
  (test-case "the panel carries the commands the agent offers, JSON in an attribute"
    (define offered (list (hash 'name "fake-init" 'description "start something")
                          (hash 'name "quote\"me" 'description "<b>not html</b>")))
    (define s (panel '() #:commands offered))
    ;; read back the way a browser reads it: unescape the attribute, parse the
    ;; JSON (which is read-json's hasheq, not the hash that went in)
    (check-equal? (panel-commands s)
                  (list (hasheq 'name "fake-init" 'description "start something")
                        (hasheq 'name "quote\"me" 'description "<b>not html</b>")))
    ;; the attribute is escaped, so nothing in it can end the tag
    (check-false (string-contains? s "<b>not html</b>") s)
    ;; a list to show is what puts the commands button on the input row
    (check-true (string-contains? s "ol-chat has-commands") s)
    (check-true (string-contains? s "data-chat-commands") s)
    (define bare (panel '()))
    (check-equal? (panel-commands bare) '())
    (check-true (string-contains? bare "data-commands=\"[]\"") bare)
    (check-false (string-contains? bare "has-commands") bare))

  (test-case "the chat script stays tiny, framework-free and connection-free"
    (define js (file->string (build-path (web-static-dir) "chat.js")))
    (check-false (string-contains? js "require") js)
    ;; ONE connection per page: the panel hooks the htmx sse extension's
    ;; messages instead of opening a second EventSource
    (check-false (string-contains? js "new EventSource") js)
    (check-true (string-contains? js "htmx:sseBeforeMessage") js)
    (check-true (string-contains? js "olai.chat") js)
    ;; chunk and user text are inserted as TEXT
    (check-true (string-contains? js "textContent") js))

  ;; ---- file sections (the watcher's re-render unit) ------------------------

  (test-case "a file section is addressable on its own"
    (define entry (list "Tasks.rkt" (list (tk "Milk" #f #f '()))))
    (define s (xstr (render-file-section entry #:today "2026-08-04")))
    (check-true (string-prefix? s "<section class=\"ol-file\"") s)
    (check-true (string-contains? s "id=\"ol-file-Tasks_rkt\"") s)
    (check-true (string-contains? s "data-file=\"Tasks.rkt\"") s)
    (check-true (string-contains? s "Milk") s)
    ;; the page is just its sections
    (define page (xstr (render-outline (list entry) #:today "2026-08-04")))
    (check-true (string-contains? page s) page)))
