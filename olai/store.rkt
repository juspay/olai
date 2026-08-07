#lang racket/base

;; The snapshot layer.
;;
;; Outline files change per save (seconds); Racket's module registry caches a
;; loaded module for the life of the process (days). A server that loads once
;; serves yesterday's outline, and a mutation route would re-render the state
;; from BEFORE its own write. The store owns that mismatch:
;;
;;   * one current snapshot — the loaded outlines plus everything derived from
;;     them (render input, node index, merged anchors), computed once per load
;;     instead of once per request;
;;   * the transitive set of files the outlines are built from (roots, @include
;;     fragments, and the documents @doc attaches), which is what a watcher
;;     must watch;
;;   * last-good + current-error: a file is transiently broken during every
;;     edit, so a failed load keeps serving the last good snapshot and records
;;     the error instead of blanking the page.
;;
;; Reloads run in a FRESH namespace (the registry would otherwise hand back
;; the first version of the file forever). The expander is ATTACHED to that
;; namespace rather than re-instantiated, so the `task` struct type stays the
;; same value across reloads; outlines are compiled in this module's namespace
;; and only instantiated in the fresh one, which is what keeps reloading
;; working inside the `raco exe` binary (see compiling-load).

(require racket/contract
         racket/list
         racket/match
         racket/path
         racket/port
         syntax/modread
         (except-in olai/lang/expander #%module-begin)
         olai/lang/walk
         ;; what a starred @include reads, and what it names right now: the
         ;; one thing in the module graph that can move without a file the
         ;; store already probed having been touched
         (only-in olai/glob glob-expand)
         (only-in olai/edges edge-index?)
         olai/load
         ;; what the one path this store was built from names right now: the
         ;; root set is a QUESTION about the disk, not a list taken at boot
         (only-in olai/paths root-outlines)
         ;; where a @doc path points and what is in it; the store is the one
         ;; layer that reads one, because it is the one that knows when to
         ;; read it again
         (only-in olai/doc doc-path doc-text)
         ;; how a node is addressed, and what sits above it
         (only-in olai/index outline-index))

;; Handlers hold a store for the life of the process and read a snapshot per
;; request: the two things that must not be confused with each other, or with
;; a bare list of outlines. Contracts say which is which at the boundary.
(provide (contract-out
          [make-store (-> (or/c path? string?) store?)]
          [store? (-> any/c boolean?)]
          [store-root (-> store? path?)]
          [store-snapshot (-> store? snapshot?)]
          [store-error (-> store? (or/c load-error? #f))]
          [store-revision (-> store? exact-positive-integer?)]
          [store-invalidate! (->* (store?) (#:force? any/c) void?)]
          [struct snapshot ([linked linked?]
                            [files-data list?]
                            [index hash?]
                            [docs hash?]
                            [watch (listof path?)]
                            [globs (listof path?)])]
          [snapshot-outlines (-> snapshot? (listof outline?))]
          [snapshot-edges (-> snapshot? edge-index?)]
          [snapshot-day-key (-> snapshot? string? (or/c string? #f))]
          [call-in-outline-namespace (-> (-> any) any)]))

;; One consistent view of the outlines. Handlers read this once and never see
;; a half-reloaded world.
;;   linked     : the loaded set as olai/load produced it — the outlines with
;;                mirror sites still unbound (which is what the durable JSON
;;                serializes), and the anchor index they share
;;   files-data : (listof (list path tasks)) — render's input: the same trees
;;                with every mirror site already bound to its node
;;                (olai/lang/walk, resolve-mirrors)
;;   index      : hash key -> node-entry (olai/index) — every node, addressed
;;   docs       : hash absolute-path-string -> text, the @doc documents as
;;                they read right now (see read-docs below)
;;   watch      : (listof path) roots, transitive @include fragments, and
;;                every document @doc named
;;   globs      : (listof path) every glob pattern an @include expanded, as an
;;                absolute path. Not files but QUESTIONS: their answers are
;;                what the module graph above was built from, so a new file in
;;                one's directory is a reload even though nothing in `watch`
;;                moved. The watcher watches where they read (web/watch).
(struct snapshot (linked files-data index docs watch globs) #:transparent)

;; The questions every handler asks the set, without unwrapping it. The anchor
;; index has no such reader: mirror sites are bound here, once per load, so
;; nothing downstream has to resolve a name.
(define (snapshot-outlines snap) (linked-outlines (snapshot-linked snap)))

;; The typed-edge graph the load derived (olai/edges). Unwrapped, not asked:
;; what a caller wants to KNOW from it — which nodes are waiting on something
;; unfinished — is a pure query (olai/query), and a store that answered it
;; would be a second door to the same question the CLI already opens itself.
(define (snapshot-edges snap) (linked-edges (snapshot-linked snap)))

(define empty-snapshot (snapshot empty-linked '() (hash) (hash) '() '()))

;; root  : the ONE path this store was pointed at — a directory, or a single
;;         outline. Which files that names is asked of the disk on every
;;         staleness probe, exactly like an `@include` glob: a directory is a
;;         standing question, so an outline created under it after boot is a
;;         root without a restart.
;; probe : what the last load was built from, as it was then (see below)
;; rev   : bumped by every reload, so "did anything happen?" is a comparison
(struct store (root [snap #:mutable] [err #:mutable] [probe #:mutable]
                    [rev #:mutable] sema))

;; ---- fresh namespaces -----------------------------------------------------

(define-namespace-anchor here)

;; Shared with every reload: attaching (not re-requiring) keeps one `task`
;; struct type and works inside the packaged binary, where these modules are
;; embedded and cannot be found by collection path. Both #lang readers —
;; outline and s-expression — must be here; the sexp one is embedded via
;; ++lib (see nix/olai.nix), not ++lang.
(define attached-modules
  '(olai/lang/expander
    olai/lang/reader
    olai/sexp/lang/reader))

(define (make-outline-namespace src)
  (define ns (parameterize ([current-namespace src]) (make-base-empty-namespace)))
  (for ([m (in-list attached-modules)])
    (parameterize ([current-namespace src])
      (dynamic-require m 0))
    (namespace-attach-module src m ns))
  ns)

(define default-load (current-load))

;; Outlines are COMPILED here, in this module's own namespace, and only
;; INSTANTIATED in the fresh one. That split is what makes reloading work in
;; the packaged binary: `raco exe` rewrites module names as it embeds them,
;; and a from-scratch namespace there cannot run the compile-time machinery
;; the expander needs (syntax/parse keeps state in a module no fresh registry
;; can reach). Compiled code needs nothing but its runtime imports — for an
;; outline that is the expander, which is attached.
(define ((compiling-load src) path expected)
  (define code
    (parameterize ([current-namespace src]
                   [current-load default-load])
      (with-module-reading-parameterization
       (λ ()
         (call-with-input-file path
           (λ (in)
             (port-count-lines! in)   ; srclocs: file:line:col has tests
             (define stx (read-syntax path in))
             (compile (if expected
                          (check-module-form stx expected path)
                          stx))))))))
  (eval code))

;; Run `proc` with a namespace that has never seen an outline file: outlines
;; load from source, includes and all. Also the validation namespace for the
;; write path — a long-lived process must not validate a new temp file against
;; a cached older one.
(define (call-in-outline-namespace proc)
  (define src (namespace-anchor->namespace here))
  (parameterize ([current-namespace (make-outline-namespace src)]
                 [current-load (compiling-load src)])
    (proc)))

;; ---- loading --------------------------------------------------------------

(define (path-key p)
  (path->string (simple-form-path p)))

;; ---- what a load was built from, as it was then ----------------------------
;;
;; Three kinds of dependency and two ways to check one: a FILE is what it was
;; when its mtime and size are, and a QUESTION — an `@include` glob, or the
;; root spec this store was built from — is what it was when it still names
;; the same files. All three are taken at the same moment and asked at the
;; same moment, so they are one value — fields updated in step by discipline
;; is how a saved document went unnoticed once already.
;;
;; The root spec is in here rather than being read once at boot for the same
;; reason the globs are: `serve DIR` is pointed at a directory, and the first
;; `Archive.rkt` an `olai archive` writes into it is a file no watched file's
;; mtime knows about.

(struct probe (files globs roots) #:transparent)

(define empty-probe (probe (hash) (hash) (hash)))

;; Both take a KEY — an absolute, simplified path string (path-key) — rather
;; than a path: this runs over every watched file on every request, and the
;; hash already holds the normalized form.
(define (file-stamp key)
  (define p (string->path key))
  (and (file-exists? p)
       (cons (file-or-directory-modify-seconds p #f (λ () #f))
             (file-size p))))

(define (glob-answer key)
  (glob-expand (string->path key)))

(define (roots-answer key)
  (root-outlines (string->path key)))

(define (take-probe paths globs root)
  (define (stamped xs f)
    (for/hash ([x (in-list xs)])
      (define k (path-key x))
      (values k (f k))))
  (probe (stamped paths file-stamp)
         (stamped globs glob-answer)
         (stamped (list root) roots-answer)))

;; Does everything still answer the way it did? An empty probe never does:
;; before the first successful load there is nothing to have changed, and that
;; is exactly the state a store has to keep trying to get out of. A store
;; always has a root, so the empty case is the one nobody built.
(define (probe-current? pr)
  (define (all-agree? h f)
    (for/and ([(k v) (in-hash h)]) (equal? v (f k))))
  (and (positive? (+ (hash-count (probe-files pr)) (hash-count (probe-roots pr))))
       (all-agree? (probe-files pr) file-stamp)
       (all-agree? (probe-globs pr) glob-answer)
       (all-agree? (probe-roots pr) roots-answer)))

;; What one module says it was built from: the files it spliced DIRECTLY, and
;; the patterns it starred itself. A fragment's own includes were flattened
;; before it exported `tasks`, which is why the graph is walked below rather
;; than read off the root.
;; -> (values (listof path) (listof path))
(define (module-sources full)
  (define mod `(file ,full))
  (define (export name)
    (with-handlers ([exn:fail? (λ (_e) '())])
      (for/list ([s (in-list (dynamic-require mod name))])
        (simple-form-path (string->path s)))))
  (values (export 'includes) (export 'include-globs)))

;; Every file the outlines are built from, and every pattern they are still
;; watching a directory for.
;; -> (values (listof path) (listof path))
(define (watch-set outlines)
  (define seen (make-hash))
  (define files '())
  (define globs '())
  (define (visit p)
    (define full (simple-form-path p))
    (define k (path->string full))
    (unless (hash-ref seen k #f)
      (hash-set! seen k #t)
      (set! files (cons full files))
      (define-values (includes patterns) (module-sources k))
      (set! globs (append (reverse patterns) globs))
      (for ([q (in-list includes)]) (visit q))))
  (for ([o (in-list outlines)]) (visit (outline-path o)))
  (values (reverse files) (remove-duplicates (reverse globs) #:key path->string)))

;; The key of the day node titled `iso-day` (Daily.rkt keeps one per day), or
;; #f. First match in file order, so the answer does not depend on hash order.
(define (snapshot-day-key snap iso-day)
  (for/or ([e (in-list (snapshot-files-data snap))])
    (match-define (list _ tasks) e)
    (fold-tasks tasks
                (λ (tk _path acc)
                  (or acc (and (equal? (task-title tk) iso-day) (task-key tk))))
                #f)))

;; ---- @doc documents -------------------------------------------------------
;;
;; A document is a file, so it belongs to this layer twice over: it is read
;; ONCE per load rather than once per request (the renderer is pure and must
;; be handed text, not a path), and it joins the watch set beside the @include
;; fragments, because editing a document is editing what the page shows.
;;
;; Keyed by the absolute path rather than by node: two nodes may attach the
;; same document, and a document reached through two roots is one file.

;; Every document the loaded outlines name, sorted so a watch set built twice
;; from the same outlines is the same list.
(define (doc-paths outs)
  (sort
   (remove-duplicates
    (for/fold ([acc '()]) ([o (in-list outs)])
      (fold-tasks (outline-tasks o)
                  (λ (tk _path acc)
                    (define p (doc-path (task-doc tk) (task-file tk)))
                    (if p (cons p acc) acc))
                  acc)))
   string<?))

;; A document that cannot be read is simply absent, and the view draws that
;; state. It is not an error the way a broken outline is: the language already
;; refused an outline naming a document that is not there, so getting here
;; means the file moved between the load and this read — and the watcher is
;; about to say so anyway.
(define (read-docs paths)
  (for/fold ([acc (hash)]) ([p (in-list paths)])
    (define text (doc-text p))
    (if text (hash-set acc p text) acc)))

;; The set arrives already LINKED (olai/load, link-outlines): keys minted over
;; every file at once, so a fragment shared by two roots is one node with one
;; key and the index below can be a plain invertible hash — and one anchor
;; index over all of them.
;;
;; Mirror sites are bound here, once per load rather than once per render, and
;; against that SET-WIDE index: a `*meeting-prep` in Daily.rkt is the node
;; Tasks.rkt defines, not an unresolved marker. What handlers get is a tree of
;; already-bound nodes, and the renderer never holds an anchors hash.
(define (build-snapshot lk watch globs)
  (define outs (linked-outlines lk))
  (define anchors (linked-anchors lk))
  (define files-data
    (for/list ([o (in-list outs)])
      (list (outline-path o)
            (resolve-mirrors (outline-tasks o) anchors))))
  (define docs (doc-paths outs))
  (snapshot lk
            files-data
            (outline-index files-data)
            (read-docs docs)
            ;; watched whether or not the read succeeded: the file coming
            ;; back is exactly the change nobody would otherwise hear about
            (append watch (map string->path docs))
            globs))

;; -> (values linked #f (listof path) (listof path))
;;  | (values #f load-error '() '())
;;
;; The set is olai/load's to assemble; what this layer adds is WHEN — a fresh
;; namespace, so the module registry cannot hand back yesterday's file — and
;; what says when to do it again: the files the outlines are built from, and
;; the patterns whose answers they were built from.
;;
;; `files` are CANDIDATES, and which of them are roots is load-roots' answer:
;; one that another one `@include`s is not one (see there).
(define (load-all files)
  (call-in-outline-namespace
   (λ ()
     (define lk (load-roots files))
     (cond
       [(linked? lk)
        (define-values (watch globs) (watch-set (linked-outlines lk)))
        (values lk #f watch globs)]
       [else (values #f lk '() '())]))))

;; ---- the store ------------------------------------------------------------

(define (make-store root)
  (define st (store (simple-form-path (if (path? root) root (string->path root)))
                    empty-snapshot
                    #f
                    empty-probe
                    0
                    (make-semaphore 1)))
  (reload! st)
  st)

;; The snapshot every handler reads. Always a value, never #f: before the
;; first successful load it is simply empty.
(define (store-snapshot st) (store-snap st))

;; #f, or the load-error from the most recent failed reload (last-good is
;; still being served).
(define (store-error st) (store-err st))

;; A counter that moves whenever the store re-read the files — including a
;; reload that FAILED, because a file that just broke is a change every
;; reader has to see (the page grows a banner, /api/* starts failing). A
;; caller that has to ask "did that invalidate do anything?" compares this
;; instead of diffing snapshots. 1 after make-store, never 0.
(define (store-revision st) (store-rev st))

(define (reload! st)
  (define root (store-root st))
  ;; asked again on every reload, never remembered: the whole point of the
  ;; directory form is that this answer moves
  (define files (root-outlines root))
  (define-values (lk err watch globs) (load-all files))
  (cond
    [lk
     ;; probe what the SNAPSHOT says it is built from, not what load-all
     ;; found: the module graph is only half of it — the documents come off
     ;; the loaded tasks, and a set that is probed and a set that is watched
     ;; being two different lists is how a saved document goes unnoticed.
     (define snap (build-snapshot lk watch globs))
     (set-store-snap! st snap)
     (set-store-err! st #f)
     (set-store-probe!
      st
      (take-probe (snapshot-watch snap) (snapshot-globs snap) root))]
    [else
     ;; Keep last-good. Probe the files we know about anyway, so a broken
     ;; file is retried on the next edit and not on every request. The globs
     ;; are last-good's too: a file appearing in one's directory is a reason
     ;; to try again, and the outline that failed may be exactly the one that
     ;; was mid-save when the file arrived.
     (define last-good (store-snap st))
     (set-store-err! st err)
     (set-store-probe!
      st
      (take-probe (remove-duplicates (append files (snapshot-watch last-good))
                                     #:key path-key)
                  (snapshot-globs last-good)
                  root))])
  (set-store-rev! st (add1 (store-rev st))))

(define (stale? st)
  (not (probe-current? (store-probe st))))

;; Reload when any watched file changed on disk (#:force? reloads regardless).
;; The watcher and the write path both call this; handlers call it as their
;; preamble, so a save is visible on the next request.
(define (store-invalidate! st #:force? [force? #f])
  (call-with-semaphore
   (store-sema st)
   (λ ()
     (when (or force? (stale? st))
       (reload! st))))
  (void))
