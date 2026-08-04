#lang racket/base

;; xexpr-level tests for the web renderers. No files, no server, no clocks:
;; `today` is always passed in.

(require rackunit
         racket/string
         xml
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/web/render
         selfflowy/web/markdown)

(define (tk title date desc kids #:tags [tags '()] #:done [done #f] #:id [id #f])
  (task title date desc done id tags kids #f))

(define (xstr x) (xexpr->string x))

(define (xstr* xs) (string-join (map xstr xs) ""))

(define (files . entries) entries)

(module+ test

  ;; ---- fragment ids -------------------------------------------------------

  (test-case "fragment id prefers the anchor"
    (check-equal? (fragment-id (tk "T" #f #f '() #:id "roadmap") '("F.rkt" "T"))
                  "roadmap")
    ;; anchor wins no matter where the node sits
    (check-equal? (fragment-id (tk "T" #f #f '() #:id "roadmap") '("Other.rkt" "X" "T"))
                  "roadmap"))

  (test-case "path fragment id is p + 8 hex, stable, path-sensitive"
    (define a (fragment-id (tk "Buy milk" #f #f '()) '("Tasks.rkt" "Inbox" "Buy milk")))
    (define b (fragment-id (tk "Buy milk" #f #f '()) '("Tasks.rkt" "Inbox" "Buy milk")))
    (check-equal? a b)
    (check-regexp-match #px"^p[0-9a-f]{8}$" a)
    ;; same title under a different parent -> different id
    (check-not-equal? a (fragment-id (tk "Buy milk" #f #f '())
                                     '("Tasks.rkt" "Later" "Buy milk")))
    ;; string and list breadcrumbs agree
    (check-equal? a (fragment-id (tk "Buy milk" #f #f '())
                                 "Tasks.rkt > Inbox > Buy milk")))

  (test-case "ids do not depend on how many files were loaded"
    (define t (tk "Solo" #f #f '()))
    (define one (fragment-index (files (list "Tasks.rkt" (list t) (hash)))))
    (define two (fragment-index (files (list "Tasks.rkt" (list t) (hash))
                                       (list "Roadmap.rkt" (list (tk "Other" #f #f '())) (hash)))))
    (check-true (hash-has-key? two (car (hash-keys one)))))

  ;; ---- node fragment ------------------------------------------------------

  (test-case "node fragment wraps in n-{fragment-id}"
    (define fid (fragment-id (tk "Leaf" #f #f '()) '("F.rkt" "Leaf")))
    (define s (xstr (render-node-fragment (tk "Leaf" #f #f '())
                                          #:breadcrumb '("F.rkt" "Leaf")
                                          #:today "2026-08-04")))
    (check-true (string-contains? s (string-append "id=\"n-" fid "\"")) s)
    (check-true (string-contains? s (string-append "data-fragment-id=\"" fid "\"")) s)
    (check-true (string-contains? s "class=\"sf-node\"") s)
    (check-true (string-contains? s "Leaf") s)
    ;; leaf: no children list, no live toggle
    (check-false (string-contains? s "sf-children") s)
    (check-true (string-contains? s "sf-toggle-empty") s))

  (test-case "parent gets a toggle, a children list and nested node ids"
    (define parent (tk "Parent" #f #f (list (tk "Child" #f #f '()))))
    (define s (xstr (render-node-fragment parent
                                          #:breadcrumb '("F.rkt" "Parent")
                                          #:today "2026-08-04")))
    (define kid-id (fragment-id (tk "Child" #f #f '()) '("F.rkt" "Parent" "Child")))
    (check-true (string-contains? s "sf-node has-children") s)
    (check-true (string-contains? s "class=\"sf-toggle\"") s)
    (check-true (string-contains? s "aria-expanded=\"true\"") s)
    (check-true (string-contains? s "<ul class=\"sf-children\">") s)
    (check-true (string-contains? s (string-append "id=\"n-" kid-id "\"")) s)
    (check-true (string-contains? s "Child") s))

  (test-case "collapsed node carries is-collapsed and aria-expanded=false"
    (define s (xstr (render-node-fragment (tk "P" #f #f (list (tk "C" #f #f '())))
                                          #:collapsed? #t
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "is-collapsed") s)
    (check-true (string-contains? s "aria-expanded=\"false\"") s))

  (test-case "anchored node keeps a plain #anchor target for mirror links"
    (define s (xstr (render-node-fragment (tk "Ship" #f #f '() #:id "ship")
                                          #:breadcrumb '("F.rkt" "Ship"))))
    (check-true (string-contains? s "id=\"n-ship\"") s)
    (check-true (string-contains? s "class=\"sf-anchor\" id=\"ship\"") s))

  (test-case "mirror site renders the target with a mirror link"
    (define target (tk "Anchored" #f #f '() #:id "a1"))
    (define parent (tk "Holder" #f #f (list (mirror-ref "a1"))))
    (define s (xstr (render-node-fragment parent
                                          #:anchors (hash "a1" target)
                                          #:breadcrumb '("F.rkt" "Holder"))))
    (check-true (string-contains? s "Anchored") s)
    (check-true (string-contains? s "class=\"sf-mirror\"") s)
    (check-true (string-contains? s "href=\"#a1\"") s)
    ;; unresolved mirror does not blow up
    (define s2 (xstr (render-node-fragment (tk "Holder" #f #f (list (mirror-ref "nope")))
                                           #:anchors (hash))))
    (check-true (string-contains? s2 "sf-unresolved") s2)
    (check-true (string-contains? s2 "(unresolved)") s2))

  (test-case "toggle-base wires htmx check-off; default is inert"
    (define plain (xstr (render-node-fragment (tk "T" #f #f '() #:id "t1"))))
    (check-false (string-contains? plain "hx-post") plain)
    (check-true (string-contains? plain "<span class=\"sf-check\"") plain)
    (define hx (xstr (render-node-fragment (tk "T" #f #f '() #:id "t1")
                                           #:toggle-base "/toggle/")))
    (check-true (string-contains? hx "hx-post=\"/toggle/t1\"") hx)
    (check-true (string-contains? hx "hx-target=\"#n-t1\"") hx)
    (check-true (string-contains? hx "hx-swap=\"outerHTML\"") hx))

  (test-case "zoom-base makes the bullet a zoom link"
    (define s (xstr (render-node-fragment (tk "T" #f #f '() #:id "t1")
                                          #:zoom-base "/z/")))
    (check-true (string-contains? s "href=\"/z/t1\"") s)
    (define s2 (xstr (render-node-fragment (tk "T" #f #f '() #:id "t1"))))
    (check-false (string-contains? s2 "sf-bullet-link") s2))

  ;; ---- done / dates / tags (carried over from the old html tests) ---------

  (test-case "done task renders checked box and strikethrough class"
    (define s (xstr (render-node-fragment (tk "Done item" #f #f '() #:done #t))))
    (check-true (string-contains? s "☑") s)
    (check-true (string-contains? s "sf-check is-done") s)
    (check-true (string-contains? s "sf-title is-done") s)
    (check-true (string-contains? s "Done item") s)
    (define s2 (xstr (render-node-fragment (tk "Stamped" "2026-01-01" #f '()
                                               #:done "2026-01-02"))))
    (check-true (string-contains? s2 "☑") s2)
    (check-true (string-contains? s2 "sf-node is-done") s2))

  (test-case "date pill and description present; undone box is empty"
    (define s (xstr (render-node-fragment (tk "T" "2026-01-02" "a **note**" '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "sf-pill sf-date") s)
    (check-true (string-contains? s "title=\"2026-01-02\"") s)
    (check-true (string-contains? s "Fri, Jan 2") s)
    (check-true (string-contains? s "sf-note") s)
    (check-true (string-contains? s "<strong") s)
    (check-true (string-contains? s "☐") s)
    (check-false (string-contains? s "is-done") s))

  (test-case "today's date pill is ringed; timed dates keep the clock"
    (define s (xstr (render-node-fragment (tk "T" "2026-08-04T18:00" #f '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "sf-date is-today") s)
    (check-true (string-contains? s "18:00") s))

  (test-case "bare ISO day title renders a friendly pill, not mangled hyphens"
    (define s (xstr (render-node-fragment (tk "2026-08-03" #f #f '())
                                          #:today "2026-08-04")))
    (check-true (string-contains? s "Mon, Aug 3") s)
    (check-true (string-contains? s "title=\"2026-08-03\"") s)
    ;; day nodes stay linkable as #YYYY-MM-DD
    (check-true (string-contains? s "class=\"sf-anchor\" id=\"2026-08-03\"") s)
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
    (check-false (string-contains? s-year "sf-day") s-year))

  (test-case "tag pills outside code; code keeps #tag text"
    (define s1 (xstr (render-node-fragment (tk "Ship #lang work" #f #f '()))))
    (check-true (string-contains? s1 "sf-pill sf-tag") s1)
    (check-true (string-contains? s1 "#lang") s1)
    (define s2 (xstr* (title->inline-xexprs "see `code #notag` please")))
    (check-true (string-contains? s2 "<code") s2)
    (check-true (string-contains? s2 "#notag") s2)
    (check-false (regexp-match? #rx"sf-tag[^>]*>#notag" s2) s2))

  ;; ---- markdown / escaping -----------------------------------------------

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
    (check-true (string-contains? s "sf-link") s)
    (define n (xstr* (note->xexprs "intro\n\n```\nblock\n```\n")))
    (check-true (string-contains? n "<pre class=\"sf-pre\"") n)
    (check-true (string-contains? n "block") n))

  (test-case "script, raw HTML and javascript: hrefs are stripped, & is escaped"
    (define s (xstr* (title->inline-xexprs "hi <script>alert(1)</script> & ok")))
    (check-false (string-contains? s "<script") s)
    (check-true (string-contains? s "alert(1)") s)
    (define node (xstr (render-node-fragment (tk "A <b>x</b> & y \"q\"" #f #f '()))))
    (check-false (regexp-match? #rx"<b[ >]" node) node)
    (check-true (string-contains? node "&amp;") node)
    (check-true (string-contains? node "x") node)
    (define bad (xstr* (title->inline-xexprs "[x](javascript:alert(1))")))
    (check-false (string-contains? bad "javascript:") bad)
    ;; a scripted title cannot escape its attribute either
    (define attrs (xstr (render-node-fragment (tk "2026-08-03" #f #f '() #:id "q\"x"))))
    (check-false (regexp-match? #rx"id=\"q\"x\"" attrs) attrs))

  (test-case "note markdown lists survive sanitizing"
    (define n (xstr* (note->xexprs "- one\n- two\n")))
    (check-true (string-contains? n "<ul") n)
    (check-true (string-contains? n "one") n))

  ;; ---- outline ------------------------------------------------------------

  (test-case "outline renders one section per file with nested lists"
    (define x (render-outline
               (files (list (string->path "/tmp/Tasks.rkt")
                            (list (tk "Milk" #f #f (list (tk "2%" #f #f '()))))
                            (hash))
                      (list (string->path "/tmp/Roadmap.rkt")
                            (list (tk "Ship" #f #f '()))
                            (hash)))
               #:today "2026-08-04"))
    (define s (xstr x))
    (check-true (string-contains? s "data-file=\"Tasks.rkt\"") s)
    (check-true (string-contains? s "data-file=\"Roadmap.rkt\"") s)
    (check-true (string-contains? s "<ul class=\"sf-outline\">") s)
    (check-true (string-contains? s "Milk") s)
    (check-true (string-contains? s "Ship") s)
    ;; roots are keyed off the file label
    (define fid (fragment-id (tk "Milk" #f #f '()) '("Tasks.rkt" "Milk")))
    (check-true (string-contains? s (string-append "id=\"n-" fid "\"")) s))

  ;; ---- sidebar ------------------------------------------------------------

  (test-case "sidebar lists Today, Starred placeholder and file roots"
    (define s (xstr (render-sidebar
                     (files (list "/tmp/Tasks.rkt"
                                  (list (tk "Inbox" #f #f (list (tk "Deep" #f #f '())))
                                        (tk "Someday" #f #f '()))
                                  (hash))
                            (list "/tmp/Roadmap.rkt" (list (tk "WP2" #f #f '())) (hash))))))
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
    (check-false (string-contains? s "sf-bullet") s)
    (check-false (string-contains? s "sf-check") s)
    (check-true (string-contains? s "sf-toggle") s)
    ;; deeper levels start collapsed
    (check-true (string-contains? s "sf-tree-node is-collapsed") s))

  ;; ---- breadcrumbs / zoom -------------------------------------------------

  (test-case "breadcrumbs link the pairs and leave bare strings plain"
    (define s (xstr (render-breadcrumbs (list "Tasks.rkt" (list "Inbox" "p1234abcd")))))
    (check-true (string-contains? s "sf-breadcrumbs") s)
    (check-true (string-contains? s "href=\"/\"") s)
    (check-true (string-contains? s "<span class=\"sf-crumb\">Tasks.rkt</span>") s)
    (check-true (string-contains? s "href=\"#n-p1234abcd\"") s)
    (define z (xstr (render-breadcrumbs (list (list "Inbox" "p1234abcd"))
                                        #:zoom-base "/z/")))
    (check-true (string-contains? z "href=\"/z/p1234abcd\"") z))

  (test-case "zoom shows breadcrumbs plus the focused subtree only"
    (define fd (files (list "Tasks.rkt"
                            (list (tk "Inbox" #f #f
                                      (list (tk "Buy milk" #f #f
                                                (list (tk "2% please" #f #f '())))))
                                  (tk "Elsewhere" #f #f '()))
                            (hash))))
    (define fid (fragment-id (tk "Buy milk" #f #f '())
                             '("Tasks.rkt" "Inbox" "Buy milk")))
    (define s (xstr (render-zoom fd fid #:today "2026-08-04")))
    (check-true (string-contains? s "sf-breadcrumbs") s)
    (check-true (string-contains? s "Tasks.rkt") s)
    (check-true (string-contains? s "Inbox") s)
    (check-true (string-contains? s (string-append "id=\"n-" fid "\"")) s)
    (check-true (string-contains? s "2% please") s)
    (check-false (string-contains? s "Elsewhere") s)
    ;; the ancestor crumb is clickable, the file label is not
    (check-true (string-contains? s (string-append
                                     "href=\"#n-"
                                     (fragment-id (tk "Inbox" #f #f '())
                                                  '("Tasks.rkt" "Inbox"))
                                     "\""))
                s))

  (test-case "zoom by anchor and unknown id"
    (define fd (files (list "Tasks.rkt"
                            (list (tk "Root" #f #f (list (tk "Kid" #f #f '() #:id "kid"))))
                            (hash))))
    (define s (xstr (render-zoom fd "kid")))
    (check-true (string-contains? s "id=\"n-kid\"") s)
    (check-true (string-contains? s "Kid") s)
    (define miss (xstr (render-zoom fd "pdeadbeef")))
    (check-true (string-contains? miss "No such node.") miss))

  ;; ---- page shell ---------------------------------------------------------

  (test-case "page shell links the static assets and composes sidebar + main"
    (define fd (files (list "Tasks.rkt" (list (tk "Milk" #f #f '())) (hash))))
    (define s (xstr (render-page (render-outline fd #:today "2026-08-04")
                                 #:title "selfflowy"
                                 #:sidebar (render-sidebar fd))))
    (check-true (string-contains? s "<title>selfflowy</title>") s)
    (check-true (string-contains? s "href=\"/static/app.css\"") s)
    (check-true (string-contains? s "src=\"/static/htmx.min.js\"") s)
    (check-true (string-contains? s "src=\"/static/sse.js\"") s)
    (check-false (string-contains? s "tailwind") s)
    (check-false (string-contains? s "cdn.") s)
    (check-true (string-contains? s "<aside class=\"sf-sidebar\"") s)
    (check-true (string-contains? s "<main class=\"sf-main\">") s)
    ;; the collapse script is inline and persists to localStorage
    (check-true (string-contains? s "selfflowy.collapsed") s)
    (check-true (string-contains? s "localStorage") s))

  (test-case "sse-connect opts the body into the htmx sse extension"
    (define s (xstr (render-page '(div) #:sse-connect "/events")))
    (check-true (string-contains? s "hx-ext=\"sse\"") s)
    (check-true (string-contains? s "sse-connect=\"/events\"") s)
    (check-false (string-contains? (xstr (render-page '(div))) "sse-connect") s))

  (test-case "collapse script stays tiny and framework-free"
    (check-true (< (length (string-split collapse-js "\n")) 30) collapse-js)
    (check-false (string-contains? collapse-js "require") collapse-js)))
