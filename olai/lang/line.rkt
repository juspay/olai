#lang racket/base

;; The surface line grammar of #lang olai, in one place.
;;
;; The file is line-oriented: a line is blank, the #lang line, a title, a
;; mirror, an @include, or one metadata field of the title above it. The
;; reader needs that to parse; done / move / add / daily need it to EDIT the
;; text in place (a text mutator must not reparse the world just to find out
;; whether line 12 is a title). It used to be restated in five modules, which
;; is five chances to disagree about what a line is.
;;
;; PURE: no srclocs, no raising, no I/O. Malformed metadata comes back as
;; '(meta bad "message") — the reader turns that into a read error at the
;; offending line, the mutators simply do not treat it as a title.
;;
;; A classification is a list whose head is the kind:
;;
;;   (blank)                     only whitespace
;;   (lang)                      the #lang line
;;   (title TEXT FLAG ANCHOR)    FLAG: 'done | 'doing | 'open | #f
;;                               ANCHOR: string | #f
;;   (mirror ANCHOR)
;;   (include REL-PATH)
;;   (meta desc TEXT)
;;   (meta date VALUE OFFSET)    OFFSET: chars before VALUE (for srclocs)
;;   (meta done VALUE OFFSET)    VALUE #t for a bare @done
;;   (meta doing VALUE OFFSET)   VALUE #t for a bare @doing
;;   (meta doc REL-PATH OFFSET)  the document this node expands into
;;   (meta bad MESSAGE)

(require racket/contract
         racket/match
         racket/string)

;; The grammar is a boundary five modules read across, so it is contracted:
;; the input is a line with its indentation already stripped, and the answer
;; is always a list headed by one of the six kinds. Flat checks only — this
;; runs once per line of a file being edited.
(define line-kind/c
  (or/c 'blank 'lang 'title 'mirror 'include 'meta))

(define classification/c (cons/c line-kind/c list?))

(provide (contract-out
          [text-lines (-> string? (listof string?))]
          [lines->text (-> (listof string?) string? string?)]
          [blank-line? (-> string? boolean?)]
          [line-indent+content (-> string? any)]
          [classify-line (-> string? classification/c)]
          [line-blank? (-> classification/c boolean?)]
          [line-lang? (-> classification/c boolean?)]
          [line-title? (-> classification/c boolean?)]
          [line-mirror? (-> classification/c boolean?)]
          [line-include? (-> classification/c boolean?)]
          [line-meta? (-> classification/c boolean?)]
          [meta-field (-> classification/c (or/c 'desc 'date 'done 'doing 'doc 'bad #f))]
          [title-text (-> classification/c (or/c string? #f))]
          [title-flag (-> classification/c (or/c 'done 'doing 'open #f))]
          [title-anchor (-> classification/c (or/c string? #f))]
          [strip-checkbox-prefix (-> string? any)]
          [strip-trailing-anchor (-> string? any)]))

;; A file is a list of lines, and back again. Every module that EDITS outline
;; text does both, and the way back is not `string-join`: whether the file ends
;; in a newline is a property of the file being edited, and an edit that adds
;; or drops one is a diff line nobody wrote. Three modules span the same text
;; the same way because it is spelled once, here, where what a line IS already
;; lives.
(define (text-lines text)
  (string-split text "\n" #:trim? #f))

(define (lines->text lines original)
  (define body (string-join lines "\n"))
  (if (regexp-match? #px"\n$" original)
      (if (regexp-match? #px"\n$" body) body (string-append body "\n"))
      body))

(define (blank-line? s)
  (regexp-match? #px"^\\s*$" s))

;; Leading spaces are structure; everything after them is the line's content.
(define (line-indent+content s)
  (match-define (list _ spaces content) (regexp-match #px"^( *)(.*)$" s))
  (values (string-length spaces) content))

;; Title checkbox sugar: "[x] " / "[X] " → done, "[/] " → doing (the Obsidian
;; community spelling for in-progress; "[-] " is left unclaimed for a future
;; cancelled), "[ ] " → open (stripped). All #t-valued marks; the timestamped
;; form is the @field.
(define (strip-checkbox-prefix title)
  (match title
    [(regexp #px"^\\[[xX]\\] (.*)$" (list _ rest)) (values rest 'done)]
    [(regexp #px"^\\[/\\] (.*)$" (list _ rest)) (values rest 'doing)]
    [(regexp #px"^\\[ \\] (.*)$" (list _ rest)) (values rest 'open)]
    [_ (values title #f)]))

;; Trailing ^anchor (not part of the verbatim title).
;; Returns (values title-without-anchor anchor-or-#f).
(define (strip-trailing-anchor title)
  (match title
    [(regexp #px"^(.*\\S)\\s+\\^([A-Za-z0-9_-]+)\\s*$" (list _ text anchor))
     (values text anchor)]
    [(regexp #px"^\\^([A-Za-z0-9_-]+)\\s*$" (list _ anchor))
     (values "" anchor)]
    [_ (values title #f)]))

;; content: a line with its indentation already stripped.
(define (classify-line content)
  (match content
    [(? blank-line?) '(blank)]
    [(regexp #px"^#lang\\s") '(lang)]
    ;; Escape: title is the rest after `\`; no checkbox/mirror/anchor sugar.
    [(regexp #px"^\\\\")
     (list 'title (substring content 1) #f #f)]
    ;; Mirror line: *anchor alone (line-initial *).
    [(regexp #px"^\\*([A-Za-z0-9_-]+)\\s*$" (list _ anchor))
     (list 'mirror anchor)]
    [(regexp #px"^: (.*)$" (list _ text))
     (list 'meta 'desc text)]
    [(regexp #px"^:($|[^ ].*)$")
     (list 'meta 'bad "description line must start with \": \" (colon + space)")]
    [(regexp #px"^(@date[ \t]+)(\\S.*)$" (list _ field value))
     (list 'meta 'date (string-trim value) (string-length field))]
    [(regexp #px"^@date\\s*$")
     (list 'meta 'bad
           "expected a date or datetime after @date (YYYY-MM-DD[THH:MM[:SS]])")]
    [(regexp #px"^(@done[ \t]+)(\\S.*)$" (list _ field value))
     (list 'meta 'done (string-trim value) (string-length field))]
    [(regexp #px"^@done\\s*$")
     (list 'meta 'done #t 0)]
    ;; @done's own regexps want whitespace after the name, so @doing cannot be
    ;; read as one of them however this match is ordered.
    [(regexp #px"^(@doing[ \t]+)(\\S.*)$" (list _ field value))
     (list 'meta 'doing (string-trim value) (string-length field))]
    [(regexp #px"^@doing\\s*$")
     (list 'meta 'doing #t 0)]
    ;; A DOCUMENT the node expands into. Metadata, not a child: it names a
    ;; file the way @include does, but nothing of it joins the tree — the
    ;; language only checks it, and the web view draws it.
    [(regexp #px"^(@doc[ \t]+)(\\S.*)$" (list _ field value))
     (list 'meta 'doc (string-trim value) (string-length field))]
    [(regexp #px"^@doc\\s*$")
     (list 'meta 'bad "expected a relative path after @doc")]
    [(regexp #px"^@include[ \t]+(\\S.*)$" (list _ rel))
     (list 'include (string-trim rel))]
    [(regexp #px"^@include\\s*$")
     (list 'meta 'bad "expected a relative path after @include")]
    [(regexp #px"^@(\\S+)" (list _ name))
     (list 'meta 'bad
           (format (string-append "unknown @~a; known fields: @date, @done, "
                                  "@doing, @doc, @include")
                   name))]
    [_
     (define-values (title0 flag) (strip-checkbox-prefix content))
     (define-values (title anchor) (strip-trailing-anchor title0))
     (list 'title title flag anchor)]))

;; `car`, not `first`: every scan of a file runs these once per line, and the
;; head of a classification is there by construction (classification/c).
(define ((kind? sym) k) (eq? (car k) sym))

(define line-blank? (kind? 'blank))
(define line-lang? (kind? 'lang))
(define line-title? (kind? 'title))
(define line-mirror? (kind? 'mirror))
(define line-include? (kind? 'include))
;; True for malformed metadata too: `:x` and `@nope` are still lines that
;; hang under a title, and an editor must not mistake them for one.
(define line-meta? (kind? 'meta))

;; 'desc | 'date | 'done | 'doing | 'doc | 'bad for a meta line, #f otherwise.
(define (meta-field k)
  (match k
    [(list 'meta field _ ...) field]
    [_ #f]))

;; The three parts of a (title TEXT FLAG ANCHOR), #f when k is not a title.
;; A title line without a checkbox or a ^anchor answers #f for those too, so
;; ask line-title? first where the difference matters. These exist so that the
;; modules that EDIT outline text — meta, capture, daily — do not each spell
;; the position a part sits at; that is this file's job.
(define (title-text k)
  (match k [(list 'title text _ _) text] [_ #f]))

(define (title-flag k)
  (match k [(list 'title _ flag _) flag] [_ #f]))

(define (title-anchor k)
  (match k [(list 'title _ _ anchor) anchor] [_ #f]))
