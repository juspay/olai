#lang racket/base

;; Loading an outline module, and turning load failures into srcloc-bearing
;; messages. Shared by the CLI and the web server — both need the same
;; file:line:col fidelity, neither should re-implement it.
;;
;; The expander is the only validator: we just dynamic-require and report.

(require racket/list
         racket/path)

(provide (struct-out outline)
         (struct-out load-error)
         try-load-outline
         exn-location
         exn-message*)

;; A loaded outline module. Named fields, not a positional tuple: every
;; consumer (CLI, JSON, web) reads the same four things and used to
;; destructure them by index.
;;   path     : path of the outline file
;;   tasks    : (listof task)
;;   anchors  : hash id -> task
;;   includes : (listof string) absolute paths spliced in by @include
(struct outline (path tasks anchors includes) #:transparent)

;; A load failure, with the srcloc of the offending form (CLAUDE.md: errors
;; carry file:line:col). line/col may be #f when the exn had no source.
(struct load-error (message file line col) #:transparent)

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
     (if (pair? locs)
         (let ([loc (last locs)])
           (cond
             [(srcloc? loc)
              (values (srcloc-source loc) (srcloc-line loc) (srcloc-column loc))]
             [(list? loc)
              (values (list-ref loc 0) (list-ref loc 1) (list-ref loc 2))]
             [else (values fallback-path #f #f)]))
         (values fallback-path #f #f))]
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

;; -> outline | load-error
(define (try-load-outline path)
  (with-handlers
      ([exn:fail?
        (λ (e)
          (define-values (src line col) (exn-location e path))
          (load-error (exn-message* e) (or src path) line col))])
    (define mod `(file ,(path->string path)))
    (define tasks (dynamic-require mod 'tasks))
    (define anchors
      (with-handlers ([exn:fail? (λ (_) (hash))])
        (dynamic-require mod 'anchors)))
    (define includes
      (with-handlers ([exn:fail? (λ (_) '())])
        (dynamic-require mod 'includes)))
    (outline path tasks anchors includes)))
