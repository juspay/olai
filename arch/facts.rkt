#lang racket/base

;; The two questions only a compiler can answer: what a module EXPORTS, and
;; what names reach it from everything it requires.
;;
;; Both come off compiled modules — `(dynamic-require path #f)` declares a
;; module without instantiating it, so nothing here runs anybody's code, opens
;; anybody's port or starts anybody's thread. The whole tree costs about a
;; second with `.zo` on disk, which is why `just arch` depends on `just build`
;; the way `just test` does.
;;
;; Why not read `provide` and `require` out of the source instead: `(provide
;; (struct-out task))` is nine names and `(provide (all-defined-out))` is
;; however many there are today. A source reader would have to become a small
;; expander to answer that, and would then be wrong in a different way from the
;; real one. Locations come from the source (arch/source); names come from
;; here; neither module computes the other's answer.

(require racket/contract
         racket/list
         racket/set)

(provide (contract-out
          [module-defines (-> path? (listof symbol?))]
          [module-provides (-> path? (listof symbol?))]
          [names-from (-> path? set?)]))

;; Everything `path` provides that it also DEFINES — a re-export is somebody
;; else's name passing through, and a facade that re-exports the tree is not a
;; second owner of everything in it. The module system says which is which: a
;; locally defined export has no nominal source module beside it.
(define (module-defines path)
  (for/list ([e (in-list (exports path))] #:when (null? (cadr e)))
    (car e)))

(define (module-provides path)
  (map car (exports path)))

;; Every name `path` exports, at every phase, whether it defined it or not.
;; This is the set a requiring module gets to see.
(define (names-from path)
  (list->seteq (module-provides path)))

;; ---- the module system ---------------------------------------------------------

;; Declared once per path per process. Two modules requiring racket/base ask
;; the same question, and the answer is thousands of names.
(define exports-cache (make-hash))

(define (exports path)
  (hash-ref! exports-cache
             path
             (λ ()
               (dynamic-require path #f)
               (define-values (vars stxs) (module->exports path))
               (for*/list ([group (in-list (append vars stxs))]
                           [e (in-list (cdr group))])
                 (list (car e) (cadr e))))))
