#lang racket/base

;; @doc: what a document PATH means.
;;
;; The field itself belongs to the language (lang/line reads the line,
;; lang/outline builds the form, lang/expander checks it and stores the string
;; verbatim). This module is the other half: which extensions are documents,
;; where a relative one resolves to, how to get the text off disk, and what one
;; line of it reads like. Three layers ask — the expander's checker at compile
;; time, the store when it reads and watches the file, the web view when it
;; draws it — and none of them should spell any of it twice.
;;
;; It knows nothing about a task, and that is structural rather than tidy: the
;; expander imports this FOR-SYNTAX, so this cannot import the expander back.
;; A caller spells (doc-path (task-doc tk) (task-file tk)) — the two fields the
;; answer is a function of — the same way olai/dates is handed a string rather
;; than a node.

(require racket/contract
         racket/file
         racket/path
         racket/port
         racket/string)

(provide (contract-out
          [doc-extensions (listof string?)]
          [doc-extensions-phrase string?]
          [doc-relative? (-> any/c boolean?)]
          [doc-kind (-> any/c (or/c 'md 'scrbl #f))]
          [doc-path (-> any/c any/c (or/c string? #f))]
          [doc-text (-> (or/c path? string?) (or/c string? #f))]
          [doc-lead (-> string? string?)]))

;; ---- the closed set -------------------------------------------------------
;;
;; Two tiers, and no third: `.md` is the default (agents are fluent in it and
;; the renderer already parses Markdown for titles and notes), `.scrbl` is for
;; a code-heavy document that wants real sections and cross-references. Anything
;; else is a language error naming this list — a document format the view has
;; no way to draw is not a document, it is a typo.
(define doc-kinds '((".md" . md) (".scrbl" . scrbl)))

(define doc-extensions (map car doc-kinds))

;; How the checker names the set in its own error message.
(define doc-extensions-phrase
  (string-join doc-extensions " or "))

;; 'md | 'scrbl for a path this language accepts, #f for anything else —
;; including a path with no extension at all, and an extension that differs
;; only in case (the set is closed, not approximately closed).
(define (doc-kind rel)
  (and (string? rel)
       (non-empty-string? rel)
       (let ([ext (path-get-extension (string->path rel))])
         (and ext
              (cond
                [(assoc (bytes->string/utf-8 ext) doc-kinds) => cdr]
                [else #f])))))

;; ---- where it is ----------------------------------------------------------

;; A document path is RELATIVE, always. Checked rather than assumed: an
;; absolute one does not survive being synced to another machine, and — left
;; to `build-path` to discover — it comes back as an internal error with no
;; srcloc on it, where every other malformed form gets one.
(define (doc-relative? rel)
  (and (string? rel)
       (non-empty-string? rel)
       (relative-path? (string->path rel))))

;; The absolute, simplified path `rel` names, as a STRING — which is both the
;; address to read and the key everything downstream agrees on (the store's
;; doc table, the renderer's lookup into it). #f when there is no doc, when it
;; is not relative, or when there is no file to resolve it against.
;;
;; `rel` is relative to the file that DEFINED the node, not to the root that
;; loaded it — the same discipline @include has, and for the same reason: a
;; fragment spliced into two different roots must name the same document.
(define (doc-path rel defining-file)
  (and (doc-relative? rel)
       (let ([dir (and defining-file (path-only (->path defining-file)))])
         (and dir
              (path->string
               (simple-form-path (build-path dir (->path rel))))))))

(define (->path p)
  (if (path? p) p (string->path (format "~a" p))))

;; ---- what it says ---------------------------------------------------------

;; The document's text, or #f when it cannot be read. The LANGUAGE already
;; refused an outline whose @doc names a file that is not there, so #f here is
;; a race — the file went away between the load and this read — and never a
;; typo somebody should be hearing about from a page instead of from `check`.
(define (doc-text path)
  (with-handlers ([exn:fail? (λ (_e) #f)])
    (file->string path)))

;; What a preview is allowed to cost, in characters. The row it sits in
;; clips at one line anyway (web/render, .ol-doc-lead); this is so a document
;; whose first line is a paragraph does not put a paragraph in the markup.
(define lead-limit 160)

;; The one line a node shows when it is NOT zoomed: the document's first
;; non-blank line, with the marks that make it a heading, a bullet or a quote
;; taken off — what the document is about, not how it is marked up.
;;
;; Text, never Markdown: a preview is one line inside an outline row, and
;; rendering it would let a document's first line drop a heading into the
;; middle of somebody's tree.
;;
;; Read line by line off a port rather than split: the answer is nearly always
;; in the first line or two, and a document is a whole file.
(define (doc-lead text)
  (define line
    (or (with-input-from-string text
          (λ ()
            (for/or ([s (in-lines)])
              (define stripped (strip-markers s))
              (and (non-empty-string? stripped) stripped))))
        ""))
  (if (> (string-length line) lead-limit)
      (string-append (substring line 0 lead-limit) "…")
      line))

;; Leading `#`, `-`/`*`/`+`, `>`, `1.` and the whitespace around them. Applied
;; to the line as a whole, so a line that is nothing BUT markers (a `---` rule,
;; a bare `>`) comes back empty and the scan moves on.
(define (strip-markers s)
  (define t (string-trim s))
  (cond
    [(regexp-match? #px"^([-*_])\\1{2,}$" t) ""]
    [else
     (string-trim
      (regexp-replace #px"^(?:#{1,6}|[-*+]|>|[0-9]+[.)])\\s*" t ""))]))
