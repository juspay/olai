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
;;   * the transitive set of files the outlines are built from (roots plus
;;     @include fragments), which is what a watcher must watch;
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
         racket/path
         racket/port
         syntax/modread
         (except-in olai/lang/expander #%module-begin)
         olai/lang/walk
         olai/load
         ;; one owner for how a file is named in the UI
         (only-in olai/paths file-label))

;; Handlers hold a store for the life of the process and read a snapshot per
;; request: the two things that must not be confused with each other, or with
;; a bare list of outlines. Contracts say which is which at the boundary.
(provide (contract-out
          [make-store (-> (listof (or/c path? string?)) store?)]
          [store? (-> any/c boolean?)]
          [store-files (-> store? (listof path?))]
          [store-snapshot (-> store? snapshot?)]
          [store-error (-> store? (or/c load-error? #f))]
          [store-revision (-> store? exact-positive-integer?)]
          [store-invalidate! (->* (store?) (#:force? any/c) void?)]
          [struct snapshot ([outlines (listof outline?)]
                            [files-data list?]
                            [index hash?]
                            [watch (listof path?)])]
          [outline-index (-> list? hash?)]
          [snapshot-day-key (-> snapshot? string? (or/c string? #f))]
          [call-in-outline-namespace (-> (-> any) any)]))

;; One consistent view of the outlines. Handlers read this once and never see
;; a half-reloaded world.
;;   outlines   : (listof outline) as loaded — mirror sites still unbound,
;;                which is what the durable JSON serializes
;;   files-data : (listof (list path tasks)) — render's input: the same trees
;;                with every mirror site already bound to its node
;;                (olai/lang/walk, resolve-mirrors)
;;   index      : hash node-id -> (list task breadcrumb)
;;   watch      : (listof path) roots + transitive @include fragments
(struct snapshot (outlines files-data index watch) #:transparent)

(define empty-snapshot (snapshot '() '() (hash) '()))

;; probe : hash path -> (cons mtime size) | #f, for cheap staleness checks
;; rev   : bumped by every reload, so "did anything happen?" is a comparison
(struct store (files [snap #:mutable] [err #:mutable] [probe #:mutable]
                     [rev #:mutable] sema))

;; ---- fresh namespaces -----------------------------------------------------

(define-namespace-anchor here)

;; Shared with every reload: attaching (not re-requiring) keeps one `task`
;; struct type and works inside the packaged binary, where these modules are
;; embedded and cannot be found by collection path.
(define attached-modules
  '(olai/lang/expander
    olai/lang/reader))

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

(define (probe-file p)
  (define full (simple-form-path p))
  (and (file-exists? full)
       (cons (file-or-directory-modify-seconds full #f (λ () #f))
             (file-size full))))

(define (probe-for paths)
  (for/hash ([p (in-list paths)])
    (values (path-key p) (probe-file p))))

;; A module reports only the includes it spliced directly: a fragment's own
;; includes were flattened before it exported `tasks`. Walk the graph so the
;; watch set covers every file the outline is built from.
(define (module-includes p)
  (with-handlers ([exn:fail? (λ (_e) '())])
    (for/list ([s (in-list (dynamic-require `(file ,(path->string (simple-form-path p)))
                                            'includes))])
      (simple-form-path (string->path s)))))

(define (watch-set outlines)
  (define seen (make-hash))
  (define acc '())
  (define (visit p)
    (define k (path-key p))
    (unless (hash-ref seen k #f)
      (hash-set! seen k #t)
      (set! acc (cons (simple-form-path p) acc))
      (for ([q (in-list (module-includes p))]) (visit q))))
  (for ([o (in-list outlines)]) (visit (outline-path o)))
  (reverse acc))

;; key -> (list task crumbs) for every node, where crumbs is the trail from
;; the file label down to and including the node itself, each crumb a
;; (list label key) with key #f for the file label. Keys come from the model
;; (task-key), so this is a plain invertible hash: no id formula restated
;; anywhere, no scan when a lookup misses. Mirrors are not indexed — a mirror
;; site is the same node as its defining site, and that site owns the key.
(define (outline-index files-data)
  (define idx (make-hash))
  (for ([e (in-list files-data)])
    (define file-crumb (list (list (file-label (car e)) #f)))
    (fold-tasks
     (cadr e)
     (λ (tk path _acc)
       (unless (hash-has-key? idx (task-key tk))
         (hash-set! idx (task-key tk)
                    (list tk
                          (append file-crumb
                                  (for/list ([n (in-list (task-path path tk))])
                                    (list (task-title n) (task-key n)))))))
       idx)
     idx))
  idx)

;; The key of the day node titled `iso-day` (Daily.rkt keeps one per day), or
;; #f. First match in file order, so the answer does not depend on hash order.
(define (snapshot-day-key snap iso-day)
  (for/or ([e (in-list (snapshot-files-data snap))])
    (fold-tasks (cadr e)
                (λ (tk _path acc)
                  (or acc (and (equal? (task-title tk) iso-day) (task-key tk))))
                #f)))

;; Node keys are minted here, over the whole loaded set at once (see
;; mint-outline-keys): a fragment shared by two roots is one node with one
;; key, and the index below can be a plain invertible hash.
;;
;; Mirror sites are bound here too, once per load rather than once per render:
;; what handlers get is a tree of already-bound nodes, and the renderer never
;; holds an anchors hash.
(define (build-snapshot outlines watch)
  (define outs (mint-outline-keys outlines))
  (define files-data
    (for/list ([o (in-list outs)])
      (list (outline-path o)
            (resolve-mirrors (outline-tasks o) (outline-anchors o)))))
  (snapshot outs
            files-data
            (outline-index files-data)
            watch))

;; -> (values (listof outline) #f (listof path)) | (values #f load-error '())
(define (load-all files)
  (call-in-outline-namespace
   (λ ()
     (let loop ([fs files] [acc '()])
       (cond
         [(null? fs)
          (define outs (reverse acc))
          (values outs #f (watch-set outs))]
         [else
          (define r (try-load-outline (car fs)))
          (if (outline? r)
              (loop (cdr fs) (cons r acc))
              (values #f r '()))])))))

;; ---- the store ------------------------------------------------------------

(define (make-store files)
  (define st (store (for/list ([f (in-list files)])
                      (simple-form-path (if (path? f) f (string->path f))))
                    empty-snapshot
                    #f
                    (hash)
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
  (define files (store-files st))
  (define-values (outs err watch) (load-all files))
  (cond
    [outs
     (set-store-snap! st (build-snapshot outs watch))
     (set-store-err! st #f)
     (set-store-probe! st (probe-for watch))]
    [else
     ;; Keep last-good. Probe the files we know about anyway, so a broken
     ;; file is retried on the next edit and not on every request.
     (set-store-err! st err)
     (set-store-probe!
      st
      (probe-for (remove-duplicates
                  (append files (snapshot-watch (store-snap st)))
                  #:key path-key)))])
  (set-store-rev! st (add1 (store-rev st))))

(define (stale? st)
  (define want (store-probe st))
  (or (zero? (hash-count want))
      (for/or ([(k v) (in-hash want)])
        (not (equal? v (probe-file (string->path k)))))))

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
