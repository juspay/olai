#lang racket/base

;; Pure xexpr renderers for the web view. No I/O, no clocks: `today` is an
;; argument. Every function here is a value -> value transform so the server
;; can render a whole page, one node fragment (SSE re-swap), or a zoom view
;; from the same code.
;;
;; DATA IN — files-data: (listof (list label tasks)), label a path or a
;; string. `tasks` is a RESOLVED tree: every mirror site already carries the
;; node it mirrors (olai/lang/walk, resolve-mirrors). This module draws
;; what it is given and looks nothing up — an unresolved mirror is a state a
;; marker is drawn in, not a hash miss in the middle of a recursion.
;;
;; DOCUMENTS — a node's @doc names a file, and this module never opens one:
;; `docs` is a hash of absolute path -> text the store read at load time, and
;; a path with no entry is a state to draw. Same discipline as the mirrors —
;; the I/O and the drawing are different layers, and only one of them is
;; allowed a filesystem.
;;
;; IDS — a node's identity is `task-key`, minted by the load layer (its
;; ^anchor, else a hash of its defining file + child ordinals). This module
;; never computes an id: it only decorates one, so renaming a title cannot
;; re-key a permalink, a stored collapse state, or an SSE swap target.
;;
;; STYLES — every class this module draws is DEFINED here, next to the markup
;; that wears it (olai/web/style). The exceptions are classes this module does
;; not own the markup of: .ol-pill's shape is the skin's (olai/web/theme), the
;; markdown classes are web/markdown's, and the prefs picker is web/prefs' — the
;; sidebar only places the block it hands back. The chat panel is an overlay on
;; all of this, so it requires this module, which is what puts its rules last in
;; the cascade.

(require racket/contract
         racket/list
         racket/match
         racket/path
         racket/runtime-path
         racket/string
         (only-in xml cdata xexpr->string)
         (except-in olai/lang/expander #%module-begin)
         ;; the resolved shape of a mirror site (core owns the binding)
         (only-in olai/lang/walk mirror-site? mirror-site-of mirror-site-task)
         olai/dates
         ;; what a @doc path means: where it points, which of the two document
         ;; formats it is, and the one line a collapsed node shows of it
         (only-in olai/doc doc-path doc-kind doc-lead)
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
         ;; how a page opts into the live view: the attributes that make an
         ;; element a live region and a link a partial navigation. The
         ;; framework spells the mechanism; olai/web/live picks the names
         (only-in live/client live-view? live-region-attributes
                  live-link-attributes live-connect-attributes
                  ;; the two states its runtime reports; the paint below is
                  ;; olai's, and these names are the whole border
                  live-connecting-class live-stale-class)
         (only-in olai/web/live live-region-id live-script-srcs)
         ;; the skin, first: tokens and the document's own rules come before
         ;; anything that leans on them (see style.rkt on ordering)
         olai/web/theme
         olai/web/style
         olai/web/markdown
         ;; the sidebar's picker and the boot script that restores what it
         ;; picked. Last of the requires, so its rules land after the skin's
         ;; and before this module's own; nothing else paints .ol-pref*
         olai/web/prefs)

;; Contracts on the drawing surface check the INPUT shape — a task, a
;; files-data list, an ISO `today` string — and say only `list?` about the
;; xexpr coming back. `xexpr?` is a recursive walk of the whole rendered page;
;; the server renders one on every request, and a shape check that costs as
;; much as the render is not a check, it is a second renderer.
(provide (contract-out
          [render-node-fragment
           (->* (task? #:today string?)
                (#:site (or/c string? #f)
                 #:mirror-of (or/c string? #f)
                 #:zoom-base (or/c string? #f)
                 #:toggle-base (or/c string? #f)
                 #:live (or/c live-view? #f)
                 #:docs hash?
                 #:doc-expanded? boolean?
                 #:collapsed? boolean?)
                list?)]
          [render-outline
           (->* (list? #:today string?)
                (#:zoom-base (or/c string? #f) #:toggle-base (or/c string? #f)
                 #:live (or/c live-view? #f) #:docs hash?)
                list?)]
          [render-file-section
           (->* (any/c #:today string?)
                (#:zoom-base (or/c string? #f) #:toggle-base (or/c string? #f)
                 #:live (or/c live-view? #f) #:docs hash?)
                list?)]
          [render-breadcrumbs
           (->* (list? #:home-href (or/c string? #f))
                (#:zoom-base (or/c string? #f)
                 #:live (or/c live-view? #f))
                list?)]
          [render-sidebar
           (->* (list? #:home-href string? #:today-href (or/c string? #f))
                (#:zoom-base (or/c string? #f)
                 #:live (or/c live-view? #f))
                list?)]
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
                 ;; the live view this page is part of — which carries the
                 ;; page's own address, the one thing the region re-fetches
                 #:live (or/c live-view? #f)
                 #:head-extra list?
                 #:body-extra list?)
                list?)]
          [render-zoom
           (->* (task? list? #:today string? #:home-href string?)
                (#:zoom-base (or/c string? #f)
                 #:toggle-base (or/c string? #f)
                 #:live (or/c live-view? #f)
                 #:docs hash?)
                list?)]
          [render-empty-pane
           (->* (string? #:home-href string?) (#:live (or/c live-view? #f)) list?)]
          [render-error-banner (->* (string?) (#:where (or/c string? #f)) list?)]
          [page->html-string (-> any/c string?)]
          [node-element-id (->* (string?) (#:site (or/c string? #f)) string?)]
          [web-static-dir (-> path?)]
          [web-static-prefix string?]
          [web-scripts (listof string?)]
          ;; the outline pane's class: the chat panel is the one thing that
          ;; moves it, so the one thing that needs its name
          [ol-main string?])
         ;; re-exported markdown surface (render-time only): contracted by
         ;; the module that owns it, not decorated twice here
         title->inline-xexprs
         note->xexprs
         sanitize-xexpr)

;; ---- static assets --------------------------------------------------------
;;
;; One owner for the whole /static/ surface: the directory the server mounts,
;; the URL prefix it mounts it at, and the files the page pulls in. NO JS lives
;; in this module — a script that changes with every SSE tweak has no business
;; recompiling a Racket module, and browsers cannot cache it. The one script the
;; page carries inline is web/prefs' (it has to run before the first paint,
;; which is the one thing a cacheable deferred file cannot do), and it is that
;; module's, not this one's.
;;
;; The stylesheet is the other way round: it is NOT a file. It is generated
;; from the modules that draw the page (olai/web/skin), and this module cannot
;; name it — skin requires render, so render asking skin for a URL would be a
;; cycle. render-page is TOLD the href, like every other address it links.

(define-runtime-path static-dir "static")
(define (web-static-dir) static-dir)

(define web-static-prefix "/static/")

;; olai's own scripts. The client runtime (htmx, its SSE extension, idiomorph
;; and the health watchdog) is the framework's, mounted at its own prefix and
;; listed by it — see olai/web/live. These come after, and lean on it.
(define web-scripts
  '("collapse.js" "prefs.js" "chat.js" "pwa.js"))

(define (static-href name) (string-append web-static-prefix name))

;; ---- element ids ----------------------------------------------------------

;; A node with an ^anchor is one node rendered at several SITES (its defining
;; site and every *mirror of it). They share a key — they are the same node —
;; but a DOM id has to be unique or an id-addressed swap updates only the
;; first copy. The defining site owns the bare id; a mirror site qualifies it
;; with the site it hangs under. Every site keeps data-fragment-id=<key>, so
;; a swap can address them all as [data-fragment-id="…"].
(define (node-element-id key #:site [site #f])
  (string-append "n-" (site-key site key)))

(define (site-key site key)
  (if site (string-append site "-" key) key))

;; ids and CSS selectors: keep them to the anchor grammar
(define (id-safe s)
  (regexp-replace* #px"[^A-Za-z0-9_-]" s "_"))

;; ---- small helpers --------------------------------------------------------

;; files-data -> (listof (list label tasks)) with labels as strings
(define (normalize-files-data files-data)
  (for/list ([e (in-list files-data)])
    (match e
      [(list label (? list? tasks)) (list (file-label label) tasks)]
      [_ (error 'render "bad files-data entry: ~e" e)])))

;; Where a node lives, as the attributes a link to it wears. With a `live`
;; view those are a partial navigation — fetch the region, swap it morphed,
;; push the address — and WITHOUT one they are the href and nothing else,
;; which is also what a browser running no JS sees either way (live/client).
;; No zoom-base is a page that has no addresses to give, so a node link is a
;; jump to the element instead.
(define (node-link-attributes live base fid)
  (live-link-attributes live
                        (if base
                            (string-append base fid)
                            (string-append "#" (node-element-id fid)))))

;; ---- states ---------------------------------------------------------------
;;
;; The node's states, spelled once. They carry no rules of their own — they
;; qualify the components below, and collapse.js toggles is-collapsed — so
;; they are defined up here where the selectors can reach them.

(define-modifier is-done is-doing is-today is-tree is-collapsed has-children)

;; Hooks, not looks: a pane wrapper the SSE swap and the tests address, and a
;; mirror site whose anchor named nothing. Nothing paints them.
(define-modifier ol-pane ol-zoom ol-zoom-root ol-unresolved ol-crumb-home)

;; ---- pills ----------------------------------------------------------------
;;
;; The shape is the skin's (web/theme, .ol-pill) because web/markdown draws one
;; too. Here is what a DATE reads like — and .ol-pill comes first in the
;; cascade, so this repaints it.

(define-style ol-date
  #:background ,blue-bg
  #:color ,blue-fg
  #:font-variant-numeric tabular-nums
  ;; today is the accent, and the only pill that carries a border
  [,(sel '& is-today)
   #:background ,pill-bg
   #:color ,green
   #:border-color ,green
   #:font-weight 600]
  ;; a done date is history: it keeps its place and stops shouting
  [,(sel '& is-done)
   #:background ,pill-bg
   #:color ,dim
   #:border-color transparent
   #:text-decoration line-through])

(define-style ol-day #:font-weight 500)

(define-style ol-date-time
  #:opacity 0.75
  #:font-family ,mono
  #:font-size ,micro-size)

;; DOING has no date to hang off and no strikethrough to read it from, so it
;; says itself: italic and pulsing, and the pulse drops out under
;; prefers-reduced-motion, which is why the slant is there too. Amber like a
;; #tag — the palette's attention colour — but bordered, uppercase and micro,
;; which no tag is.
(define-component (doing-pill-xexpr)
  #:class ol-doing
  #:css (#:background ,amber-bg
         #:color ,amber-fg
         #:border-color ,amber-fg
         #:font-style italic
         #:font-size ,micro-size
         #:letter-spacing 0.06em
         #:text-transform uppercase
         #:animation (ol-doing-pulse ,busy-beat ease-in-out infinite)
         ;; the pill still says doing; only the breathing drops out
         [@ media (#:prefers-reduced-motion reduce) #:animation none])
  `(span ((class ,(classes ol-pill ol-doing)) (title "in progress")) "doing"))

(register-fragment!
 (css-expr
  [@ keyframes ol-doing-pulse
     [0% 100% #:opacity 1]
     [50% #:opacity 0.55]]))

;; ---- one node -------------------------------------------------------------

;; Bare ISO day title -> friendly pill (display-only). ISO stays in the file.
(define (day-pill-xexpr iso-day today done?)
  `(span ((class ,(classes ol-pill ol-date ol-day
                           (and (equal? iso-day today) is-today)
                           (and done? is-done)))
          (title ,iso-day)
          ,@(if (equal? iso-day today) '((data-today "true")) '()))
         ,(friendly-date-label iso-day)))

(define (date-pill-xexpr date today done?)
  (define day (date-day-prefix date))
  `(span ((class ,(classes ol-pill ol-date
                           (and (equal? day today) is-today)
                           (and done? is-done)))
          (title ,date))
         ,(if (bare-iso-date-title? day) (friendly-date-label day) date)
         ,@(if (> (string-length date) 10)
               (list `(span ((class ,ol-date-time)) ,(substring date 11)))
               '())))

;; The shell first: the <li>, the row, the child list. Everything after it
;; sits INSIDE the row, and the selectors that reach in from here need these
;; names to already exist.

(define-style ol-children
  ;; the list reset every outline list wears (.ol-outline and .ol-tree too)
  #:list-style none
  #:margin 0
  #:padding 0
  ;; Workflowy connector: a hairline down the left of a node's children
  #:margin-left ,indent
  #:padding-left 0.75rem
  #:border-left (1px solid (apply color-mix (in srgb)
                                  (,dim 35%) ,line)))

(define-style ol-node
  #:position relative
  ;; collapse is a class on the node; the children are what it hides
  [(> ,(sel '& is-collapsed) ,(sel ol-children)) #:display none])

(define-style ol-row
  #:display flex
  #:align-items flex-start
  #:gap 0.125rem
  #:padding (0.0625rem 0)
  #:border-radius ,radius
  [(: & hover)
   #:background (apply color-mix (in srgb) (,pill-bg 55%) transparent)])

;; disclosure triangle: hidden until hover, like Workflowy
(define-style ol-toggle
  #:flex (0 0 1rem)
  #:width 1rem
  #:height 1.5rem
  #:display inline-flex
  #:align-items center
  #:justify-content center
  #:padding 0
  #:border 0
  #:background none
  #:color ,dim
  #:font-size 0.625rem
  #:line-height 1
  #:cursor pointer
  #:opacity 0
  #:transform (apply rotate 90deg)
  #:transition (transform 120ms ease) (opacity 120ms ease)
  [(> (: ,(sel ol-row) hover) &) (: & focus-visible) #:opacity 1]
  ;; folded: the triangle points right, and stays visible saying so
  [(> ,(sel ol-node is-collapsed) ,(sel ol-row) &)
   #:transform (apply rotate 0deg)
   #:opacity 1]
  ;; a touch screen has no hover, and a finger needs a bigger target
  [@ media (#:max-width ,phone-max)
     #:opacity 1
     #:flex (0 0 1.75rem)
     #:width 1.75rem
     #:height 1.75rem
     #:font-size 0.75rem])

(define-style ol-toggle-empty #:cursor default)

;; The node's state as the class it wears, or #f for the state nothing marks.
;; One switch, so a fourth state is a clause here rather than a boolean loose
;; in the markup — and the shell and the checkbox below cannot disagree about
;; what a state looks like.
(define (state-class status)
  (case status
    [(done) is-done]
    [(doing) is-doing]
    [else #f]))

;; The collapsible shell both panes wear: the node <li> with its collapse
;; state, the disclosure toggle, the row, and the child list. The main pane
;; and the sidebar tree differ in what goes IN the row and in one modifier
;; class — not in the markup, and not in the selectors CSS and JS have to
;; know about.
(define (node-shell #:key key
                    #:element-id [element-id #f]
                    #:collapse-key collapse-key
                    #:collapsed? collapsed?
                    #:tree? [tree? #f]
                    #:status [status 'open]
                    #:before-row [before-row '()]
                    #:row row
                    ;; between the node's own line and its children: what
                    ;; belongs to this node but is not one line of it. The
                    ;; document a @doc attaches is the only such thing today
                    #:after-row [after-row '()]
                    #:children [children '()])
  (define has-kids? (pair? children))
  `(li ((class ,(classes ol-node
                         (and tree? is-tree)
                         (and has-kids? has-children)
                         ;; a leaf has nothing to fold
                         (and has-kids? collapsed? is-collapsed)
                         (state-class status)))
        ,@(if element-id `((id ,element-id)) '())
        (data-fragment-id ,key)
        ,@(if has-kids? `((data-collapse-key ,collapse-key)) '()))
       ,@before-row
       (div ((class ,ol-row))
            ,(toggle-xexpr has-kids? collapsed?)
            ,@row)
       ,@after-row
       ,@(if has-kids?
             (list `(ul ((class ,ol-children)) ,@children))
             '())))

;; Hidden until hover, like Workflowy; a leaf keeps the gutter.
(define (toggle-xexpr has-kids? collapsed?)
  (if has-kids?
      `(button ((type "button")
                (class ,ol-toggle)
                (aria-expanded ,(if collapsed? "false" "true"))
                (aria-label "toggle children"))
               "▸")
      `(span ((class ,(classes ol-toggle ol-toggle-empty)) (aria-hidden "true")))))

;; ---- what sits in the row -------------------------------------------------

(define-style ol-bullet-link
  #:display inline-flex
  #:align-items center
  #:height 1.5rem)

(define-style ol-bullet
  #:position relative
  #:flex (0 0 1rem)
  #:width 1rem
  #:height 1.5rem
  #:display inline-flex
  #:align-items center
  #:justify-content center
  [(:: & after)
   #:content ""
   #:position relative
   #:width 0.4375rem
   #:height 0.4375rem
   #:border-radius 50%
   #:background ,dim]
  ;; collapsed parents wear a halo, like Workflowy
  [(> ,(sel ol-node is-collapsed) (,(sel ol-row) (:: ,(sel '& has-children) before)))
   #:content ""
   #:position absolute
   #:top 50%
   #:left 50%
   #:width 1rem
   #:height 1rem
   #:margin (-0.5rem 0 0 -0.5rem)
   #:border-radius 50%
   #:background ,line]
  [((: ,(sel ol-bullet-link) hover) (:: & after)) #:background ,ink])

(define-style ol-content
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (0.125rem 0))

(define-style ol-line
  #:display flex
  #:flex-wrap wrap
  #:align-items baseline
  #:gap 0.375rem
  #:min-width 0)

;; The bullet is the node; the box only shows up when it matters — on hover,
;; on focus, or once the node is in a state.
(define-component (checkbox-xexpr key elt-key status toggle-base)
  #:class ol-check
  #:css (#:flex (0 0 1.125rem)
         #:width 1.125rem
         #:height 1.5rem
         #:display inline-flex
         #:align-items center
         #:justify-content center
         #:padding 0
         #:border 0
         #:background none
         #:color ,dim
         #:font-size 0.8125rem
         #:line-height 1
         #:cursor pointer
         #:user-select none
         #:opacity 0
         #:transition (opacity 120ms ease)
         [((: ,(sel ol-row) hover) &) (: & focus-visible)
          ,(sel '& is-done) ,(sel '& is-doing) #:opacity 1]
         [,(sel '& is-done) #:color ,green]
         [,(sel '& is-doing) #:color ,amber-fg]
         ;; no hover on a phone: the box has to stay put, and a finger needs
         ;; room around it. A node in a state was already visible; open ones
         ;; were not
         [@ media (#:max-width ,phone-max)
            #:opacity 1
            #:flex (0 0 1.75rem)
            #:width 1.75rem
            #:height 1.75rem
            #:font-size 1rem])
  ;; the same box in three readings: empty, half-filled, checked. One switch,
  ;; so what a state looks like and what it is called cannot drift apart
  (define-values (label hint)
    (case status
      [(done) (values "☑" "done")]
      [(doing) (values "◧" "doing")]
      [else (values "☐" "not done")]))
  (define done? (eq? status 'done))
  (define common
    `((class ,(classes ol-check (state-class status)))
      (title ,hint)))
  (if toggle-base
      ;; post against the node (its key), swap the copy you clicked (elt-key)
      `(button ((type "button")
                ,@common
                (hx-post ,(string-append toggle-base key))
                (hx-target ,(string-append "#n-" elt-key))
                (hx-swap "outerHTML")
                (aria-label ,(if done? "mark not done" "mark done")))
               ,label)
      `(span (,@common (aria-hidden "true")) ,label)))

;; A box you can press is a <button>; the read-only copy is a <span>, and only
;; the button answers a hover. CSS nesting has no spelling for "the parent,
;; but only when it is a button", so this rule is written out.
(register-fragment!
 (css-expr [(: ,(sel 'button ol-check) hover) #:color ,green]))

(define-style ol-title
  #:color ,ink
  #:overflow-wrap anywhere
  ;; done is a state of the NODE; the title is where it reads
  [,(sel '& is-done) (> ,(sel ol-node is-done) (,(sel ol-row) &))
   #:color ,dim
   #:text-decoration line-through])

(define-style ol-dim #:color ,dim)

(define-style ol-note
  #:margin-top 0.125rem
  #:color ,dim
  #:font-size 0.875rem
  [,(sel '& is-done) #:opacity 0.65 #:text-decoration line-through]
  ;; Markdown blocks inside a note: tightened, never the browser's defaults
  [(& p) #:margin (0.25rem 0)]
  [(& ul) (& ol) #:margin (0.25rem 0) #:padding-left 1.25rem]
  [(& blockquote)
   #:margin (0.25rem 0)
   #:padding-left 0.75rem
   #:border-left (2px solid ,line)])

;; ---- the document a node expands into --------------------------------------
;;
;; @doc attaches a FILE to a node. In the outline the node shows one line of
;; it; zoomed, it shows the whole thing. Same block either way, and only its
;; contents differ — a document that looked like one thing collapsed and
;; something unrelated expanded would be two features wearing one field.
;;
;; It sits between the node's row and its children (node-shell's after-row):
;; the document belongs to this node, and the nodes under it are still under
;; it. Indented to the content column, not to the gutter the bullet sits in.

(define-style ol-doc
  #:margin (0.25rem 0 0.375rem 3.5rem)
  #:min-width 0
  [@ media (#:max-width ,phone-max) #:margin-left 2rem])

(define-style ol-doc-name
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,dim
  #:text-decoration none)

;; The name is a link in the outline and plain text on the node's own page.
;; Only the link answers a hover, and CSS nesting cannot spell "the parent,
;; but only when it is an <a>" — same shape as .ol-crumb below.
(register-fragment!
 (css-expr [(: ,(sel 'a ol-doc-name) hover)
            #:color ,ink
            #:text-decoration underline]))

;; One line, and one line only: the rest of the document is a click away, so
;; a preview that wrapped would be spending three rows saying so.
(define-style ol-doc-lead
  #:display inline-block
  #:max-width 100%
  #:margin-left 0.5rem
  #:vertical-align bottom
  #:color ,dim
  #:font-size 0.8125rem
  #:white-space nowrap
  #:overflow hidden
  #:text-overflow ellipsis)

;; The document itself. Markdown at render time, like every other string this
;; view draws — the file on disk is the data, and this is one reading of it.
(define-style ol-doc-body
  #:margin-top 0.375rem
  #:padding-left 0.75rem
  #:border-left (1px solid ,line)
  #:font-size 0.875rem
  #:color ,ink
  [(& p) #:margin (0.375rem 0)]
  [(& h1) (& h2) (& h3) (& h4) (& h5) (& h6)
   #:margin (0.75rem 0 0.25rem)
   #:font-size 0.9375rem
   #:font-weight 600
   #:letter-spacing -0.01em]
  [(& ul) (& ol) #:margin (0.375rem 0) #:padding-left 1.25rem]
  [(& li) #:margin (0.125rem 0)]
  [(& blockquote)
   #:margin (0.375rem 0)
   #:padding-left 0.75rem
   #:border-left (2px solid ,line)
   #:color ,dim]
  [(& hr) #:margin (0.75rem 0) #:border 0 #:border-top (1px solid ,line)])

;; The file's name — a link to the node's own page while you are looking at
;; the outline, and plain text once you are on it.
(define (doc-name-xexpr rel key live zoom-base link?)
  (define label (file-label rel))
  (if link?
      `(a ((class ,ol-doc-name)
           ,@(node-link-attributes live zoom-base key)
           (title ,rel))
          ,label)
      `(span ((class ,ol-doc-name) (title ,rel)) ,label)))

;; A state to draw, not a thing to fix: a document that is not there, or one
;; in a format this view has no reading of yet.
(define (doc-note-xexpr message)
  `(p ((class ,ol-empty)) ,message))

(define (doc-lead-xexprs text)
  (define lead (and text (doc-lead text)))
  (if (and lead (non-empty-string? lead))
      (list `(span ((class ,ol-doc-lead)) ,lead))
      '()))

(define (doc-body-xexprs rel text)
  (case (doc-kind rel)
    [(md)
     (if text
         (list `(article ((class ,ol-doc-body)) ,@(note->xexprs text)))
         (list (doc-note-xexpr
                (format "~a could not be read." (file-label rel)))))]
    ;; .scrbl is IN the language and not yet on the page. A Scribble document
    ;; is a Racket module, so drawing one means expanding and running it while
    ;; a request is open — arbitrary code out of a data file, inside the
    ;; server. That is a decision with a blast radius rather than a renderer
    ;; detail, so the view says what it is looking at and stops.
    [(scrbl)
     (list (doc-note-xexpr
            (format "~a is a Scribble document; the web view does not render one yet."
                    (file-label rel))))]
    ;; The language rejects any other extension, so nothing loaded reaches
    ;; here — but a switch whose last clause is somebody else's message is a
    ;; switch that lies the day the set grows.
    [else
     (list (doc-note-xexpr
            (format "~a is not a document this view draws." (file-label rel))))]))

;; `docs` is path -> text, read by the store; this only looks in it.
(define (doc-block tk docs expanded? live zoom-base)
  (define rel (task-doc tk))
  (cond
    [(not rel) '()]
    [else
     (define path (doc-path rel (task-file tk)))
     (define text (and path (hash-ref docs path #f)))
     (list
      `(div ((class ,ol-doc))
            ,(doc-name-xexpr rel (task-key tk) live zoom-base (not expanded?))
            ,@(if expanded?
                  (doc-body-xexprs rel text)
                  (doc-lead-xexprs text))))]))

;; A permalink target, not a thing to see.
(define-style ol-anchor #:position absolute #:width 0 #:height 0 #:overflow hidden)

;; Legacy permalink target: explicit ^anchor or bare ISO day title. Node ids
;; are namespaced ("n-…"), so this keeps plain "#anchor" links — mirrors,
;; notes, anything a user wrote — resolving inside the page.
(define (legacy-anchor-xexpr tk)
  (define legacy
    (or (task-id tk)
        (and (bare-iso-date-title? (task-title tk)) (task-title tk))))
  (if legacy
      (list `(a ((class ,ol-anchor) (id ,legacy) (aria-hidden "true"))))
      '()))

(define-style ol-mirror
  #:flex (0 0 auto)
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,rose-fg
  #:text-decoration none
  [(: & hover) #:text-decoration underline])

;; A mirror site whose anchor named nothing. The marker is still drawn — the
;; outline says something belongs here — in its unresolved state.
(define (unresolved-mirror-xexpr anchor)
  `(li ((class ,(classes ol-node ol-unresolved)))
       (div ((class ,ol-row))
            (span ((class ,ol-bullet)))
            (div ((class ,ol-content))
                 (a ((class ,ol-mirror) (href ,(string-append "#" anchor)))
                    "↗" ,anchor)
                 (span ((class ,(classes ol-title ol-dim))) "(unresolved)")))))

(define (render-child child
                      #:site site
                      #:owner owner
                      #:today today
                      #:zoom-base zoom-base
                      #:toggle-base toggle-base
                      #:live live
                      #:docs docs)
  (cond
    [(mirror-site? child)
     (define target (mirror-site-task child))
     (if target
         (render-node-fragment target
                               #:site owner
                               #:today today
                               #:mirror-of (mirror-site-of child)
                               #:zoom-base zoom-base
                               #:toggle-base toggle-base
                               #:live live
                               #:docs docs)
         (unresolved-mirror-xexpr (mirror-site-of child)))]
    [(task? child)
     (render-node-fragment child
                           #:site site
                           #:today today
                           #:zoom-base zoom-base
                           #:toggle-base toggle-base
                           #:live live
                           #:docs docs)]
    [else `(li ((class ,(classes ol-node ol-unresolved))) "???")]))

;; One subtree, self-contained: this is the unit SSE re-swaps.
(define (render-node-fragment tk
                              #:site [site #f]
                              #:today today
                              #:mirror-of [mirror-of #f]
                              #:zoom-base [zoom-base #f]
                              #:toggle-base [toggle-base #f]
                              #:live [live #f]
                              #:docs [docs (hash)]
                              ;; the whole document, not one line of it: true
                              ;; for the node a zoom page is ABOUT, and for
                              ;; nothing else on it
                              #:doc-expanded? [doc-expanded? #f]
                              #:collapsed? [collapsed? #f])
  (define title (task-title tk))
  (define key (task-key tk))
  ;; where this copy of the node sits: #f at its defining site
  (define qkey (site-key site key))
  ;; one switch on the node's state; everything below is drawing. `done?` is
  ;; narrower on purpose — the strikethrough is about being finished, not
  ;; about being in some state
  (define status (task-status tk))
  (define done? (eq? status 'done))
  (define kids (task-children tk))
  (define iso-day (and (bare-iso-date-title? title) title))
  (define title-el
    (if iso-day
        (day-pill-xexpr iso-day today done?)
        `(span ((class ,(classes ol-title (and done? is-done))))
               ,@(map style-md-xexpr (title->inline-xexprs title)))))
  (define dot
    `(span ((class ,(classes ol-bullet (and (pair? kids) has-children)))
            (aria-hidden "true"))))
  (define bullet
    (if zoom-base
        `(a ((class ,ol-bullet-link)
             ,@(node-link-attributes live zoom-base key)
             (title "zoom in"))
            ,dot)
        dot))
  (node-shell
   #:key key
   #:element-id (node-element-id key #:site site)
   #:collapse-key qkey
   #:collapsed? collapsed?
   #:status status
   ;; the legacy #anchor target belongs to the defining site only
   #:before-row (if site '() (legacy-anchor-xexpr tk))
   #:row
   (list bullet
         ;; the check sits in the gutter, not in the text run, so a title
         ;; and its note stay flush left of each other
         (checkbox-xexpr key qkey status toggle-base)
         `(div ((class ,ol-content))
               (div ((class ,ol-line))
                    ,@(if mirror-of
                          (list `(a ((class ,ol-mirror)
                                     (href ,(string-append "#" mirror-of))
                                     (title ,(string-append "mirror of ^" mirror-of)))
                                    "↗"))
                          '())
                    ,title-el
                    ,@(if (eq? status 'doing) (list (doing-pill-xexpr)) '())
                    ,@(if (task-date tk)
                          (list (date-pill-xexpr (task-date tk) today done?))
                          '()))
               ,@(if (task-description tk)
                     (list `(div ((class ,(classes ol-note (and done? is-done))))
                                 ,@(note->xexprs (task-description tk))))
                     '())))
   #:after-row (doc-block tk docs doc-expanded? live zoom-base)
   #:children (for/list ([c (in-list kids)])
                (render-child c
                              #:site site
                              #:owner qkey
                              #:today today
                              #:zoom-base zoom-base
                              #:toggle-base toggle-base
                              #:live live
                              #:docs docs))))


;; ---- main pane ------------------------------------------------------------

;; The outline's own list: same reset as .ol-children, no connector — a file's
;; top level has no parent to hang off.
(define-style ol-outline #:list-style none #:margin 0 #:padding 0)

;; Files stack; the gap between two of them is what says they are two.
(define-style ol-file [(+ & &) #:margin-top 2.5rem])

(define-style ol-file-title
  #:margin (0 0 0.75rem 0.25rem)
  #:font-family ,mono
  #:font-size 0.75rem
  #:font-weight 600
  #:letter-spacing 0.06em
  #:text-transform uppercase
  #:color ,dim)

;; One file's section. This is the natural re-render unit for a watcher: a
;; save touches one file, and #ol-file-<label> is what it swaps.
(define (render-file-section entry
                             #:today today
                             #:zoom-base [zoom-base #f]
                             #:toggle-base [toggle-base #f]
                             #:live [live #f]
                             #:docs [docs (hash)])
  (match-define (list label tasks) (car (normalize-files-data (list entry))))
  `(section ((class ,ol-file)
             (id ,(string-append "ol-file-" (id-safe label)))
             (data-file ,label))
            (h2 ((class ,ol-file-title)) ,label)
            (ul ((class ,ol-outline))
                ,@(for/list ([tk (in-list tasks)])
                    (render-child tk
                                  #:site #f
                                  #:owner (id-safe label)
                                  #:today today
                                  #:zoom-base zoom-base
                                  #:toggle-base toggle-base
                                  #:live live
                                  #:docs docs)))))

(define (render-outline files-data
                        #:today today
                        #:zoom-base [zoom-base #f]
                        #:toggle-base [toggle-base #f]
                        #:live [live #f]
                        #:docs [docs (hash)])
  `(div ((class ,ol-pane) (id "ol-outline"))
        ,@(for/list ([e (in-list files-data)])
            (render-file-section e
                                 #:today today
                                 #:zoom-base zoom-base
                                 #:toggle-base toggle-base
                                 #:live live
                                 #:docs docs))))

;; ---- chrome ---------------------------------------------------------------

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
                            #:zoom-base [zoom-base #f]
                            #:live [live #f])
  (define (crumb->xexpr c)
    (match c
      [(list title key)
       `(a ((class ,ol-crumb) ,@(node-link-attributes live zoom-base key))
           ,@(map style-md-xexpr (title->inline-xexprs title)))]
      [file `(span ((class ,ol-crumb)) ,(file-label file))]))
  `(nav ((class ,ol-breadcrumbs) (aria-label "breadcrumbs"))
        ,@(if home-href
              (list `(a ((class ,(classes ol-crumb ol-crumb-home))
                         ,@(live-link-attributes live home-href))
                        "home"))
              '())
        ,@(append*
           (for/list ([c (in-list path)])
             (list `(span ((class ,ol-crumb-sep) (aria-hidden "true")) "›")
                   (crumb->xexpr c))))))

;; ---- sidebar --------------------------------------------------------------

;; A column that stays put while the outline scrolls — until the screen is a
;; phone's, where there is only one column and it becomes a header.
(define-style ol-sidebar
  #:flex (0 0 ,sidebar-w)
  #:width ,sidebar-w
  #:padding (1.25rem 0.75rem 3rem 1rem)
  #:border-right (1px solid ,line)
  #:background (apply color-mix (in srgb) (,paper 85%) ,paper-2)
  #:overflow-y auto
  #:max-height 100dvh
  #:position sticky
  #:top 0
  [@ media (#:max-width ,phone-max)
     ;; header, not a second full page: cap the height so the outline still
     ;; has room below, and scroll the tree inside rather than the whole view
     #:position static
     #:flex (0 0 auto)
     #:width 100%
     #:max-height 42dvh
     #:border-right 0
     #:border-bottom (1px solid ,line)
     #:padding (0.75rem 1rem)])

(define-style ol-brand #:margin-bottom 1.25rem)

(define-style ol-brand-link
  #:font-weight 600
  #:letter-spacing -0.01em
  #:text-decoration none
  #:color ,ink)

(define-style ol-sidebar-nav #:display flex #:flex-direction column #:gap 0.125rem)

(define-style ol-nav-item
  #:display flex
  #:align-items center
  #:gap 0.5rem
  #:padding (0.25rem 0.5rem)
  #:border-radius ,radius
  #:text-decoration none
  #:color ,ink
  #:font-size 0.875rem
  [(: & hover) #:background ,pill-bg])

(define-style ol-nav-icon #:color ,green #:font-size 0.75rem)

(define-style ol-sidebar-section #:margin-top 1.5rem)

(define-style ol-sidebar-heading
  #:margin (0 0 0.375rem 0.5rem)
  #:font-size ,micro-size
  #:font-weight 600
  #:letter-spacing 0.08em
  #:text-transform uppercase
  #:color ,dim)

(define-style ol-sidebar-empty
  #:margin (0 0 0 0.5rem)
  #:font-size 0.8125rem
  #:color ,dim
  #:font-style italic)

(define-style ol-tree-file [(+ & &) #:margin-top 0.75rem])

(define-style ol-tree-file-label
  #:margin (0 0 0.125rem 0.5rem)
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,dim)

(define-style ol-tree #:list-style none #:margin 0 #:padding 0)

;; SIDEBAR NODES: the same shell as the outline (.ol-node / .ol-row /
;; .ol-children), keyed by the .is-tree modifier — flatter, no connector, one
;; line each. Three components at once, so it is written as one fragment
;; rather than nested under any of them.
(register-fragment!
 (css-expr
  [(> ,(sel ol-node is-tree) ,(sel ol-children))
   #:margin-left 0.75rem
   #:padding-left 0
   #:border-left 0]
  [(> ,(sel ol-node is-tree) ,(sel ol-row))
   #:align-items center
   #:padding (0.0625rem 0.25rem)
   [(: & hover) #:background ,pill-bg]]
  [(> ,(sel ol-node is-tree) ,(sel ol-row) ,(sel ol-toggle)) #:height 1.25rem]))

(define-style ol-tree-link
  #:flex (1 1 auto)
  #:min-width 0
  #:text-decoration none
  #:color ,ink
  #:font-size 0.875rem
  #:white-space nowrap
  #:overflow hidden
  #:text-overflow ellipsis)

;; Sidebar: Today, Starred (placeholder), Home tree (disclosure only).
(define (render-sidebar files-data
                        #:home-href home-href
                        #:today-href today-href
                        #:zoom-base [zoom-base #f]
                        #:live [live #f])
  (define entries (normalize-files-data files-data))
  ;; Disclosure only, and mirror sites stay out of it: the tree is for finding
  ;; a node, and a node is listed where it is defined.
  (define (tree-item tk depth)
    (cond
      [(task? tk)
       (define key (task-key tk))
       (define kids (filter task? (task-children tk)))
       (list
        (node-shell
         #:key key
         #:tree? #t
         ;; sidebar collapse state is its own; the same node can sit expanded
         ;; in the main pane and folded here
         #:collapse-key (string-append "tree-" key)
         #:collapsed? (> depth 0)
         #:row (list `(a ((class ,ol-tree-link)
                          ,@(node-link-attributes live zoom-base key))
                         ,@(map style-md-xexpr (title->inline-xexprs (task-title tk)))))
         #:children (append*
                     (for/list ([c (in-list kids)])
                       (tree-item c (add1 depth))))))]
      [else '()]))
  `(aside ((class ,ol-sidebar) (id "ol-sidebar"))
          (div ((class ,ol-brand))
               (a ((class ,ol-brand-link) ,@(live-link-attributes live home-href))
                  "olai"))
          (nav ((class ,ol-sidebar-nav))
               ,(if today-href
                    `(a ((class ,ol-nav-item) ,@(live-link-attributes live today-href))
                        (span ((class ,ol-nav-icon) (aria-hidden "true")) "◉")
                        "Today")
                    `(span ((class ,ol-nav-item))
                           (span ((class ,ol-nav-icon) (aria-hidden "true")) "◉")
                           "Today")))
          (section ((class ,ol-sidebar-section))
                   (h3 ((class ,ol-sidebar-heading)) "Starred")
                   (p ((class ,ol-sidebar-empty)) "Nothing starred yet"))
          ;; above the tree, not below it: the tree is the one section here
          ;; whose length is the outline's, and a control under it would be a
          ;; scroll away on a big one. A section, like Starred and Home — a
          ;; disclosure would be new machinery for three lines of chrome.
          (section ((class ,ol-sidebar-section))
                   (h3 ((class ,ol-sidebar-heading)) "Prefs")
                   ,(prefs-xexpr))
          (section ((class ,ol-sidebar-section))
                   (h3 ((class ,ol-sidebar-heading)) "Home")
                   ,@(for/list ([e (in-list entries)])
                       (match-define (list label tasks) e)
                       `(div ((class ,ol-tree-file))
                             (div ((class ,ol-tree-file-label)) ,label)
                             (ul ((class ,ol-tree))
                                 ,@(append*
                                    (for/list ([tk (in-list tasks)])
                                      (tree-item tk 0)))))))))

;; ---- page shell -----------------------------------------------------------

;; A file is broken for a moment during every edit. The page keeps the last
;; good content and says so here, with the file:line:col of the offending
;; form — the same location the JSON errors carry.
(define-component (render-error-banner detail #:where [where #f])
  #:class ol-error
  #:css (#:display flex
         #:flex-wrap wrap
         #:gap 0.5rem
         #:align-items baseline
         #:margin-bottom 1.5rem
         #:padding (0.625rem 0.875rem)
         #:border (1px solid ,rose-fg)
         #:border-radius ,radius
         #:background ,rose-bg
         #:color ,rose-fg
         #:font-size 0.8125rem)
  `(div ((class ,ol-error) (role "alert"))
        ,@(if where
              (list `(span ((class ,ol-error-where)) ,where))
              '())
        (span ((class ,ol-error-detail)) ,detail)))

;; file:line:col — long, and the one part worth wrapping anywhere
(define-style ol-error-where
  #:font-family ,mono
  #:font-size 0.75rem
  #:opacity 0.85
  #:overflow-wrap anywhere)

(define-style ol-error-detail #:font-family ,mono #:overflow-wrap anywhere)

;; ---- the stream's health --------------------------------------------------
;;
;; A page whose stream is down looks exactly like a page nobody has edited, and
;; that is the one lie this view can tell. The framework's runtime knows the
;; difference — a clean drop, or a beat that never came — and says so by
;; writing one class on <html>; what that LOOKS like is olai's, and it is
;; nothing at all while the stream is healthy.
;;
;; Two states, two sentences, both of them chrome: this sits outside the live
;; region, because it is about the connection rather than the content, and a
;; swap that replaced it would be the swap it exists to report the absence of.

(define-style ol-stream
  #:display none
  #:position fixed
  #:left 1rem
  #:bottom (apply calc (+ 1rem (apply env safe-area-inset-bottom)))
  #:z-index 18
  #:padding (0.375rem 0.75rem)
  #:border-radius ,radius
  #:border (1px solid ,line)
  #:font-size 0.75rem
  #:box-shadow (0 2px 8px (apply color-mix (in srgb) (,ink 12%) transparent)))

;; One line per state, and the state on <html> picks which. Hidden by default
;; so the healthy page — no class at all — shows neither.
(define-style (ol-stream-connecting ol-stream-stale) #:display none)

(register-fragment!
 (css-expr
  [(,(sel 'html live-connecting-class) ,(sel ol-stream))
   #:display block
   #:border-color ,amber-fg
   #:background ,amber-bg
   #:color ,amber-fg]
  [(,(sel 'html live-connecting-class) ,(sel ol-stream-connecting)) #:display inline]
  [(,(sel 'html live-stale-class) ,(sel ol-stream))
   #:display block
   #:border-color ,rose-fg
   #:background ,rose-bg
   #:color ,rose-fg]
  [(,(sel 'html live-stale-class) ,(sel ol-stream-stale)) #:display inline]))

;; role=status, not alert: this is a condition to notice, not one to interrupt
;; for, and both sentences are already on the page for a reader to reach.
(define (render-stream-status)
  `(div ((class ,ol-stream) (id "ol-stream") (role "status") (aria-live "polite"))
        (span ((class ,ol-stream-connecting)) "reconnecting…")
        (span ((class ,ol-stream-stale)) "showing last known state")))

;; What the live region holds: the banner slot AND the pane, in one container,
;; because a save can change either and they must not be able to disagree about
;; which snapshot they are showing. Everything else on the page — the sidebar,
;; the chat panel, the skin — sits outside it and is never rebuilt.
;;
;; The page's OWN address rides on the live view, and it comes from the route
;; layer — a renderer that guessed it would be guessing a URL, which is how the
;; sidebar's Today link once came to 404. The attributes that make the region
;; re-fetch that address, morph the reply onto itself, and own the back button
;; are the framework's (live/client); what they are pointed AT is olai's.
;; Fixed slot: empty while the outlines load clean, filled while a file is
;; mid-edit. The page keeps showing the last good content underneath, and an
;; empty slot must not leave a gap where the banner would be.
(define-style ol-banner-slot [(: & empty) #:display none])

(define (live-region live banner main)
  (define slot
    ;; fixed slot: the banner is swapped in and out, so it must exist
    ;; (empty) even on a healthy page
    `(div ((class ,ol-banner-slot) (id "ol-banner"))
          ,@(if banner (list banner) '())))
  `(div ,(if live
             (live-region-attributes live)
             ;; a page with no stream (a fragment test) still has the region:
             ;; it is where the content lives, not just where a swap lands
             `((id ,live-region-id)))
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
                     ;; The live view this page belongs to: olai/web/live picks
                     ;; its names, the route layer builds it, and it carries
                     ;; the address of THIS page. #f is a page with no stream —
                     ;; a fragment, a test.
                     #:live [live #f]
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
         (body ((class ,ol-body)
                ,@(if live (live-connect-attributes live) '()))
               ,@(if sidebar (list sidebar) '())
               (main ((class ,ol-main))
                     ,(live-region live banner main))
               ;; only a page that HAS a stream can report one being down
               ,@(if live (list (render-stream-status)) '())
               ,@body-extra)))

;; Serve this, not a bare xexpr: without the doctype browsers fall into
;; quirks mode and the layout collapses. Fragments need no doctype —
;; xexpr->string is enough for those.
(define (page->html-string page)
  (string-append "<!DOCTYPE html>\n" (xexpr->string page)))

;; ---- zoom -----------------------------------------------------------------

(define-style ol-empty #:color ,dim #:font-style italic)

;; A pane with nothing to show: breadcrumbs home, one line saying why.
(define (render-empty-pane message #:home-href home-href #:live [live #f])
  `(div ((class ,(classes ol-pane ol-zoom)) (id "ol-outline"))
        ,(render-breadcrumbs '() #:home-href home-href #:live live)
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
                     #:zoom-base [zoom-base #f]
                     #:toggle-base [toggle-base #f]
                     #:live [live #f]
                     #:docs [docs (hash)])
  `(div ((class ,(classes ol-pane ol-zoom)) (id "ol-outline"))
        ,(render-breadcrumbs crumbs
                             #:zoom-base zoom-base
                             #:home-href home-href
                             #:live live)
        (ul ((class ,(classes ol-outline ol-zoom-root)))
            ,(render-node-fragment tk
                                   #:today today
                                   #:zoom-base zoom-base
                                   #:toggle-base toggle-base
                                   #:live live
                                   #:docs docs
                                   ;; the page IS this node: its document is
                                   ;; what you came here to read
                                   #:doc-expanded? #t))))
