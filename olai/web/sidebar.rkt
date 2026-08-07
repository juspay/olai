#lang racket/base

;; THE SIDEBAR: brand, Today, Starred, the prefs picker, and the file tree.
;;
;; A live REGION of its own, on the same stream as the outline. It draws the
;; same node titles the outline pane does, from the same file, so an edit that
;; renamed a node used to leave the tree showing the old name until somebody
;; reloaded. It re-fetches the page and lifts itself back out of the reply, the
;; way the outline does.
;;
;; It is still chrome as far as NAVIGATION goes: no link targets it, so
;; clicking through the outline never rebuilds it. The two halves of "live" are
;; different questions, and this surface answers them differently.
;;
;; The tree is disclosure only, and mirror sites stay out of it: it is for
;; FINDING a node, and a node is listed where it is defined.

(require racket/contract
         racket/list
         racket/match
         ;; a region of its own, and links into the outline's: this module
         ;; writes no htmx attribute by hand (live/README.md)
         live/dsl
         (only-in olai/web/live outline-events ol-live)
         (except-in olai/lang/expander #%module-begin)
         ;; which of the loaded outlines is the day journal — by its basename,
         ;; the way the archive is recognised (olai/journal, olai/archive)
         (only-in olai/journal daily-file?)
         olai/web/theme
         olai/web/style
         olai/web/markdown
         (only-in olai/web/address node-link-attributes)
         (only-in olai/web/states is-tree)
         (only-in olai/web/node node-shell ol-node ol-children ol-row ol-toggle)
         (only-in olai/web/outline normalize-files-data)
         ;; the journal's entry, which is a month rather than a file name
         (only-in olai/web/calendar render-month-calendar)
         ;; what makes a row open the search palette. The palette itself is
         ;; drawn outside every region and is not on the screen until it is
         ;; asked for (web/search); this is where it is asked for, next to the
         ;; other ways around the outline
         (only-in olai/web/search search-toggle-attributes)
         ;; the picker this places, and the boot script that restores what it
         ;; picked. Required here rather than by the page: the sidebar is the
         ;; one thing that draws it
         olai/web/prefs)

(provide (contract-out
          ;; #:href is the page's own address, because this is a region: it
          ;; re-fetches that page and lifts itself out of the reply whenever
          ;; the outline moves
          [render-sidebar
           (-> list? #:home-href string?
               #:archive-href string?
               ;; what day it is, as a string: the journal's entry is the month
               ;; around it, and this layer reads no clock (olai/arch)
               #:today string?
               ;; the node THIS page is about, or #f. Chrome that draws the
               ;; same node the pane does has to be able to say which one you
               ;; are on; #f is every page that is not about one node
               #:current-key (or/c string? #f)
               #:href string? #:node-href (-> string? string?)
               list?)]))

;; The binding's name IS the element id, always: that is what keeps `#ol-sidebar`
;; from being written anywhere. The CSS class this element also wears wanted the
;; same word and gave it up — it is `ol-sidebar-col` below, which says what it
;; is (the column) rather than what it is called.
;;
;; `#:history? #f` is the page-global decision two regions force: htmx honours
;; the FIRST history element in the document, and Back has to restore the
;; outline. This one yields, exactly as the counters example's ticker does.
(define-live-region ol-sidebar #:stream outline-events #:history? #f)

;; A column that stays put while the outline scrolls — until the screen is a
;; phone's, where there is only one column and it becomes a header.
(define-style ol-sidebar-col
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

;; A row that is a BUTTON and not a link: everything a button brings with it,
;; undone, so it reads as one more line of the nav and not as a control.
(define-style ol-nav-button
  #:width 100%
  #:border 0
  #:background none
  #:font-family inherit
  #:text-align left
  #:cursor pointer)

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
                        #:today today
                        #:current-key current-key
                        #:href href
                        #:archive-href archive-href
                        #:node-href node-href)
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
         ;; This region's own id for the node, which is the point of minting
         ;; them by region: the outline is showing the same node under
         ;; `ol-live-<key>`, and morph has to be able to tell the two copies
         ;; apart or a swap of one would go looking in the other.
         #:element-id (live-id ol-sidebar key)
         #:tree? #t
         ;; sidebar collapse state is its own; the same node can sit expanded
         ;; in the main pane and folded here
         #:collapse-key (string-append "tree-" key)
         #:collapsed? (> depth 0)
         #:row (list `(a ((class ,ol-tree-link)
                          ,@(node-link-attributes node-href key))
                         ,@(map style-md-xexpr (title->inline-xexprs (task-title tk)))))
         #:children (append*
                     (for/list ([c (in-list kids)])
                       (tree-item c (add1 depth))))))]
      [else '()]))
  ;; A navigation swaps the OUTLINE, so this region keeps the hx-get it was
  ;; drawn with — after a click on a node the sidebar still re-fetches whatever
  ;; page drew it. Harmless, and not luck: the tree is the whole outline and
  ;; says the same thing on every page, so any address answers with the same
  ;; #ol-sidebar.
  `(aside ((class ,ol-sidebar-col) ,@(live-region ol-sidebar #:href href))
          (div ((class ,ol-brand))
               (a ((class ,ol-brand-link) ,@(live-link ol-live home-href))
                  "olai"))
          ;; TODAY IS NOT A ROW ANY MORE. It was one when the sidebar had no
          ;; other way to reach the day you are in; the calendar below is that
          ;; way, and it says which day today IS rather than promising to find
          ;; out. A row that duplicates a control three inches down the same
          ;; column is a row that has to be read twice and means once. The
          ;; ROUTE stays — /today is an address an agent, a bookmark and a home
          ;; screen all still name (docs/cli.md).
          ;;
          ;; Archive is not that: it is a whole outline nothing else here draws,
          ;; so it keeps its row. A link and not a section like Starred, because
          ;; what is behind it is a page.
          (nav ((class ,ol-sidebar-nav))
               (a ((class ,ol-nav-item) ,@(live-link ol-live archive-href))
                  (span ((class ,ol-nav-icon) (aria-hidden "true")) "▤")
                  "Archive")
               ;; And the second row is not a link at all: Search has nowhere to
               ;; GO. The palette opens over the page you are on, and `/` opens
               ;; it without coming here — this is the way in for a finger, and
               ;; for anyone who has not learned the slash. Last of the two,
               ;; because the one above it is a place and this is an action.
               (button ((type "button") (class ,(classes ol-nav-item ol-nav-button))
                        ,@(search-toggle-attributes))
                       (span ((class ,ol-nav-icon) (aria-hidden "true")) "⌕")
                       "Search"))
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
                             ;; The day journal is the one root whose entry is
                             ;; not its name. A month IS its table of contents
                             ;; — the tree under it would be a year, twelve
                             ;; months and a list of dates to scroll — so the
                             ;; calendar stands where the label and the tree
                             ;; would have, and reaches the same nodes.
                             ,@(if (daily-file? label)
                                   (list (render-month-calendar
                                          tasks
                                          #:today today
                                          #:current-key current-key
                                          #:node-href node-href))
                                   (list
                                    `(div ((class ,ol-tree-file-label)) ,label)
                                    `(ul ((class ,ol-tree))
                                         ,@(append*
                                            (for/list ([tk (in-list tasks)])
                                              (tree-item tk 0)))))))))))

