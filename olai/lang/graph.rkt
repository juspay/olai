#lang racket/base

;; The anchor/mirror graph rules, once, for both phases.
;;
;; A module is checked at COMPILE time, over the syntax it was written as;
;; a whole loaded tree is checked at RUN time, after @include has spliced
;; fragments in (cross-file anchors only exist then). Those were two DFS
;; implementations of the same three rules — duplicate ^anchor, unknown
;; *mirror, mirror cycle — and they drifted: with any @include present the
;; compile-time pass was skipped and the runtime one had no srclocs, so an
;; agent got "duplicate ^agent" with no file:line:col at all.
;;
;; So the rules live here, over a NODE PROTOCOL the caller supplies: how to
;; read a node's anchor, its children, whether it is a mirror site, and how
;; to fail on one. Nothing in this module knows what a node is.

(require racket/list
         racket/string)

(provide check-anchor-graph)

;; roots     : (listof node)
;; #:id      : node -> string | #f   (its ^anchor)
;; #:kids    : node -> (listof node)
;; #:mirror  : node -> string | #f   (non-#f = a *mirror site, no children)
;; #:scope   : "this file" | "this tree" — what the anchor list covers
;; #:describe: node -> string        (where it is, for "first declared at")
;; #:fail    : who node message -> ⊥ (node may be #f)
(define (check-anchor-graph roots
                            #:id id-of
                            #:kids kids-of
                            #:mirror mirror-of
                            #:scope scope
                            #:describe describe
                            #:fail fail)
  (define decls (declarations roots id-of kids-of mirror-of describe fail))
  (check-mirrors-resolve roots kids-of mirror-of decls scope fail)
  (check-cycles decls id-of kids-of mirror-of fail)
  (void))

;; anchor -> declaring node; duplicates are the first rule.
(define (declarations roots id-of kids-of mirror-of describe fail)
  (define decls (make-hash))
  (define (walk n)
    (unless (mirror-of n)
      (define id (id-of n))
      (when id
        (define prev (hash-ref decls id #f))
        (when prev
          (fail 't n
                (format "duplicate ^~a; first declared at ~a" id (describe prev))))
        (hash-set! decls id n))
      (for-each walk (kids-of n))))
  (for-each walk roots)
  decls)

(define (check-mirrors-resolve roots kids-of mirror-of decls scope fail)
  (define known (sort (hash-keys decls) string<?))
  (define listed (if (null? known) "(none)" (string-join known ", ")))
  (define (walk n)
    (cond
      [(mirror-of n)
       => (λ (a)
            (unless (hash-has-key? decls a)
              (fail 'mirror n
                    (format "unknown *~a; anchors in ~a: ~a" a scope listed))))]
      [else (for-each walk (kids-of n))]))
  (for-each walk roots))

;; A mirror is the same node, so anchors form a graph: ^a owns *b owns ^a is
;; a node that contains itself. Edges run from an anchored node to every
;; anchor reachable under it, mirror sites included.
(define (check-cycles decls id-of kids-of mirror-of fail)
  (define edges (make-hash))
  (define (add-edge! from to node)
    (hash-set! edges from (cons (cons to node) (hash-ref edges from '()))))
  (define (walk-under n owner)
    (cond
      [(mirror-of n) => (λ (a) (add-edge! owner a n))]
      [else
       (when (id-of n) (add-edge! owner (id-of n) #f))
       (for ([k (in-list (kids-of n))]) (walk-under k owner))]))
  (for ([(id n) (in-hash decls)])
    (for ([k (in-list (kids-of n))]) (walk-under k id)))

  (define WHITE 0) (define GRAY 1) (define BLACK 2)
  (define color (make-hash))
  (define parent (make-hash))

  ;; The trail back to `end` through the parent map, as anchor names.
  (define (cycle-path end)
    (let loop ([cur end] [acc (list end)])
      (define p (hash-ref parent cur #f))
      (cond
        [(not p) acc]
        [else
         (define prev (car p))
         (if (equal? prev end)
             (cons prev acc)
             (loop prev (cons prev acc)))])))

  ;; A mirror site on the cycle: the form to point the error at.
  (define (mirror-on-path path)
    (for/or ([from (in-list path)] [to (in-list (cdr path))])
      (for/or ([e (in-list (hash-ref edges from '()))])
        (and (equal? (car e) to) (cdr e)))))

  (define (dfs u)
    (hash-set! color u GRAY)
    (for ([e (in-list (hash-ref edges u '()))])
      (define v (car e))
      (define site (cdr e))
      (define c (hash-ref color v WHITE))
      (cond
        [(= c GRAY)
         (hash-set! parent v (cons u site))
         (define path (cycle-path v))
         (fail 'mirror
               (or (mirror-on-path path) site)
               (format "mirror *~a creates a cycle: ~a"
                       (if site v (car path))
                       (string-join path " -> ")))]
        [(= c WHITE)
         (hash-set! parent v (cons u site))
         (dfs v)]))
    (hash-set! color u BLACK))

  (for ([id (in-hash-keys decls)])
    (when (= (hash-ref color id WHITE) WHITE)
      (dfs id))))
