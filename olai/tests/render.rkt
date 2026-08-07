#lang racket/base

;; xexpr-level tests for the web renderers. No files, no server, no clocks:
;; `today` is always passed in.

(require json
         racket/file
         racket/list
         racket/string
         xml
         file/sha1
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk resolve-mirrors)
         ;; the one thing the store and the renderer have to agree about: the
         ;; key a document is filed under
         (only-in olai/doc doc-path)
         olai/web/render
         ;; the app's own route table: a renderer is handed the address of a
         ;; node, so these hand it the one the router answers at
         (only-in olai/tests/addresses test-node-href test-search-href)
         ;; olai's side of the live-view contract: the names a page is drawn
         ;; with, and the scripts it pulls in for them
         (only-in olai/web/live live-script-srcs)
         ;; the stream address a page connects to: the transport's, carrying
         ;; the boot id of the process that drew the markup
         (only-in live/frame live-stream-path)
         ;; the list the picker draws: the themes the sheet carries, and the
         ;; one a page that picked nothing reads in
         (only-in olai/web/theme theme-names theme-default theme-default-paper)
         ;; the chat panel is its own module now: presentation for the agent's
         ;; conversation, sitting on top of the outline's skin
         olai/web/chat-panel
         ;; the palette over the outline, and the pure query it draws
         olai/web/search
         (only-in olai/search search-outlines)
         olai/web/markdown)

(module+ test
  (require rackunit))

(module+ test
  ;; Hand-built tasks, so the key has to be minted here too. Keying off the
  ;; title keeps these tests readable: two `tk` calls with the same title stand
  ;; for the same node. Real keys come from the expander (see tests/expander).
  (define (title-key title)
    (string-append
     "p" (substring (sha1 (open-input-bytes (string->bytes/utf-8 title))) 0 8)))

  (define (tk title date desc kids
              #:tags [tags '()] #:done [done #f] #:doing [doing #f]
              #:id [id #f] #:key [key #f]
              ;; a documented node needs both halves of the answer: the path
              ;; the outline wrote, and the file it wrote it in
              #:doc [doc #f] #:file [file #f])
    (make-task #:title title #:date date #:description desc #:done done
               #:doing doing #:id id #:tags tags #:children kids
               #:doc doc #:file file
               #:key (or key id (title-key title))))

  (define (xstr x) (xexpr->string x))

  ;; What a page's stream address looks like once the transport has put this
  ;; process's boot id in it. Asked of the framework rather than rebuilt here:
  ;; a test that spelled the shape would pin this file's arithmetic instead of
  ;; the page's markup.
  (define (stream-href cursor)
    (string-append live-stream-path "?last-event-id=" cursor))

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
                          #:today-href "/today" #:archive-href "/archive" #:today "2026-08-04"
                          #:href "/"
                          #:node-href test-node-href))))

(module+ test

  ;; ---- node fragment ------------------------------------------------------

  (test-case "a node fragment carries the id its region mints"
    (define fid (task-key (tk "Leaf" #f #f '())))
    (define s (xstr (render-node-fragment (tk "Leaf" #f #f '())
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s (format "id=\"~a\"" (node-element-id fid))) s)
    (check-true (string-contains? s (string-append "data-fragment-id=\"" fid "\"")) s)
    (check-true (string-contains? s "class=\"ol-node\"") s)
    (check-true (string-contains? s "Leaf") s)
    ;; leaf: no children list, no live toggle
    (check-false (string-contains? s "ol-children") s)
    (check-true (string-contains? s "ol-toggle-empty") s))

  (test-case "parent gets a toggle, a children list and nested node ids"
    (define parent (tk "Parent" #f #f (list (tk "Child" #f #f '()))))
    (define s (xstr (render-node-fragment parent
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
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
    (check-true (string-contains? s (format "id=\"~a\"" (node-element-id kid-id))) s)
    (check-true (string-contains? s "Child") s))

  (test-case "collapsed node carries is-collapsed and aria-expanded=false"
    (define s (xstr (render-node-fragment (tk "P" #f #f (list (tk "C" #f #f '())))
                                          #:collapsed? #t
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "is-collapsed") s)
    (check-true (string-contains? s "aria-expanded=\"false\"") s))

  (test-case "anchored node keeps a plain #anchor target for mirror links"
    (define s (xstr (render-node-fragment (tk "Ship" #f #f (quote ()) #:id "ship")
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s (format "id=\"~a\"" (node-element-id "ship"))) s)
    (check-true (string-contains? s "class=\"ol-anchor\" id=\"ship\"") s))

  ;; The renderer is handed a RESOLVED tree: binding happens in core (see
  ;; lang/walk, resolve-mirrors), and this module never holds an anchors hash.
  (test-case "mirror site renders the node it carries, with a mirror link"
    (define target (tk "Anchored" #f #f '() #:id "a1"))
    (define parent (tk "Holder" #f #f (list (mirror-ref "a1" #f))))
    (define bound (car (resolve-mirrors (list parent) (hash "a1" target))))
    (define s (xstr (render-node-fragment bound #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "Anchored") s)
    (check-true (string-contains? s "class=\"ol-mirror\"") s)
    ;; The arrow goes to the DEFINING node's own page, like every other link to
    ;; a node. It used to be the same-page fragment `#a1`, which is only ever
    ;; on the page the defining site is on — so on a zoom, or in the file that
    ;; only mirrors, the click did nothing at all.
    (check-true (string-contains? s "href=\"/n/a1\"") s)
    (check-false (string-contains? s "href=\"#a1\"") s)
    ;; an anchor that names nothing is a state the marker is drawn in — and
    ;; not a link, because there is no node to have an address
    (define loose
      (car (resolve-mirrors (list (tk "Holder" #f #f (list (mirror-ref "nope" #f))))
                            (hash))))
    (define s2 (xstr (render-node-fragment loose #:today "2026-08-04"
                                           #:node-href test-node-href)))
    (check-true (string-contains? s2 "ol-unresolved") s2)
    (check-true (string-contains? s2 "(unresolved)") s2)
    (check-true (string-contains? s2 "<span class=\"ol-mirror\">") s2)
    (check-false (string-contains? s2 "href=\"#nope\"") s2))

  (test-case "toggle-base wires htmx check-off; default is inert"
    (define plain (xstr (render-node-fragment (tk "T" #f #f (quote ())  #:id "t1")
                                              #:today "2026-08-04"
                                              #:node-href test-node-href)))
    (check-false (string-contains? plain "hx-post") plain)
    (check-true (string-contains? plain "<span class=\"ol-check\"") plain)
    (define hx (xstr (render-node-fragment (tk "T" #f #f (quote ()) #:id "t1")
                                           #:today "2026-08-04"
                                           #:toggle-base "/toggle/"
                                           #:node-href test-node-href)))
    (check-true (string-contains? hx "hx-post=\"/toggle/t1\"") hx)
    (check-true (string-contains? hx (format "hx-target=\"#~a\"" (node-element-id "t1"))) hx)
    (check-true (string-contains? hx "hx-swap=\"outerHTML\"") hx))

  ;; The bullet is the node's PERMALINK, and the address is the route table's
  ;; (tests/addresses hands over the app's own) — not a prefix this file made
  ;; up and not a fragment.
  (test-case "the bullet is a link to the node's own page"
    (define s (xstr (render-node-fragment (tk "T" #f #f (quote ()) #:id "t1")
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "ol-bullet-link") s)
    (check-true (string-contains? s "href=\"/n/t1\"") s))

  ;; ---- done / dates / tags (carried over from the old html tests) ---------

  (test-case "done task renders checked box and strikethrough class"
    (define s (xstr (render-node-fragment (tk "Done item" #f #f (quote ()) #:done #t)
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "☑") s)
    (check-true (string-contains? s "ol-check is-done") s)
    (check-true (string-contains? s "ol-title is-done") s)
    (check-true (string-contains? s "Done item") s)
    (define s2 (xstr (render-node-fragment (tk "Stamped" "2026-01-01" #f (quote ())
                                               #:done "2026-01-02")
                                           #:today "2026-08-04"
                                           #:node-href test-node-href)))
    (check-true (string-contains? s2 "☑") s2)
    (check-true (string-contains? s2 "ol-node is-done") s2))

  ;; The third state has neither a date nor a strikethrough to be read off,
  ;; so it says itself: a pill beside the title, a half-filled box, and the
  ;; state on the node.
  (test-case "doing task renders its own pill and a half-filled box"
    (define s (xstr (render-node-fragment (tk "In flight" #f #f '() #:doing #t)
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
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
                     #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "ol-pill ol-doing") s)
    (check-true (string-contains? s "ol-pill ol-date") s)
    (define done (xstr (render-node-fragment (tk "Shipped" #f #f '() #:done #t)
                                             #:today "2026-08-04"
                                             #:node-href test-node-href)))
    (check-false (string-contains? done "ol-doing") done))

  (test-case "date pill and description present; undone box is empty"
    (define s (xstr (render-node-fragment (tk "T" "2026-01-02" "a **note**" '())
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "ol-pill ol-date") s)
    (check-true (string-contains? s "title=\"2026-01-02\"") s)
    (check-true (string-contains? s "Fri, Jan 2") s)
    (check-true (string-contains? s "ol-note") s)
    (check-true (string-contains? s "<strong") s)
    (check-true (string-contains? s "☐") s)
    (check-false (string-contains? s "is-done") s))

  ;; A note is drawn folded, with the button that opens it and the key the
  ;; browser remembers that by. Everything about it that MOVES is the script's
  ;; (olai/web/static/notes.js) — the page is drawn one way, every time.
  (test-case "a note carries its opener, folded, keyed, and pointing at itself"
    (define s (xstr (render-node-fragment (tk "T" #f "a note" '() #:key "k1")
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "data-note-key=\"k1\"") s)
    (check-true (string-contains? s "ol-note-more") s)
    (check-true (string-contains? s "aria-expanded=\"false\"") s)
    ;; the control names what it opens, and that is the note's own element
    (check-true (string-contains? s "class=\"ol-note\" id=\"ol-live-k1-note\"") s)
    (check-true (string-contains? s "aria-controls=\"ol-live-k1-note\"") s)
    ;; nothing is expanded, and nothing has more, until the browser says so
    (check-false (string-contains? s "is-expanded") s)
    (check-false (string-contains? s "has-more") s))

  ;; A mirror is the same note at a second SITE, and it opens on its own: the
  ;; key the browser remembers it by is the site's, like the fold's.
  (test-case "a mirrored note is keyed and identified by its site"
    (define s (xstr (render-node-fragment (tk "T" #f "a note" '() #:key "k1")
                                          #:today "2026-08-04"
                                          #:site "holder"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "data-note-key=\"holder-k1\"") s)
    (check-true (string-contains? s "aria-controls=\"ol-live-holder-k1-note\"") s))

  (test-case "today's date pill is ringed; timed dates keep the clock"
    (define s (xstr (render-node-fragment (tk "T" "2026-08-04T18:00" #f '())
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "ol-date is-today") s)
    (check-true (string-contains? s "18:00") s))

  (test-case "bare ISO day title renders a friendly pill, not mangled hyphens"
    (define s (xstr (render-node-fragment (tk "2026-08-03" #f #f '())
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-true (string-contains? s "Mon, Aug 3") s)
    (check-true (string-contains? s "title=\"2026-08-03\"") s)
    ;; day nodes stay linkable as #YYYY-MM-DD
    (check-true (string-contains? s "class=\"ol-anchor\" id=\"2026-08-03\"") s)
    (check-false (string-contains? s "ndash") s)
    (check-false (regexp-match? #rx">2026-08-03<" s) s)
    (define s-today (xstr (render-node-fragment (tk "2026-08-03" #f #f '())
                                                #:today "2026-08-03"
                                                #:node-href test-node-href)))
    (check-true (string-contains? s-today "data-today") s-today)
    (check-true (string-contains? s-today "is-today") s-today)
    ;; month / year titles stay plain text
    (define s-month (xstr (render-node-fragment (tk "August" #f #f '())
                                                #:today "2026-08-03"
                                                #:node-href test-node-href)))
    (check-true (string-contains? s-month "August") s-month)
    (check-false (string-contains? s-month "data-today") s-month)
    (define s-year (xstr (render-node-fragment (tk "2026" #f #f '())
                                               #:today "2026-08-03"
                                               #:node-href test-node-href)))
    (check-true (string-contains? s-year "2026") s-year)
    (check-false (string-contains? s-year "ol-day") s-year))

  (test-case "tag pills outside code; code keeps #tag text"
    (define s1 (xstr (render-node-fragment (tk "Ship #lang work" #f #f (quote ()))
                                           #:today "2026-08-04"
                                           #:node-href test-node-href)))
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
                                             #:today "2026-08-04"
                                             #:node-href test-node-href)))
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
                                             #:today "2026-08-04"
                                             #:node-href test-node-href)))
    (check-false (regexp-match? #rx"<b[ >]" node) node)
    (check-true (string-contains? node "&amp;") node)
    (check-true (string-contains? node "x") node)
    (define bad (xstr* (title->inline-xexprs "[x](javascript:alert(1))")))
    (check-false (string-contains? bad "javascript:") bad)
    ;; a scripted title cannot escape its attribute either
    (define attrs (xstr (render-node-fragment (tk "2026-08-03" #f #f (quote ()) #:id "q\"x")
                                              #:today "2026-08-04"
                                              #:node-href test-node-href)))
    (check-false (regexp-match? #rx"id=\"q\"x\"" attrs) attrs))

  (test-case "note markdown lists survive sanitizing"
    (define n (xstr* (note->xexprs "- one\n- two\n")))
    (check-true (string-contains? n "<ul") n)
    (check-true (string-contains? n "one") n))

  ;; ---- fenced code: the language, and only the language -------------------
  ;;
  ;; The parser hands the fence's info string over as class="brush: …" on the
  ;; <pre>. It is the one place a note carries a word straight from its author
  ;; into an attribute, so what survives is the FIRST word, on the <code>, and
  ;; only when it is a bare language name.

  (test-case "a fence names its language on the code element"
    (define n (xstr* (note->xexprs "```racket\n(define x 1)\n```\n")))
    (check-true (string-contains? n "<pre class=\"ol-pre\"") n)
    (check-true (string-contains? n "class=\"ol-code language-racket\"") n)
    (check-true (string-contains? n "(define x 1)") n)
    ;; a fence with no info string says nothing about a language
    (define plain (xstr* (note->xexprs "```\nblock\n```\n")))
    (check-true (string-contains? plain "class=\"ol-code\"") plain)
    (check-false (string-contains? plain "language-") plain))

  (test-case "an info string cannot smuggle markup through the fence"
    (define n (xstr* (note->xexprs "```js onload=\"alert(1)\" evil\ncode\n```\n")))
    ;; the first word is the language; the rest of the line is gone
    (check-true (string-contains? n "class=\"ol-code language-js\"") n)
    (check-false (string-contains? n "onload") n)
    (check-false (string-contains? n "alert(1)") n)
    ;; and a first word that is not a language name is no class at all
    (for ([info (in-list '("\"><script>alert(1)</script>"
                           "-leading-dash"
                           "语言"))])
      (define s (xstr* (note->xexprs (string-append "```" info "\ncode\n```\n"))))
      (check-false (string-contains? s "language-") s)
      (check-false (string-contains? s "<script") s))
    ;; nor is a language name longer than any language has ever been
    (define long (xstr* (note->xexprs
                         (string-append "```" (make-string 64 #\a) "\ncode\n```\n"))))
    (check-false (string-contains? long "language-") long))

  ;; ---- pictures ------------------------------------------------------------
  ;;
  ;; An image's src is a path inside the outline's own directory, rewritten to
  ;; the one route that serves it. Everything else is not a picture this view
  ;; draws — not a remote one, not an inline one, and not one that climbs.

  (test-case "a relative image is served from the outline's directory"
    (define n (xstr* (note->xexprs "![a shot](images/pic.png)")))
    (check-true (string-contains? n "<img") n)
    (check-true (string-contains? n "src=\"/media/images/pic.png\"") n)
    (check-true (string-contains? n "alt=\"a shot\"") n)
    (check-true (string-contains? n "class=\"ol-image\"") n))

  (test-case "an image that is not a file beside the outline is not drawn"
    (for ([src (in-list '("https://evil.example/a.png"
                          "http://evil.example/a.png"
                          "//evil.example/a.png"
                          "data:text/html;base64,PHNjcmlwdD4="
                          "javascript:alert(1)"
                          "JavaScript:alert(1)"
                          "/etc/passwd"
                          "../../secret.png"
                          "images/../../secret.png"
                          "a.png?x=1"
                          ;; not a picture: the route will not serve these, so
                          ;; drawing one would be drawing a broken icon
                          "diagram.svg"
                          "Tasks.rkt"
                          "notes"))])
      (define n (xstr* (note->xexprs (format "![x](~a)" src))))
      (check-false (string-contains? n "<img") (format "~a -> ~a" src n))
      (check-false (string-contains? n "javascript") (format "~a -> ~a" src n))
      (check-false (string-contains? n "data:") (format "~a -> ~a" src n)))
    ;; The sanitizer is the border, so it is asked directly too — an xexpr can
    ;; hold what a Markdown source cannot express (the parser eats a backslash
    ;; before it ever gets here).
    (for ([src (in-list '("..\\secret.png" "\\\\host\\share\\a.png" ""))])
      (check-equal? (sanitize-xexpr `(p (img ((src ,src) (alt "x"))))) '(p) src))
    ;; and a src that survives is always under the route, never verbatim
    (check-false (string-contains? (xstr (sanitize-xexpr '(img ((src "a.png")))))
                                   "\"a.png\"")))

  ;; A title is one line of an outline row, and a picture is not one line.
  (test-case "a title draws no picture"
    (define s (xstr* (title->inline-xexprs "hi ![x](a.png) there")))
    (check-false (string-contains? s "<img") s)
    (check-true (string-contains? s "hi") s))

  ;; ---- footnotes -----------------------------------------------------------
  ;;
  ;; The parser wires a footnote by id, and mints those ids itself. The
  ;; structure survives; the names do not — the number is all that is read out
  ;; of an upstream id, and both ends are spelled from a prefix this view chose.

  (define (attr-values s name)
    (regexp-match* (pregexp (string-append name "=\"([^\"]*)\"")) s #:match-select cadr))

  (test-case "a footnote survives, and both ends point at each other"
    (define n (xstr* (note->xexprs "text[^1] and more[^2]\n\n[^1]: first\n\n[^2]: second\n")))
    (check-true (string-contains? n "<sup") n)
    (check-true (string-contains? n "ol-footnotes") n)
    (check-true (string-contains? n "first") n)
    ;; every id is one this module minted, and no id the parser made
    (define ids (attr-values n "id"))
    (check-equal? (length ids) 4 n)
    (for ([id (in-list ids)])
      (check-true (regexp-match? #px"^fn[0-9a-f]{8}-(fn|fnref)-[0-9]+$" id) id))
    ;; and every jump link lands on one of them
    (define jumps
      (for/list ([h (in-list (attr-values n "href"))]
                 #:when (string-prefix? h "#"))
        (substring h 1)))
    (check-equal? (length jumps) 4 n)
    (for ([j (in-list jumps)])
      (check-not-false (member j ids) (format "~a is a link to nothing" j))))

  (test-case "two notes on a page number their footnotes apart"
    (define a (xstr* (note->xexprs "a[^1]\n\n[^1]: first\n")))
    (define b (xstr* (note->xexprs "b[^1]\n\n[^1]: second\n")))
    (check-equal? (length (remove-duplicates (append (attr-values a "id")
                                                     (attr-values b "id"))))
                  4 (string-append a b))
    ;; and the same note twice is the same markup: an id that moved between
    ;; renders is markup a live update would have to replace rather than morph
    (check-equal? (xstr* (note->xexprs "a[^1]\n\n[^1]: first\n")) a))

  (test-case "a forged footnote id never reaches the page"
    (define s
      (xstr (sanitize-xexpr
             '(div ((class "footnotes"))
                   (ol ()
                       (li ((id "x\"><script>alert(1)</script>-footnote-1-definition"))
                           (a ((href "#evil") (name "javascript:alert(1)")) "back")
                           (a ((href "#g1-footnote-1-return")
                               (name "g1-footnote-2-return"))
                              "↩")))))))
    (check-false (string-contains? s "<script") s)
    (check-false (string-contains? s "javascript:") s)
    (check-false (string-contains? s "g1-") s)
    ;; an id that is not a footnote's NAME is not a footnote's id: the <li>
    ;; keeps nothing at all
    (check-false (string-contains? s "<li id") s)
    ;; a well-formed one is re-minted, both ends of it
    (check-true (string-contains? s "href=\"#fnref-1\"") s)
    (check-true (string-contains? s "id=\"fnref-2\"") s)
    ;; an href that is not a footnote's is still just an href
    (check-true (string-contains? s "href=\"#evil\"") s))

  ;; ---- the scripts a rendered page pulls in --------------------------------

  ;; Three of them are vendored — highlight.js and two of its grammars, pinned
  ;; upstream and staged by nix (nix/highlight-js.nix), never committed — so a
  ;; checkout that skipped `just vendor` fails HERE, the way live/tests/client
  ;; fails for the browser runtime, rather than in a browser with no colour.
  (test-case "every script the page links is a file under static/"
    (for ([name (in-list web-scripts)])
      (check-true (file-exists? (build-path (web-static-dir) name)) name))
    (define page (xstr (render-page '(div))))
    (for ([name (in-list web-scripts)])
      (check-true (string-contains? page (string-append "src=\"/static/" name "\""))
                  name))
    ;; the bundle before the grammars that register into it, and ours after both
    (check-true (< (string-index page "hljs/highlight.min.js")
                   (string-index page "hljs/scheme.min.js")))
    (check-true (< (string-index page "hljs/scheme.min.js")
                   (string-index page "highlight-init.js"))))

  ;; ---- outline ------------------------------------------------------------

  (test-case "outline renders one section per file with nested lists"
    (define x (render-outline
               (files (list (string->path "/tmp/Tasks.rkt")
                            (list (tk "Milk" #f #f (list (tk "2%" #f #f '())))))
                      (list (string->path "/tmp/Roadmap.rkt")
                            (list (tk "Ship" #f #f '()))))
               #:today "2026-08-04"
                              #:node-href test-node-href))
    (define s (xstr x))
    (check-true (string-contains? s "data-file=\"Tasks.rkt\"") s)
    (check-true (string-contains? s "data-file=\"Roadmap.rkt\"") s)
    (check-true (string-contains? s "<ul class=\"ol-outline\">") s)
    (check-true (string-contains? s "Milk") s)
    (check-true (string-contains? s "Ship") s)
    ;; roots are keyed off the file label
    (define fid (task-key (tk "Milk" #f #f (quote ()))))
    (check-true (string-contains? s (format "id=\"~a\"" (node-element-id fid))) s))

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
                     #:today-href "/today" #:archive-href "/archive" #:today "2026-08-04"
                     #:href "/"
                                    #:node-href test-node-href)))
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

  ;; ---- the journal's month ------------------------------------------------
  ;;
  ;; Daily.rkt has no entry of its own in the tree: the file name was never a
  ;; way into anything, and the days under it are. So the calendar stands where
  ;; the label and the tree would have, and every other root is untouched.

  (define daily-files
    (files (list "/tmp/Daily.rkt"
                 (list (tk "2026" #f #f
                           (list (tk "August" #f #f
                                     (list (tk "2026-08-03" #f #f
                                               (list (tk "Setup day" #f #f '())))
                                           (tk "2026-08-06" #f #f '())))))))
           (list "/tmp/Tasks.rkt" (list (tk "Inbox" #f #f '())))))

  (define (daily-sidebar [today "2026-08-06"])
    (xstr (render-sidebar daily-files
                          #:home-href "/" #:today-href "/today"
                          #:archive-href "/archive" #:today today
                          #:href "/" #:node-href test-node-href)))

  (test-case "the Daily root is a month, not a file name and a tree"
    (define s (daily-sidebar))
    (check-true (string-contains? s "ol-cal-grid") s)
    (check-true (string-contains? s "August 2026") s)
    ;; the entry it REPLACES: no file label, and no tree of years and months
    (check-false (string-contains? s "Daily.rkt") s)
    (check-false (string-contains? s "August<") s)
    ;; every other root still reads the way it did
    (check-true (string-contains? s "Tasks.rkt") s)
    (check-true (string-contains? s "Inbox") s))

  (test-case "a day the journal has is a link to that day's page"
    (define s (daily-sidebar))
    (check-true (string-contains?
                 s (format "title=\"2026-08-03\" href=\"~a\""
                           (test-node-href (task-key (tk "2026-08-03" #f #f '())))))
                s)
    ;; and it navigates the outline region like every other link
    (check-true (string-contains? s "hx-target=\"#ol-live\"") s))

  (test-case "an empty day is inert: a number, not a link"
    (define s (daily-sidebar))
    (check-true (string-contains? s "<span class=\"ol-cal-day ol-cal-empty\">5</span>") s)
    ;; the 3rd and the 6th are the only cells with anywhere to go
    (check-equal? (length (regexp-match* #px"<a class=\"ol-cal-day" s)) 2 s))

  (test-case "today is marked whether or not anything was written on it"
    (check-true (string-contains? (daily-sidebar "2026-08-06")
                                  "<a class=\"ol-cal-day is-today\"")
                (daily-sidebar "2026-08-06"))
    ;; a day with no node still says which day it is
    (define s (daily-sidebar "2026-08-12"))
    (check-true (string-contains?
                 s "<span class=\"ol-cal-day is-today ol-cal-empty\">12</span>")
                s))

  (test-case "the month header zooms to what the days hang under"
    (define s (daily-sidebar))
    (check-true (string-contains?
                 s (format "class=\"ol-cal-title\" title=\"the whole journal\" href=\"~a\""
                           (test-node-href (task-key (tk "August" #f #f '())))))
                s))

  ;; A month with no days yet still has to reach the journal: the header falls
  ;; back to the root's first node, which is the file as far as a link goes.
  (test-case "a month with nothing in it still reaches the outline"
    (define s (xstr (render-sidebar
                     (files (list "/tmp/Daily.rkt"
                                  (list (tk "Daily notes" #f #f '()))))
                     #:home-href "/" #:today-href "/today"
                     #:archive-href "/archive" #:today "2026-08-06"
                     #:href "/" #:node-href test-node-href)))
    (check-true (string-contains?
                 s (format "class=\"ol-cal-title\" title=\"the whole journal\" href=\"~a\""
                           (test-node-href (task-key (tk "Daily notes" #f #f '())))))
                s)
    (check-false (string-contains? s "<a class=\"ol-cal-day") s))

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
                                        #:home-href "/"
                                        #:node-href test-node-href)))
    (check-true (string-contains? s "ol-breadcrumbs") s)
    (check-true (string-contains? s "href=\"/\"") s)
    (check-true (string-contains? s "<span class=\"ol-crumb\">Tasks.rkt</span>") s)
    ;; a node crumb is that node's own page; the file it hangs off is not a
    ;; link at all
    (check-true (string-contains? s "href=\"/n/p1234abcd\"") s))

  ;; A zoom is GIVEN its node and the trail above it (olai/index answers which
  ;; node a key names; tests/index.rkt asks it). Here both are literals.
  (test-case "zoom shows breadcrumbs plus the focused subtree only"
    (define milk (tk "Buy milk" #f #f (list (tk "2% please" #f #f '()))))
    (define inbox-key (task-key (tk "Inbox" #f #f '())))
    (define s (xstr (render-zoom milk (list "Tasks.rkt" (list "Inbox" inbox-key))
                                #:today "2026-08-04"
                                #:home-href "/"
                                #:node-href test-node-href)))
    (check-true (string-contains? s "ol-breadcrumbs") s)
    (check-true (string-contains? s "Tasks.rkt") s)
    (check-true (string-contains? s "Inbox") s)
    (check-true (string-contains? s (format "id=\"~a\"" (node-element-id (task-key milk)))) s)
    (check-true (string-contains? s "2% please") s)
    ;; the focused subtree, and only it
    (check-false (string-contains? s "Elsewhere") s)
    ;; every ancestor crumb is that ancestor's own page; the file is not a link
    (check-true (string-contains? s (string-append "href=\"/n/" inbox-key "\"")) s))

  ;; ---- @doc: one line in the outline, the whole thing zoomed ---------------
  ;;
  ;; No file is ever opened here: `docs` is what the store read, keyed the one
  ;; way both sides spell it (olai/doc, doc-path).

  (define doc-file "/tmp/outlines/Tasks.rkt")

  (define (documented rel #:key [key "doc-node"])
    (tk "Ship it" #f #f '() #:key key #:doc rel #:file doc-file))

  (define (doc-table rel text)
    (hash (doc-path rel doc-file) text))

  (define plan-md "# The plan\n\nA paragraph, and a `span` of code.\n")

  (test-case "a documented node shows one line of its document in the outline"
    (define s (xstr (render-node-fragment (documented "notes/plan.md")
                                          #:today "2026-08-04"
                                          #:node-href test-node-href
                                          #:docs (doc-table "notes/plan.md" plan-md))))
    ;; the file, by name, linking to the page that has all of it
    (check-true (string-contains? s "ol-doc-name") s)
    (check-true (string-contains? s ">plan.md<") s)
    (check-true (string-contains? s "href=\"/n/doc-node\"") s)
    ;; one line of it, markers stripped, as TEXT
    (check-true (string-contains? s "<span class=\"ol-doc-lead\">The plan</span>") s)
    ;; and not the document
    (check-false (string-contains? s "ol-doc-body") s)
    (check-false (string-contains? s "A paragraph") s))

  (test-case "a node with no @doc draws no document block"
    (define s (xstr (render-node-fragment (tk "Plain" #f #f '())
                                          #:today "2026-08-04"
                                          #:node-href test-node-href)))
    (check-false (string-contains? s "ol-doc") s))

  (test-case "zooming a documented node renders the document inline"
    (define s (xstr (render-zoom (documented "notes/plan.md") '()
                                 #:today "2026-08-04"
                                 #:home-href "/"
                                 #:node-href test-node-href
                                 #:docs (doc-table "notes/plan.md" plan-md))))
    (check-true (string-contains? s "<article class=\"ol-doc-body\">") s)
    ;; Markdown at render time, same as a note: blocks included
    (check-true (string-contains? s "<h1>The plan</h1>") s)
    (check-true (string-contains? s "A paragraph") s)
    (check-true (string-contains? s "class=\"ol-code\"") s)
    ;; the preview is what the outline shows; this page is not the outline
    (check-false (string-contains? s "ol-doc-lead") s)
    ;; and the name is not a link to the page you are already on
    (check-false (string-contains? s "<a class=\"ol-doc-name\"") s))

  (test-case "a .scrbl document is named and not drawn"
    (define s (xstr (render-zoom (documented "deep.scrbl") '()
                                 #:today "2026-08-04"
                                 #:home-href "/"
                                 #:docs (doc-table "deep.scrbl"
                                                   "#lang scribble/manual\n")
                                 #:node-href test-node-href)))
    (check-true (string-contains? s ">deep.scrbl<") s)
    (check-true (string-contains? s "does not render one yet") s)
    (check-false (string-contains? s "ol-doc-body") s)
    ;; never the source, verbatim, on the page
    (check-false (string-contains? s "scribble/manual\n") s))

  (test-case "a document the store could not read is a state, not a blank"
    ;; the language refuses an outline naming a file that is not there, so
    ;; this is the race: it went away between the load and the read
    (define s (xstr (render-zoom (documented "notes/plan.md") '()
                                 #:today "2026-08-04"
                                 #:home-href "/"
                                 #:docs (hash)
                                 #:node-href test-node-href)))
    (check-true (string-contains? s "plan.md") s)
    (check-true (string-contains? s "could not be read") s)
    (check-false (string-contains? s "ol-doc-body") s))

  (test-case "a mirror site shows the document of the node it is a mirror of"
    (define holder
      (car (resolve-mirrors
            (list (tk "Holder" #f #f (list (mirror-ref "shipped" #f))))
            (hash "shipped" (documented "notes/plan.md" #:key "shipped")))))
    (define s (xstr (render-node-fragment holder
                                          #:today "2026-08-04"
                                          #:docs (doc-table "notes/plan.md"
                                                            plan-md)
                                          #:node-href test-node-href)))
    (check-true (string-contains? s ">plan.md<") s)
    (check-true (string-contains? s "The plan") s))

  (test-case "a file crumb is drawn by its basename, whole path or not"
    ;; the trail carries the file as the loaded set named it (olai/index); how
    ;; it READS is this module's call
    (define s (xstr (render-zoom (tk "Kid" #f #f '() #:id "kid")
                                 (list (string->path "/tmp/outlines/Tasks.rkt"))
                                 #:today "2026-08-04" #:home-href "/"
                                 #:node-href test-node-href)))
    (check-true (string-contains? s (format "id=\"~a\"" (node-element-id "kid"))) s)
    (check-true (string-contains? s "<span class=\"ol-crumb\">Tasks.rkt</span>") s)
    (check-false (string-contains? s "/tmp/outlines") s))

  ;; ---- page shell ---------------------------------------------------------

  (test-case "page shell links the static assets and composes sidebar + main"
    (define fd (files (list "Tasks.rkt" (list (tk "Milk" #f #f '())))))
    (define s (xstr (render-page (render-outline fd #:today "2026-08-04"
                                                 #:node-href test-node-href)
                                 #:title "olai"
                                 #:stylesheet-href "/static/app.css"
                                 #:sidebar (render-sidebar fd #:home-href "/"
                                                           #:href "/"
                                                           #:today-href "/today" #:archive-href "/archive" #:today "2026-08-04"
                                                           #:node-href test-node-href))))
    (check-true (string-contains? s "<title>olai</title>") s)
    (check-true (string-contains? s "href=\"/static/app.css\"") s)
    ;; the client runtime is the framework's, under its own prefix, and it
    ;; comes first: an extension cannot register into an undefined htmx
    (check-true (string-contains? s "src=\"/live/htmx.min.js\"") s)
    (check-true (string-contains? s "src=\"/live/idiomorph.min.js\"") s)
    (check-true (< (string-index s "/live/htmx.min.js")
                   (string-index s "/static/chat.js")))
    (check-true (string-contains? s "src=\"/static/collapse.js\"") s)
    (check-true (string-contains? s "src=\"/static/notes.js\"") s)
    (check-true (string-contains? s "src=\"/static/prefs.js\"") s)
    (check-true (string-contains? s "src=\"/static/chat.js\"") s)
    (check-true (string-contains? s "src=\"/static/pwa.js\"") s)
    (check-false (string-contains? s "tailwind") s)
    (check-false (string-contains? s "cdn.") s)
    (check-true (string-contains? s "<aside class=\"ol-sidebar-col\"") s)
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

  (test-case "the page opts into the stream the transport addresses"
    (define s (xstr (render-page '(div) #:cursor "boot.1")))
    ;; the stream, and what this page was rendered at — so an edit that lands
    ;; between drawing the page and its EventSource connecting is not lost.
    ;; The address carries the boot id of THIS process: a tab that outlives a
    ;; restart connects somewhere the new server does not answer, and is told
    ;; to reload rather than left subscribed to nothing.
    (check-true (string-contains? s (format "sse-connect=\"~a\"" (stream-href "boot.1"))) s)
    (check-true (string-contains? s "hx-ext=\"sse,morph\"") s)
    ;; a page drawn from no cursor still connects — it just carries the old gap
    (check-true (string-contains? (xstr (render-page '(div))) "sse-connect")))

  (test-case "the live region re-fetches its own address and morphs itself"
    (define s (xstr (render-page '(div) #:href "/today" #:cursor "boot.1")))
    (check-true (string-contains? s "id=\"ol-live\"") s)
    (check-true (string-contains? s "hx-get=\"/today\"") s)
    (check-true (string-contains? s "hx-trigger=\"sse:outline\"") s)
    (check-true (string-contains? s "hx-select=\"#ol-live\"") s)
    (check-true (string-contains? s "hx-swap=\"morph:outerHTML\"") s)
    ;; back and forward restore the region, not the chrome around it
    (check-true (string-contains? s "hx-history-elt") s))

  (test-case "a page can say its stream is down"
    (define s (xstr (render-page '(div) #:cursor "boot.1")))
    (check-true (string-contains? s "showing last known state") s)
    ;; the report sits OUTSIDE the region it reports on
    (check-true (> (string-index s "ol-stream") (string-index s "ol-live")) s))

  (test-case "links navigate partially and keep their plain href"
    (define fd (files (list "Tasks.rkt" (list (tk "Milk" #f #f '())))))
    (define s (xstr (render-sidebar fd #:home-href "/" #:today-href "/today" #:archive-href "/archive" #:today "2026-08-04" #:href "/"
                                    #:node-href test-node-href)))
    ;; no-JS, middle-click and copy-link all still read the href
    (check-true (string-contains? s (format "href=\"/n/~a\"" (title-key "Milk"))) s)
    (check-true (string-contains? s (format "hx-get=\"/n/~a\"" (title-key "Milk"))) s)
    (check-true (string-contains? s "hx-push-url=\"true\"") s)
    ;; every link on the page names the region it aims at, and there is only
    ;; one to name: a sidebar click that rebuilt the chat panel is the bug
    ;; this is here to keep unwritable
    (check-true (string-contains? s "hx-target=\"#ol-live\"") s)
    (check-false (string-contains? s "hx-target=\"#ol-chat\"") s)
    ;; the chrome links too: Today and the brand are navigation like any other
    (check-true (string-contains? s "hx-get=\"/today\"") s))

  (test-case "the bullet and the crumbs navigate the same way"
    (define bullet (xstr (render-node-fragment (tk "T" #f #f '() #:id "t1")
                                               #:today "2026-08-04"
                                               #:node-href test-node-href)))
    (check-true (string-contains? bullet "hx-get=\"/n/t1\"") bullet)
    (define crumbs (xstr (render-breadcrumbs (list (list "Ship" "t1"))
                                             #:home-href "/"
                                             #:node-href test-node-href)))
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

  ;; The note's opener is the same kind of script and holds to the same
  ;; sentence: browser state, stored in the browser, keyed the way the fold is.
  (test-case "notes script stays tiny and framework-free"
    (define js (file->string (build-path (web-static-dir) "notes.js")))
    (check-true (< (length (string-split js "\n")) 65) js)
    (check-false (string-contains? js "require") js)
    (check-true (string-contains? js "olai.notes") js)
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

  ;; ---- the search palette --------------------------------------------------
  ;;
  ;; Which nodes a query names is olai/tests/search.rkt's; this is the surface
  ;; over it — the box, the region it re-fetches, and what a hit reads like.

  (define search-files
    (list (list "/tmp/Tasks.rkt"
                (list (tk "Inbox" #f "where a thought lands"
                          (list (tk "Buy oat milk" #f "the barista kind" '())
                                (tk "Ship the server" #f #f '() #:done #t)))))))

  ;; Both addresses off the app's own table, like the node links inside it: a
  ;; suite that spelled "/search?q=" for itself would be asserting its own
  ;; string (tests/addresses).
  (define (palette query)
    (define q (and (non-empty-string? query) query))
    (xstr (render-search-panel #:action-href (test-search-href #f)
                               #:results-href (test-search-href q)
                               #:query q
                               #:hits (search-outlines search-files query)
                               #:node-href test-node-href)))

  ;; The box does the fetching, and it is the forms that write it: what this
  ;; asserts is that the input aims at the region below it and debounces, and
  ;; that the form still names an action a browser with no JS can submit.
  (test-case "the box re-fetches the results region as it is typed"
    (define s (palette ""))
    (check-true (string-contains? s "action=\"/search\"") s)
    (check-true (string-contains? s "method=\"get\"") s)
    (check-true (string-contains? s "name=\"q\"") s)
    (check-true (string-contains? s "hx-target=\"#ol-search\"") s)
    (check-true (string-contains? s "hx-select=\"#ol-search\"") s)
    (check-true (string-contains? s "delay:") s)
    ;; typing is not a navigation: nothing here touches the address bar
    (check-false (string-contains? s "hx-push-url") s))

  ;; The results are a region of their own: a file that moves while a palette
  ;; is open must not leave it naming a node that has been renamed away.
  (test-case "the results are a region at this query's own address"
    (define s (palette "milk"))
    (check-true (string-contains? s "id=\"ol-search\"") s)
    (check-true (string-contains? s "hx-get=\"/search?q=milk\"") s)
    (check-true (string-contains? s "hx-trigger=\"sse:outline\"") s)
    ;; and Back restores the outline, not a palette
    (check-false (string-contains? s "hx-history-elt") s))

  (test-case "a hit is a link to the node's own page, with the trail above it"
    (define s (palette "milk"))
    (check-true (string-contains? s (string-append "href=\"/n/" (title-key "Buy oat milk")))
                s)
    (check-true (string-contains? s "Buy oat milk") s)
    ;; where it is: the file, then every node above it
    (check-true (string-contains? s "Tasks.rkt › Inbox") s)
    ;; a title hit does not drag the note along with it
    (check-false (string-contains? s "barista") s)
    ;; and the note IS drawn when the note is why this node is on the screen
    (check-true (string-contains? (palette "barista") "the barista kind")
                (palette "barista")))

  ;; Search is not the agenda: a node you finished is a node you may well be
  ;; looking for, and it says which it is.
  (test-case "a done node is found, and drawn as done"
    (define s (palette "server"))
    (check-true (string-contains? s "Ship the server") s)
    (check-true (string-contains? s "ol-search-title is-done") s))

  (test-case "a palette says which of its three states it is in"
    ;; nothing typed: closed, and one line saying what the box is for
    (check-true (string-contains? (palette "") "hidden=\"hidden\"") (palette ""))
    (check-true (string-contains? (palette "") "Type to find a node.") (palette ""))
    ;; a query the outline has nothing for is not an empty palette
    (define none (palette "nosuchnode"))
    (check-false (string-contains? none "hidden=\"hidden\"") none)
    (check-true (string-contains? none "No node matches") none)
    ;; and a query with hits is open, with no such line
    (check-false (string-contains? (palette "milk") "Type to find a node.")
                 (palette "milk")))

  ;; The border the class names have, one attribute over: search.js finds the
  ;; palette, its hits and what opens it by `data-search-*`, and nothing else
  ;; would notice the day one of them stopped being written.
  (test-case "every data-search attribute the script reads is one the markup writes"
    (define js (file->string (build-path (web-static-dir) "search.js")))
    (define wanted (remove-duplicates (regexp-match* #px"data-search-[a-z-]+" js)))
    (define drawn (palette "milk"))
    (check-true (>= (length wanted) 3)
                (format "search.js reads ~a; it used to read three" wanted))
    (for ([a (in-list wanted)])
      (check-true (string-contains? drawn a)
                  (format "search.js reads ~a; the palette writes no such attribute" a))))

  (test-case "the search script fetches nothing and opens no connection"
    (define js (file->string (build-path (web-static-dir) "search.js")))
    (check-false (string-contains? js "fetch(") js)
    (check-false (string-contains? js "new EventSource") js)
    ;; and writes no htmx attribute of its own: the box came with them
    (check-false (string-contains? js "hx-") js))

  ;; ---- file sections (the watcher's re-render unit) ------------------------

  (test-case "a file section is addressable on its own"
    (define entry (list "Tasks.rkt" (list (tk "Milk" #f #f '()))))
    (define s (xstr (render-file-section entry #:today "2026-08-04"
                                         #:node-href test-node-href)))
    (check-true (string-prefix? s "<section class=\"ol-file\"") s)
    (check-true (string-contains? s "id=\"ol-file-Tasks_rkt\"") s)
    (check-true (string-contains? s "data-file=\"Tasks.rkt\"") s)
    (check-true (string-contains? s "Milk") s)
    ;; the page is just its sections
    (define page (xstr (render-outline (list entry) #:today "2026-08-04"
                                       #:node-href test-node-href)))
    (check-true (string-contains? page s) page)))
