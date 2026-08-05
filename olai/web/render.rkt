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

(require racket/contract
         racket/list
         racket/match
         racket/path
         racket/string
         racket/runtime-path
         (only-in json jsexpr->string)
         (only-in xml cdata xexpr->string)
         (except-in olai/lang/expander #%module-begin)
         ;; the resolved shape of a mirror site (core owns the binding)
         (only-in olai/lang/walk mirror-site? mirror-site-of mirror-site-task)
         olai/dates
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
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
          [render-chat-panel
           (->* ((listof hash?)
                 #:send-href string? #:new-href string? #:cancel-href string?
                 #:sessions-href string? #:load-href string?
                 #:event string?)
                (#:model (or/c string? #f)
                 #:session-title (or/c string? #f)
                 #:commands (listof hash?))
                list?)]
          [render-empty-pane (-> string? #:home-href string? list?)]
          [render-error-banner (->* (string?) (#:where (or/c string? #f)) list?)]
          [page->html-string (-> any/c string?)]
          [node-element-id (->* (string?) (#:site (or/c string? #f)) string?)]
          [web-static-dir (-> path?)]
          [web-static-prefix string?]
          [web-stylesheets (listof string?)]
          [web-scripts (listof string?)])
         ;; re-exported markdown surface (render-time only): contracted by
         ;; the module that owns it, not decorated twice here
         title->inline-xexprs
         note->xexprs
         sanitize-xexpr)

;; ---- static assets --------------------------------------------------------
;;
;; One owner for the whole /static/ surface: the directory the server mounts,
;; the URL prefix it mounts it at, and the files the page pulls in. No JS or
;; CSS lives in this module — a script that changes with every SSE tweak has
;; no business recompiling a Racket module, and browsers cannot cache it.

(define-runtime-path static-dir "static")
(define (web-static-dir) static-dir)

(define web-static-prefix "/static/")

(define web-stylesheets '("app.css"))
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

(define (classes . parts)
  (string-join (filter values parts) " "))

;; ---- one node -------------------------------------------------------------

;; Bare ISO day title -> friendly pill (display-only). ISO stays in the file.
(define (day-pill-xexpr iso-day today done?)
  `(span ((class ,(classes "sf-pill" "sf-date" "sf-day"
                           (and (equal? iso-day today) "is-today")
                           (and done? "is-done")))
          (title ,iso-day)
          ,@(if (equal? iso-day today) '((data-today "true")) '()))
         ,(friendly-date-label iso-day)))

(define (date-pill-xexpr date today done?)
  (define day (date-day-prefix date))
  `(span ((class ,(classes "sf-pill" "sf-date"
                           (and (equal? day today) "is-today")
                           (and done? "is-done")))
          (title ,date))
         ,(if (bare-iso-date-title? day) (friendly-date-label day) date)
         ,@(if (> (string-length date) 10)
               (list `(span ((class "sf-date-time")) ,(substring date 11)))
               '())))

(define (checkbox-xexpr key elt-key done? toggle-base)
  (define label (if done? "☑" "☐"))
  (define common
    `((class ,(classes "sf-check" (and done? "is-done")))
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

;; Legacy permalink target: explicit ^anchor or bare ISO day title. Node ids
;; are namespaced ("n-…"), so this keeps plain "#anchor" links — mirrors,
;; notes, anything a user wrote — resolving inside the page.
(define (legacy-anchor-xexpr tk)
  (define legacy
    (or (task-id tk)
        (and (bare-iso-date-title? (task-title tk)) (task-title tk))))
  (if legacy
      (list `(a ((class "sf-anchor") (id ,legacy) (aria-hidden "true"))))
      '()))

;; A mirror site whose anchor named nothing. The marker is still drawn — the
;; outline says something belongs here — in its unresolved state.
(define (unresolved-mirror-xexpr anchor)
  `(li ((class "sf-node sf-unresolved"))
       (div ((class "sf-row"))
            (span ((class "sf-bullet")))
            (div ((class "sf-content"))
                 (a ((class "sf-mirror") (href ,(string-append "#" anchor)))
                    "↗" ,anchor)
                 (span ((class "sf-title sf-dim")) "(unresolved)")))))

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
    [else `(li ((class "sf-node sf-unresolved")) "???")]))

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
  `(li ((class ,(classes "sf-node"
                         (and tree? "is-tree")
                         (and has-kids? "has-children")
                         ;; a leaf has nothing to fold
                         (and has-kids? collapsed? "is-collapsed")
                         (and done? "is-done")))
        ,@(if element-id `((id ,element-id)) '())
        (data-fragment-id ,key)
        ,@(if has-kids? `((data-collapse-key ,collapse-key)) '()))
       ,@before-row
       (div ((class "sf-row"))
            ,(toggle-xexpr has-kids? collapsed?)
            ,@row)
       ,@(if has-kids?
             (list `(ul ((class "sf-children")) ,@children))
             '())))

;; Hidden until hover, like Workflowy; a leaf keeps the gutter.
(define (toggle-xexpr has-kids? collapsed?)
  (if has-kids?
      `(button ((type "button")
                (class "sf-toggle")
                (aria-expanded ,(if collapsed? "false" "true"))
                (aria-label "toggle children"))
               "▸")
      `(span ((class "sf-toggle sf-toggle-empty") (aria-hidden "true")))))

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
        `(span ((class ,(classes "sf-title" (and done? "is-done"))))
               ,@(map style-md-xexpr (title->inline-xexprs title)))))
  (define bullet
    (let ([dot `(span ((class ,(classes "sf-bullet"
                                        (and (pair? kids) "has-children")))
                       (aria-hidden "true")))])
      (if zoom-base
          `(a ((class "sf-bullet-link")
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
         `(div ((class "sf-content"))
               (div ((class "sf-line"))
                    ,@(if mirror-of
                          (list `(a ((class "sf-mirror")
                                     (href ,(string-append "#" mirror-of))
                                     (title ,(string-append "mirror of ^" mirror-of)))
                                    "↗"))
                          '())
                    ,title-el
                    ,@(if (task-date tk)
                          (list (date-pill-xexpr (task-date tk) today done?))
                          '()))
               ,@(if (task-description tk)
                     (list `(div ((class ,(classes "sf-note" (and done? "is-done"))))
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

;; One file's section. This is the natural re-render unit for a watcher: a
;; save touches one file, and #sf-file-<label> is what it swaps.
(define (render-file-section entry
                             #:today today
                             #:zoom-base [zoom-base #f]
                             #:toggle-base [toggle-base #f])
  (match-define (list label tasks) (car (normalize-files-data (list entry))))
  `(section ((class "sf-file")
             (id ,(string-append "sf-file-" (id-safe label)))
             (data-file ,label))
            (h2 ((class "sf-file-title")) ,label)
            (ul ((class "sf-outline"))
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
  `(div ((class "sf-pane") (id "sf-outline"))
        ,@(for/list ([e (in-list files-data)])
            (render-file-section e
                                 #:today today
                                 #:zoom-base zoom-base
                                 #:toggle-base toggle-base))))

;; ---- chrome ---------------------------------------------------------------

;; path: (listof crumb) where crumb is "Label" or (list "Label" href-or-fid)
(define (render-breadcrumbs path #:home-href home-href #:zoom-base [zoom-base #f])
  (define (label->xexprs label)
    (map style-md-xexpr (title->inline-xexprs label)))
  (define (crumb->xexpr c)
    (match c
      [(list label target)
       `(a ((class "sf-crumb") (href ,(if (regexp-match? #px"^[/#]" target)
                                          target
                                          (href-for zoom-base target))))
           ,@(label->xexprs label))]
      [(? string? label) `(span ((class "sf-crumb")) ,@(label->xexprs label))]
      [_ `(span ((class "sf-crumb")) ,(format "~a" c))]))
  `(nav ((class "sf-breadcrumbs") (aria-label "breadcrumbs"))
        ,@(if home-href
              (list `(a ((class "sf-crumb sf-crumb-home") (href ,home-href)) "home"))
              '())
        ,@(append*
           (for/list ([c (in-list path)])
             (list `(span ((class "sf-crumb-sep") (aria-hidden "true")) "›")
                   (crumb->xexpr c))))))

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
         #:row (list `(a ((class "sf-tree-link") (href ,(href-for zoom-base key)))
                         ,@(map style-md-xexpr (title->inline-xexprs (task-title tk)))))
         #:children (append*
                     (for/list ([c (in-list kids)])
                       (tree-item c (add1 depth))))))]
      [else '()]))
  `(aside ((class "sf-sidebar") (id "sf-sidebar"))
          (div ((class "sf-brand"))
               (a ((class "sf-brand-link") (href ,home-href)) "olai"))
          (nav ((class "sf-sidebar-nav"))
               ,(if today-href
                    `(a ((class "sf-nav-item") (href ,today-href))
                        (span ((class "sf-nav-icon") (aria-hidden "true")) "◉")
                        "Today")
                    `(span ((class "sf-nav-item"))
                           (span ((class "sf-nav-icon") (aria-hidden "true")) "◉")
                           "Today")))
          (section ((class "sf-sidebar-section"))
                   (h3 ((class "sf-sidebar-heading")) "Starred")
                   (p ((class "sf-sidebar-empty")) "Nothing starred yet"))
          (section ((class "sf-sidebar-section"))
                   (h3 ((class "sf-sidebar-heading")) "Home")
                   ,@(for/list ([e (in-list entries)])
                       (match-define (list label tasks) e)
                       `(div ((class "sf-tree-file"))
                             (div ((class "sf-tree-file-label")) ,label)
                             (ul ((class "sf-tree"))
                                 ,@(append*
                                    (for/list ([tk (in-list tasks)])
                                      (tree-item tk 0)))))))))

;; ---- page shell -----------------------------------------------------------

;; A file is broken for a moment during every edit. The page keeps the last
;; good content and says so here, with the file:line:col of the offending
;; form — the same location the JSON errors carry.
(define (render-error-banner detail #:where [where #f])
  `(div ((class "sf-error") (role "alert"))
        ,@(if where
              (list `(span ((class "sf-error-where")) ,where))
              '())
        (span ((class "sf-error-detail")) ,detail)))

;; What an `outline` event re-swaps: the banner slot AND the pane, in one
;; container, because a save can change either and they must not be able to
;; disagree about which snapshot they are showing.
;;
;; `live-href` is the page's OWN address, and it comes from the route layer —
;; a renderer that guessed it would be guessing a URL, which is how the
;; sidebar's Today link once came to 404. The container re-fetches that page
;; and lifts itself back out of the reply (hx-select), so one handler serves
;; both the first load and every swap.
(define (live-region live-href banner main)
  (define slot
    ;; fixed slot: the banner is swapped in and out, so it must exist
    ;; (empty) even on a healthy page
    `(div ((class "sf-banner-slot") (id "sf-banner"))
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

(define (render-page main
                     #:title [title "olai"]
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
          ,@(for/list ([name (in-list web-stylesheets)])
              `(link ((rel "stylesheet") (href ,(static-href name)))))
          ,@(for/list ([name (in-list web-scripts)])
              `(script ((src ,(static-href name)) (defer "defer"))))
          ,@head-extra)
         (body ((class "sf-body")
                ,@(if sse-connect
                      `((hx-ext "sse") (sse-connect ,sse-connect))
                      '()))
               ,@(if sidebar (list sidebar) '())
               (main ((class "sf-main"))
                     ,(live-region live-href banner main))
               ,@body-extra)))

;; Serve this, not a bare xexpr: without the doctype browsers fall into
;; quirks mode and the layout collapses. Fragments need no doctype —
;; xexpr->string is enough for those.
(define (page->html-string page)
  (string-append "<!DOCTYPE html>\n" (xexpr->string page)))

;; ---- chat panel -----------------------------------------------------------
;;
;; The agent's conversation, replayed from the bridge's transcript (frames are
;; ephemeral: a browser that connects late, or reloads, missed them). From
;; there static/chat.js keeps it live off the page's ONE SSE connection.
;;
;; The URLs are the route layer's, and so is the SSE event name — a renderer
;; that spelled "chat" here would be a second owner of the wire format.
;;
;; What is Markdown and what is not: a FINISHED turn's agent text gets the
;; same treatment a note gets. A running or failed turn's text is a fragment,
;; so it stays verbatim (chat.js accumulates chunks as text and swaps in the
;; server's HTML when the `done` frame lands). User text and tool titles are
;; never Markdown — they are strings in an xexpr, which is what escapes them.

(define tool-glyphs #hash(("completed" . "✓") ("failed" . "✗")))

(define (chat-tool-xexpr t)
  (define status (chat-string t 'status "pending"))
  `(div ((class "sf-chat-tool")
         (data-tool-id ,(chat-string t 'id ""))
         (data-status ,status))
        (span ((class "sf-chat-tool-glyph")) ,(hash-ref tool-glyphs status "⚙"))
        (span ((class "sf-chat-tool-title")) ,(chat-string t 'title ""))))

;; A transcript field is JSON: a missing one and an explicit null are the
;; same nothing, and neither may reach xexpr->string.
(define (chat-string h k [default #f])
  (define v (hash-ref h k #f))
  (if (string? v) v default))

(define (chat-turn-xexpr e)
  (define status (chat-string e 'status "done"))
  (define text (chat-string e 'agent ""))
  (define stop (chat-string e 'stopReason))
  (define err (chat-string e 'error))
  `(div ((class "sf-chat-turn"))
        (div ((class "sf-chat-msg is-user")) ,(chat-string e 'text ""))
        (div ((class "sf-chat-msg is-agent"))
             ,@(if (equal? status "done")
                   (note->xexprs text)
                   (list text)))
        ,@(for/list ([t (in-list (hash-ref e 'tools '()))]
                     #:when (hash? t))
            (chat-tool-xexpr t))
        ,@(if err (list `(div ((class "sf-chat-msg is-error")) ,err)) '())
        ,@(if (and stop (not (equal? stop "end_turn")))
              (list `(div ((class "sf-chat-note")) ,stop))
              '())))

;; Not a turn: the conversation moved. A live `reset` clears the panel; a
;; replayed one is a line across it, because the turns above it happened.
(define (chat-marker-xexpr e)
  (define type (chat-string e 'type ""))
  `(div ((class "sf-chat-sep"))
        ,(or (chat-string e 'message) (if (equal? type "reset") "new chat" type))))

(define (chat-entry-xexpr e)
  (if (equal? (chat-string e 'type "") "turn")
      (chat-turn-xexpr e)
      (chat-marker-xexpr e)))

(define (render-chat-panel transcript
                           #:send-href send-href
                           #:new-href new-href
                           #:cancel-href cancel-href
                           #:sessions-href sessions-href
                           #:load-href load-href
                           #:event event
                           #:model [model #f]
                           #:session-title [session-title #f]
                           #:commands [commands '()])
  ;; A turn was still running when this page was rendered: the panel comes up
  ;; in that state (input disabled, stop showing) rather than idle.
  (define busy?
    (for/or ([e (in-list transcript)]) (equal? (chat-string e 'status) "running")))
  `(div ((class "sf-chat-dock"))
        (button ((type "button") (class "sf-chat-open") (data-chat-toggle "")
                 (aria-label "open the agent panel"))
                ">_ agent")
        ;; The agent's slash commands, replayed onto the panel: chat.js reads
        ;; them at init so a reloaded page completes immediately, and a
        ;; `commands` frame replaces them from there. JSON in an attribute —
        ;; the xexpr layer is what escapes it, same as any other string here.
        (aside ((class ,(classes "sf-chat" (and busy? "is-busy")
                                 ;; nothing to offer, nothing to press: the
                                 ;; commands button is a class away (app.css),
                                 ;; so a `commands` frame can bring it back
                                 (and (pair? commands) "has-commands")))
                (id "sf-chat")
                (data-commands ,(jsexpr->string commands)))
               (div ((class "sf-chat-head"))
                    ;; Which model, when the bridge has heard one — never a
                    ;; placeholder. Its own span, and the separator is the
                    ;; span's (app.css), so a `model` frame sets one string.
                    (span ((class "sf-chat-title")) "agent · claude code"
                          (span ((class "sf-chat-model") (id "sf-chat-model"))
                                ,(or model ""))
                          ;; A running turn is visible on the floating toggle,
                          ;; which an OPEN panel hides — so the header carries
                          ;; the same signal. Always drawn, shown by is-busy
                          ;; (app.css), which the server sets for a turn in
                          ;; flight and chat.js moves from there.
                          (span ((class "sf-chat-working") (title "working")))
                          ;; Which conversation, when it has a name. Same
                          ;; pattern as the model, one line down: a `session`
                          ;; frame sets one string, and an empty one takes the
                          ;; line away with it.
                          (span ((class "sf-chat-session") (id "sf-chat-session"))
                                ,(or session-title "")))
                    (div ((class "sf-chat-actions"))
                         ;; The conversations the agent has stored for this
                         ;; directory. The popover it opens is drawn by
                         ;; chat.js from what the route answers — the list is
                         ;; the agent's, and a copy rendered into the page
                         ;; would be stale before it was read.
                         (button ((type "button") (class "sf-chat-btn")
                                  (data-chat-sessions ,sessions-href)
                                  (data-chat-load ,load-href)
                                  (title "past chats"))
                                 "chats")
                         (button ((type "button") (class "sf-chat-btn")
                                  (data-post ,new-href) (title "new chat"))
                                 "+ new")
                         ;; An open panel sits on top of the floating toggle,
                         ;; so the way out is in here — and on a phone, where
                         ;; the panel is a full-width sheet, it is the only one.
                         (button ((type "button") (class "sf-chat-btn")
                                  (data-chat-toggle "")
                                  (title "close the agent panel")
                                  (aria-label "close the agent panel"))
                                 "×")))
               ;; Frames land here: the htmx sse extension would swap the raw
               ;; JSON in, and chat.js cancels that and keeps the data. One
               ;; connection, two consumers.
               (div ((class "sf-chat-sink") (id "sf-chat-sink")
                     (sse-swap ,event) (hidden "hidden")))
               (div ((class "sf-chat-body") (id "sf-chat-body"))
                    ,@(for/list ([e (in-list transcript)]) (chat-entry-xexpr e)))
               (form ((class "sf-chat-form") (id "sf-chat-form")
                      (action ,send-href) (method "post"))
                     ;; The same popover a typed "/" opens, unfiltered: the
                     ;; commands are a thing to SEE, not only to guess at.
                     (button ((type "button") (class "sf-chat-btn sf-chat-cmds")
                              (data-chat-commands "") (title "commands")
                              (aria-label "show the agent's commands"))
                             "/")
                     (input ((class "sf-chat-input") (name "text") (type "text")
                             (autocomplete "off") (placeholder "message the agent")
                             ,@(if busy? '((disabled "disabled")) '())))
                     (button ((type "submit") (class "sf-chat-send")) "send")
                     (button ((type "button") (class "sf-chat-stop")
                              (data-post ,cancel-href))
                             "stop")))))

;; ---- zoom -----------------------------------------------------------------

;; A pane with nothing to show: breadcrumbs home, one line saying why.
(define (render-empty-pane message #:home-href home-href)
  `(div ((class "sf-pane sf-zoom") (id "sf-outline"))
        ,(render-breadcrumbs '() #:home-href home-href)
        (p ((class "sf-empty")) ,message)))

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
     `(div ((class "sf-pane sf-zoom") (id "sf-outline"))
           ,(render-breadcrumbs ancestors #:zoom-base zoom-base #:home-href home-href)
           (ul ((class "sf-outline sf-zoom-root"))
               ,(render-node-fragment tk
                                      #:today today
                                      #:zoom-base zoom-base
                                      #:toggle-base toggle-base)))]))
