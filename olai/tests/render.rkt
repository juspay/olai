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
         ;; olai's side of the live-view contract: the names a page is drawn
         ;; with, and the scripts it pulls in for them
         (only-in olai/web/live outline-live-view live-script-srcs)
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
            #:tags [tags '()] #:done [done #f] #:doing [doing #f]
            #:id [id #f] #:key [key #f])
  (make-task #:title title #:date date #:description desc #:done done
             #:doing doing #:id id #:tags tags #:children kids
             #:key (or key id (title-key title))))

(define (xstr x) (xexpr->string x))

;; The live view a served page is drawn with — the same value web/serve builds,
;; so a test asserting markup is asserting the shipped markup. It is per-PAGE
;; (it carries the page's own address), which is why this is a function.
(define (live-at href) (outline-live-view "/events" #:href href #:cursor "boot.1"))
(define the-live-view (live-at "/"))

;; Where `needle` starts in `s`, for the assertions that are about ORDER.
(define (string-index s needle)
  (caar (regexp-match-positions (regexp (regexp-quote needle)) s)))

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

  ;; The third state has neither a date nor a strikethrough to be read off,
  ;; so it says itself: a pill beside the title, a half-filled box, and the
  ;; state on the node.
  (test-case "doing task renders its own pill and a half-filled box"
    (define s (xstr (render-node-fragment (tk "In flight" #f #f '() #:doing #t)
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "ol-pill ol-doing") s)
    (check-true (string-contains? s "◧") s)
    (check-true (string-contains? s "ol-check is-doing") s)
    (check-true (string-contains? s "ol-node is-doing") s)
    ;; doing is not done: no checkmark, no strikethrough class
    (check-false (string-contains? s "is-done") s)
    (check-false (string-contains? s "☑") s)
    ;; and the box says which state it is in, for a screen reader
    (check-true (string-contains? s "title=\"doing\"") s))

  (test-case "doing keeps its date pill; done is not doing"
    (define s (xstr (render-node-fragment
                     (tk "Started" "2026-08-04" #f '() #:doing "2026-08-01")
                     #:today "2026-08-04")))
    (check-true (string-contains? s "ol-pill ol-doing") s)
    (check-true (string-contains? s "ol-pill ol-date") s)
    (define done (xstr (render-node-fragment (tk "Shipped" #f #f '() #:done #t)
                                             #:today "2026-08-04")))
    (check-false (string-contains? done "ol-doing") done))

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
    ;; the client runtime is the framework's, under its own prefix, and it
    ;; comes first: an extension cannot register into an undefined htmx
    (check-true (string-contains? s "src=\"/live/htmx.min.js\"") s)
    (check-true (string-contains? s "src=\"/live/idiomorph.min.js\"") s)
    (check-true (< (string-index s "/live/htmx.min.js")
                   (string-index s "/static/chat.js")))
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
                  (+ 1 (length live-script-srcs) (length web-scripts)) s)
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

  ;; ---- the live view ------------------------------------------------------
  ;;
  ;; What the page WEARS is the framework's vocabulary (live/client, tested
  ;; there); these are the four places olai puts it, and the one thing this
  ;; layer decides — that the region, and only the region, is the live one.

  (test-case "a live view opts the body into the stream"
    (define s (xstr (render-page '(div) #:live the-live-view)))
    ;; the stream, and what this page was rendered at — so an edit that lands
    ;; between drawing the page and its EventSource connecting is not lost
    (check-true (string-contains? s "sse-connect=\"/events?last-event-id=boot.1\"") s)
    (check-true (string-contains? s "hx-ext=\"sse,morph\"") s)
    ;; and without one there is no stream on the page at all
    (check-false (string-contains? (xstr (render-page '(div))) "sse-connect")))

  (test-case "the live region re-fetches its own address and morphs itself"
    (define s (xstr (render-page '(div) #:live (live-at "/today"))))
    (check-true (string-contains? s "id=\"ol-live\"") s)
    (check-true (string-contains? s "hx-get=\"/today\"") s)
    (check-true (string-contains? s "hx-trigger=\"sse:outline\"") s)
    (check-true (string-contains? s "hx-select=\"#ol-live\"") s)
    (check-true (string-contains? s "hx-swap=\"morph:outerHTML\"") s)
    ;; back and forward restore the region, not the chrome around it
    (check-true (string-contains? s "hx-history-elt") s)
    ;; and with no live view the region is still there — it is where the
    ;; content lives, not just where a swap lands
    (define plain (xstr (render-page '(div))))
    (check-true (string-contains? plain "id=\"ol-live\"") plain)
    (check-false (string-contains? plain "hx-get") plain))

  (test-case "a page with a stream can say the stream is down"
    (define s (xstr (render-page '(div) #:live the-live-view)))
    (check-true (string-contains? s "showing last known state") s)
    ;; the report sits OUTSIDE the region it reports on
    (check-true (> (string-index s "ol-stream") (string-index s "ol-live")) s)
    (check-false (string-contains? (xstr (render-page '(div))) "ol-stream")))

  (test-case "links navigate partially and keep their plain href"
    (define fd (files (list "Tasks.rkt" (list (tk "Milk" #f #f '())))))
    (define s (xstr (render-sidebar fd #:home-href "/" #:today-href "/today"
                                    #:zoom-base "/n/" #:live the-live-view)))
    ;; no-JS, middle-click and copy-link all still read the href
    (check-true (string-contains? s (format "href=\"/n/~a\"" (title-key "Milk"))) s)
    (check-true (string-contains? s (format "hx-get=\"/n/~a\"" (title-key "Milk"))) s)
    (check-true (string-contains? s "hx-push-url=\"true\"") s)
    (check-true (string-contains? s "hx-target=\"#ol-live\"") s)
    ;; the chrome links too: Today and the brand are navigation like any other
    (check-true (string-contains? s "hx-get=\"/today\"") s)
    ;; and without a live view they are ordinary links
    (define plain (xstr (render-sidebar fd #:home-href "/" #:today-href "/today"
                                        #:zoom-base "/n/")))
    (check-false (string-contains? plain "hx-get") plain))

  (test-case "the bullet and the crumbs navigate the same way"
    (define bullet (xstr (render-node-fragment (tk "T" #f #f '() #:id "t1")
                                               #:today "2026-08-04"
                                               #:zoom-base "/n/"
                                               #:live the-live-view)))
    (check-true (string-contains? bullet "hx-get=\"/n/t1\"") bullet)
    (define crumbs (xstr (render-breadcrumbs (list (list "Ship" "t1"))
                                             #:home-href "/"
                                             #:zoom-base "/n/"
                                             #:live the-live-view)))
    (check-true (string-contains? crumbs "hx-get=\"/n/t1\"") crumbs)
    ;; home is a crumb like any other
    (check-true (string-contains? crumbs "hx-get=\"/\"") crumbs))

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
  ;; The panel is CHROME: the dock, the header, an empty conversation and the
  ;; input row. Nothing about the conversation is drawn here — a page is served
  ;; while the agent may still be waking up, so anything it said about one
  ;; would be as old as the request. What a panel shows is the stream's, which
  ;; catches a connection up the moment it exists (web/chat's chat-catch-up;
  ;; tests/integration/chat.rkt is where that is asserted).

  (define (panel)
    (xstr (render-chat-panel #:send-href "/chat"
                             #:new-href "/chat/new"
                             #:cancel-href "/chat/cancel"
                             #:sessions-href "/chat/sessions"
                             #:load-href "/chat/load"
                             #:event "chat")))

  (test-case "the panel is a form and the routes it was told"
    (define s (panel))
    (check-true (string-contains? s "id=\"ol-chat\"") s)
    (check-true (string-contains? s "action=\"/chat\"") s)
    (check-true (string-contains? s "data-post=\"/chat/new\"") s)
    (check-true (string-contains? s "data-post=\"/chat/cancel\"") s)
    ;; frames arrive on the page's own connection, under the name it is given —
    ;; carried, not spelled by the script that subscribes to it
    (check-true (string-contains? s "data-chat-event=\"chat\"") s)
    (check-false (string-contains? s "sse-connect") s)
    ;; an open panel covers the floating toggle, so the header carries a way
    ;; out of its own — two buttons, one toggle path
    (check-equal? (length (regexp-match* #rx"data-chat-toggle" s)) 2 s)
    ;; the picker's button, with the routes it drives
    (check-true (string-contains? s "data-chat-sessions=\"/chat/sessions\"") s)
    (check-true (string-contains? s "data-chat-load=\"/chat/load\"") s)
    ;; the commands button is drawn once and shown by a class, so a `commands`
    ;; frame is all it takes to put it there
    (check-true (string-contains? s "data-chat-commands") s))

  ;; Every state the panel has is a class, and it comes out of the renderer in
  ;; none of them: a page drawn while the agent was still waking up would be
  ;; claiming something it cannot know.
  (test-case "the panel is drawn in none of its states, and carries no conversation"
    (define s (panel))
    (check-false (string-contains? s "is-busy") s)
    (check-false (string-contains? s "is-open") s)
    (check-false (string-contains? s "has-commands") s)
    (check-false (string-contains? s "disabled") s)
    ;; nothing of the conversation: no turns, and no copy of the command list
    (check-false (string-contains? s "ol-chat-turn") s)
    (check-false (string-contains? s "data-commands") s)
    (check-true (string-contains? s "<div class=\"ol-chat-body\" id=\"ol-chat-body\"></div>") s))

  ;; The header's two live strings are empty spans waiting for the frames that
  ;; name them. Unknown is not "unknown": an empty one the sheet takes away.
  (test-case "the header has a slot for the model and one for the conversation"
    (define s (panel))
    (check-true (string-contains? s "agent · claude code") s)
    (check-true (string-contains?
                 s "<span class=\"ol-chat-model\" id=\"ol-chat-model\"></span>") s)
    (check-true (string-contains?
                 s "<span class=\"ol-chat-session\" id=\"ol-chat-session\"></span>") s)
    ;; an open panel hides the toggle that breathes, so the header carries the
    ;; working dot — drawn either way, and shown by is-busy
    (check-true (string-contains? s "ol-chat-working") s)
    (check-false (string-contains? s "unknown") s))

  (test-case "the chat script stays tiny, framework-free and connection-free"
    (define js (file->string (build-path (web-static-dir) "chat.js")))
    (check-false (string-contains? js "require") js)
    ;; ONE connection per page: the panel subscribes to the framework's
    ;; stream instead of opening a second EventSource
    (check-false (string-contains? js "new EventSource") js)
    (check-true (string-contains? js "live.on") js)
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
