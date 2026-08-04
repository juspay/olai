#lang racket/base

;; Loading an outline module, and turning load failures into srcloc-bearing
;; messages. Shared by the CLI and the web server — both need the same
;; file:line:col fidelity, neither should re-implement it.
;;
;; The expander is the only validator: we just dynamic-require and report.

(require racket/list
         racket/path)

(provide try-load-outline
         exn-location
         exn-message*)

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

;; -> (list 'ok tasks anchors includes) | (list 'error msg src line col)
(define (try-load-outline path)
  (with-handlers
      ([exn:fail?
        (λ (e)
          (define-values (src line col) (exn-location e path))
          (list 'error (exn-message* e) (or src path) line col))])
    (define mod `(file ,(path->string path)))
    (define tasks (dynamic-require mod 'tasks))
    (define anchors
      (with-handlers ([exn:fail? (λ (_) (hash))])
        (dynamic-require mod 'anchors)))
    (define includes
      (with-handlers ([exn:fail? (λ (_) '())])
        (dynamic-require mod 'includes)))
    (list 'ok tasks anchors includes)))
