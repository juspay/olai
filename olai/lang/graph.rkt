#lang racket/base

;; The anchor/mirror graph rules, once, for every phase.
;;
;; A module is checked at COMPILE time, over the syntax it was written as, and
;; again at RUN time after @include has spliced fragments in; the whole LOADED
;; SET is checked by the linker (lang/link), which is the only pass that can
;; see every file at once. Those were two DFS implementations of the same three
;; rules — duplicate ^anchor, unknown *mirror, mirror cycle — and they drifted:
;; with any @include present the compile-time pass was skipped and the runtime
;; one had no srclocs, so an agent got "duplicate ^agent" with no file:line:col
;; at all.
;;
;; So the rules live here, over a NODE PROTOCOL the caller supplies: how to
;; read a node's anchor, its children, whether it is a mirror site, and how
;; to fail on one. Nothing in this module knows what a node is.
;;
;; The one thing a phase does change is whether the anchor list it can see is
;; the WHOLE list — see #:scope below.

(require racket/list
         racket/string)

(provide check-anchor-graph
         ;; the "unknown name" diagnostic, for the next kind of reference to
         ;; reuse: a typed edge's target is an anchor too (docs/brainstorming/
         ;; typed-edges.md), and it deserves the same sentence
         unknown-anchor-message)

;; roots     : (listof node)
;; #:id      : node -> string | #f   (its ^anchor)
;; #:kids    : node -> (listof node)
;; #:mirror  : node -> string | #f   (non-#f = a *mirror site, no children)
;; #:scope   : what the anchor list covers ("the loaded set"), or #f when this
;;             pass cannot see the whole world — a module being compiled does
;;             not know which files it will be loaded beside, so a *mirror it
;;             cannot resolve is not yet wrong. An OPEN scope checks the two
;;             rules that are about the nodes in hand (duplicate, cycle) and
;;             leaves "unknown" to the linker, which is closed by construction.
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
  (when scope
    (check-mirrors-resolve roots kids-of mirror-of decls scope fail))
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
  (define (walk n)
    (cond
      [(mirror-of n)
       => (λ (a)
            (unless (hash-has-key? decls a)
              (fail 'mirror n (unknown-anchor-message a known #:scope scope))))]
      [else (for-each walk (kids-of n))]))
  (for-each walk roots))

;; What a name that resolves to nothing is told: the name, every anchor that
;; DOES exist in the scope it was looked up in, and — when one of them is a
;; typo away — which one it probably meant.
;;
;; `sigil` is how the reference was written: `*` for a mirror site, and an
;; edge's own spelling when one arrives.
(define (unknown-anchor-message name known #:scope scope #:sigil [sigil "*"])
  (define listed (if (null? known) "(none)" (string-join known ", ")))
  (define near (nearest name known))
  (format "unknown ~a~a; anchors in ~a: ~a~a"
          sigil name scope listed
          (if near (format "; did you mean ~a~a?" sigil near) "")))

;; The one candidate close enough to be worth naming, or #f. "Close enough" is
;; one edit per three characters (and always at least one), which catches the
;; typo an agent actually makes — a dropped letter, a swapped pair — without
;; offering ^demo for ^order. Ties go to the first in sorted order, so the same
;; mistake is answered the same way twice.
(define (nearest name known)
  (define limit (max 1 (quotient (string-length name) 3)))
  (for/fold ([best #f] [best-d (add1 limit)] #:result best)
            ([k (in-list known)])
    (define d (edit-distance name k))
    (if (< d best-d) (values k d) (values best best-d))))

;; Levenshtein, one row at a time: `prev` is the row above and `row` is this
;; one, each cell consed on, so its head is always the cell just left of the
;; one being computed. Written out because this Racket ships no edit distance
;; anywhere — the rule is no hand-rolling where a maintained library exists,
;; and here none does.
(define (edit-distance a b)
  (define bs (string->list b))
  (last
   (for/fold ([prev (range (add1 (length bs)))])
             ([ca (in-string a)] [i (in-naturals 1)])
     (for/fold ([row (list i)] #:result (reverse row))
               ([cb (in-list bs)]
                [diag (in-list prev)]
                [above (in-list (cdr prev))])
       (cons (min (add1 (car row))                       ; insert
                  (add1 above)                           ; delete
                  (+ diag (if (char=? ca cb) 0 1)))       ; substitute
             row)))))

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
