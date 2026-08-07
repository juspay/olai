#lang racket/base

;; Flat-record JSONL as an outline surface.
;;
;; One JSON object per line, one line per node (or mirror site, or include).
;; Loads into the same `task` / `mirror-ref` shapes the expander produces, then
;; runs the same checker (`check-task-graph`) — so duplicate ids, dangling
;; mirrors/edges, cycles and derived-state contradictions are the language's
;; rules, not a parallel validator.
;;
;; A record's `id` is the node's key AND its ^anchor (addressable for mirrors
;; and edges). `ord` orders siblings by string comparison. Srcloc for a record
;; is its 1-based line number in the file (column 0).

(require racket/contract
         racket/file
         racket/list
         racket/match
         racket/path
         racket/port
         racket/set
         racket/string
         file/sha1
         json
         olai/dates
         olai/doc
         olai/fail
         olai/frac
         (only-in olai/glob
                  include-absolute include-glob? include-glob-problem
                  glob-dir glob-expand)
         (except-in olai/lang/expander #%module-begin)
         olai/lang/tags)

(provide (contract-out
          [jsonl-path? (-> any/c boolean?)]
          [jsonl-extension string?]
          [load-jsonl (-> path? (values list? hash? list? list?))]
          [load-jsonl-text (->* (string?)
                                (#:source any/c)
                                (values list? hash? list? list?))]
          [record->line (-> hash? string?)]
          [jsonl-records (-> string? (listof (cons/c exact-positive-integer? hash?)))]
          [jsonl-text-from-records (-> (listof hash?) string?)]
          [jsonl-find-by-id (-> string? string?
                                (or/c (cons/c exact-positive-integer? hash?) #f))]
          [jsonl-find-by-title (-> string? string?
                                   (listof (cons/c exact-positive-integer? hash?)))]
          [jsonl-sibling-ords (-> string? (or/c string? #f) (listof string?))]
          [jsonl-mint-id (-> string? string?)]
          [jsonl-insert-child (-> string? (or/c string? #f) hash?
                                 (values string? exact-positive-integer?))]
          [jsonl-update-record (-> string? exact-positive-integer?
                                   (-> hash? hash?)
                                   (values string? exact-positive-integer?))]
          [jsonl-canonical-keys (listof symbol?)]
          ;; archive: cut a record subtree / graft under an ancestor chain
          [jsonl-cut-subtree (-> string? exact-nonnegative-integer?
                                 (values string? (listof hash?) (listof string?)))]
          [jsonl-graft-subtree (-> string? (listof string?) (listof hash?)
                                   (values string? exact-positive-integer?))]
          ;; daily helpers
          [jsonl-include-paths (-> string? (listof string?))]
          [jsonl-ensure-day (-> string? string?
                                (values string? exact-positive-integer? boolean?))]
          [jsonl-root-with-include
           (-> string? string? string? string?
               (values string? boolean?))]))

(define jsonl-extension ".jsonl")

(define (jsonl-path? p)
  (define s (cond [(path? p) (path->string p)]
                  [(string? p) p]
                  [else #f]))
  (and s (string-suffix? (string-downcase s) jsonl-extension)))

;; Field order for stable diffs — the demo PR's table, then mirror/include.
(define jsonl-canonical-keys
  '(id parent ord title done doing date desc doc after blocks see mirror include))

;; ---- errors -----------------------------------------------------------------

(define (fail-at source line who fmt . args)
  (define msg (apply format fmt args))
  (define src-str
    (cond [(path? source) (path->string source)]
          [(string? source) source]
          [else #f]))
  (define stx
    (datum->syntax #f 'olai (vector source line 0 #f #f)))
  (raise (exn:fail:syntax
          (if src-str
              (format "~a:~a:0: ~a: ~a" src-str line who msg)
              (format "~a:0: ~a: ~a" line who msg))
          (current-continuation-marks)
          (list stx))))

;; ---- parse ------------------------------------------------------------------

(define (normalize-record-keys h)
  (for/hash ([(k v) (in-hash h)])
    (values (cond [(symbol? k) k]
                  [(string? k) (string->symbol k)]
                  [else (string->symbol (format "~a" k))])
            v)))

;; line-num (1-based) . jsexpr hash, in file order. Blank lines skipped.
;; `#:source` only affects error messages when JSON is malformed.
(define (jsonl-records text #:source [source #f])
  (define lines (string-split text "\n" #:trim? #f))
  (define lines*
    (if (and (pair? lines) (equal? (last lines) ""))
        (drop-right lines 1)
        lines))
  (for/list ([raw (in-list lines*)]
             [i (in-naturals 1)]
             #:unless (regexp-match? #px"^\\s*$" raw))
    (define j
      (with-handlers ([exn:fail?
                       (λ (e)
                         (fail-at source i 'jsonl
                                  "invalid JSON: ~a" (exn-message e)))])
        (string->jsexpr raw)))
    (unless (hash? j)
      (fail-at source i 'jsonl "expected a JSON object, got ~v" j))
    (cons i (normalize-record-keys j))))

(define (expect-string who source line h key)
  (define v (hash-ref h key #f))
  (unless (string? v)
    (fail-at source line who "field ~a must be a string" key))
  v)

(define (optional-string who source line h key)
  (define v (hash-ref h key #f))
  (cond
    [(not v) #f]
    [(string? v) v]
    [else (fail-at source line who "field ~a must be a string" key)]))

(define (optional-bool-or-iso who source line h key)
  (define v (hash-ref h key #f))
  (cond
    [(not v) #f]
    [(eq? v #t) #t]
    [(string? v)
     (unless (valid-iso-date-string? v)
       (fail-at source line who
                "field ~a: expected true or ISO date/datetime, got ~v" key v))
     (normalize-date-string v)]
    [else
     (fail-at source line who
              "field ~a: expected true or ISO date/datetime, got ~v" key v)]))

(define (optional-string-list who source line h key)
  (define v (hash-ref h key #f))
  (cond
    [(not v) '()]
    [(list? v)
     (for ([x (in-list v)])
       (unless (string? x)
         (fail-at source line who "field ~a must be an array of strings" key)))
     v]
    [else (fail-at source line who "field ~a must be an array of strings" key)]))

;; ---- classify ---------------------------------------------------------------

(struct rec (line kind id parent ord payload) #:transparent)
;; kind: 'task | 'mirror | 'include

(define (classify-record source line h)
  (define id (expect-string 'jsonl source line h 'id))
  (unless (valid-anchor-id? id)
    (fail-at source line 'jsonl
             "id must match [A-Za-z0-9_-]+, got ~v" id))
  (define parent (optional-string 'jsonl source line h 'parent))
  (define ord (expect-string 'jsonl source line h 'ord))
  (unless (ord-string? ord)
    (fail-at source line 'jsonl
             "ord must be a non-empty base62 string, got ~v" ord))
  (define has-mirror (hash-has-key? h 'mirror))
  (define has-include (hash-has-key? h 'include))
  (define has-title (hash-has-key? h 'title))
  (cond
    [has-mirror
     (when (or has-include has-title)
       (fail-at source line 'jsonl
                "mirror record must not carry title or include"))
     (define target (expect-string 'jsonl source line h 'mirror))
     (unless (valid-anchor-id? target)
       (fail-at source line 'jsonl
                "mirror target must be an id, got ~v" target))
     (rec line 'mirror id parent ord target)]
    [has-include
     (when (or has-mirror has-title)
       (fail-at source line 'jsonl
                "include record must not carry title or mirror"))
     (define path (expect-string 'jsonl source line h 'include))
     (rec line 'include id parent ord path)]
    [else
     (unless has-title
       (fail-at source line 'jsonl "record needs title, mirror, or include"))
     (define title (expect-string 'jsonl source line h 'title))
     (define done (optional-bool-or-iso 'jsonl source line h 'done))
     (define doing (optional-bool-or-iso 'jsonl source line h 'doing))
     (when (and done doing)
       (fail-at source line 'jsonl
                "a node is done or doing, not both; drop done or doing"))
     (define date0 (optional-string 'jsonl source line h 'date))
     (define date
       (and date0
            (begin
              (unless (valid-iso-date-string? date0)
                (fail-at source line 'jsonl "invalid date ~v" date0))
              (normalize-date-string date0))))
     (define desc (optional-string 'jsonl source line h 'desc))
     (define doc (optional-string 'jsonl source line h 'doc))
     (when doc
       (unless (doc-kind doc)
         (fail-at source line 'jsonl
                  "doc extension must be ~a, got ~v"
                  doc-extensions-phrase doc))
       (unless (doc-relative? doc)
         (fail-at source line 'jsonl
                  "doc path must be relative, got ~v" doc)))
     (define after (optional-string-list 'jsonl source line h 'after))
     (define blocks (optional-string-list 'jsonl source line h 'blocks))
     (define see (optional-string-list 'jsonl source line h 'see))
     (for ([a (in-list (append after blocks see))])
       (unless (valid-anchor-id? a)
         (fail-at source line 'jsonl
                  "edge target must be an id, got ~v" a)))
     (rec line 'task id parent ord
          (hash 'title title 'done done 'doing doing 'date date
                'desc desc 'doc doc
                'after after 'blocks blocks 'see see))]))

;; ---- tree build -------------------------------------------------------------

(define (line-srcloc source line)
  (srcloc source line 0 #f #f))

(define (load-included full)
  (cond
    [(jsonl-path? full) (load-jsonl full)]
    [else
     (define tasks (dynamic-require `(file ,(path->string full)) 'tasks))
     (define anchors
       (with-handlers ([exn:fail? (λ (_) (hash))])
         (dynamic-require `(file ,(path->string full)) 'anchors)))
     (define includes
       (with-handlers ([exn:fail? (λ (_) '())])
         (dynamic-require `(file ,(path->string full)) 'includes)))
     (define globs
       (with-handlers ([exn:fail? (λ (_) '())])
         (dynamic-require `(file ,(path->string full)) 'include-globs)))
     (values tasks anchors includes globs)]))

(define (load-jsonl-text text #:source [source #f])
  (define pairs (jsonl-records text #:source source))
  (define recs
    (for/list ([p (in-list pairs)])
      (classify-record source (car p) (cdr p))))
  (define by-id (make-hash))
  (for ([r (in-list recs)])
    (when (hash-has-key? by-id (rec-id r))
      (define prev (hash-ref by-id (rec-id r)))
      (fail-at source (rec-line r) 'jsonl
               "duplicate id ~v; first at line ~a"
               (rec-id r) (rec-line prev)))
    (hash-set! by-id (rec-id r) r))
  (for ([r (in-list recs)])
    (define p (rec-parent r))
    (when p
      (unless (hash-has-key? by-id p)
        (fail-at source (rec-line r) 'jsonl "unknown parent ~v" p))
      (define pref (hash-ref by-id p))
      (unless (eq? (rec-kind pref) 'task)
        (fail-at source (rec-line r) 'jsonl
                 "parent ~v is not a task node" p))))
  (for ([r (in-list recs)])
    (define seen (make-hash))
    (let loop ([id (rec-id r)])
      (when (hash-ref seen id #f)
        (fail-at source (rec-line r) 'jsonl
                 "parent cycle involving ~v" id))
      (hash-set! seen id #t)
      (define rr (hash-ref by-id id #f))
      (when (and rr (rec-parent rr))
        (loop (rec-parent rr)))))
  (define kids (make-hash))
  (for ([r (in-list recs)])
    (define k (or (rec-parent r) 'root))
    (hash-update! kids k (λ (xs) (cons r xs)) '()))
  (define (sorted-kids parent-key)
    (sort (hash-ref kids parent-key '())
          (λ (a b)
            (cond
              [(string=? (rec-ord a) (rec-ord b))
               (< (rec-line a) (rec-line b))]
              [else (string<? (rec-ord a) (rec-ord b))]))))
  (define file-str
    (cond [(path? source) (path->string (simple-form-path source))]
          [(string? source) source]
          [else #f]))
  (define includes-acc '())
  (define globs-acc '())
  (define (splice-include rel line)
    (unless file-str
      (fail-at source line 'jsonl
               "include requires a file path to resolve against"))
    (define dir (path-only (string->path file-str)))
    (cond
      [(include-glob? rel)
       (define problem (include-glob-problem rel))
       (when problem
         (fail-at source line 'include "~a" problem))
       (define pattern (include-absolute rel dir))
       (define gdir (glob-dir pattern))
       (unless (directory-exists? gdir)
         (fail-at source line 'include
                  "no such directory: ~a" (path->string gdir)))
       (set! globs-acc
             (cons (path->string (simple-form-path pattern)) globs-acc))
       ;; Empty match is legal (like the outline grammar). Splice flat,
       ;; lexicographic order — glob-expand already sorts.
       (append*
        (for/list ([m (in-list (glob-expand pattern))])
          (set! includes-acc
                (cons (path->string (simple-form-path m)) includes-acc))
          (define-values (sub-tasks _a _i _g) (load-included m))
          sub-tasks))]
      [else
       (define full (include-absolute rel dir))
       (unless (file-exists? full)
         (fail-at source line 'include "file not found: ~a" rel))
       (set! includes-acc
             (cons (path->string (simple-form-path full)) includes-acc))
       (define-values (sub-tasks _a _i _g) (load-included full))
       sub-tasks]))
  (define (build r)
    (define loc (line-srcloc source (rec-line r)))
    (case (rec-kind r)
      [(mirror) (mirror-ref (rec-payload r) loc)]
      [(include)
       ;; Splice immediately: the include record is a site, not a node in the
       ;; tree. Return the included top-level tasks as a list to be appended
       ;; into the parent's children (or the root forest).
       (splice-include (rec-payload r) (rec-line r))]
      [(task)
       (define p (rec-payload r))
       (define edges
         (append
          (for/list ([a (in-list (hash-ref p 'after))])
            (edge-ref 'after a loc))
          (for/list ([a (in-list (hash-ref p 'blocks))])
            (edge-ref 'blocks a loc))
          (for/list ([a (in-list (hash-ref p 'see))])
            (edge-ref 'see a loc))))
       (define child-nodes (build-kids (rec-id r)))
       (define doc (hash-ref p 'doc))
       (when doc
         (define abs (doc-path doc file-str))
         (unless (and abs (file-exists? abs))
           (fail-at source (rec-line r) 'jsonl
                    "doc file not found: ~a" doc)))
       (make-task #:title (hash-ref p 'title)
                  #:date (hash-ref p 'date)
                  #:description (hash-ref p 'desc)
                  #:doc doc
                  #:done (hash-ref p 'done)
                  #:doing (hash-ref p 'doing)
                  #:id (rec-id r)
                  #:tags (title-tags (hash-ref p 'title))
                  #:edges edges
                  #:children child-nodes
                  #:file file-str
                  #:key (rec-id r)
                  #:loc loc)]
      [else (fail-at source (rec-line r) 'jsonl "internal: bad kind")]))
  ;; build may return a single node or a list (include splice)
  (define (build-kids parent-key)
    (append*
     (for/list ([r (in-list (sorted-kids parent-key))])
       (define x (build r))
       (if (list? x) x (list x)))))
  (define roots (build-kids 'root))
  (check-task-graph roots)
  (define anchors (anchors-of roots))
  (values roots anchors
          (remove-duplicates (reverse includes-acc))
          (remove-duplicates (reverse globs-acc))))

(define (load-jsonl path)
  (define full (simple-form-path path))
  (load-jsonl-text (file->string full) #:source full))

;; ---- serialize --------------------------------------------------------------

(define (omit-value? v)
  (or (eq? v #f)
      (and (list? v) (null? v))))

(define (record->line h)
  (define parts
    (for/list ([k (in-list jsonl-canonical-keys)]
               #:when (hash-has-key? h k)
               #:unless (omit-value? (hash-ref h k)))
      (format "~v:~a"
              (symbol->string k)
              (jsexpr->string (hash-ref h k)))))
  (string-append "{" (string-join parts ",") "}"))

(define (jsonl-text-from-records recs)
  (if (null? recs)
      ""
      (string-append (string-join (map record->line recs) "\n") "\n")))

;; ---- write helpers ----------------------------------------------------------

(define (jsonl-find-by-id text id)
  (for/first ([p (in-list (jsonl-records text))]
              #:when (equal? (hash-ref (cdr p) 'id #f) id))
    p))

(define (jsonl-find-by-title text title)
  (for/list ([p (in-list (jsonl-records text))]
             #:when (equal? (hash-ref (cdr p) 'title #f) title))
    p))

(define (jsonl-sibling-ords text parent-id)
  (for/list ([p (in-list (jsonl-records text))]
             #:when (equal? (hash-ref (cdr p) 'parent #f) parent-id))
    (hash-ref (cdr p) 'ord)))

;; Content-addressed id (hex ⊂ base62). 8 chars so two independent files
;; written in one op (daily's root + fragment) almost never collide when each
;; only knows its own used set. Salt advances per call so a second mint in the
;; same file after the first insert still moves.
(define mint-seq (box 0))

(define (jsonl-mint-id text)
  (define used
    (for/set ([p (in-list (jsonl-records text))])
      (hash-ref (cdr p) 'id)))
  (let loop ([n 0])
    (define seq (unbox mint-seq))
    (set-box! mint-seq (add1 seq))
    (define candidate
      (substring
       (sha1 (open-input-string (format "~a\n~a\n~a" text seq n)))
       0 8))
    (if (set-member? used candidate) (loop (add1 n)) candidate)))

(define (jsonl-insert-child text parent-id new-fields)
  (define ords (sort (jsonl-sibling-ords text parent-id) string<?))
  (define ord (if (null? ords) (ord-first) (ord-after (last ords))))
  (define rec
    (let* ([h new-fields]
           [h (hash-set h 'ord ord)]
           [h (if parent-id (hash-set h 'parent parent-id) h)])
      h))
  (define recs (map cdr (jsonl-records text)))
  (define new-text (jsonl-text-from-records (append recs (list rec))))
  (define pairs (jsonl-records new-text))
  (define line (car (last pairs)))
  (values new-text line))

(define (jsonl-update-record text line-1 transform)
  (define pairs (jsonl-records text))
  (define found #f)
  (define new-recs
    (for/list ([p (in-list pairs)])
      (if (= (car p) line-1)
          (begin (set! found #t) (transform (cdr p)))
          (cdr p))))
  (unless found
    (user-fail "jsonl: no record at line ~a" line-1))
  (values (jsonl-text-from-records new-recs) line-1))

;; ---- archive: cut / graft ---------------------------------------------------

(define (jsonl-children-map recs)
  (define kids (make-hash))
  (for ([h (in-list recs)])
    (define p (hash-ref h 'parent #f))
    (hash-update! kids p (λ (xs) (cons h xs)) '()))
  kids)

(define (jsonl-descendants-of recs root-id)
  (define kids (jsonl-children-map recs))
  (define root
    (for/first ([h (in-list recs)] #:when (equal? (hash-ref h 'id) root-id)) h))
  (unless root (error 'jsonl-cut-subtree "no record ~a" root-id))
  (define acc (list root))
  (define (walk id)
    (for ([h (in-list (reverse (hash-ref kids id '())))])
      (set! acc (append acc (list h)))
      (walk (hash-ref h 'id))))
  (walk root-id)
  acc)

(define (jsonl-ancestor-titles recs start-id)
  (define by-id
    (for/hash ([h (in-list recs)]) (values (hash-ref h 'id) h)))
  (let loop ([id (hash-ref (hash-ref by-id start-id) 'parent #f)] [acc '()])
    (cond
      [(not id) acc]
      [else
       (define h (hash-ref by-id id #f))
       (if (and h (hash-has-key? h 'title))
           (loop (hash-ref h 'parent #f) (cons (hash-ref h 'title) acc))
           (loop (and h (hash-ref h 'parent #f)) acc))])))

;; at: 0-based index of the title record's line in the file (same as located-index).
;; -> (values new-text cut-records ancestors)
(define (jsonl-cut-subtree text at)
  (define pairs (jsonl-records text))
  (define line-1 (add1 at))
  (define hit
    (for/first ([p (in-list pairs)] #:when (= (car p) line-1)) p))
  (unless hit
    (user-fail "line ~a is not in this file" line-1))
  (define h (cdr hit))
  (unless (hash-has-key? h 'title)
    (user-fail "line ~a is not a task title" line-1))
  (define root-id (hash-ref h 'id))
  (define all (map cdr pairs))
  (define cut (jsonl-descendants-of all root-id))
  (define cut-ids (for/set ([r (in-list cut)]) (hash-ref r 'id)))
  (define kept
    (for/list ([r (in-list all)]
               #:unless (set-member? cut-ids (hash-ref r 'id)))
      r))
  (define ancestors (jsonl-ancestor-titles all root-id))
  ;; Detach the subtree root so graft can reparent it.
  (define cut*
    (for/list ([r (in-list cut)])
      (if (equal? (hash-ref r 'id) root-id)
          (hash-remove r 'parent)
          r)))
  (values (jsonl-text-from-records kept) cut* ancestors))

;; Place cut-records under `ancestors` (title chain, outermost first). Merge
;; scaffold nodes by title; never copy anchors onto scaffolds.
(define (jsonl-graft-subtree text ancestors cut-records)
  (define recs (map cdr (jsonl-records text)))
  (define parent-id #f)
  (define new-recs recs)
  (define (find-child-title pid title)
    (for/first ([h (in-list new-recs)]
                #:when (and (equal? (hash-ref h 'parent #f) pid)
                            (equal? (hash-ref h 'title #f) title)))
      h))
  (for ([title (in-list ancestors)])
    (define existing (find-child-title parent-id title))
    (cond
      [existing (set! parent-id (hash-ref existing 'id))]
      [else
       (define id (jsonl-mint-id (jsonl-text-from-records new-recs)))
       (define ords
         (for/list ([h (in-list new-recs)]
                    #:when (equal? (hash-ref h 'parent #f) parent-id))
           (hash-ref h 'ord)))
       (define ord (if (null? ords) (ord-first) (ord-after (last (sort ords string<?)))))
       (define scaffold
         (let* ([h (hash 'id id 'ord ord 'title title)]
                [h (if parent-id (hash-set h 'parent parent-id) h)])
           h))
       (set! new-recs (append new-recs (list scaffold)))
       (set! parent-id id)]))
  ;; Attach cut root under parent-id; keep internal parents.
  (define cut-root-id (hash-ref (car cut-records) 'id))
  (define sibling-ords
    (for/list ([h (in-list new-recs)]
               #:when (equal? (hash-ref h 'parent #f) parent-id))
      (hash-ref h 'ord)))
  (define root-ord
    (if (null? sibling-ords)
        (ord-first)
        (ord-after (last (sort sibling-ords string<?)))))
  (define grafted
    (for/list ([r (in-list cut-records)])
      (if (equal? (hash-ref r 'id) cut-root-id)
          (let* ([h (hash-set r 'ord root-ord)]
                 [h (if parent-id (hash-set h 'parent parent-id) (hash-remove h 'parent))])
            h)
          r)))
  (define final (append new-recs grafted))
  (define new-text (jsonl-text-from-records final))
  ;; Line of the cut root in the new file
  (define line
    (for/first ([p (in-list (jsonl-records new-text))]
                #:when (equal? (hash-ref (cdr p) 'id) cut-root-id))
      (car p)))
  (values new-text (or line 1)))

;; ---- daily helpers ----------------------------------------------------------

(define (jsonl-include-paths text)
  (for/list ([p (in-list (jsonl-records text))]
             #:when (hash-has-key? (cdr p) 'include))
    (hash-ref (cdr p) 'include)))

;; Ensure a top-level day record titled `day` exists. -> text, line, created?
(define (jsonl-ensure-day text day)
  (define hits (jsonl-find-by-title text day))
  (cond
    [(pair? hits) (values text (car (car hits)) #f)]
    [else
     (define id (jsonl-mint-id text))
     (define-values (text* line)
       (jsonl-insert-child text #f (hash 'id id 'title day)))
     (values text* line #t)]))

;; Ensure year > month chain and an include record for `rel` under the month.
;; -> (values text wrote-root?)
(define (jsonl-root-with-include text year-title mon-title rel)
  (define recs (map cdr (jsonl-records text)))
  (define wrote? #f)
  (define (find-title pid title)
    (for/first ([h (in-list recs)]
                #:when (and (equal? (hash-ref h 'parent #f) pid)
                            (equal? (hash-ref h 'title #f) title)))
      h))
  (define year
    (or (find-title #f year-title)
        (let ([id (jsonl-mint-id (jsonl-text-from-records recs))])
          (define h (hash 'id id 'ord (ord-first) 'title year-title))
          (set! recs (append recs (list h)))
          (set! wrote? #t)
          h)))
  (define year-id (hash-ref year 'id))
  (define mon
    (or (find-title year-id mon-title)
        (let ([id (jsonl-mint-id (jsonl-text-from-records recs))])
          (define ords
            (for/list ([h (in-list recs)]
                       #:when (equal? (hash-ref h 'parent #f) year-id))
              (hash-ref h 'ord)))
          (define ord (if (null? ords) (ord-first) (ord-after (last (sort ords string<?)))))
          (define h (hash 'id id 'parent year-id 'ord ord 'title mon-title))
          (set! recs (append recs (list h)))
          (set! wrote? #t)
          h)))
  (define mon-id (hash-ref mon 'id))
  (define already
    (for/or ([h (in-list recs)])
      (and (equal? (hash-ref h 'parent #f) mon-id)
           (equal? (hash-ref h 'include #f) rel)
           #t)))
  (unless already
    (define id (jsonl-mint-id (jsonl-text-from-records recs)))
    (define ords
      (for/list ([h (in-list recs)]
                 #:when (equal? (hash-ref h 'parent #f) mon-id))
        (hash-ref h 'ord)))
    (define ord (if (null? ords) (ord-first) (ord-after (last (sort ords string<?)))))
    (set! recs
          (append recs
                  (list (hash 'id id 'parent mon-id 'ord ord 'include rel))))
    (set! wrote? #t))
  (values (jsonl-text-from-records recs) wrote?))
