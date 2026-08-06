#lang racket/base

;; What the live forms in a file turn into.
;;
;; A macro that cannot be looked through is a macro an agent debugs by
;; guessing, and the one recorded case of an agent successfully debugging
;; generated code turned on being able to dump the expansion. So the dump is
;; part of the interface here, not a debugging convenience:
;;
;;   just expand live/examples/counters/list.rkt
;;
;; `raco expand` prints the whole module, most of which is `#lang racket/base`
;; arriving. This prints only the live forms, each beside what it became —
;; ONE level, the macro's own output, before the expander went on to rewrite
;; the result into core syntax. That is the level a reader wants: the point of
;; the forms is that they expand into ordinary calls on live/client, and this
;; is where you check that they did.
;;
;; How: every form in live/dsl labels its output with a `'live-form` syntax
;; property carrying the pair (source-form . expansion). Expanding the module
;; and walking the result for that property is the whole implementation — no
;; second expander, and nothing here that has to be kept in step with the
;; grammar.

(require racket/cmdline
         racket/path
         racket/pretty
         syntax/modread)

(provide live-form-expansions)

;; path -> (listof (cons syntax? any/c)), in source order
(define (live-form-expansions path)
  (define found (make-hasheq))
  (let walk ([s (expand-module path)])
    (when (syntax? s)
      (for ([pair (in-list (property-pairs (syntax-property s 'live-form)))])
        (hash-set! found pair #t)))
    (define e (if (syntax? s) (syntax-e s) s))
    (cond
      [(pair? e) (walk (car e)) (walk (cdr e))]
      [(vector? e) (for-each walk (vector->list e))]
      [(box? e) (walk (unbox e))]
      [else (void)]))
  (sort (hash-keys found) < #:key (λ (p) (or (syntax-position (car p)) 0))))

;; Setting a property twice on one syntax object conses the values together,
;; so what comes back is a tree of them and not always ours alone.
(define (property-pairs v)
  (cond
    [(and (pair? v) (syntax? (car v))) (list v)]
    [(pair? v) (append (property-pairs (car v)) (property-pairs (cdr v)))]
    [else '()]))

;; The module, expanded in a namespace of its own. `current-load-relative-directory`
;; is what makes the file's own relative requires resolve — a drawer requires
;; the producer next to it, and that is exactly the pair worth dumping.
(define (expand-module path)
  ;; resolved before anything is parameterized: a relative FILE argument is
  ;; relative to where the command was run, and the directory below is about
  ;; the module's own requires
  (define full (path->complete-path path))
  (parameterize ([current-namespace (make-base-namespace)]
                 [current-load-relative-directory (path-only full)])
    (expand (read-module full))))

(define (read-module full)
  (parameterize ([read-accept-reader #t]
                 [read-accept-lang #t])
    (with-module-reading-parameterization
     (λ ()
       (call-with-input-file full
         (λ (in)
           (port-count-lines! in)
           (read-syntax full in)))))))

(module+ main
  (define target
    (command-line
     #:program "expand"
     #:args (file)
     file))
  (define pairs (live-form-expansions target))
  (cond
    [(null? pairs) (printf ";; no live forms in ~a\n" target)]
    [else
     ;; wider than the default 79: these are one call with keyword arguments,
     ;; and a keyword split off its value reads worse than a long line
     (pretty-print-columns 100)
     (for ([p (in-list pairs)])
       (printf ";; ~a:~a:~a\n"
               target
               (or (syntax-line (car p)) 0)
               (or (syntax-column (car p)) 0))
       (pretty-write (syntax->datum (car p)))
       (printf ";; =>\n")
       (pretty-write (cdr p))
       (newline))]))
