#lang racket/base

;; A file-name pattern: what `@include Daily/*.rkt` NAMES.
;;
;; Beside olai/doc and olai/dates, and for the same reason: the FIELD belongs
;; to the language (lang/line reads the line, lang/expander turns a bad
;; pattern into a syntax error), and what the field MEANS is here, where every
;; layer that asks can reach it without spelling it twice. Four do — the
;; expander for-syntax when it splices, the store when it decides a load is
;; stale, the watcher when it picks directories, and olai/paths, whose
;; `dir-roots` is this same question with the pattern already chosen.
;;
;; A literal include is a CLAIM about one file; a glob is a QUERY over one
;; directory, and everything that differs between the two follows from that. A
;; query answers with a set — the empty one included — and its answer can
;; change without any file the outline already read being touched.
;;
;; The grammar is smaller than a shell's, on purpose. `*` stands for any run
;; of characters inside ONE file name; the directory part is literal, so a
;; pattern names exactly one directory — which is what makes "watch where this
;; reads" a single answerable question. `**`, `?`, character classes and
;; braces are rejected BY NAME rather than quietly taken as literal
;; characters: a closed grammar says no out loud. Hand-rolled over the `glob`
;; package on purpose: nearly all of that package is the syntax this language
;; refuses, and importing it would mean policing its extras rather than
;; translating our own four rules.

(require racket/contract
         racket/path
         racket/string)

;; Everything below the grammar takes an ABSOLUTE pattern. Resolving one
;; against the file that wrote it is the include form's business, not the
;; pattern's — it is the same resolution a literal @include gets, and the
;; expander does it once for both (lang/expander, include-absolute).
(provide (contract-out
          [include-glob? (-> string? boolean?)]
          [include-glob-problem (-> string? (or/c string? #f))]
          [glob-dir (-> path? path?)]
          [glob-match? (-> path? path? boolean?)]
          [glob-expand (-> path? (listof path?))]))

;; A path the source wrote is a glob when it stars something. Nothing else
;; promotes one: a file really called `notes[1].rkt` is a file, and an
;; @include naming it is a literal include. The other metacharacters are only
;; policed once a `*` says a pattern was meant (include-glob-problem).
(define (include-glob? rel)
  (string-contains? rel "*"))

;; The file name a pattern matches, and the directory part it reads it from —
;; both as the source wrote them. `#f` name when the pattern ends in a
;; separator (it names a directory, not files in one).
(define (pattern-parts rel)
  (define-values (base name dir?) (split-path (string->path rel)))
  (values (if (path? base) base #f)
          (and (not dir?)
               (path-for-some-system? name)
               (path->string name))))

;; #f when `rel` is a pattern this language will answer, else why not. Only
;; ever asked of a string include-glob? already said yes to.
(define (include-glob-problem rel)
  (define-values (base name) (pattern-parts rel))
  (cond
    [(string-contains? rel "**")
     "** is not a glob here: * matches inside one file name, never across directories"]
    [(for/or ([c (in-string "?[]{}")])
       (and (string-contains? rel (string c)) c))
     => (λ (c)
          (format "~a is not a glob character here; * is the only one" c))]
    [(not name)
     "a glob names files in a directory, so it must end in a file name pattern"]
    [(and base (string-contains? (path->string base) "*"))
     "only the file name may be starred; the directory part of an @include is literal"]
    [else #f]))

;; The one directory an absolute pattern reads. This is the thing to watch:
;; the files in it are what the pattern's answer is made of.
(define (glob-dir pattern)
  (or (path-only pattern) pattern))

;; `*` is any run of characters; everything else in the name is itself.
(define (name-rx name)
  (pregexp
   (string-append "^"
                  (string-join (map regexp-quote (string-split name "*" #:trim? #f))
                               ".*")
                  "$")))

;; Two spellings of one directory are one directory. Reads nothing: the
;; filesystem is glob-expand's to touch, not a comparison's.
(define (dir-key dir)
  (path->directory-path (simplify-path dir #f)))

;; Does a pattern NAME this path? The question glob-expand answers by reading
;; a directory, asked of ONE path and reading nothing.
;;
;; A WRITER is who needs it that way round: `olai daily` is about to add an
;; @include line for a month fragment, and a pattern the outline already
;; wrote may cover it — in which case the line would splice that file a
;; SECOND time (olai/daily). The path it asks about is a name, not yet
;; necessarily a file, and a directory listing cannot answer about a name.
;;
;; The rules are the expansion's, spelled once for both: the directory part
;; is literal and must be the path's own, `*` matches inside the one file
;; name, and a leading dot is not something it matches.
(define (glob-match? pattern path)
  (define pname (file-name-from-path pattern))
  (define-values (base name dir?) (split-path path))
  (and (path? pname)
       (path? name)
       (not dir?)
       (path? base)
       (equal? (dir-key base) (dir-key (glob-dir pattern)))
       (let ([n (path->string name)])
         (and (not (string-prefix? n "."))
              (regexp-match? (name-rx (path->string pname)) n)))))

;; What the pattern matches, right now, sorted lexicographically — which is
;; what makes date-named fragments (2026-01.rkt, 2026-02.rkt, ...) splice in
;; the order they were lived in, by construction rather than by a rule about
;; dates.
;;
;; A missing directory answers with the empty list rather than raising: this
;; is the function the store calls on every staleness check, and a directory
;; that went away between two loads is a reload, not a crash. The LANGUAGE is
;; where a pattern with no directory to read is rejected (lang/expander).
;;
;; A leading dot is not something `*` matches, exactly as in a shell — and
;; here that is load-bearing rather than a convention: `.#2026-08.rkt` is the
;; lock file Emacs leaves beside a file it is editing, it is a dangling
;; symlink, and globbing it in would break an outline nobody had touched.
;;
;; Names are sorted as STRINGS and only then turned back into paths: within
;; one directory the two orders are the same, and `sort #:key path->string`
;; re-converts on both sides of every comparison. This runs on every staleness
;; check (olai/store), so the allocation is not theoretical.
(define (glob-expand pattern)
  (define dir (glob-dir pattern))
  (define rx (name-rx (path->string (file-name-from-path pattern))))
  (cond
    [(not (directory-exists? dir)) '()]
    [else
     (define names
       (sort (for*/list ([p (in-list (directory-list dir))]
                         [name (in-value (path->string p))]
                         #:unless (string-prefix? name ".")
                         #:when (regexp-match? rx name))
               name)
             string<?))
     (for*/list ([name (in-list names)]
                 [full (in-value (build-path dir name))]
                 #:when (file-exists? full))
       full)]))
