#lang racket/base

;; THE SEARCH PALETTE: a box you type in, and the nodes it names.
;;
;; PRESENTATION ONLY. Which nodes a query names, and in what order, is
;; olai/search — a pure function over the loaded set, so a command palette can
;; ask the same question later without asking this module anything. What is
;; here is where the box sits, what a hit reads like, and the rules that paint
;; them.
;;
;; It lives OUTSIDE every live region, like the chat panel and for the same
;; reason: a file saved while you are typing re-swaps the outline, and a search
;; box that went with it would take what you typed and where the cursor was.
;; The one part of it that IS a region is the list of hits — it re-fetches
;; itself as the query is typed (live-query) and again whenever a file moves,
;; so results cannot go on naming a node that has been renamed out from under
;; them.
;;
;; Two addresses arrive from the route layer and neither is guessed here: where
;; a query is ASKED (the form's action, and what the input re-fetches) and what
;; THIS render's results are the answer to (the region's own address, query and
;; all). A renderer that built either would be a renderer that knows the route
;; table.
;;
;; No JS is written here and none is generated. static/search.js opens and
;; closes the panel and moves the focus through the hits; every class it
;; touches is defined below, which is what olai/tests/style.rkt checks.

(require racket/contract
         racket/list
         racket/string
         ;; the region, the input that re-asks it, and the links out of it —
         ;; the only door to htmx in this repo (live/README.md)
         live/dsl
         (only-in olai/web/live outline-events ol-live)
         (except-in olai/lang/expander #%module-begin)
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
         ;; which nodes a query names: the pure query layer this only draws
         (only-in olai/search search-hit-task search-hit-file search-hit-trail
                  search-hit-fields search-hit?)
         olai/web/theme
         olai/web/style
         olai/web/markdown
         (only-in olai/web/states is-done state-class)
         (only-in olai/web/address node-link-attributes))

(provide (contract-out
          ;; #:action-href is where a query is asked — the form's action, and
          ;; what the input re-fetches with what you typed on it. #:results-href
          ;; is what THESE hits are the answer to, which is the same address
          ;; carrying this query: the region re-fetches it when a file moves.
          [render-search-panel
           (->* (#:action-href string? #:results-href string?)
                (#:query (or/c string? #f)
                 #:hits (listof search-hit?)
                 #:zoom-base (or/c string? #f))
                list?)]
          ;; how many hits a screen gets. The rest are counted, not drawn: a
          ;; palette you scroll is a palette you stopped reading
          [search-shown-limit exact-positive-integer?]))

;; The hits are a region of their own, on the same stream as the outline: what
;; a query names changes when a file does. `#:history? #f` — Back restores the
;; OUTLINE (web/page's region is the one history element on the page), and a
;; palette is not a place you navigate to.
(define-live-region ol-search #:stream outline-events #:history? #f)

(define search-shown-limit 12)

;; how much of a note is worth reading on one line of a result list
(define note-excerpt-chars 120)

;; ---- the dock ---------------------------------------------------------------
;;
;; Top right, fixed, and out of the outline's way — the same idiom as the chat
;; panel's toggle at the other corner, because they are the same kind of thing:
;; a surface you call up, not part of the page you are reading.

(define-style ol-search-dock
  #:position fixed
  #:top (apply max 1rem (apply env safe-area-inset-top))
  #:right (apply max 1rem (apply env safe-area-inset-right))
  ;; over the chat panel: a palette is the thing you just asked for, and it
  ;; goes away by itself
  #:z-index 21
  #:display flex
  #:flex-direction column
  #:align-items flex-end
  #:gap 0.5rem)

(define-style ol-search-open
  #:padding (0.5rem 0.875rem)
  ;; a thing a thumb aims at, whatever the label says (theme.rkt, touch-min)
  #:min-height ,touch-min
  #:border (1px solid ,line)
  #:border-radius 9999px
  #:background ,paper-2
  #:color ,dim
  #:font-family ,mono
  #:font-size 0.75rem
  #:cursor pointer
  [(: & hover) #:color ,ink #:border-color ,dim])

;; ---- the panel --------------------------------------------------------------

(define-style ol-search-panel
  #:display flex
  #:flex-direction column
  #:width (apply min 26rem (apply calc (- 100vw 2rem)))
  #:max-height (apply min 60dvh 30rem)
  #:overflow hidden
  #:border (1px solid ,line)
  #:border-radius ,radius
  ;; its own surface, a step up the paper ramp: a palette is a layer over the
  ;; outline, not more of the same sheet
  #:background ,panel
  #:box-shadow (0 4px 16px (apply color-mix (in srgb) (,ink 14%) transparent))
  ;; closed is the attribute a browser already has an opinion about; search.js
  ;; sets it, and a page whose scripts never ran gets the same answer
  [(attribute & hidden) #:display none]
  [@ media (#:max-width ,phone-max)
     #:width (apply calc (- 100vw 1.5rem))])

(define-style ol-search-form
  #:display flex
  #:align-items center
  #:gap 0.375rem
  #:padding (0.5rem 0.5rem)
  #:border-bottom (1px solid ,line)
  #:background (apply color-mix (in srgb) (,panel 85%) ,paper))

(define-style ol-search-input
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (0.3125rem 0.5rem)
  #:border (1px solid ,line)
  #:border-radius ,radius
  #:background ,paper
  #:color ,ink
  #:font-family ,sans
  #:font-size 0.875rem
  ;; 16px is a threshold, not a taste: iOS Safari zooms the page in when you
  ;; focus an input whose type is smaller, and does not zoom back out
  [@ media (#:max-width ,phone-max) #:min-height ,touch-min #:font-size 1rem])

(define-style ol-search-close
  #:flex none
  #:padding (0.1875rem 0.5rem)
  #:border (1px solid ,line)
  #:border-radius ,radius
  #:background ,paper-2
  #:color ,dim
  #:font-family ,mono
  #:font-size ,micro-size
  #:cursor pointer
  [(: & hover) #:color ,ink]
  [@ media (#:max-width ,phone-max) #:min-height ,touch-min])

;; ---- the hits ---------------------------------------------------------------

(define-style ol-search-results
  #:flex (1 1 auto)
  #:overflow-y auto
  #:overscroll-behavior contain
  #:padding 0.25rem)

(define-style ol-search-list #:list-style none #:margin 0 #:padding 0)

(define-style ol-search-hit
  #:display flex
  #:flex-direction column
  #:gap 0.0625rem
  #:padding (0.375rem 0.5rem)
  #:border-radius ,radius
  #:text-decoration none
  #:color ,ink
  ;; the keyboard's highlight and the mouse's are the same mark: arrowing to a
  ;; hit is focusing it, so there is no second notion of "the picked one"
  [(: & hover) (: & focus-visible) #:background ,pill-bg])

(define-style ol-search-title
  #:font-size 0.875rem
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap
  ;; a finished node is still findable, and still says which it is
  [,(sel '& is-done) #:color ,dim #:text-decoration line-through])

;; where the node is, which is what tells two nodes of the same name apart
(define-style ol-search-trail
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,dim
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap)

;; the note, and only when the note is WHY this node is on the screen
(define-style ol-search-note
  #:font-size 0.75rem
  #:color ,dim
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap)

(define-style ol-search-empty
  #:margin 0
  #:padding (0.5rem 0.5rem)
  #:font-size 0.8125rem
  #:font-style italic
  #:color ,dim)

;; what did not fit: counted, not drawn
(define-style ol-search-more
  #:margin 0
  #:padding (0.375rem 0.5rem)
  #:font-family ,mono
  #:font-size ,micro-size
  #:color ,dim)

;; ---- the markup -------------------------------------------------------------

;; A title is Markdown at render time, here as everywhere else.
(define (md-inline s) (map style-md-xexpr (title->inline-xexprs s)))

;; The trail above a hit, as one line: the file it is in, then every node above
;; it. What tells two nodes of the same name apart, and the reason a hit does
;; not need its own breadcrumbs.
(define (trail-xexprs hit)
  (define parts
    (cons (list (file-label (search-hit-file hit)))
          (for/list ([title (in-list (search-hit-trail hit))]) (md-inline title))))
  ;; each part is a LIST of xexprs (a title is Markdown), so the separator is
  ;; one too, and the whole thing flattens once
  (append* (add-between parts (list " › "))))

;; One line of a note, when the note is why this node is here. Cut at a word,
;; because a cut mid-word reads as a spelling mistake.
(define (note-excerpt s)
  (define text (string-normalize-spaces s))
  (cond
    [(<= (string-length text) note-excerpt-chars) text]
    [else
     (define cut (substring text 0 note-excerpt-chars))
     (define at (for/last ([m (in-list (regexp-match-positions* #px"\\s" cut))]) (car m)))
     (string-append (string-trim (if at (substring cut 0 at) cut)) "…")]))

;; One hit: the node's title, where it is, and the note when the note is what
;; matched. A link into the outline's region — so landing on a hit is the same
;; navigation the sidebar and the breadcrumbs make, and the palette is not a
;; second way to get anywhere.
(define (hit-xexpr hit zoom-base)
  (define tk (search-hit-task hit))
  (define note (task-description tk))
  (define show-note? (and note (memq 'note (search-hit-fields hit))))
  `(li ((id ,(live-id ol-search (task-key tk))))
       (a ((class ,ol-search-hit) (data-search-hit "")
           ,@(node-link-attributes zoom-base (task-key tk)))
          (span ((class ,(classes ol-search-title (state-class (task-status tk)))))
                ,@(md-inline (task-title tk)))
          (span ((class ,ol-search-trail)) ,@(trail-xexprs hit))
          ,@(if show-note?
                (list `(span ((class ,ol-search-note)) ,(note-excerpt note)))
                '()))))

;; What the region holds: the hits, or the one line that says why there are
;; none. Both are the same element, because the element is what the input
;; re-fetches and what a save re-draws.
(define (results-xexpr query hits zoom-base results-href)
  (define shown (if (> (length hits) search-shown-limit)
                    (take hits search-shown-limit)
                    hits))
  (define more (- (length hits) (length shown)))
  `(div ((class ,ol-search-results)
         ;; a result list that changes under a reader who cannot see it still
         ;; has to say so
         (aria-live "polite")
         ,@(live-region ol-search #:href results-href))
        ,@(cond
            [(not (non-empty-query? query))
             (list `(p ((class ,ol-search-empty)) "Type to find a node."))]
            [(null? hits)
             (list `(p ((class ,ol-search-empty))
                       ,(format "No node matches “~a”." query)))]
            [else
             (append
              (list `(ul ((class ,ol-search-list))
                         ,@(for/list ([h (in-list shown)]) (hit-xexpr h zoom-base))))
              (if (positive? more)
                  (list `(p ((class ,ol-search-more))
                            ,(format "+ ~a more" more)))
                  '()))])))

(define (non-empty-query? q)
  (and q (non-empty-string? (string-trim q))))

;; The palette. Closed unless this page WAS a query — which is what makes
;; /search?q=… a page you can paste at someone, and what a browser running no
;; JS gets when it submits the form.
(define (render-search-panel #:action-href action-href
                             #:results-href results-href
                             #:query [query #f]
                             #:hits [hits '()]
                             #:zoom-base [zoom-base #f])
  `(div ((class ,ol-search-dock))
        (button ((type "button") (class ,ol-search-open) (data-search-toggle "")
                 (aria-label "search the outline"))
                "⌕ search")
        (div ((class ,ol-search-panel) (data-search-panel "")
              ,@(if (non-empty-query? query) '() '((hidden "hidden"))))
             (form ((class ,ol-search-form) (role "search")
                    (action ,action-href) (method "get"))
                   (input ((class ,ol-search-input) (type "search") (name "q")
                           (value ,(or query "")) (autocomplete "off")
                           (placeholder "find a node")
                           (aria-label "search the outline")
                           ;; as it is typed, the region below re-fetches
                           ;; itself with what is in here (live/README.md)
                           ,@(live-query ol-search action-href)))
                   (button ((type "button") (class ,ol-search-close)
                            (data-search-toggle "")
                            (aria-label "close search"))
                           "×"))
             ,(results-xexpr query hits zoom-base results-href))))
