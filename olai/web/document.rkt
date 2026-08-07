#lang racket/base

;; THE DOCUMENT a node expands into.
;;
;; @doc attaches a FILE to a node. In the outline the node shows one line of
;; it; zoomed, it shows the whole thing. Same block either way, and only its
;; contents differ — a document that looked like one thing collapsed and
;; something unrelated expanded would be two features wearing one field.
;;
;; It opens nothing: `docs` is a hash of absolute path -> text the store read
;; at load time, so a path with no entry is a state to draw rather than an I/O
;; error in the middle of a render.
;;
;; It sits between the node's row and its children (node-shell's after-row):
;; the document belongs to this node, and the nodes under it are still under
;; it. Indented to the content column, not to the gutter the bullet sits in.

(require racket/contract
         racket/string
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/doc doc-path doc-kind doc-lead)
         ;; one owner for how a file is named in the UI (core, not web)
         (only-in olai/paths file-label)
         olai/web/theme
         olai/web/style
         olai/web/markdown
         (only-in olai/web/address node-link-attributes))

(provide (contract-out
          ;; the node, the documents as of this snapshot, whether this page is
          ;; ABOUT the node (so the whole document is drawn), and a node's key
          ;; -> its own page (web/routes). -> the block, or nothing when the
          ;; node has no @doc
          [doc-block (-> task? hash? boolean? (-> string? string?) list?)])
         ;; the "nothing here" line, drawn once here and again by a pane with
         ;; nothing in it (web/zoom): one sentence, one look, and this is the
         ;; module that draws it first
         ol-empty)

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
(define (doc-name-xexpr rel key node-href link?)
  (define label (file-label rel))
  (if link?
      `(a ((class ,ol-doc-name)
           ,@(node-link-attributes node-href key)
           (title ,rel))
          ,label)
      `(span ((class ,ol-doc-name) (title ,rel)) ,label)))

;; "Nothing here", wherever a pane or a node has to say it: a document that is
;; not there, a node that is gone, a day with nothing captured yet. One look
;; for one sentence — web/zoom draws the other two.
(define-style ol-empty #:color ,dim #:font-style italic)

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
(define (doc-block tk docs expanded? node-href)
  (define rel (task-doc tk))
  (cond
    [(not rel) '()]
    [else
     (define path (doc-path rel (task-file tk)))
     (define text (and path (hash-ref docs path #f)))
     (list
      `(div ((class ,ol-doc))
            ,(doc-name-xexpr rel (task-key tk) node-href (not expanded?))
            ,@(if expanded?
                  (doc-body-xexprs rel text)
                  (doc-lead-xexprs text))))]))

