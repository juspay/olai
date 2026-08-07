#lang racket/base

;; THE GRAPH BEYOND CONTAINMENT, derived once per load.
;;
;; The tree says what CONTAINS what. The typed edges say the rest — what comes
;; after what, and what points at what — and they are written the way a person
;; thinks of them: `install @after ^order` in one file, `demo @blocks ^install`
;; in another, both meaning the same arrow. This is the layer that turns the
;; two spellings into one graph, so that nothing above it ever has to ask which
;; way round a line was written.
;;
;; Three answers, built together because they are three readings of one walk:
;;
;;   edges  relation -> source-key -> (listof target-key)
;;          forwards, normalized: `a @blocks b` is `b after a` here, and only
;;          the relations that survive normalization exist (@after, @see)
;;   back   target-key -> (listof backlink)
;;          backwards, and MIRRORS ARE IN IT: "this node is also shown here" is
;;          one more thing pointing at a node, which is what a backlinks panel
;;          is a list of. It is not grammar — a mirror is identity, not
;;          relation (docs/syntax.md) — it is a KIND in the reverse index
;;   topo   relation -> (listof key), targets before sources
;;          per acyclic relation, so "what order do these actually go in" is a
;;          lookup rather than a walk. The checker has already refused a cycle
;;          in an ordering relation, so this is total
;;   nodes  key -> task, for the ends of the arrows and nothing else
;;          A graph that could not say what its own vertices ARE would push
;;          that question onto every caller — "is the node I am after done?" is
;;          the first thing anybody asks this index. It is not addressing:
;;          olai/index inverts EVERY key and knows what sits above each node,
;;          which is a different question with a different owner
;;
;; Addressing is not derivation: keys are minted by the load layer and an
;; ^anchor IS its node's key, which is why an edge's target key is the anchor
;; it names. `anchors` (the set's index, olai/lang/link) is the one lookup this
;; module needs, and the reason it needs one at all is that a hand-built tree —
;; a test's — may name an anchor nobody declares, where a linked set may not.

(require racket/contract
         racket/list
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/graph normalize-edge derived-relation-acyclic?)
         olai/lang/walk)

(provide (contract-out
          [struct edge-index ([edges hash?] [back hash?] [topo hash?]
                              [nodes hash?])]
          [struct backlink ([source (or/c string? #f)] [kind symbol?])]
          [empty-edge-index edge-index?]
          [build-edge-index (-> list? hash? edge-index?)]
          [edge-graph (-> edge-index? symbol? hash?)]
          [edge-targets (-> edge-index? symbol? string? list?)]
          [edge-backlinks (-> edge-index? string? list?)]
          [edge-order (-> edge-index? symbol? list?)]
          [edge-node (-> edge-index? string? (or/c task? #f))]))

;; The readings, as one value: they are built from one walk and are only ever
;; right about the same load.
(struct edge-index (edges back topo nodes) #:transparent)

;; One thing pointing at a node: which node (its key — #f for a mirror site at
;; a file's top level, which hangs off no node), and what kind of pointing.
;; `kind` is a derived relation ('after, 'see) or 'mirror.
(struct backlink (source kind) #:transparent)

(define empty-edge-index (edge-index (hash) (hash) (hash) (hash)))

;; The node a key names, for a key this graph has an arrow at. #f for anything
;; else — including a perfectly good node that simply has no edges, which is
;; most of them: this is the graph's vertices, not the outline's.
(define (edge-node idx key) (hash-ref (edge-index-nodes idx) key #f))

;; Every arrow of one relation: source key -> target keys. What a reader that
;; folds over the whole thing wants (a query, a panel); `edge-targets` below is
;; the same question about one node. Empty for a relation nothing declares.
(define (edge-graph idx relation)
  (hash-ref (edge-index-edges idx) relation (hash)))

;; What `source` is `relation`-ed to, in source order. Empty for a key that
;; declares none — asking is not an error, it is the ordinary case.
(define (edge-targets idx relation source)
  (hash-ref (edge-graph idx relation) source '()))

;; Everything pointing AT `target`, edges and mirror sites alike.
(define (edge-backlinks idx target)
  (hash-ref (edge-index-back idx) target '()))

;; The relation's nodes in an order that respects it: every target before every
;; node that is after it. Empty for a relation nothing declares, and for one
;; that is not an ordering (a cross-reference has no order to be in).
(define (edge-order idx relation)
  (hash-ref (edge-index-topo idx) relation '()))

;; ---- building ---------------------------------------------------------------

;; roots   : every loaded file's tasks, appended — the graph spans the set, the
;;           way an anchor's scope does
;; anchors : the set's anchor index (id -> task)
(define (build-edge-index roots anchors)
  (define forward (make-hash))   ; relation -> hash from -> (listof to), reversed
  (define back (make-hash))      ; to -> (listof backlink), reversed
  (define nodes (make-hash))     ; key -> task, the ends of the arrows

  ;; Everything is consed on and reversed at the end (see `freeze`), and the
  ;; same arrow may be written twice — two `@after ^x` lines, a mirror of a
  ;; node that is also mirrored next door. Duplicates come out in that one
  ;; pass rather than by scanning what is already there per edge, which was a
  ;; membership test against a node's whole in-degree.
  (define (back! target source kind)
    (hash-update! back target (λ (bs) (cons (backlink source kind) bs)) '()))

  (define (add! relation from to)
    (define from-key (task-key from))
    (define to-key (task-key to))
    (hash-set! nodes from-key from)
    (hash-set! nodes to-key to)
    (define g (hash-ref! forward relation make-hash))
    (hash-update! g from-key (λ (ts) (cons to-key ts)) '())
    (back! to-key from-key relation))

  (fold-tasks
   roots
   (λ (x path acc)
     (begin0 acc
       (cond
         [(task? x)
          (for ([e (in-list (task-edges x))])
            ;; An edge names an ANCHOR, so the node at the far end is whichever
            ;; the set's index has under that name. A name nothing declares
            ;; reaches no node — the linker has already refused that in any set
            ;; that got here, and a hand-built tree gets no edge rather than a
            ;; graph with a hole in it.
            (define target (hash-ref anchors (edge-ref-anchor e) #f))
            (when (and target (task-key x) (task-key target))
              ;; Normalized over the NODES and not over their keys: `a @blocks
              ;; b` is the edge `b after a`, and holding both ends as nodes is
              ;; what lets the far end's state be answered later without a
              ;; second index to look it up in.
              (define-values (relation from to)
                (normalize-edge (edge-ref-relation e) x target))
              (add! relation from to)))]
         [(mirror-ref? x)
          ;; A mirror site is not an edge — it is the same node, shown a second
          ;; time — so it is in `back` and in nothing else. Its source is the
          ;; node it hangs under, which is where a reader would go looking.
          (define target (hash-ref anchors (mirror-ref-anchor x) #f))
          (when (and target (task-key target))
            (back! (task-key target)
                   (and (pair? path) (task-key (last path)))
                   'mirror))]
         [else (void)])))
   (void)
   #:mirrors 'visit)

  (define edges (freeze forward))
  (edge-index edges
              (for/hash ([(k v) (in-hash back)])
                (values k (remove-duplicates (reverse v))))
              (for/hash ([(relation g) (in-hash edges)]
                         #:when (derived-relation-acyclic? relation))
                (values relation (topo-order g)))
              (for/hash ([(k v) (in-hash nodes)]) (values k v))))

;; from -> (listof to), source order restored and duplicates dropped.
(define (freeze forward)
  (for/hash ([(relation g) (in-hash forward)])
    (values relation
            (for/hash ([(from tos) (in-hash g)])
              (values from (remove-duplicates (reverse tos)))))))

;; Targets before the nodes that are after them: a postorder DFS, entered from
;; every source in name order so the same graph answers with the same list
;; twice. A back edge is skipped rather than followed — the checker refuses a
;; cycle in an ordering relation, and a total function here is worth more than
;; a second place that raises about one.
(define (topo-order g)
  (define seen (make-hash))
  (define order '())
  (define (visit k)
    (unless (hash-ref seen k #f)
      (hash-set! seen k #t)
      (for ([to (in-list (hash-ref g k '()))]) (visit to))
      (set! order (cons k order))))
  (for ([from (in-list (sort (hash-keys g) string<?))]) (visit from))
  (reverse order))
