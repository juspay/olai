#lang racket/base

;; Loading an outline module, and turning load failures into srcloc-bearing
;; messages. Shared by the CLI and the web server — both need the same
;; file:line:col fidelity, neither should re-implement it.
;;
;; The expander is the only validator: we just dynamic-require and report.

(require racket/contract
         racket/list
         racket/match
         racket/path
         racket/string
         file/sha1
         (except-in olai/lang/expander #%module-begin)
         ;; what an anchor means once several files are held at once — and
         ;; what it means over the files one write touched
         (only-in olai/lang/link link-anchors link-written)
         ;; and what the typed edges between them derive to, over that same set
         (only-in olai/edges build-edge-index edge-index? empty-edge-index)
         olai/paths)

;; This is a seam, so it ships with contracts: a caller that hands us a string
;; where a path belongs is named by the blame, at its own srcloc, instead of
;; failing three frames down inside dynamic-require. Checks are flat and
;; shallow on purpose — a struct predicate, a list, a hash — never a walk of
;; the task tree.
(provide (contract-out
          [struct outline ([path path?]
                           [tasks list?]
                           [anchors hash?]
                           [includes list?]
                           [include-globs list?])]
          [struct linked ([outlines (listof outline?)]
                          [anchors hash?]
                          [edges edge-index?])]
          [empty-linked linked?]
          [linked-entries (-> linked? list?)]
          [struct load-error ([message string?]
                              [file (or/c path? string? #f)]
                              [line (or/c exact-positive-integer? #f)]
                              [col (or/c exact-nonnegative-integer? #f)])]
          [load-error-where (-> load-error? (or/c string? #f))]
          [load-error-detail (-> load-error? string?)]
          [try-load-outline (-> path? (or/c outline? load-error?))]
          [load-set (-> (listof path?) (or/c linked? load-error?))]
          [load-roots (-> (listof path?) (or/c linked? load-error?))]
          [include-closure (-> (listof path?) (values (listof path?)
                                                      (listof path?)
                                                      hash?))]
          [check-written (-> (listof path?) (or/c #f load-error?))]
          [link-outlines (-> (listof outline?) (or/c linked? load-error?))]
          [mint-outline-keys (-> (listof outline?) (listof outline?))]
          [mint-task-keys (-> list? #:label (-> any/c string?) list?)]
          [exn-location (-> any/c any/c any)]
          [exn-message* (-> any/c string?)]
          ;; any failure of the language, as the four fields every surface
          ;; reports one in — the write path raises its own and needs the
          ;; same translation
          [exn->load-error (-> any/c any/c load-error?)]))

;; A loaded outline module. Named fields, not a positional tuple: every
;; consumer (CLI, JSON, web) reads the same things and used to destructure
;; them by index.
;;   path     : path of the outline file
;;   tasks    : (listof task)
;;   anchors  : hash id -> task
;;   includes : (listof string) absolute paths spliced in by @include
;;   include-globs : (listof string) absolute patterns it starred
;;
;; The last two are what the file SPLICES, and they are one fact in two
;; spellings — a claim about a file, and a query over a directory. Both are
;; here, because a reader that had only the first would have to go back to the
;; module for the second, which is how the store came to keep its own copy of
;; this walk.
(struct outline (path tasks anchors includes include-globs) #:transparent)

;; A loaded SET, linked: the outlines with their keys minted, and the one
;; anchor index they share. An anchor is a name whose scope is the set (see
;; olai/lang/link), so "which node does ^agent mean" has exactly one answer
;; per load and it is this hash — not something each file answers for itself.
;;   outlines : (listof outline), in load order, keys minted
;;   anchors  : hash id -> task, over every file at once
;;   edges    : the typed-edge graph over the same set (olai/edges) — derived
;;              here rather than by each reader, for the same reason the anchor
;;              index is: an edge crosses files, so one load has one answer
(struct linked (outlines anchors edges) #:transparent)

;; No files loaded yet — what a store serves before its first load. Named here
;; rather than built by the caller, so what a linked set CARRIES stays this
;; module's to change.
(define empty-linked (linked '() (hash) empty-edge-index))

;; The set as the pure queries read it: one (file . tasks) per outline, in load
;; order. Named here because it is what `linked` IS to a reader — the agenda,
;; the calendar and the ICS writer all wanted it, and each was spelling the
;; same two accessors into a cons.
(define (linked-entries lk)
  (for/list ([o (in-list (linked-outlines lk))])
    (cons (outline-path o) (outline-tasks o))))

;; A load failure, with the srcloc of the offending form (CLAUDE.md: errors
;; carry file:line:col). line/col may be #f when the exn had no source.
(struct load-error (message file line col) #:transparent)

;; "file:line:col" — or just "file" when the exn carried no position, #f when
;; not even that. Every surface (JSON, plain text, HTML) shows this.
(define (load-error-where err)
  (define f (load-error-file err))
  (define file (and f (if (path? f) (path->string f) f)))
  (cond
    [(and file (load-error-line err))
     (format "~a:~a:~a" file (load-error-line err) (or (load-error-col err) 0))]
    [else file]))

;; The message without a leading copy of `where` (exn-message* already
;; prefixes syntax errors with their location, JSON carries it in fields).
(define (load-error-detail err)
  (define w (load-error-where err))
  (define m (load-error-message err))
  (define prefix (and w (string-append w ": ")))
  (if (and prefix (string-prefix? m prefix))
      (substring m (string-length prefix))
      m))

;; Prefer the most specific syntax object for agents: highest line/col among
;; exprs that carry a source (outline @date values are later subforms).
(define (exn-location e fallback-path)
  (cond
    [(exn:fail:syntax? e)
     (define stxs (exn:fail:syntax-exprs e))
     (define with-src
       (filter (λ (x) (and (syntax-source x) (syntax-line x))) stxs))
     (define s
       (if (null? with-src)
           #f
           (argmax
            (λ (x)
              (+ (* 100000 (or (syntax-line x) 0))
                 (or (syntax-column x) 0)))
            with-src)))
     (if s
         (values (syntax-source s) (syntax-line s) (syntax-column s))
         (values fallback-path #f #f))]
    [(exn:fail:read? e)
     (define locs (exn:fail:read-srclocs e))
     (cond
       [(null? locs) (values fallback-path #f #f)]
       [else
        (match (last locs)
          [(srcloc source line column _ _) (values source line column)]
          [(list source line column _ ...) (values source line column)]
          [_ (values fallback-path #f #f)])])]
    [else (values fallback-path #f #f)]))

(define (exn-message* e)
  (cond
    [(exn:fail:syntax? e)
     (define-values (src line col) (exn-location e #f))
     (define core
       ;; Drop Racket's leading "file:line:col: " if we re-emit a better loc
       (regexp-replace #px"^[^\\s:]+:[0-9]+:[0-9]+:\\s*" (exn-message e) ""))
     (if (and src line)
         (format "~a:~a:~a: ~a" src line (or col 0) core)
         (exn-message e))]
    [(exn:fail? e) (exn-message e)]
    [else (format "~a" e)]))

;; Any failure of the language, as the four fields every surface reports it
;; in. `fallback` is the file to blame when the exn carried no source of its
;; own.
(define (exn->load-error e fallback)
  (define-values (src line col) (exn-location e fallback))
  (load-error (exn-message* e) (or src fallback) line col))

;; -> outline | load-error
(define (try-load-outline path)
  (with-handlers ([exn:fail? (λ (e) (exn->load-error e path))])
    (define mod `(file ,(path->string path)))
    (define tasks (dynamic-require mod 'tasks))
    (define anchors
      (with-handlers ([exn:fail? (λ (_) (hash))])
        (dynamic-require mod 'anchors)))
    (define (spliced name)
      (with-handlers ([exn:fail? (λ (_) '())])
        (dynamic-require mod name)))
    (outline path tasks anchors (spliced 'includes) (spliced 'include-globs))))

;; ---- node identity --------------------------------------------------------
;;
;; A node's key is what everything downstream addresses it by: element ids,
;; permalinks, stored collapse state, SSE swap targets. So it must not be
;; derived from anything the user retypes casually, and it must not depend on
;; WHICH file you happened to load. It is:
;;
;;   * the ^anchor when the node has one — user-chosen, survives everything;
;;   * otherwise a hash of "<defining file>/<child ordinals within that file>"
;;     ("Daily/2026-08.rkt/0.2.1"), which survives renaming the node or any
;;     ancestor, cannot collide between same-titled siblings, and changes only
;;     when siblings are reordered (anchor the node if you want more).
;;
;; Minted HERE and not in the expander, because the expander only ever sees
;; one entry point: a node spliced in by @include would key differently loaded
;; standalone than through the file that includes it, and two roots sharing a
;; fragment would mint two keys for one node.

(define (short-hash s)
  (substring (sha1 (open-input-bytes (string->bytes/utf-8 s))) 0 8))

(define (path-key label ordinals)
  (string-append
   "p"
   (short-hash (format "~a/~a"
                       label
                       (string-join (map number->string ordinals) ".")))))

;; Ordinals are counted per DEFINING file, and restart whenever the file
;; changes: a fragment's top-level tasks are ordinals 0,1,… of the fragment
;; wherever they are spliced. `label-of` names a file (see paths.rkt).
;; An already-minted key (an ^anchor) is left alone.
(define (mint-task-keys tasks #:label label-of)
  (define (walk-forest xs parent-file parent-ords)
    (define counts (make-hash))
    (for/list ([x (in-list xs)])
      (cond
        [(task? x)
         (define f (task-file x))
         (define i (hash-ref counts f 0))
         (hash-set! counts f (add1 i))
         (define ords
           (if (equal? f parent-file)
               (append parent-ords (list i))
               (list i)))
         (struct-copy task x
                      [key (or (task-key x) (path-key (label-of f) ords))]
                      [children (walk-forest (task-children x) f ords)])]
        [else x])))
  (walk-forest tasks #f '()))

;; ---- linking --------------------------------------------------------------
;;
;; Loading is per file; LINKING is what makes the files a set. Both steps here
;; are set-wide and neither can be done by a module: keys are minted over every
;; file at once (see above), and an anchor is a name whose scope is the set —
;; so `*meeting-prep` in Daily.rkt finds the `^meeting-prep` Tasks.rkt defines,
;; and a name declared twice is an error naming both files.
;;
;; The check is the LANGUAGE's, run where cross-file anchors first exist
;; (lang/link) — the same rules and the same messages the module's own passes
;; use, and a failure arrives in the same four fields as any other load error,
;; because it is one.
(define (link-outlines outs)
  (define fallback (and (pair? outs) (outline-path (car outs))))
  (with-handlers ([exn:fail? (λ (e) (exn->load-error e fallback))])
    (define minted (mint-outline-keys outs))
    (define roots (append* (map outline-tasks minted)))
    ;; The checker runs first and the derivation second, in that order and not
    ;; as a matter of taste: an edge naming nothing is a form that is wrong,
    ;; and a graph built from one would be a graph with a hole in it that
    ;; nobody was ever told about.
    (define anchors (link-anchors roots))
    (linked minted anchors (build-edge-index roots anchors))))

;; The whole of what "the files you were given" means: each one loaded, then
;; linked as the set they are. Every read surface wants exactly this — the CLI
;; commands, the store, a test — and the two steps have an order (a set cannot
;; be linked from a file that would not load), so they are one call.
;;
;; -> linked, or the load-error of the first file that would not load, or of
;; the set that would not link.
(define (load-set paths)
  (define outs (load-each paths))
  (if (load-error? outs) outs (link-outlines outs)))

;; The same, of CANDIDATES rather than of a list somebody typed: every outline
;; under a directory, of which the roots are the ones no other one splices.
;;
;; That subtraction is what makes recursion safe. A fragment is an ordinary
;; module — it loads on its own, and read as a root as well as through the
;; file that `@include`s it, it would define every one of its nodes twice: two
;; keys for one node, and an `^anchor` the linker rightly calls a duplicate.
;; So the answer is not "don't look in subdirectories" (which makes a stray
;; outline invisible rather than wrong) but "an included file is not a root",
;; asked of the set itself.
;;
;; The closure is walked rather than read off the candidates: a fragment may
;; live outside the directory that was served, and what IT includes is spliced
;; just the same.
;;
;; -> linked, or the load-error of the first file that would not load, or of
;; the set that would not link.
(define (load-roots paths)
  (define outs (load-each paths))
  (cond
    [(load-error? outs) outs]
    [else
     (define-values (_files _globs spliced)
       (include-closure (map outline-path outs)))
     (link-outlines
      (for/list ([o (in-list outs)]
                 #:unless (hash-ref spliced (path-string (outline-path o)) #f))
        o))]))

;; The one spelling of a file's identity in every list compared here.
(define (path-string p)
  (path->string (simple-form-path (if (path? p) p (string->path p)))))

;; The `@include` graph reachable from `paths`, walked once and answered three
;; ways, because the two callers want different halves of the same walk and a
;; second walk is a second answer waiting to disagree:
;;
;;   files   : every file these are built from, starts included, in order.
;;             What must be re-read when it changes (olai/store's watch set).
;;   globs   : every pattern they starred, deduped. NOT files but questions:
;;             their answers are what the graph was built from, so a new file
;;             in one's directory is a change no file in `files` records.
;;   spliced : path-string -> #t for every file something else `@include`s.
;;             Which is to say: the files that are not roots (load-roots).
;;
;; A file is visited once — the module registry would hand back the same
;; module anyway, and a graph that reaches something twice has to end.
(define (include-closure paths)
  (define seen (make-hash))
  (define spliced (make-hash))
  (define files '())
  (define globs '())
  (define (visit p)
    (define full (simple-form-path p))
    (define key (path->string full))
    (unless (hash-ref seen key #f)
      (hash-set! seen key #t)
      (set! files (cons full files))
      (define o (try-load-outline full))
      (when (outline? o)
        (set! globs (append (reverse (map full-path (outline-include-globs o))) globs))
        (for ([q (in-list (outline-includes o))])
          (hash-set! spliced (path-string q) #t)
          (visit (full-path q))))))
  (for ([p (in-list paths)]) (visit p))
  (values (reverse files)
          (remove-duplicates (reverse globs) #:key path->string)
          spliced))

(define (full-path p)
  (simple-form-path (if (path? p) p (string->path p))))

;; Every one of them, in order, or the first that would not load. What the two
;; callers above then DO with the outlines is the whole of how they differ:
;; a read links them as the set they are, a write holds only the files it wrote.
(define (load-each paths)
  (let loop ([ps paths] [acc '()])
    (cond
      [(null? ps) (reverse acc)]
      [else
       (define r (try-load-outline (car ps)))
       (if (outline? r) (loop (cdr ps) (cons r acc)) r)])))

;; What a WRITE validates: the files it just wrote, loaded and then held
;; together, because a pair can be broken in a way neither half is (olai/edit
;; calls this on the temp files, before anything is renamed over anything).
;;
;; Not `load-set`: no keys are minted (nobody addresses a file that is about to
;; be renamed away) and the anchor scope stays open — a write must not be
;; hostage to a file it is not touching. The difference is one word, and it is
;; lang/link's to say; see link-written there.
;;
;; -> #f when they are good, else the load-error of the first file that would
;; not load, or of the pair that would not hold together.
(define (check-written paths)
  (define outs (load-each paths))
  (cond
    [(load-error? outs) outs]
    [else
     (with-handlers ([exn:fail? (λ (e) (exn->load-error e (car paths)))])
       (link-written (append* (map outline-tasks outs)))
       #f)]))

;; The whole loaded set at once: labels are relative to what these files have
;; in common, so the answer does not depend on the machine's $HOME.
(define (mint-outline-keys outs)
  (define base (roots-base (map outline-path outs)))
  (for/list ([o (in-list outs)])
    (define tasks
      (mint-task-keys (outline-tasks o) #:label (λ (f) (key-label base f))))
    ;; Anchors index the MINTED trees, not the module's originals: a mirror
    ;; site renders the node it finds here, and it must carry the same key.
    (outline (outline-path o) tasks (anchors-of tasks)
             (outline-includes o) (outline-include-globs o))))
