#lang racket/base

;; ONE NODE: the shell both panes wear, and what sits in its row.
;;
;; The <li> with its collapse state, the disclosure toggle, the row, and the
;; child list — plus the bullet, the title and the note that fill the row. The
;; outline pane stacks these (web/outline); the sidebar tree draws the same
;; shell flatter and puts a link in the row instead (web/sidebar). They differ
;; in what goes IN the row and in one modifier class, never in the markup and
;; never in the selectors CSS and JS have to know about.
;;
;; The parts with a look of their own are their own modules: the pills
;; (web/pills), the checkbox (web/checkbox), the document a node expands into
;; (web/document). What is left here is the shell and the text.
;;
;; DATA IN — a RESOLVED task (olai/lang/walk, resolve-mirrors): every mirror
;; site already carries the node it mirrors. This module draws what it is given
;; and looks nothing up, so an unresolved mirror is a state a marker is drawn
;; in rather than a hash miss in the middle of a recursion. Ids are the load
;; layer's and web/address decorates them; nothing here computes one.

(require racket/contract
         (except-in olai/lang/expander #%module-begin)
         ;; the resolved shape of a mirror site (core owns the binding)
         (only-in olai/lang/walk mirror-site? mirror-site-of mirror-site-task)
         olai/dates
         olai/web/theme
         olai/web/style
         olai/web/markdown
         (only-in olai/web/states
                  is-done is-doing is-tree is-collapsed has-children state-class)
         (only-in olai/web/address node-element-id site-key node-link-attributes)
         (only-in olai/web/pills day-pill-xexpr date-pill-xexpr doing-pill-xexpr)
         (only-in olai/web/checkbox checkbox-xexpr ol-check)
         (only-in olai/web/document doc-block))

(provide (contract-out
          [render-node-fragment
           (->* (task? #:today string?)
                (#:site (or/c string? #f)
                 #:mirror-of (or/c string? #f)
                 #:zoom-base (or/c string? #f)
                 #:toggle-base (or/c string? #f)
                 #:docs hash?
                 #:doc-expanded? boolean?
                 #:collapsed? boolean?)
                list?)])
         ;; The seam between modules in one layer, so plain `provide` and no
         ;; contract: the outline pane stacks these (render-child), the sidebar
         ;; draws the same shell flatter (node-shell) and reaches into these
         ;; class names to do it.
         render-child
         node-shell
         ol-node ol-children ol-row ol-toggle ol-unresolved)

;; Hooks, not looks: a mirror site whose anchor named nothing. Nothing paints
;; it; the marker below wears it and the tests read it.
(define-modifier ol-unresolved)

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

;; Hovering the ROW reveals the checkbox in its gutter. The subject is the box
;; (web/checkbox paints the rest of it) but the condition is this row's, and a
;; rule cannot be in two modules — so it is here, with the hover it belongs to.
;; Same shape as the chat panel's one rule about .ol-main.
(register-fragment!
 (css-expr [((: ,(sel ol-row) hover) ,(sel ol-check)) #:opacity 1]))

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
                               #:docs docs)
         (unresolved-mirror-xexpr (mirror-site-of child)))]
    [(task? child)
     (render-node-fragment child
                           #:site site
                           #:today today
                           #:zoom-base zoom-base
                           #:toggle-base toggle-base
                           #:docs docs)]
    [else `(li ((class ,(classes ol-node ol-unresolved))) "???")]))

;; One subtree, self-contained: this is the unit SSE re-swaps.
(define (render-node-fragment tk
                              #:site [site #f]
                              #:today today
                              #:mirror-of [mirror-of #f]
                              #:zoom-base [zoom-base #f]
                              #:toggle-base [toggle-base #f]
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
             ,@(node-link-attributes zoom-base key)
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
   #:after-row (doc-block tk docs doc-expanded? zoom-base)
   #:children (for/list ([c (in-list kids)])
                (render-child c
                              #:site site
                              #:owner qkey
                              #:today today
                              #:zoom-base zoom-base
                              #:toggle-base toggle-base
                              #:docs docs))))

