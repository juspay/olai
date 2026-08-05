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
;; IDS — a node's identity is `task-key`, minted by the load layer (its
;; ^anchor, else a hash of its defining file + child ordinals). This module
;; never computes an id: it only decorates one, so renaming a title cannot
;; re-key a permalink, a stored collapse state, or an SSE swap target.
;;
;; STYLES — every class this module draws is DEFINED here, next to the markup
;; that wears it (olai/web/style). Two exceptions, both of them classes this
;; module is not the only one to draw: .sf-pill's shape is the skin's
;; (olai/web/theme), and the markdown classes are web/markdown's, which is what
;; puts them on the markup. The chat panel is an overlay on all of this, so it
;; requires this module, which is what puts its rules last in the cascade.

(require racket/contract
         racket/list
         racket/match
         racket/path
         racket/runtime-path
         (only-in xml cdata xexpr->string)
         (except-in olai/lang/expander #%module-begin)
         ;; the resolved shape of a mirror site (core owns the binding)
         (only-in olai/lang/walk mirror-site? mirror-site-of mirror-site-task)
         olai/dates
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
         ;; the skin, first: tokens and the document's own rules come before
         ;; anything that leans on them (see style.rkt on ordering)
         olai/web/theme
         olai/web/style
         olai/web/markdown)

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
                 #:collapsed? boolean?)
                list?)]
          [render-outline
           (->* (list? #:today string?)
                (#:zoom-base (or/c string? #f) #:toggle-base (or/c string? #f))
                list?)]
          [render-file-section
           (->* (any/c #:today string?)
                (#:zoom-base (or/c string? #f) #:toggle-base (or/c string? #f))
                list?)]
          [render-breadcrumbs
           (->* (list? #:home-href (or/c string? #f))
                (#:zoom-base (or/c string? #f))
                list?)]
          [render-sidebar
           (->* (list? #:home-href string? #:today-href (or/c string? #f))
                (#:zoom-base (or/c string? #f))
                list?)]
          [render-page
           (->* (any/c)
                (#:title string?
                 #:stylesheet-href (or/c string? #f)
                 #:sidebar (or/c list? #f)
                 #:banner (or/c list? #f)
                 #:sse-connect (or/c string? #f)
                 #:live-href (or/c string? #f)
                 #:head-extra list?
                 #:body-extra list?)
                list?)]
          [render-zoom
           (->* (hash? string? #:today string? #:home-href string?)
                (#:zoom-base (or/c string? #f)
                 #:toggle-base (or/c string? #f))
                list?)]
          [render-empty-pane (-> string? #:home-href string? list?)]
          [render-error-banner (->* (string?) (#:where (or/c string? #f)) list?)]
          [page->html-string (-> any/c string?)]
          [node-element-id (->* (string?) (#:site (or/c string? #f)) string?)]
          [web-static-dir (-> path?)]
          [web-static-prefix string?]
          [web-scripts (listof string?)]
          ;; the outline pane's class: the chat panel is the one thing that
          ;; moves it, so the one thing that needs its name
          [sf-main string?])
         ;; re-exported markdown surface (render-time only): contracted by
         ;; the module that owns it, not decorated twice here
         title->inline-xexprs
         note->xexprs
         sanitize-xexpr)

;; ---- static assets --------------------------------------------------------
;;
;; One owner for the whole /static/ surface: the directory the server mounts,
;; the URL prefix it mounts it at, and the files the page pulls in. No JS lives
;; in this module — a script that changes with every SSE tweak has no business
;; recompiling a Racket module, and browsers cannot cache it.
;;
;; The stylesheet is the other way round: it is NOT a file. It is generated
;; from the modules that draw the page (olai/web/skin), and this module cannot
;; name it — skin requires render, so render asking skin for a URL would be a
;; cycle. render-page is TOLD the href, like every other address it links.

(define-runtime-path static-dir "static")
(define (web-static-dir) static-dir)

(define web-static-prefix "/static/")

(define web-scripts '("htmx.min.js" "sse.js" "collapse.js" "chat.js"))

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

(define (href-for base fid)
  (if base
      (string-append base fid)
      (string-append "#" (node-element-id fid))))

;; ---- states ---------------------------------------------------------------
;;
;; The node's states, spelled once. They carry no rules of their own — they
;; qualify the components below, and collapse.js toggles is-collapsed — so
;; they are defined up here where the selectors can reach them.

(define-modifier is-done is-today is-tree is-collapsed has-children)

;; Hooks, not looks: a pane wrapper the SSE swap and the tests address, and a
;; mirror site whose anchor named nothing. Nothing paints them.
(define-modifier sf-pane sf-zoom sf-zoom-root sf-unresolved sf-crumb-home)

;; ---- pills ----------------------------------------------------------------
;;
;; The shape is the skin's (web/theme, .sf-pill) because web/markdown draws one
;; too. Here is what a DATE reads like — and .sf-pill comes first in the
;; cascade, so this repaints it.

(define-style sf-date
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

(define-style sf-day #:font-weight 500)

(define-style sf-date-time
  #:opacity 0.75
  #:font-family ,mono
  #:font-size ,micro-size)

;; ---- one node -------------------------------------------------------------

;; Bare ISO day title -> friendly pill (display-only). ISO stays in the file.
(define (day-pill-xexpr iso-day today done?)
  `(span ((class ,(classes sf-pill sf-date sf-day
                           (and (equal? iso-day today) is-today)
                           (and done? is-done)))
          (title ,iso-day)
          ,@(if (equal? iso-day today) '((data-today "true")) '()))
         ,(friendly-date-label iso-day)))

(define (date-pill-xexpr date today done?)
  (define day (date-day-prefix date))
  `(span ((class ,(classes sf-pill sf-date
                           (and (equal? day today) is-today)
                           (and done? is-done)))
          (title ,date))
         ,(if (bare-iso-date-title? day) (friendly-date-label day) date)
         ,@(if (> (string-length date) 10)
               (list `(span ((class ,sf-date-time)) ,(substring date 11)))
               '())))

;; The shell first: the <li>, the row, the child list. Everything after it
;; sits INSIDE the row, and the selectors that reach in from here need these
;; names to already exist.

(define-style sf-children
  ;; the list reset every outline list wears (.sf-outline and .sf-tree too)
  #:list-style none
  #:margin 0
  #:padding 0
  ;; Workflowy connector: a hairline down the left of a node's children
  #:margin-left ,indent
  #:padding-left 0.75rem
  #:border-left (1px solid (apply color-mix (in srgb)
                                  (,dim 35%) ,line)))

(define-style sf-node
  #:position relative
  ;; collapse is a class on the node; the children are what it hides
  [(> ,(sel '& is-collapsed) ,(sel sf-children)) #:display none])

(define-style sf-row
  #:display flex
  #:align-items flex-start
  #:gap 0.125rem
  #:padding (0.0625rem 0)
  #:border-radius ,radius
  [(: & hover)
   #:background (apply color-mix (in srgb) (,pill-bg 55%) transparent)])

;; disclosure triangle: hidden until hover, like Workflowy
(define-style sf-toggle
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
  [(> (: ,(sel sf-row) hover) &) (: & focus-visible) #:opacity 1]
  ;; folded: the triangle points right, and stays visible saying so
  [(> ,(sel sf-node is-collapsed) ,(sel sf-row) &)
   #:transform (apply rotate 0deg)
   #:opacity 1]
  ;; a touch screen has no hover to reveal it with
  [@ media (#:max-width ,phone-max) #:opacity 1])

(define-style sf-toggle-empty #:cursor default)

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
                    #:done? [done? #f]
                    #:before-row [before-row '()]
                    #:row row
                    #:children [children '()])
  (define has-kids? (pair? children))
  `(li ((class ,(classes sf-node
                         (and tree? is-tree)
                         (and has-kids? has-children)
                         ;; a leaf has nothing to fold
                         (and has-kids? collapsed? is-collapsed)
                         (and done? is-done)))
        ,@(if element-id `((id ,element-id)) '())
        (data-fragment-id ,key)
        ,@(if has-kids? `((data-collapse-key ,collapse-key)) '()))
       ,@before-row
       (div ((class ,sf-row))
            ,(toggle-xexpr has-kids? collapsed?)
            ,@row)
       ,@(if has-kids?
             (list `(ul ((class ,sf-children)) ,@children))
             '())))

;; Hidden until hover, like Workflowy; a leaf keeps the gutter.
(define (toggle-xexpr has-kids? collapsed?)
  (if has-kids?
      `(button ((type "button")
                (class ,sf-toggle)
                (aria-expanded ,(if collapsed? "false" "true"))
                (aria-label "toggle children"))
               "▸")
      `(span ((class ,(classes sf-toggle sf-toggle-empty)) (aria-hidden "true")))))

;; ---- what sits in the row -------------------------------------------------

(define-style sf-bullet-link
  #:display inline-flex
  #:align-items center
  #:height 1.5rem)

(define-style sf-bullet
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
  [(> ,(sel sf-node is-collapsed) (,(sel sf-row) (:: ,(sel '& has-children) before)))
   #:content ""
   #:position absolute
   #:top 50%
   #:left 50%
   #:width 1rem
   #:height 1rem
   #:margin (-0.5rem 0 0 -0.5rem)
   #:border-radius 50%
   #:background ,line]
  [((: ,(sel sf-bullet-link) hover) (:: & after)) #:background ,ink])

(define-style sf-content
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (0.125rem 0))

(define-style sf-line
  #:display flex
  #:flex-wrap wrap
  #:align-items baseline
  #:gap 0.375rem
  #:min-width 0)

;; The bullet is the node; the box only shows up when it matters — on hover,
;; on focus, or once it is checked.
(define-component (checkbox-xexpr key elt-key done? toggle-base)
  #:class sf-check
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
         [((: ,(sel sf-row) hover) &) (: & focus-visible) ,(sel '& is-done) #:opacity 1]
         [,(sel '& is-done) #:color ,green])
  (define label (if done? "☑" "☐"))
  (define common
    `((class ,(classes sf-check (and done? is-done)))
      (title ,(if done? "done" "not done"))))
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
 (css-expr [(: ,(sel 'button sf-check) hover) #:color ,green]))

(define-style sf-title
  #:color ,ink
  #:overflow-wrap anywhere
  ;; done is a state of the NODE; the title is where it reads
  [,(sel '& is-done) (> ,(sel sf-node is-done) (,(sel sf-row) &))
   #:color ,dim
   #:text-decoration line-through])

(define-style sf-dim #:color ,dim)

(define-style sf-note
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

;; A permalink target, not a thing to see.
(define-style sf-anchor #:position absolute #:width 0 #:height 0 #:overflow hidden)

;; Legacy permalink target: explicit ^anchor or bare ISO day title. Node ids
;; are namespaced ("n-…"), so this keeps plain "#anchor" links — mirrors,
;; notes, anything a user wrote — resolving inside the page.
(define (legacy-anchor-xexpr tk)
  (define legacy
    (or (task-id tk)
        (and (bare-iso-date-title? (task-title tk)) (task-title tk))))
  (if legacy
      (list `(a ((class ,sf-anchor) (id ,legacy) (aria-hidden "true"))))
      '()))

(define-style sf-mirror
  #:flex (0 0 auto)
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,rose-fg
  #:text-decoration none
  [(: & hover) #:text-decoration underline])

;; A mirror site whose anchor named nothing. The marker is still drawn — the
;; outline says something belongs here — in its unresolved state.
(define (unresolved-mirror-xexpr anchor)
  `(li ((class ,(classes sf-node sf-unresolved)))
       (div ((class ,sf-row))
            (span ((class ,sf-bullet)))
            (div ((class ,sf-content))
                 (a ((class ,sf-mirror) (href ,(string-append "#" anchor)))
                    "↗" ,anchor)
                 (span ((class ,(classes sf-title sf-dim))) "(unresolved)")))))

(define (render-child child
                      #:site site
                      #:owner owner
                      #:today today
                      #:zoom-base zoom-base
                      #:toggle-base toggle-base)
  (cond
    [(mirror-site? child)
     (define target (mirror-site-task child))
     (if target
         (render-node-fragment target
                               #:site owner
                               #:today today
                               #:mirror-of (mirror-site-of child)
                               #:zoom-base zoom-base
                               #:toggle-base toggle-base)
         (unresolved-mirror-xexpr (mirror-site-of child)))]
    [(task? child)
     (render-node-fragment child
                           #:site site
                           #:today today
                           #:zoom-base zoom-base
                           #:toggle-base toggle-base)]
    [else `(li ((class ,(classes sf-node sf-unresolved))) "???")]))

;; One subtree, self-contained: this is the unit SSE re-swaps.
(define (render-node-fragment tk
                              #:site [site #f]
                              #:today today
                              #:mirror-of [mirror-of #f]
                              #:zoom-base [zoom-base #f]
                              #:toggle-base [toggle-base #f]
                              #:collapsed? [collapsed? #f])
  (define title (task-title tk))
  (define key (task-key tk))
  ;; where this copy of the node sits: #f at its defining site
  (define qkey (site-key site key))
  ;; one switch on the node's state; everything below is drawing
  (define done? (eq? (task-status tk) 'done))
  (define kids (task-children tk))
  (define iso-day (and (bare-iso-date-title? title) title))
  (define title-el
    (if iso-day
        (day-pill-xexpr iso-day today done?)
        `(span ((class ,(classes sf-title (and done? is-done))))
               ,@(map style-md-xexpr (title->inline-xexprs title)))))
  (define bullet
    (let ([dot `(span ((class ,(classes sf-bullet
                                        (and (pair? kids) has-children)))
                       (aria-hidden "true")))])
      (if zoom-base
          `(a ((class ,sf-bullet-link)
               (href ,(href-for zoom-base key))
               (title "zoom in"))
              ,dot)
          dot)))
  (node-shell
   #:key key
   #:element-id (node-element-id key #:site site)
   #:collapse-key qkey
   #:collapsed? collapsed?
   #:done? done?
   ;; the legacy #anchor target belongs to the defining site only
   #:before-row (if site '() (legacy-anchor-xexpr tk))
   #:row
   (list bullet
         ;; the check sits in the gutter, not in the text run, so a title
         ;; and its note stay flush left of each other
         (checkbox-xexpr key qkey done? toggle-base)
         `(div ((class ,sf-content))
               (div ((class ,sf-line))
                    ,@(if mirror-of
                          (list `(a ((class ,sf-mirror)
                                     (href ,(string-append "#" mirror-of))
                                     (title ,(string-append "mirror of ^" mirror-of)))
                                    "↗"))
                          '())
                    ,title-el
                    ,@(if (task-date tk)
                          (list (date-pill-xexpr (task-date tk) today done?))
                          '()))
               ,@(if (task-description tk)
                     (list `(div ((class ,(classes sf-note (and done? is-done))))
                                 ,@(note->xexprs (task-description tk))))
                     '())))
   #:children (for/list ([c (in-list kids)])
                (render-child c
                              #:site site
                              #:owner qkey
                              #:today today
                              #:zoom-base zoom-base
                              #:toggle-base toggle-base))))


;; ---- main pane ------------------------------------------------------------

;; The outline's own list: same reset as .sf-children, no connector — a file's
;; top level has no parent to hang off.
(define-style sf-outline #:list-style none #:margin 0 #:padding 0)

;; Files stack; the gap between two of them is what says they are two.
(define-style sf-file [(+ & &) #:margin-top 2.5rem])

(define-style sf-file-title
  #:margin (0 0 0.75rem 0.25rem)
  #:font-family ,mono
  #:font-size 0.75rem
  #:font-weight 600
  #:letter-spacing 0.06em
  #:text-transform uppercase
  #:color ,dim)

;; One file's section. This is the natural re-render unit for a watcher: a
;; save touches one file, and #sf-file-<label> is what it swaps.
(define (render-file-section entry
                             #:today today
                             #:zoom-base [zoom-base #f]
                             #:toggle-base [toggle-base #f])
  (match-define (list label tasks) (car (normalize-files-data (list entry))))
  `(section ((class ,sf-file)
             (id ,(string-append "sf-file-" (id-safe label)))
             (data-file ,label))
            (h2 ((class ,sf-file-title)) ,label)
            (ul ((class ,sf-outline))
                ,@(for/list ([tk (in-list tasks)])
                    (render-child tk
                                  #:site #f
                                  #:owner (id-safe label)
                                  #:today today
                                  #:zoom-base zoom-base
                                  #:toggle-base toggle-base)))))

(define (render-outline files-data
                        #:today today
                        #:zoom-base [zoom-base #f]
                        #:toggle-base [toggle-base #f])
  `(div ((class ,sf-pane) (id "sf-outline"))
        ,@(for/list ([e (in-list files-data)])
            (render-file-section e
                                 #:today today
                                 #:zoom-base zoom-base
                                 #:toggle-base toggle-base))))

;; ---- chrome ---------------------------------------------------------------

(define-style sf-breadcrumbs
  #:display flex
  #:flex-wrap wrap
  #:align-items center
  #:gap 0.375rem
  #:margin-bottom 1rem
  #:font-size 0.8125rem
  #:color ,dim)

(define-style sf-crumb
  #:text-decoration none
  #:color ,dim)

;; only a crumb you can click answers a hover, and a crumb is a link only
;; when it has somewhere to go
(register-fragment!
 (css-expr [(: ,(sel 'a sf-crumb) hover)
            #:color ,ink
            #:text-decoration underline]))

(define-style sf-crumb-sep #:color ,line)

;; path: (listof crumb) where crumb is "Label" or (list "Label" href-or-fid)
(define (render-breadcrumbs path #:home-href home-href #:zoom-base [zoom-base #f])
  (define (label->xexprs label)
    (map style-md-xexpr (title->inline-xexprs label)))
  (define (crumb->xexpr c)
    (match c
      [(list label target)
       `(a ((class ,sf-crumb) (href ,(if (regexp-match? #px"^[/#]" target)
                                         target
                                         (href-for zoom-base target))))
           ,@(label->xexprs label))]
      [(? string? label) `(span ((class ,sf-crumb)) ,@(label->xexprs label))]
      [_ `(span ((class ,sf-crumb)) ,(format "~a" c))]))
  `(nav ((class ,sf-breadcrumbs) (aria-label "breadcrumbs"))
        ,@(if home-href
              (list `(a ((class ,(classes sf-crumb sf-crumb-home)) (href ,home-href))
                        "home"))
              '())
        ,@(append*
           (for/list ([c (in-list path)])
             (list `(span ((class ,sf-crumb-sep) (aria-hidden "true")) "›")
                   (crumb->xexpr c))))))

;; ---- sidebar --------------------------------------------------------------

;; A column that stays put while the outline scrolls — until the screen is a
;; phone's, where there is only one column and it becomes a header.
(define-style sf-sidebar
  #:flex (0 0 ,sidebar-w)
  #:width ,sidebar-w
  #:padding (1.25rem 0.75rem 3rem 1rem)
  #:border-right (1px solid ,line)
  #:background (apply color-mix (in srgb) (,paper 85%) ,paper-2)
  #:overflow-y auto
  #:max-height 100vh
  #:position sticky
  #:top 0
  [@ media (#:max-width ,phone-max)
     #:position static
     #:flex (0 0 auto)
     #:width 100%
     #:max-height none
     #:border-right 0
     #:border-bottom (1px solid ,line)
     #:padding 1rem])

(define-style sf-brand #:margin-bottom 1.25rem)

(define-style sf-brand-link
  #:font-weight 600
  #:letter-spacing -0.01em
  #:text-decoration none
  #:color ,ink)

(define-style sf-sidebar-nav #:display flex #:flex-direction column #:gap 0.125rem)

(define-style sf-nav-item
  #:display flex
  #:align-items center
  #:gap 0.5rem
  #:padding (0.25rem 0.5rem)
  #:border-radius ,radius
  #:text-decoration none
  #:color ,ink
  #:font-size 0.875rem
  [(: & hover) #:background ,pill-bg])

(define-style sf-nav-icon #:color ,green #:font-size 0.75rem)

(define-style sf-sidebar-section #:margin-top 1.5rem)

(define-style sf-sidebar-heading
  #:margin (0 0 0.375rem 0.5rem)
  #:font-size ,micro-size
  #:font-weight 600
  #:letter-spacing 0.08em
  #:text-transform uppercase
  #:color ,dim)

(define-style sf-sidebar-empty
  #:margin (0 0 0 0.5rem)
  #:font-size 0.8125rem
  #:color ,dim
  #:font-style italic)

(define-style sf-tree-file [(+ & &) #:margin-top 0.75rem])

(define-style sf-tree-file-label
  #:margin (0 0 0.125rem 0.5rem)
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,dim)

(define-style sf-tree #:list-style none #:margin 0 #:padding 0)

;; SIDEBAR NODES: the same shell as the outline (.sf-node / .sf-row /
;; .sf-children), keyed by the .is-tree modifier — flatter, no connector, one
;; line each. Three components at once, so it is written as one fragment
;; rather than nested under any of them.
(register-fragment!
 (css-expr
  [(> ,(sel sf-node is-tree) ,(sel sf-children))
   #:margin-left 0.75rem
   #:padding-left 0
   #:border-left 0]
  [(> ,(sel sf-node is-tree) ,(sel sf-row))
   #:align-items center
   #:padding (0.0625rem 0.25rem)
   [(: & hover) #:background ,pill-bg]]
  [(> ,(sel sf-node is-tree) ,(sel sf-row) ,(sel sf-toggle)) #:height 1.25rem]))

(define-style sf-tree-link
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
                        #:zoom-base [zoom-base #f])
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
         #:row (list `(a ((class ,sf-tree-link) (href ,(href-for zoom-base key)))
                         ,@(map style-md-xexpr (title->inline-xexprs (task-title tk)))))
         #:children (append*
                     (for/list ([c (in-list kids)])
                       (tree-item c (add1 depth))))))]
      [else '()]))
  `(aside ((class ,sf-sidebar) (id "sf-sidebar"))
          (div ((class ,sf-brand))
               (a ((class ,sf-brand-link) (href ,home-href)) "olai"))
          (nav ((class ,sf-sidebar-nav))
               ,(if today-href
                    `(a ((class ,sf-nav-item) (href ,today-href))
                        (span ((class ,sf-nav-icon) (aria-hidden "true")) "◉")
                        "Today")
                    `(span ((class ,sf-nav-item))
                           (span ((class ,sf-nav-icon) (aria-hidden "true")) "◉")
                           "Today")))
          (section ((class ,sf-sidebar-section))
                   (h3 ((class ,sf-sidebar-heading)) "Starred")
                   (p ((class ,sf-sidebar-empty)) "Nothing starred yet"))
          (section ((class ,sf-sidebar-section))
                   (h3 ((class ,sf-sidebar-heading)) "Home")
                   ,@(for/list ([e (in-list entries)])
                       (match-define (list label tasks) e)
                       `(div ((class ,sf-tree-file))
                             (div ((class ,sf-tree-file-label)) ,label)
                             (ul ((class ,sf-tree))
                                 ,@(append*
                                    (for/list ([tk (in-list tasks)])
                                      (tree-item tk 0)))))))))

;; ---- page shell -----------------------------------------------------------

;; A file is broken for a moment during every edit. The page keeps the last
;; good content and says so here, with the file:line:col of the offending
;; form — the same location the JSON errors carry.
(define-component (render-error-banner detail #:where [where #f])
  #:class sf-error
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
  `(div ((class ,sf-error) (role "alert"))
        ,@(if where
              (list `(span ((class ,sf-error-where)) ,where))
              '())
        (span ((class ,sf-error-detail)) ,detail)))

;; file:line:col — long, and the one part worth wrapping anywhere
(define-style sf-error-where
  #:font-family ,mono
  #:font-size 0.75rem
  #:opacity 0.85
  #:overflow-wrap anywhere)

(define-style sf-error-detail #:font-family ,mono #:overflow-wrap anywhere)

;; What an `outline` event re-swaps: the banner slot AND the pane, in one
;; container, because a save can change either and they must not be able to
;; disagree about which snapshot they are showing.
;;
;; `live-href` is the page's OWN address, and it comes from the route layer —
;; a renderer that guessed it would be guessing a URL, which is how the
;; sidebar's Today link once came to 404. The container re-fetches that page
;; and lifts itself back out of the reply (hx-select), so one handler serves
;; both the first load and every swap.
;; Fixed slot: empty while the outlines load clean, filled while a file is
;; mid-edit. The page keeps showing the last good content underneath, and an
;; empty slot must not leave a gap where the banner would be.
(define-style sf-banner-slot [(: & empty) #:display none])

(define (live-region live-href banner main)
  (define slot
    ;; fixed slot: the banner is swapped in and out, so it must exist
    ;; (empty) even on a healthy page
    `(div ((class ,sf-banner-slot) (id "sf-banner"))
          ,@(if banner (list banner) '())))
  (if live-href
      `(div ((id "sf-live")
             (hx-get ,live-href)
             (hx-trigger "sse:outline")
             (hx-select "#sf-live")
             (hx-target "#sf-live")
             (hx-swap "outerHTML"))
            ,slot
            ,main)
      `(div ((id "sf-live")) ,slot ,main)))

;; The reading column: it takes what the sidebar leaves and stops growing
;; where a line stops being readable.
(define-style sf-main
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (2rem 2rem 6rem)
  #:max-width 56rem
  [@ media (#:max-width ,phone-max) #:padding (1.25rem 1rem 4rem)])

(define (render-page main
                     #:title [title "olai"]
                     ;; the generated sheet's URL, from the route layer (see
                     ;; olai/web/skin). #f is a page with no skin at all — a
                     ;; fragment test, never a served page.
                     #:stylesheet-href [stylesheet-href #f]
                     #:sidebar [sidebar #f]
                     #:banner [banner #f]
                     #:sse-connect [sse-connect #f]
                     #:live-href [live-href #f]
                     #:head-extra [head-extra '()]
                     #:body-extra [body-extra '()])
  `(html ((lang "en"))
         (head
          (meta ((charset "utf-8")))
          (meta ((name "viewport")
                 (content "width=device-width, initial-scale=1, viewport-fit=cover")))
          (meta ((name "color-scheme") (content "light dark")))
          (title ,title)
          ,@(if stylesheet-href
                (list `(link ((rel "stylesheet") (href ,stylesheet-href))))
                '())
          ,@(for/list ([name (in-list web-scripts)])
              `(script ((src ,(static-href name)) (defer "defer"))))
          ,@head-extra)
         (body ((class ,sf-body)
                ,@(if sse-connect
                      `((hx-ext "sse") (sse-connect ,sse-connect))
                      '()))
               ,@(if sidebar (list sidebar) '())
               (main ((class ,sf-main))
                     ,(live-region live-href banner main))
               ,@body-extra)))

;; Serve this, not a bare xexpr: without the doctype browsers fall into
;; quirks mode and the layout collapses. Fragments need no doctype —
;; xexpr->string is enough for those.
(define (page->html-string page)
  (string-append "<!DOCTYPE html>\n" (xexpr->string page)))

;; ---- zoom -----------------------------------------------------------------

(define-style sf-empty #:color ,dim #:font-style italic)

;; A pane with nothing to show: breadcrumbs home, one line saying why.
(define (render-empty-pane message #:home-href home-href)
  `(div ((class ,(classes sf-pane sf-zoom)) (id "sf-outline"))
        ,(render-breadcrumbs '() #:home-href home-href)
        (p ((class ,sf-empty)) ,message)))

;; Breadcrumbs + the focused subtree.
;;
;; `index` is the store's node index: key -> (list task crumbs), where crumbs
;; is the trail from the file label down to and including the node, each crumb
;; a (list label key) with key #f for the file label itself. Nothing here
;; recomputes an id or walks a tree — zoom is a hash lookup.
(define (render-zoom index key
                     #:today today
                     #:home-href home-href
                     #:zoom-base [zoom-base #f]
                     #:toggle-base [toggle-base #f])
  (define hit (hash-ref index key #f))
  (cond
    [(not hit) (render-empty-pane "No such node." #:home-href home-href)]
    [else
     (match-define (list tk crumbs) hit)
     ;; drop the node's own crumb; the file label has no node to zoom to
     (define ancestors
       (for/list ([c (in-list (drop-right crumbs 1))])
         (match-define (list label k) c)
         (if k (list label k) label)))
     `(div ((class ,(classes sf-pane sf-zoom)) (id "sf-outline"))
           ,(render-breadcrumbs ancestors #:zoom-base zoom-base #:home-href home-href)
           (ul ((class ,(classes sf-outline sf-zoom-root)))
               ,(render-node-fragment tk
                                      #:today today
                                      #:zoom-base zoom-base
                                      #:toggle-base toggle-base)))]))
