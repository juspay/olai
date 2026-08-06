#lang racket/base

;; Markdown -> sanitized xexprs for the web view.
;;
;; Render-time only: strings in the task struct / JSON stay verbatim. The
;; markdown package does the parsing; this module only sanitizes (no raw
;; HTML injection) and attaches semantic classes — and, since it is the
;; module that DRAWS them, it owns what they look like too (olai/web/style).
;; Never inline, never a utility-class framework.

(require racket/contract
         racket/list
         racket/match
         racket/string
         ;; a name for a note, derived from the note (see footnote-prefix)
         (only-in file/sha1 sha1)
         (only-in markdown parse-markdown)
         (only-in xml xexpr->string)
         ;; the tag grammar has one owner; this module only draws the pills
         (only-in olai/lang/tags tag-rx)
         ;; the skin: its mechanism, its tokens, and the shared shape a #tag
         ;; pill wears
         olai/web/style
         olai/web/theme)

(provide sanitize-xexpr
         title->inline-xexprs
         note->xexprs
         style-md-xexpr
         (contract-out [note->html-string (-> string? string?)]
                       ;; where the pictures a note draws come from — the URL
                       ;; they are asked for at, and the formats this module
                       ;; will write a src for at all — and what paints the
                       ;; code it fences. What this module puts on a page that
                       ;; something else has to serve
                       [media-prefix string?]
                       [media-extensions (listof string?)]
                       [highlight-scripts (listof string?)]))

;; ---- xexpr helpers --------------------------------------------------------

(define (xexpr-tag x)
  (match x
    [(cons (? symbol? tag) (? list?)) tag]
    [_ #f]))

(define (xexpr-attrs x)
  (match x
    [(list _ (and attrs (list (list (? symbol?) _) ...)) _ ...) attrs]
    [_ '()]))

(define (xexpr-kids x)
  (match x
    [(list _ (list (list (? symbol?) _) ...) kids ...) kids]
    [(list _ kids ...) kids]
    [_ '()]))

(define (make-xexpr tag attrs kids)
  (if (null? attrs)
      (list* tag kids)
      (list* tag attrs kids)))

;; ---- sanitize (no raw HTML injection) -------------------------------------

;; Two tables, and what divides them is not block versus inline: it is what a
;; TITLE gets. A title is one line of an outline row, so the second table is
;; the set a title does not get — the blocks, and `img`, which is inline in
;; HTML and still not one line.
(define allowed-anywhere
  (make-hasheq '((em . #t) (strong . #t) (code . #t) (a . #t) (del . #t)
                           (span . #t) (br . #t)
                           ;; a footnote's reference marker
                           (sup . #t))))

(define allowed-in-body
  (make-hasheq '((p . #t) (pre . #t) (ul . #t) (ol . #t) (li . #t)
                           (blockquote . #t) (h1 . #t) (h2 . #t) (h3 . #t)
                           (h4 . #t) (h5 . #t) (h6 . #t) (hr . #t) (div . #t)
                           (img . #t))))

;; The value of an xexpr attribute, or `missing` when the tag does not wear it.
(define (attr-value attrs name [missing #f])
  (match (assq name attrs)
    [(list-rest _ value _) value]
    [_ missing]))

;; Same, but only when it is a string — everything below reads attributes with
;; a regexp, and an xexpr is a data structure a caller writes by hand.
(define (attr-string attrs name)
  (define v (attr-value attrs name))
  (and (string? v) v))

(define (safe-href href)
  (and (string? href)
       (or (regexp-match? #px"^(https?|mailto):" href)
           (regexp-match? #px"^#" href))
       href))

;; ---- pictures --------------------------------------------------------------

;; Where a picture in a note comes from. The ROUTE is the server's to mount
;; (olai/web/serve); the prefix is this module's, because this is the module
;; that writes the src — the same split /static/ has with web/render.
(define media-prefix "/media/")

;; And what a picture IS, which is a shorter list than what a file can be: the
;; route hands these bytes to a browser with no reading of them, so an .svg —
;; a document, which can script — is not one. Said here, next to the src this
;; module writes, and the route is built from the same list (olai/web/serve).
(define media-extensions
  '("png" "jpg" "jpeg" "gif" "webp" "avif" "bmp" "ico"))

(define media-extension-rx
  (pregexp (string-append "(?i:\\.(" (string-join media-extensions "|") "))$")))

;; An image's src is a path INSIDE the outline directory, and nothing else: no
;; scheme (http, data:, javascript:), no protocol-relative //host, no absolute
;; path, and no segment that climbs. What is left is served by one route off
;; the directory being served — so a picture in a note is a file beside the
;; outline, and a picture anywhere else is not drawn at all rather than
;; fetched from wherever it says.
;;
;; A backslash is rejected wherever it appears, which is also what makes a
;; leading one (a UNC path) one of the rejected shapes.
(define (media-href src)
  (and (non-empty-string? src)
       (not (regexp-match? #px"^[A-Za-z][A-Za-z0-9+.-]*:" src)) ; a scheme
       (not (regexp-match? #px"^/" src))                ; absolute, or //host
       (not (regexp-match? #px"\\\\" src))              ; the other separator
       (not (regexp-match? #px"(^|/)\\.\\.(/|$)" src))  ; climbing
       (not (regexp-match? #px"[?#]" src))              ; a query is not a file
       (not (regexp-match? #px"[[:cntrl:]]" src))
       (regexp-match? media-extension-rx src)
       (string-append media-prefix src)))

;; ---- footnotes -------------------------------------------------------------
;;
;; The parser emits working footnotes: a <sup> marker per reference, and an
;; <ol> of definitions each with a ↩ back to it, wired together by id. It mints
;; those ids itself, from a gensym per parse — and none of that is ours to
;; trust onto the page, because an id is also just markup somebody can write.
;;
;; So the STRUCTURE survives and the NAMES do not. The only thing read out of
;; an upstream id is the footnote's number and which end of the pair it is;
;; both ends are then spelled here, from a prefix this module chose. A forged
;; id in a note is at worst a jump link to the wrong footnote of that same
;; note, and never a name of somebody else's choosing landing on the page.

;; "…-footnote-3-definition" -> (cons "3" "definition"), else #f. Anchored at
;; both ends: an id is the whole attribute, never a substring of one.
(define footnote-id-rx
  #px"^[A-Za-z0-9_-]*footnote-([0-9]{1,4})-(definition|return)$")

(define (footnote-parts s)
  (define m (and (string? s) (regexp-match footnote-id-rx s)))
  (and m (cons (cadr m) (caddr m))))

;; The href a footnote link carries is the same name with a # on it.
(define (footnote-href-parts href)
  (and (string? href)
       (string-prefix? href "#")
       (footnote-parts (substring href 1))))

(define (footnote-name prefix parts)
  (string-append prefix
                 (if (equal? (cdr parts) "definition") "fn-" "fnref-")
                 (car parts)))

;; A page is many parses — every title, every note, every document — and each
;; numbers its footnotes from 1, so the prefix is what keeps two of them from
;; minting one id. It is the text's own hash: the same note draws the same ids
;; on every render (a live update MORPHS the markup, and an id that moved would
;; be markup that has to be replaced instead), and two notes collide only by
;; being the same note twice.
;;
;; Which does happen, and is the known limit: a mirrored node is one note drawn
;; at two SITES on one page, so both copies mint the same ids and the ↩ from
;; either lands on the first. Cosmetic, and the alternative is this module
;; being told a node's identity — which it does not otherwise know, and which a
;; chat turn does not have at all.
(define (footnote-prefix text)
  (string-append "fn" (substring (sha1 (open-input-string text)) 0 8) "-"))

;; The one class that crosses from the parser's markup into ours, and a lookup
;; rather than a value carried through: it is how the parser marks the block of
;; definitions, and how style-md-xexpr finds the block to paint.
(define footnotes-class "footnotes")

;; ---- fenced code -----------------------------------------------------------

;; The highlighter, as the files a page pulls in, IN LOAD ORDER: the bundle,
;; then the languages that register into it, then ours. The three under hljs/
;; are vendored — pinned upstream and staged by nix, never committed
;; (nix/highlight-js.nix) — and they are named here because this is the module
;; that draws what they paint. Where they are MOUNTED is web/render's.
(define highlight-scripts
  '("hljs/highlight.min.js" "hljs/scheme.min.js" "hljs/nix.min.js"
    "highlight-init.js"))

;; The fence's language, put where a highlighter reads it.
;;
;; The parser hangs the info string on the <pre> as class="brush: LANG …" —
;; SyntaxHighlighter's spelling, from 2009. HTML's convention, which is also
;; highlight.js's, is class="language-LANG" on the <code> inside, and it is
;; the truer statement: the language is a fact about the code, not about the
;; box around it.
;;
;; Only the FIRST word is read, and only when it is a bare language name. The
;; rest of an info string is anything at all — a fence is the one place a note
;; carries a word straight from its author into an attribute — so anything
;; else is a fence with no language rather than a fence with a class.
(define brush-rx #px"^brush: *([A-Za-z0-9][A-Za-z0-9+#._-]{0,31})(?: |$)")

(define (fence-language attrs)
  (define m (regexp-match brush-rx (or (attr-string attrs 'class) "")))
  (and m (cadr m)))

(define (label-code-language attrs kids)
  (define lang (fence-language attrs))
  (if lang
      (for/list ([k (in-list kids)])
        (if (eq? (xexpr-tag k) 'code)
            (make-xexpr 'code
                        `((class ,(string-append "language-" lang)))
                        (xexpr-kids k))
            k))
      kids))

;; What an element keeps. `prefix` is the footnote namespace this piece of
;; markdown mints its ids in (see footnote-prefix).
(define (sanitize-attrs tag attrs prefix)
  (case tag
    [(a)
     (define raw (attr-value attrs 'href))
     (define jump (footnote-href-parts raw))
     (define href (if jump
                      (string-append "#" (footnote-name prefix jump))
                      (safe-href raw)))
     ;; the reference's own anchor, which the definition's ↩ points back at:
     ;; <a name=…> is what the parser writes and `id` is what a page reads, so
     ;; it is re-minted as one
     (define anchor (footnote-parts (attr-value attrs 'name)))
     (append (if href `((href ,href)) '())
             (if anchor `((id ,(footnote-name prefix anchor))) '()))]
    [(li)
     (define fn (footnote-parts (attr-value attrs 'id)))
     (if fn `((id ,(footnote-name prefix fn))) '())]
    [(div)
     (if (equal? (attr-string attrs 'class) footnotes-class)
         `((class ,footnotes-class))
         '())]
    [else '()]))

;; One sanitized element — or nothing at all. Two tags decide something about
;; themselves that an attribute list cannot say, so they are answered here
;; rather than in the table above: an <img> IS its src, and one this view will
;; not serve is a broken icon rather than a picture; a <pre> puts its fence's
;; language on the child that carries the code.
(define (sanitize-element tag attrs kids prefix)
  (case tag
    [(img)
     (define src (media-href (attr-value attrs 'src)))
     (define alt (attr-string attrs 'alt))
     (if src
         (list (make-xexpr 'img (cons `(src ,src) (if alt `((alt ,alt)) '())) kids))
         '())]
    [(pre)
     (list (make-xexpr tag (sanitize-attrs tag attrs prefix)
                       (label-code-language attrs kids)))]
    [else (list (make-xexpr tag (sanitize-attrs tag attrs prefix) kids))]))

;; The markdown package emits smart punctuation as bare entity symbols
;; (mdash, ndash, rsquo, …). We want VERBATIM ASCII for those — ISO dates
;; like 2026-07-31 must keep plain hyphens, quotes stay straight. Other
;; legitimate entities expand to the real Unicode character, never to the
;; entity *name* as text (that produced "2026ndash07ndash31").
;;
;; (current-strict-markdown? #t) would kill smart punctuation but also
;; fenced code blocks and other useful GFM-ish bits, so we normalize after
;; a normal parse instead.
(define smart-punct-ascii
  #hasheq((mdash . "--")
          (ndash . "-")
          (lsquo . "'")
          (rsquo . "'")
          (ldquo . "\"")
          (rdquo . "\"")
          (sbquo . "'")
          (bdquo . "\"")
          (lsaquo . "<")
          (rsaquo . ">")
          (hellip . "...")
          (prime . "'")
          (Prime . "\"")
          (apos . "'")
          (quot . "\"")))

(define named-entity-chars
  #hasheq((middot . "\u00B7")
          (bull . "\u2022")
          (nbsp . "\u00A0")
          (ensp . "\u2002")
          (emsp . "\u2003")
          (thinsp . "\u2009")
          (amp . "&")
          (lt . "<")
          (gt . ">")))

(define (entity-symbol->text sym)
  (or (hash-ref smart-punct-ascii sym #f)
      (hash-ref named-entity-chars sym #f)
      ;; Unknown entity name: never emit the bare name as text.
      ""))

;; Returns a list of sanitized pieces (may flatten forbidden wrappers).
;; `#:footnotes` is the namespace this markdown's footnote ids are minted in;
;; the default is one namespace for everything, which is what a caller with a
;; single piece of markup in its hands (a test, a fragment) wants.
(define (sanitize-pieces x #:inline-only? [inline-only? #f] #:footnotes [prefix ""])
  (define (allowed? tag)
    (or (hash-ref allowed-anywhere tag #f)
        (and (not inline-only?) (hash-ref allowed-in-body tag #f))))
  (let loop ([x x])
    (cond
      [(string? x) (list x)]
      [(symbol? x) (list (entity-symbol->text x))]
      [(number? x) (list (number->string x))]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (xexpr-kids x))
       (define skids (append* (map loop kids)))
       (if (allowed? tag)
           (sanitize-element tag attrs skids prefix)
           skids)] ; strip unknown tag (e.g. script), keep text kids
      [(list? x)
       (append* (map loop x))]
      [else '()])))

(define (sanitize-xexpr x #:inline-only? [inline-only? #f] #:footnotes [prefix ""])
  (define pieces (sanitize-pieces x #:inline-only? inline-only? #:footnotes prefix))
  (match pieces
    [(list one) one]
    [many many]))

;; ---- titles / notes -------------------------------------------------------

;; A TITLE IS INLINE. That is the spec, and Markdown disagrees: the same
;; characters at the START of a line are block syntax, so "#tag first" came
;; back as an <h1> with the "#" eaten (and the tag pill with it), "- not a
;; list" as a one-item <ul>, "> quoted" as a blockquote, "1. one" as an <ol>.
;;
;; There is no inline-only entry point in the markdown package, so: parse it,
;; and if the parser insisted on a block, read it again as the text of a
;; heading — the one context where "#", "- ", "> " and "1. " at the start of
;; a line are just characters. Ordinary titles (a paragraph, which is nearly
;; all of them) never take the second path.
(define (title-md-inline s)
  (define body
    (match (parse-markdown s)
      [(list (list 'p (list (list (? symbol?) _) ...) kids ...) _ ...) kids]
      [(list (list 'p kids ...) _ ...) kids]
      [_ (heading-inlines s)]))
  (sanitize-pieces body #:inline-only? #t))

(define (heading-inlines s)
  (match (parse-markdown (string-append "# " s))
    [(list (list 'h1 (list (list (? symbol?) _) ...) kids ...) _ ...) kids]
    [(list (list 'h1 kids ...) _ ...) kids]
    [other other]))

;; A #tag in a title: the shared pill shape (theme) in its own paint.
(define-style ol-tag
  #:background ,amber-bg
  #:color ,amber-fg
  #:font-family ,mono
  #:font-size ,micro-size)

(define (add-tag-pills pieces)
  ;; Tag pills only in text nodes outside <code>. Code wins over #tags.
  (define re tag-rx)
  (define (split-text s)
    (define parts '())
    (let loop ([pos 0])
      (define m (regexp-match-positions re s pos))
      (cond
        [(not m)
         (when (< pos (string-length s))
           (set! parts (cons (substring s pos) parts)))
         (reverse parts)]
        [else
         (define a (caar m))
         (define b (cdar m))
         (when (> a pos)
           (set! parts (cons (substring s pos a) parts)))
         (set! parts
               (cons `(span ((class ,(classes ol-pill ol-tag))) ,(substring s a b))
                     parts))
         (loop b)])))
  (define (walk x #:in-code? [in-code? #f])
    (cond
      [(string? x)
       (if in-code? (list x) (split-text x))]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (xexpr-kids x))
       (define code? (or in-code? (eq? tag 'code)))
       (list (make-xexpr tag attrs
                         (append* (map (λ (k) (walk k #:in-code? code?)) kids))))]
      [(list? x)
       (append* (map (λ (k) (walk k #:in-code? in-code?)) x))]
      [else (list x)]))
  (append* (map walk pieces)))

(define (title->inline-xexprs title)
  (add-tag-pills (title-md-inline title)))

;; ---- markdown inline ------------------------------------------------------
;;
;; The three looks a rendered title or note asks for. They are defined here
;; because this is the module that puts them on the markup.

(define-style ol-link
  #:color ,blue-fg
  #:text-decoration underline
  [(: & hover) #:color ,ink])

(define-style ol-code
  #:font-family ,mono
  #:font-size 0.8125em
  #:background ,pill-bg
  #:border (1px solid ,line)
  #:border-radius 0.25rem
  #:padding (0.0625rem 0.25rem))

(define-style ol-pre
  #:font-family ,mono
  #:font-size 0.8125rem
  #:background ,pill-bg
  #:border (1px solid ,line)
  #:border-radius ,radius
  #:padding (0.625rem 0.75rem)
  #:margin (0.375rem 0)
  #:overflow-x auto
  ;; a block already has the box; the code inside it does not need a second
  [(& ,(sel ol-code)) #:background none #:border 0 #:padding 0])

;; A picture fits the column it is in, and never widens it.
(define-style ol-image
  #:display block
  #:max-width 100%
  #:height auto
  #:margin (0.375rem 0)
  #:border-radius ,radius)

;; Footnotes, at the foot. The rule above them is what says the list under a
;; note is not part of what the note said.
(define-style ol-footnotes
  #:margin-top 0.5rem
  #:padding-top 0.375rem
  #:border-top (1px solid ,line)
  #:font-size 0.8125rem
  #:color ,dim
  [(& ol) #:margin 0 #:padding-left 1.25rem]
  [(& p) #:margin (0.125rem 0)])

;; ---- fenced code, painted --------------------------------------------------
;;
;; highlight.js writes the spans; the palette is ours. These are ITS class
;; names — hljs-*, none of the skin's three prefixes — so this is a fragment
;; rather than a define-style: nothing here DEFINES a class, it paints someone
;; else's, the same standing web/render's rules for the framework's two
;; stream-state classes have.
;;
;; And it is why nothing vendors a highlight.js stylesheet: one of those is one
;; fixed palette in a file, and a page here reads in whichever theme its reader
;; picked. Eight rules against the tokens is the whole cost.
(register-fragment!
 (css-expr
  [,(sel "hljs-comment") ,(sel "hljs-quote") #:color ,dim #:font-style italic]
  [,(sel "hljs-keyword") ,(sel "hljs-selector-tag") ,(sel "hljs-deletion")
   #:color ,rose-fg]
  [,(sel "hljs-string") ,(sel "hljs-regexp") ,(sel "hljs-addition")
   #:color ,green]
  [,(sel "hljs-number") ,(sel "hljs-literal") ,(sel "hljs-symbol")
   ,(sel "hljs-bullet") ,(sel "hljs-meta")
   #:color ,amber-fg]
  [,(sel "hljs-title") ,(sel "hljs-name") ,(sel "hljs-section")
   ,(sel "hljs-attr") ,(sel "hljs-attribute") ,(sel "hljs-variable")
   ,(sel "hljs-built_in") ,(sel "hljs-type")
   #:color ,blue-fg]
  [,(sel "hljs-emphasis") #:font-style italic]
  [,(sel "hljs-strong") #:font-weight 600]))

;; Attach the classes above; nothing else decides what a piece looks like.
(define (style-md-xexpr x)
  (let loop ([x x])
    (cond
      [(string? x) x]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (map loop (xexpr-kids x)))
       (case tag
         ;; a fenced block's language rides along — the sanitizer minted that
         ;; class and the highlighter reads it (highlight-init.js) — and an
         ;; inline `span` keeps sharing the one constant, which is nearly
         ;; every <code> on a page
         [(code)
          (define lang (attr-string attrs 'class))
          (make-xexpr 'code
                      `((class ,(if lang (classes ol-code lang) ol-code)))
                      kids)]
         [(pre) (make-xexpr 'pre `((class ,ol-pre)) kids)]
         [(img) (make-xexpr 'img `((class ,ol-image) ,@attrs) kids)]
         [(div)
          (if (equal? (attr-string attrs 'class) footnotes-class)
              (make-xexpr 'div `((class ,ol-footnotes)) kids)
              (make-xexpr 'div attrs kids))]
         [(a)
          (define href (attr-value attrs 'href "#"))
          ;; the id is the footnote anchor's, and the only other attribute the
          ;; sanitizer ever mints on a link
          (define id (attr-string attrs 'id))
          (make-xexpr 'a
                      `((href ,href) (class ,ol-link) ,@(if id `((id ,id)) '()))
                      kids)]
         [else (make-xexpr tag attrs kids)])]
      [(list? x) (map loop x)]
      [else x])))

(define (note->xexprs note)
  (map style-md-xexpr
       (sanitize-pieces (parse-markdown note) #:footnotes (footnote-prefix note))))

;; The same treatment, as one HTML string — for the callers that hand HTML to
;; a browser instead of an xexpr to a renderer (the `done` chat frame carries
;; the agent's finished text this way). xexpr->string is what escapes it, so
;; the string is safe to insert as markup and nowhere else is.
(define (note->html-string note)
  (apply string-append (map xexpr->string (note->xexprs note))))
