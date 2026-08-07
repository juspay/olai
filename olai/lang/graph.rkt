#lang racket/base

;; The anchor graph rules — mirrors and typed edges — once, for every phase.
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
;; read a node's anchor, its children, whether it is a mirror site, what edges
;; it declares, and how to fail on one. Nothing in this module knows what a
;; node is.
;;
;; The one thing a phase does change is whether the anchor list it can see is
;; the WHOLE list — see #:scope below.
;;
;; A TYPED EDGE (`@after ^x`) is a second kind of reference to an anchor, so it
;; is checked here and by the same machinery: an unknown target is the message
;; an unknown mirror gets, with its own sigil, and a cycle is the same DFS with
;; a different graph in it. What it adds is the RELATION SET, which is closed
;; and lives below — a new relation is a human-ratified event, not an edit a
;; reader of one call site can make.

(require racket/list
         racket/string)

(provide check-anchor-graph
         edge-relations
         edge-relations-label
         edge-relation?
         normalize-edge
         derived-relation-acyclic?)

;; ---- the closed relation set ------------------------------------------------
;;
;; ONE ROW PER RELATION, and the row is the whole of what the language knows
;; about it: how it is written, which relation it derives to, and which way the
;; edge runs there. A fourth relation is a human-ratified event, and this table
;; is where it is ratified — the reader builds its line grammar from the rows
;; (lang/line), and everything that asks "what does @blocks mean" asks here.
;;
;; | written    | means                                   | derives to        |
;; |------------|-----------------------------------------|-------------------|
;; | @after ^x  | this node is not actionable until ^x is  | after: node -> x  |
;; |            | done — ORDERING, never scheduling       |                   |
;; | @blocks ^y | the same fact from the other end        | after: y -> node  |
;; | @see ^z    | a plain cross-reference, no semantics   | see: node -> z    |
;;
;; Two relations come out of three spellings, which is the whole point of the
;; normalization: `@blocks` is where the writer thought of it, not a second
;; edge kind to check, sort and keep in step with the first.
(struct relation-rule (written derived flip?) #:transparent)

(define relation-rules
  (list (relation-rule 'after  'after #f)
        (relation-rule 'blocks 'after #t)
        (relation-rule 'see    'see   #f)))

(define edge-relations (map relation-rule-written relation-rules))

;; "@after, @blocks, @see" — the set as a person reads it. Both messages that
;; name it (the reader's unknown-@field, the checker's unknown-relation) say it
;; this way, and neither spells the list itself.
(define edge-relations-label
  (string-join (for/list ([r (in-list edge-relations)]) (format "@~a" r)) ", "))

(define (edge-relation? r) (and (rule-for r) #t))

(define (rule-for r)
  (for/first ([rule (in-list relation-rules)]
              #:when (eq? (relation-rule-written rule) r))
    rule))

;; One edge, as the DERIVED graph has it. `a @blocks b` is the edge `b after a`
;; — the file keeps the direction its writer thought in, and everything
;; downstream sees one.
;;
;; from/to may be #f: an edge declared by a node with no ^anchor has no name to
;; be the far end of, and a caller that needs one skips it. A relation with no
;; row is left exactly as written, so the caller that checks the set (below)
;; reports it rather than this one inventing an answer.
;; -> (values relation from to)
(define (normalize-edge relation source target)
  (define rule (rule-for relation))
  (cond
    [(not rule) (values relation source target)]
    [(relation-rule-flip? rule)
     (values (relation-rule-derived rule) target source)]
    [else (values (relation-rule-derived rule) source target)]))

;; And one row per DERIVED relation — the ones that survive normalization, and
;; the one thing that differs between them. Ordering must be acyclic: a node
;; cannot be after itself, however long the way round. A cross-reference need
;; not be — `@see` is a link, and two nodes may perfectly well point at each
;; other.
;;
;; A second table rather than a field on the first, because it is keyed by a
;; different thing: `@after` and `@blocks` are two spellings with one answer
;; here, and asking a spelling whether it is acyclic is asking the wrong noun.
(struct derived-rule (relation acyclic?) #:transparent)

(define derived-rules
  (list (derived-rule 'after #t)
        (derived-rule 'see   #f)))

(define (derived-relation-acyclic? r)
  (define rule
    (for/first ([rule (in-list derived-rules)]
                #:when (eq? (derived-rule-relation rule) r))
      rule))
  (and rule (derived-rule-acyclic? rule)))

;; The two tables have to agree — every relation something derives TO has a row
;; above — and a fourth relation is exactly when that is got wrong: the new row
;; is written in the table keyed by the spelling, and the one keyed by the
;; derived name is the edit nobody makes. So it is checked, here, at the moment
;; this module is instantiated, rather than left to whoever reads both.
(for ([rule (in-list relation-rules)])
  (define derived (relation-rule-derived rule))
  (unless (for/or ([d (in-list derived-rules)])
            (eq? (derived-rule-relation d) derived))
    (error 'olai/lang/graph
           "@~a derives to ~a, which has no row in derived-rules"
           (relation-rule-written rule) derived)))

;; roots      : (listof node)
;; #:id       : node -> string | #f   (its ^anchor)
;; #:kids     : node -> (listof node)
;; #:mirror   : node -> string | #f   (non-#f = a *mirror site, no children)
;; #:edges    : node -> (listof edge) (the typed edges written on it)
;; #:relation : edge -> symbol
;; #:target   : edge -> string        (the ^anchor it names)
;; #:scope    : what the anchor list covers ("the loaded set"), or #f when this
;;              pass cannot see the whole world — a module being compiled does
;;              not know which files it will be loaded beside, so a reference it
;;              cannot resolve is not yet wrong. An OPEN scope checks the rules
;;              that are about the nodes in hand (duplicate, cycle) and leaves
;;              "unknown" to the linker, which is closed by construction.
;; #:describe : node -> string        (where it is, for "first declared at")
;; #:fail     : who form message -> ⊥ (`form` is a node for the mirror rules,
;;              an edge for the edge ones, or #f)
;;
;; Both kinds of reference in ONE call, because the second cannot run without
;; the first's answer: the edge rules are checked against the anchor index the
;; duplicate rule collects on its way through. Two exported passes would have
;; handed every caller that ordering to get right, and all of them the same
;; six arguments to pass twice.
;;
;; -> hash anchor -> declaring node. It is the answer a caller wants anyway
;; ("which node is ^agent"); returning it beats walking the forest again.
(define (check-anchor-graph roots
                            #:id id-of
                            #:kids kids-of
                            #:mirror mirror-of
                            #:edges [edges-of (λ (_n) '())]
                            #:relation [relation-of #f]
                            #:target [target-of #f]
                            #:scope scope
                            #:describe describe
                            #:fail fail)
  (define decls (declarations roots id-of kids-of mirror-of describe fail))
  (when scope
    (check-mirrors-resolve roots kids-of mirror-of decls scope fail))
  (check-cycles decls id-of kids-of mirror-of fail)
  (check-edges roots
               #:id id-of #:kids kids-of #:edges edges-of
               #:relation relation-of #:target target-of
               #:decls decls #:scope scope #:fail fail)
  decls)

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
  (define (walk n)
    (cond
      [(mirror-of n)
       => (λ (a)
            (unless (hash-has-key? decls a)
              (fail 'mirror n
                    (unknown-anchor-message a (sorted-anchors decls)
                                            #:scope scope #:sigil "*"))))]
      [else (for-each walk (kids-of n))]))
  (for-each walk roots))

;; Every anchor the scope has, in an order two runs agree on. Only ever asked
;; on the way to failing, so it is asked there.
(define (sorted-anchors decls) (sort (hash-keys decls) string<?))

;; What a name that resolves to nothing is told: the name, every anchor that
;; DOES exist in the scope it was looked up in, and — when one of them is a
;; typo away — which one it probably meant.
;;
;; `sigil` is how the reference was spelled — `*` for a mirror site, `^` for a
;; typed edge's target. The two kinds of reference are the same lookup in the
;; same index, so they are the same message, and an agent that learned to read
;; one has learned to read the other.
(define (unknown-anchor-message name known #:scope scope #:sigil sigil)
  (define listed (if (null? known) "(none)" (string-join known ", ")))
  (define near (nearest name known))
  (format "unknown ~a~a; anchors in ~a: ~a~a"
          sigil name scope listed
          (if near (format "; did you mean ~a~a?" sigil near) "")))

;; The one candidate close enough to be worth naming, or #f. "Close enough" is
;; one edit per three characters (and always at least one), which catches the
;; typo an agent actually makes — a dropped letter, a swapped pair — without
;; offering ^demo for ^order. `known` is sorted and argmin keeps the first of
;; a tie, so the same mistake is answered the same way twice.
(define (nearest name known)
  (and (pair? known)
       (let ([best (argmin (λ (k) (edit-distance name k)) known)])
         (and (<= (edit-distance name best)
                  (max 1 (quotient (string-length name) 3)))
              best))))

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
    (hash-update! edges from (λ (es) (cons (cons to node) es)) '()))
  (define (walk-under n owner)
    (cond
      [(mirror-of n) => (λ (a) (add-edge! owner a n))]
      [else
       (when (id-of n) (add-edge! owner (id-of n) #f))
       (for ([k (in-list (kids-of n))]) (walk-under k owner))]))
  (for ([(id n) (in-hash decls)])
    (for ([k (in-list (kids-of n))]) (walk-under k id)))

  (define-values (path blame) (find-cycle edges))
  (when path
    (fail 'mirror blame
          (format "mirror *~a creates a cycle: ~a"
                  (car path)
                  (string-join path " -> ")))))

;; ---- the cycle DFS ----------------------------------------------------------
;;
;; One graph walk, two callers. `edges` is a hash from -> (listof (cons to
;; site)), where a site is whatever form the caller wants an error pointed at
;; (#f when the edge is structural — containment has no line of its own).
;;
;; -> (values path blame-site) | (values #f #f). The path is `a -> … -> a`, the
;; names the cycle runs through, and `blame-site` is the form to point an error
;; at: a site ON the cycle, else the form of the edge
;; that closed it.
(define (find-cycle edges)
  (define WHITE 0) (define GRAY 1) (define BLACK 2)
  (define color (make-hash))
  (define parent (make-hash))

  ;; The trail back to `end` through the parent map, as names.
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

  (define found #f)

  (define (dfs u)
    (hash-set! color u GRAY)
    (for ([e (in-list (hash-ref edges u '()))]
          #:unless found)
      (define v (car e))
      (define site (cdr e))
      (define c (hash-ref color v WHITE))
      (cond
        [(= c GRAY)
         (hash-set! parent v (cons u site))
         (set! found (cons (cycle-path v) site))]
        [(= c WHITE)
         (hash-set! parent v (cons u site))
         (dfs v)]))
    (hash-set! color u BLACK))

  ;; Sorted, so the same graph answers with the same cycle twice: hash order is
  ;; not an order, and an error message is read by a diff as often as by a
  ;; person.
  (for ([u (in-list (sort (hash-keys edges) string<?))]
        #:unless found)
    (when (= (hash-ref color u WHITE) WHITE)
      (dfs u)))
  (cond
    [found
     (define path (car found))
     (values path (or (site-on-path edges path) (cdr found)))]
    [else (values #f #f)]))

;; A site on the cycle: the form to point the error at when the edge that
;; closed it has none (containment reaching an anchor, say).
(define (site-on-path edges path)
  (for/or ([from (in-list path)] [to (in-list (cdr path))])
    (for/or ([e (in-list (hash-ref edges from '()))])
      (and (equal? (car e) to) (cdr e)))))

;; ---- typed edges ------------------------------------------------------------
;;
;; The second kind of reference to an anchor, checked where the first one is
;; and against the index the first one built (`decls`).
;;
;; Three rules, and the first is what makes the set closed: a relation nobody
;; ratified is not a relation. The other two are per relation — an unknown
;; target is wrong for all of them, a cycle only for the ordering one. It is
;; the same walk for all three, and it does nothing at all for a tree that
;; wrote no edges, which is most of them.
(define (check-edges roots
                     #:id id-of
                     #:kids kids-of
                     #:edges edges-of
                     #:relation relation-of
                     #:target target-of
                     #:decls decls
                     #:scope scope
                     #:fail fail)
  ;; derived relation -> hash from -> (listof (cons to edge)), for the ones
  ;; that must be acyclic. Built on the way through the same walk that checks
  ;; the other two rules.
  (define graphs (make-hasheq))
  (define (add-edge! relation from to e)
    (define g (hash-ref! graphs relation make-hash))
    (hash-update! g from (λ (es) (cons (cons to e) es)) '()))

  (define (visit n)
    (define source (id-of n))
    (for ([e (in-list (edges-of n))])
      (define relation (relation-of e))
      (define target (target-of e))
      (cond
        [(not (edge-relation? relation))
         (fail (edge-who relation) e (unknown-relation-message relation))]
        [else
         ;; the anchor list is sorted HERE and not once up front: it is for a
         ;; message, this call does not return, and most trees never build one
         (when (and scope (not (hash-has-key? decls target)))
           (fail (edge-who relation) e
                 (unknown-anchor-message target (sorted-anchors decls)
                                         #:scope scope #:sigil "^")))
         (define-values (derived from to) (normalize-edge relation source target))
         ;; An end with no name cannot be reached, so it cannot be on a cycle.
         (when (and (derived-relation-acyclic? derived) from to)
           (add-edge! derived from to e))]))
    (for-each visit (kids-of n)))
  (for-each visit roots)

  (for ([derived (in-list (sort (hash-keys graphs) symbol<?))])
    (define-values (path e) (find-cycle (hash-ref graphs derived)))
    (when path
      (fail (edge-who (and e (relation-of e))) e
            (format "cycle in @~a: ~a; @~a must be acyclic"
                    derived
                    (string-join (map (λ (a) (string-append "^" a)) path) " -> ")
                    derived)))))

;; A failure is blamed on the FORM the source wrote, so it is named after it
;; too: `@blocks` closing a cycle in the @after graph says both, which is the
;; only way to read what the normalization did.
(define (edge-who relation)
  (string->symbol (format "@~a" (or relation "edge"))))

(define (unknown-relation-message relation)
  (format "unknown relation @~a; relations: ~a" relation edge-relations-label))
