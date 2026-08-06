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
;;   (meta bad MESSAGE)

(require racket/contract
         racket/string)

;; The grammar is a boundary five modules read across, so it is contracted:
;; the input is a line with its indentation already stripped, and the answer
;; is always a list headed by one of the six kinds. Flat checks only — this
;; runs once per line of a file being edited.
(define line-kind/c
  (or/c 'blank 'lang 'title 'mirror 'include 'meta))

(define classification/c (cons/c line-kind/c list?))

(provide (contract-out
          [blank-line? (-> string? boolean?)]
          [line-indent+content (-> string? any)]
          [classify-line (-> string? classification/c)]
          [line-blank? (-> classification/c boolean?)]
          [line-lang? (-> classification/c boolean?)]
          [line-title? (-> classification/c boolean?)]
          [line-mirror? (-> classification/c boolean?)]
          [line-include? (-> classification/c boolean?)]
          [line-meta? (-> classification/c boolean?)]
          [meta-field (-> classification/c (or/c 'desc 'date 'done 'doing 'bad #f))]
          [strip-checkbox-prefix (-> string? any)]
          [strip-trailing-anchor (-> string? any)]))

(define (blank-line? s)
  (regexp-match? #px"^\\s*$" s))

;; Leading spaces are structure; everything after them is the line's content.
(define (line-indent+content s)
  (define m (regexp-match #px"^( *)(.*)$" s))
  (values (string-length (cadr m)) (caddr m)))

;; Title checkbox sugar: "[x] " / "[X] " → done, "[/] " → doing (the Obsidian
;; community spelling for in-progress; "[-] " is left unclaimed for a future
;; cancelled), "[ ] " → open (stripped). All #t-valued marks; the timestamped
;; form is the @field.
(define (strip-checkbox-prefix title)
  (cond
    [(regexp-match #px"^\\[[xX]\\] (.*)$" title)
     => (λ (m) (values (cadr m) 'done))]
    [(regexp-match #px"^\\[/\\] (.*)$" title)
     => (λ (m) (values (cadr m) 'doing))]
    [(regexp-match #px"^\\[ \\] (.*)$" title)
     => (λ (m) (values (cadr m) 'open))]
    [else (values title #f)]))

;; Trailing ^anchor (not part of the verbatim title).
;; Returns (values title-without-anchor anchor-or-#f).
(define (strip-trailing-anchor title)
  (cond
    [(regexp-match #px"^(.*\\S)\\s+\\^([A-Za-z0-9_-]+)\\s*$" title)
     => (λ (m) (values (cadr m) (caddr m)))]
    [(regexp-match #px"^\\^([A-Za-z0-9_-]+)\\s*$" title)
     => (λ (m) (values "" (cadr m)))]
    [else (values title #f)]))

;; content: a line with its indentation already stripped.
(define (classify-line content)
  (cond
    [(blank-line? content) '(blank)]
    [(regexp-match? #px"^#lang\\s" content) '(lang)]
    ;; Escape: title is the rest after `\`; no checkbox/mirror/anchor sugar.
    [(regexp-match? #px"^\\\\" content)
     (list 'title (substring content 1) #f #f)]
    ;; Mirror line: *anchor alone (line-initial *).
    [(regexp-match #px"^\\*([A-Za-z0-9_-]+)\\s*$" content)
     => (λ (m) (list 'mirror (cadr m)))]
    [(regexp-match #px"^: (.*)$" content)
     => (λ (m) (list 'meta 'desc (cadr m)))]
    [(regexp-match? #px"^:($|[^ ].*)$" content)
     (list 'meta 'bad "description line must start with \": \" (colon + space)")]
    [(regexp-match #px"^(@date[ \t]+)(\\S.*)$" content)
     => (λ (m) (list 'meta 'date (string-trim (caddr m)) (string-length (cadr m))))]
    [(regexp-match? #px"^@date\\s*$" content)
     (list 'meta 'bad
           "expected a date or datetime after @date (YYYY-MM-DD[THH:MM[:SS]])")]
    [(regexp-match #px"^(@done[ \t]+)(\\S.*)$" content)
     => (λ (m) (list 'meta 'done (string-trim (caddr m)) (string-length (cadr m))))]
    [(regexp-match? #px"^@done\\s*$" content)
     (list 'meta 'done #t 0)]
    ;; @done's own regexps want whitespace after the name, so @doing cannot be
    ;; read as one of them however this cond is ordered.
    [(regexp-match #px"^(@doing[ \t]+)(\\S.*)$" content)
     => (λ (m) (list 'meta 'doing (string-trim (caddr m)) (string-length (cadr m))))]
    [(regexp-match? #px"^@doing\\s*$" content)
     (list 'meta 'doing #t 0)]
    [(regexp-match #px"^@include[ \t]+(\\S.*)$" content)
     => (λ (m) (list 'include (string-trim (cadr m))))]
    [(regexp-match? #px"^@include\\s*$" content)
     (list 'meta 'bad "expected a relative path after @include")]
    [(regexp-match #px"^@(\\S+)" content)
     => (λ (m)
          (list 'meta 'bad
                (format "unknown @~a; known fields: @date, @done, @doing, @include"
                        (cadr m))))]
    [else
     (define-values (title0 flag) (strip-checkbox-prefix content))
     (define-values (title anchor) (strip-trailing-anchor title0))
     (list 'title title flag anchor)]))

(define ((kind? sym) k) (eq? (car k) sym))

(define line-blank? (kind? 'blank))
(define line-lang? (kind? 'lang))
(define line-title? (kind? 'title))
(define line-mirror? (kind? 'mirror))
(define line-include? (kind? 'include))
;; True for malformed metadata too: `:x` and `@nope` are still lines that
;; hang under a title, and an editor must not mistake them for one.
(define line-meta? (kind? 'meta))

;; 'desc | 'date | 'done | 'doing | 'bad for a meta line, #f otherwise.
(define (meta-field k)
  (and (line-meta? k) (cadr k)))
