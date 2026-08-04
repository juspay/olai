#lang racket/base

;; Pure xexpr renderers for the web view. No I/O, no clocks: `today` is an
;; argument. Every function here is a value -> value transform so the server
;; can render a whole page, one node fragment (SSE re-swap), or a zoom view
;; from the same code.
;;
;; DATA IN — files-data: (listof file-entry), where file-entry is
;;   (list label tasks anchors)   ; label: path or string, anchors: hash
;;   (cons label tasks)           ; legacy shorthand, no anchors
;;
;; IDS — every node element carries id="n-{fragment-id}". fragment-id is the
;; task's ^anchor when it has one, else "p" + 8 hex chars of the SHA-1 of its
;; breadcrumb path ("Tasks.rkt > Inbox > Buy milk"). Breadcrumbs INCLUDE the
;; node's own title and start at the file label, so an id is stable no matter
;; how many files were loaded alongside it.

(require racket/list
         racket/match
         racket/path
         racket/string
         racket/runtime-path
         file/sha1
         (only-in xml cdata xexpr->string)
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/dates
         selfflowy/web/markdown)

(provide fragment-id
         render-node-fragment
         render-outline
         render-breadcrumbs
         render-sidebar
         render-page
         render-zoom
         ;; helpers the server needs to route/lookup
         page->html-string
         render-error-banner
         fragment-index
         file-label
         node-element-id
         web-static-dir
         collapse-js
         ;; re-exported markdown surface (render-time only)
         title->inline-xexprs
         note->xexprs
         sanitize-xexpr)

;; Where the server mounts /static/ from.
(define-runtime-path static-dir "static")
(define (web-static-dir) static-dir)

;; ---- fragment ids ---------------------------------------------------------

;; breadcrumb: string or (listof string). Lists join with " > ".
(define (breadcrumb->string breadcrumb)
  (cond
    [(string? breadcrumb) breadcrumb]
    [(list? breadcrumb) (string-join (map crumb-label breadcrumb) " > ")]
    [else (format "~a" breadcrumb)]))

(define (crumb-label c)
  (cond
    [(string? c) c]
    [(pair? c) (crumb-label (car c))]
    [else (format "~a" c)]))

(define (path-hash s)
  (substring (sha1 (open-input-bytes (string->bytes/utf-8 s))) 0 8))

;; The anchor wins: ^ids are user-chosen and survive renames of ancestors.
(define (fragment-id tk breadcrumb)
  (or (and (task? tk) (task-id tk))
      (string-append "p" (path-hash (breadcrumb->string breadcrumb)))))

(define (node-element-id fid)
  (string-append "n-" fid))

;; ---- small helpers --------------------------------------------------------

(define (file-label label)
  (cond
    [(path? label) (path->string (file-name-from-path label))]
    [(string? label)
     (define-values (base name dir?) (split-path label))
     (if (path-for-some-system? name) (path->string name) label)]
    [else (format "~a" label)]))

;; files-data -> (listof (list label tasks anchors)) with labels as strings
(define (normalize-files-data files-data)
  (for/list ([e (in-list files-data)])
    (match e
      [(list label tasks anchors) (list (file-label label) tasks (or anchors (hash)))]
      [(cons label tasks) (list (file-label label) tasks (hash))]
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

(define (checkbox-xexpr fid done? toggle-base)
  (define label (if done? "☑" "☐"))
  (define common
    `((class ,(classes "sf-check" (and done? "is-done")))
      (title ,(if done? "done" "not done"))))
  (if toggle-base
      `(button ((type "button")
                ,@common
                (hx-post ,(string-append toggle-base fid))
                (hx-target ,(string-append "#" (node-element-id fid)))
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

(define (render-child child
                      #:anchors anchors
                      #:breadcrumb breadcrumb
                      #:today today
                      #:zoom-base zoom-base
                      #:toggle-base toggle-base)
  (cond
    [(mirror-ref? child)
     (define anchor (mirror-ref-anchor child))
     (define target (and anchors (hash-ref anchors anchor #f)))
     (cond
       [target
        (render-node-fragment target
                              #:anchors anchors
                              #:breadcrumb (append breadcrumb (list (task-title target)))
                              #:today today
                              #:mirror-of anchor
                              #:zoom-base zoom-base
                              #:toggle-base toggle-base)]
       [else
        `(li ((class "sf-node sf-unresolved"))
             (div ((class "sf-row"))
                  (span ((class "sf-bullet")))
                  (div ((class "sf-content"))
                       (a ((class "sf-mirror") (href ,(string-append "#" anchor)))
                          "↗" ,anchor)
                       (span ((class "sf-title sf-dim")) "(unresolved)"))))])]
    [(task? child)
     (render-node-fragment child
                           #:anchors anchors
                           #:breadcrumb (append breadcrumb (list (task-title child)))
                           #:today today
                           #:zoom-base zoom-base
                           #:toggle-base toggle-base)]
    [else `(li ((class "sf-node sf-unresolved")) "???")]))

;; One subtree, self-contained: this is the unit SSE re-swaps.
(define (render-node-fragment tk
                              #:anchors [anchors (hash)]
                              #:breadcrumb [breadcrumb #f]
                              #:today [today #f]
                              #:mirror-of [mirror-of #f]
                              #:zoom-base [zoom-base #f]
                              #:toggle-base [toggle-base #f]
                              #:collapsed? [collapsed? #f])
  (define title (task-title tk))
  (define crumb (or breadcrumb (list title)))
  (define today* (or today (today-iso-string)))
  (define fid (fragment-id tk crumb))
  (define done? (and (task-done tk) #t))
  (define kids (task-children tk))
  (define has-kids? (pair? kids))
  (define iso-day (and (bare-iso-date-title? title) title))
  (define title-el
    (if iso-day
        (day-pill-xexpr iso-day today* done?)
        `(span ((class ,(classes "sf-title" (and done? "is-done"))))
               ,@(map style-md-xexpr (title->inline-xexprs title)))))
  (define row
    `(div ((class "sf-row"))
          ,@(if has-kids?
                (list `(button ((type "button")
                                (class "sf-toggle")
                                (aria-expanded ,(if collapsed? "false" "true"))
                                (aria-label "toggle children"))
                               "▸"))
                (list `(span ((class "sf-toggle sf-toggle-empty") (aria-hidden "true")))))
          ,(let ([dot `(span ((class ,(classes "sf-bullet"
                                               (and has-kids? "has-children")))
                              (aria-hidden "true")))])
             (if zoom-base
                 `(a ((class "sf-bullet-link")
                      (href ,(href-for zoom-base fid))
                      (title "zoom in"))
                     ,dot)
                 dot))
          ;; the check sits in the gutter, not in the text run, so a title
          ;; and its note stay flush left of each other
          ,(checkbox-xexpr fid done? toggle-base)
          (div ((class "sf-content"))
               (div ((class "sf-line"))
                    ,@(if mirror-of
                          (list `(a ((class "sf-mirror")
                                     (href ,(string-append "#" mirror-of))
                                     (title ,(string-append "mirror of ^" mirror-of)))
                                    "↗"))
                          '())
                    ,title-el
                    ,@(if (task-date tk)
                          (list (date-pill-xexpr (task-date tk) today* done?))
                          '()))
               ,@(if (task-description tk)
                     (list `(div ((class ,(classes "sf-note" (and done? "is-done"))))
                                 ,@(note->xexprs (task-description tk))))
                     '()))))
  `(li ((class ,(classes "sf-node"
                         (and has-kids? "has-children")
                         (and collapsed? "is-collapsed")
                         (and done? "is-done")))
        (id ,(node-element-id fid))
        (data-fragment-id ,fid)
        ,@(if has-kids? `((data-collapse-key ,fid)) '()))
       ,@(legacy-anchor-xexpr tk)
       ,row
       ,@(if has-kids?
             (list `(ul ((class "sf-children"))
                        ,@(for/list ([c (in-list kids)])
                            (render-child c
                                          #:anchors anchors
                                          #:breadcrumb crumb
                                          #:today today*
                                          #:zoom-base zoom-base
                                          #:toggle-base toggle-base))))
             '())))

;; ---- main pane ------------------------------------------------------------

(define (render-outline files-data
                        #:today [today #f]
                        #:zoom-base [zoom-base #f]
                        #:toggle-base [toggle-base #f])
  (define today* (or today (today-iso-string)))
  (define entries (normalize-files-data files-data))
  (define (file-list label tasks anchors)
    `(ul ((class "sf-outline"))
         ,@(for/list ([tk (in-list tasks)])
             (render-child tk
                           #:anchors anchors
                           #:breadcrumb (list label)
                           #:today today*
                           #:zoom-base zoom-base
                           #:toggle-base toggle-base))))
  `(div ((class "sf-pane") (id "sf-outline"))
        ,@(for/list ([e (in-list entries)])
            (match-define (list label tasks anchors) e)
            `(section ((class "sf-file") (data-file ,label))
                      (h2 ((class "sf-file-title")) ,label)
                      ,(file-list label tasks anchors)))))

;; ---- chrome ---------------------------------------------------------------

;; path: (listof crumb) where crumb is "Label" or (list "Label" href-or-fid)
(define (render-breadcrumbs path #:zoom-base [zoom-base #f] #:home-href [home-href "/"])
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
                        #:today-href [today-href "/today"]
                        #:zoom-base [zoom-base #f]
                        #:home-href [home-href "/"])
  (define entries (normalize-files-data files-data))
  (define (tree-item tk breadcrumb depth)
    (cond
      [(mirror-ref? tk) '()]
      [(task? tk)
       (define crumb (append breadcrumb (list (task-title tk))))
       (define fid (fragment-id tk crumb))
       (define kids (filter task? (task-children tk)))
       (define has-kids? (pair? kids))
       (list
        `(li ((class ,(classes "sf-tree-node"
                               (and has-kids? "has-children")
                               (and has-kids? (> depth 0) "is-collapsed")))
              (data-fragment-id ,fid)
              ;; sidebar collapse state is its own; the same node can sit
              ;; expanded in the main pane and folded here.
              ,@(if has-kids? `((data-collapse-key ,(string-append "tree-" fid))) '()))
             (div ((class "sf-tree-row"))
                  ,@(if has-kids?
                        (list `(button ((type "button")
                                        (class "sf-toggle")
                                        (aria-expanded ,(if (> depth 0) "false" "true"))
                                        (aria-label "toggle children"))
                                       "▸"))
                        (list `(span ((class "sf-toggle sf-toggle-empty")
                                      (aria-hidden "true")))))
                  (a ((class "sf-tree-link") (href ,(href-for zoom-base fid)))
                     ,@(map style-md-xexpr (title->inline-xexprs (task-title tk)))))
             ,@(if has-kids?
                   (list `(ul ((class "sf-tree-children"))
                              ,@(append*
                                 (for/list ([c (in-list kids)])
                                   (tree-item c crumb (add1 depth))))))
                   '())))]
      [else '()]))
  `(aside ((class "sf-sidebar") (id "sf-sidebar"))
          (div ((class "sf-brand"))
               (a ((class "sf-brand-link") (href ,home-href)) "selfflowy"))
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
                       (match-define (list label tasks _) e)
                       `(div ((class "sf-tree-file"))
                             (div ((class "sf-tree-file-label")) ,label)
                             (ul ((class "sf-tree"))
                                 ,@(append*
                                    (for/list ([tk (in-list tasks)])
                                      (tree-item tk (list label) 0)))))))))

;; ---- page shell -----------------------------------------------------------

;; Collapse state: a class on .sf-node / .sf-tree-node, persisted per
;; data-collapse-key. Unvisited keys keep whatever the server rendered, so
;; render-time defaults survive. htmx swaps re-apply through the same pass.
(define collapse-js
  #<<JS
(function(){
  var KEY='selfflowy.collapsed',state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){state={}}
  function set(n,c){
    n.classList.toggle('is-collapsed',c);
    var t=n.querySelector(':scope > .sf-row > .sf-toggle, :scope > .sf-tree-row > .sf-toggle');
    if(t)t.setAttribute('aria-expanded',c?'false':'true');
  }
  function apply(root){
    (root||document).querySelectorAll('[data-collapse-key]').forEach(function(n){
      var v=state[n.dataset.collapseKey];
      set(n,v===undefined?n.classList.contains('is-collapsed'):v);
    });
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('.sf-toggle');if(!t)return;
    var n=t.closest('[data-collapse-key]');if(!n)return;
    e.preventDefault();
    var c=!n.classList.contains('is-collapsed');
    state[n.dataset.collapseKey]=c;
    set(n,c);
    localStorage.setItem(KEY,JSON.stringify(state));
  });
  document.addEventListener('htmx:afterSwap',function(e){apply(e.target)});
  apply();
})();
JS
  )

;; A file is broken for a moment during every edit. The page keeps the last
;; good content and says so here, with the file:line:col of the offending
;; form — the same location the JSON errors carry.
(define (render-error-banner detail #:where [where #f])
  `(div ((class "sf-error") (role "alert"))
        ,@(if where
              (list `(span ((class "sf-error-where")) ,where))
              '())
        (span ((class "sf-error-detail")) ,detail)))

(define (render-page main
                     #:title [title "selfflowy"]
                     #:sidebar [sidebar #f]
                     #:banner [banner #f]
                     #:sse-connect [sse-connect #f]
                     #:head-extra [head-extra '()]
                     #:body-extra [body-extra '()])
  `(html ((lang "en"))
         (head
          (meta ((charset "utf-8")))
          (meta ((name "viewport")
                 (content "width=device-width, initial-scale=1, viewport-fit=cover")))
          (meta ((name "color-scheme") (content "light dark")))
          (title ,title)
          (link ((rel "stylesheet") (href "/static/app.css")))
          (script ((src "/static/htmx.min.js") (defer "defer")))
          (script ((src "/static/sse.js") (defer "defer")))
          ,@head-extra)
         (body ((class "sf-body")
                ,@(if sse-connect
                      `((hx-ext "sse") (sse-connect ,sse-connect))
                      '()))
               ,@(if sidebar (list sidebar) '())
               (main ((class "sf-main"))
                     ;; fixed slot: the banner is swapped in and out, so it
                     ;; must exist (empty) even on a healthy page
                     (div ((class "sf-banner-slot") (id "sf-banner"))
                          ,@(if banner (list banner) '()))
                     ,main)
               ,@body-extra
               (script ,(cdata #f #f collapse-js)))))

;; Serve this, not a bare xexpr: without the doctype browsers fall into
;; quirks mode and the layout collapses. Fragments need no doctype —
;; xexpr->string is enough for those.
(define (page->html-string page)
  (string-append "<!DOCTYPE html>\n" (xexpr->string page)))

;; ---- zoom -----------------------------------------------------------------

;; fid -> (list task breadcrumb) for every node in files-data. Mirrors resolve
;; to their target once (the anchor site owns the id).
(define (fragment-index files-data)
  (define entries (normalize-files-data files-data))
  (define idx (make-hash))
  (define (walk x breadcrumb)
    (when (task? x)
      (define crumb (append breadcrumb (list (task-title x))))
      (define fid (fragment-id x crumb))
      (unless (hash-has-key? idx fid)
        (hash-set! idx fid (list x crumb)))
      (for ([c (in-list (task-children x))])
        (walk c crumb))))
  (for ([e (in-list entries)])
    (match-define (list label tasks _) e)
    (for ([tk (in-list tasks)])
      (walk tk (list label))))
  idx)

(define (anchors-for files-data)
  (for/fold ([h (hash)]) ([e (in-list (normalize-files-data files-data))])
    (for/fold ([h h]) ([(k v) (in-hash (caddr e))])
      (hash-set h k v))))

;; Breadcrumbs + the focused subtree. Unknown id -> a plain "not found" pane.
(define (render-zoom files-data id
                     #:today [today #f]
                     #:zoom-base [zoom-base #f]
                     #:toggle-base [toggle-base #f]
                     #:home-href [home-href "/"])
  (define idx (fragment-index files-data))
  (define hit (hash-ref idx id #f))
  (cond
    [(not hit)
     `(div ((class "sf-pane sf-zoom") (id "sf-outline"))
           ,(render-breadcrumbs '() #:home-href home-href)
           (p ((class "sf-empty")) "No such node."))]
    [else
     (match-define (list tk crumb) hit)
     ;; Ancestor crumbs are clickable: rebuild their fragment ids from the path.
     (define ancestors
       (let loop ([acc '()] [path '()] [rest crumb])
         (cond
           [(null? (cdr rest)) (reverse acc)]
           [else
            (define here (append path (list (car rest))))
            (loop (cons (if (null? path)
                            (car rest) ; file label: no node to zoom to
                            (list (car rest)
                                  (or (fid-for idx here) (car rest))))
                        acc)
                  here
                  (cdr rest))])))
     `(div ((class "sf-pane sf-zoom") (id "sf-outline"))
           ,(render-breadcrumbs ancestors #:zoom-base zoom-base #:home-href home-href)
           (ul ((class "sf-outline sf-zoom-root"))
               ,(render-node-fragment tk
                                      #:anchors (anchors-for files-data)
                                      #:breadcrumb crumb
                                      #:today today
                                      #:zoom-base zoom-base
                                      #:toggle-base toggle-base)))]))

;; path -> fragment id if that exact path is a node we indexed
(define (fid-for idx path)
  (define want (string-append "p" (path-hash (breadcrumb->string path))))
  (cond
    [(hash-has-key? idx want) want]
    [else
     ;; anchored node: its id is the ^anchor, so look it up by path
     (for/first ([(k v) (in-hash idx)]
                 #:when (equal? (cadr v) path))
       k)]))
