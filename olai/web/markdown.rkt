#lang racket/base

;; Markdown -> sanitized xexprs for the web view.
;;
;; Render-time only: strings in the task struct / JSON stay verbatim. The
;; markdown package does the parsing; this module only sanitizes (no raw
;; HTML injection) and attaches semantic classes. Styling lives in
;; web/static/app.css — never inline, never a utility-class framework.

(require racket/contract
         racket/list
         racket/match
         (only-in markdown parse-markdown)
         (only-in xml xexpr->string)
         ;; the tag grammar has one owner; this module only draws the pills
         (only-in olai/lang/tags tag-rx))

(provide sanitize-xexpr
         title->inline-xexprs
         note->xexprs
         style-md-xexpr
         (contract-out [note->html-string (-> string? string?)]))

;; ---- xexpr helpers --------------------------------------------------------

(define (xexpr-tag x)
  (and (list? x) (pair? x) (symbol? (car x)) (car x)))

(define (xexpr-attrs x)
  (match x
    [(list _ (list (list (? symbol?) _) ...) _ ...) (cadr x)]
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

(define allowed-inline
  (make-hasheq '((em . #t) (strong . #t) (code . #t) (a . #t) (del . #t)
                           (span . #t) (br . #t))))

(define allowed-block
  (make-hasheq '((p . #t) (pre . #t) (ul . #t) (ol . #t) (li . #t)
                           (blockquote . #t) (h1 . #t) (h2 . #t) (h3 . #t)
                           (h4 . #t) (h5 . #t) (h6 . #t) (hr . #t) (div . #t))))

(define (safe-href href)
  (and (string? href)
       (or (regexp-match? #px"^(https?|mailto):" href)
           (regexp-match? #px"^#" href))
       href))

(define (sanitize-attrs tag attrs)
  (case tag
    [(a)
     (define href (safe-href (cond [(assq 'href attrs) => cadr] [else #f])))
     (if href `((href ,href)) '())]
    [else '()]))

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
(define (sanitize-pieces x #:inline-only? [inline-only? #f])
  (define (allowed? tag)
    (or (hash-ref allowed-inline tag #f)
        (and (not inline-only?) (hash-ref allowed-block tag #f))))
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
           (list (make-xexpr tag (sanitize-attrs tag attrs) skids))
           skids)] ; strip unknown tag (e.g. script), keep text kids
      [(list? x)
       (append* (map loop x))]
      [else '()])))

(define (sanitize-xexpr x #:inline-only? [inline-only? #f])
  (define pieces (sanitize-pieces x #:inline-only? inline-only?))
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
               (cons `(span ((class "sf-pill sf-tag")) ,(substring s a b))
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

;; Attach semantic classes; the skin decides what they look like.
(define (style-md-xexpr x)
  (let loop ([x x])
    (cond
      [(string? x) x]
      [(and (list? x) (pair? x) (symbol? (car x)))
       (define tag (xexpr-tag x))
       (define attrs (xexpr-attrs x))
       (define kids (map loop (xexpr-kids x)))
       (case tag
         [(code) (make-xexpr 'code '((class "sf-code")) kids)]
         [(pre) (make-xexpr 'pre '((class "sf-pre")) kids)]
         [(a)
          (define href (cond [(assq 'href attrs) => cadr] [else "#"]))
          (make-xexpr 'a `((href ,href) (class "sf-link")) kids)]
         [else (make-xexpr tag attrs kids)])]
      [(list? x) (map loop x)]
      [else x])))

(define (note->xexprs note)
  (map style-md-xexpr (sanitize-pieces (parse-markdown note))))

;; The same treatment, as one HTML string — for the callers that hand HTML to
;; a browser instead of an xexpr to a renderer (the `done` chat frame carries
;; the agent's finished text this way). xexpr->string is what escapes it, so
;; the string is safe to insert as markup and nowhere else is.
(define (note->html-string note)
  (apply string-append (map xexpr->string (note->xexprs note))))
