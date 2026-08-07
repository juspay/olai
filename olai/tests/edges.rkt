#lang racket/base

;; TYPED EDGES: the graph beyond containment.
;;
;; The grammar (three field lines naming an anchor), the two rules the checker
;; owns (a target that resolves, an ordering that does not run in a circle),
;; what the load derives from them, and what the surfaces say about it.
;;
;; The anchor half of every one of these — scope is the loaded set, a module
;; compiles without it, the message names the near miss — is the mirror rules'
;; (tests/link.rkt, tests/mirrors.rkt), and it is the same code answering.

(require racket/list
         racket/string
         json
         xml
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/lang/walk find-tasks-by-title)
         olai/agenda
         olai/edges
         ;; the closed set itself: what the language says the relations ARE
         (only-in olai/lang/graph edge-relations)
         olai/json/model
         olai/json/reply
         olai/load
         (only-in olai/query blocked-nodes)
         olai/store
         ;; outlines on disk, and the two answers a load gives (tests/outlines)
         olai/tests/outlines
         olai/web/render)

(module+ test
  (require rackunit))

(module+ test
  ;; One outline, loaded and linked the way every read command loads one.
  (define (link-one name body proc)
    (in-dir name (λ (dir) (proc (load-set (list (write-outline dir "T.rkt" body)))))))

  (define (tasks-of lk) (append* (map outline-tasks (linked-outlines lk))))

  ;; A reply as a reader gets it: through the JSON, never as the hash the
  ;; serializer happened to build.
  (define (round-trip h) (read-json (open-input-string (jsexpr->string h))))

  (define (by-title tasks title)
    (define found (find-tasks-by-title tasks title))
    (check-true (pair? found) (format "no node titled ~s" title))
    (car found)))

;; ---- the grammar ------------------------------------------------------------

(module+ test
  (test-case "three relations, in source order, verbatim"
    (link-one
     "olai-edge-read"
     #<<EOF
#lang olai

install ^install
  @after ^order
  @blocks ^paint
  @see ^colour
order ^order
paint ^paint
colour ^colour
EOF
     (λ (lk)
       (define install (by-title (tasks-of (linked-or-fail lk)) "install"))
       (check-equal?
        (for/list ([e (in-list (task-edges install))])
          (list (edge-ref-relation e) (edge-ref-anchor e)))
        '((after "order") (blocks "paint") (see "colour"))))))

  ;; The same node, in the core the expander actually sees. One surface does
  ;; not get language the other does not.
  (test-case "the sexp surface writes the same edges"
    (link-one
     "olai-edge-sexp"
     #<<EOF
#lang olai/sexp
(t "install" #:id "install" #:after "order" #:see "colour")
(t "order" #:id "order")
(t "colour" #:id "colour")
EOF
     (λ (lk)
       (define install (by-title (tasks-of (linked-or-fail lk)) "install"))
       (check-equal?
        (for/list ([e (in-list (task-edges install))])
          (list (edge-ref-relation e) (edge-ref-anchor e)))
        '((after "order") (see "colour"))))))

  ;; Every edge keeps the line it was written on: @after is at the column of
  ;; the `@`, because the form an error is about is the whole line.
  (test-case "an edge carries the srcloc of its own line"
    (link-one
     "olai-edge-loc"
     "#lang olai\ninstall ^install\n  @after ^order\norder ^order\n"
     (λ (lk)
       (define e (car (task-edges (by-title (tasks-of (linked-or-fail lk)) "install"))))
       (check-equal? (srcloc-line (edge-ref-loc e)) 3)
       (check-equal? (srcloc-column (edge-ref-loc e)) 2))))

  ;; The `^` is grammar, not decoration. A bare word where an anchor belongs is
  ;; a line that is wrong, and the reader says so at it.
  (test-case "@after without a ^anchor is a reader error at the line"
    (link-one
     "olai-edge-bare"
     "#lang olai\ninstall\n  @after order\n"
     (λ (lk)
       (define-values (where msg) (error-of lk))
       (check-true (string-contains? where ":3:") where)
       (check-true (string-contains? msg "expected ^anchor after @after") msg))))

  (test-case "a relation nobody ratified is an unknown field, and the list says so"
    (link-one
     "olai-edge-unknown-field"
     "#lang olai\ninstall\n  @before ^order\n"
     (λ (lk)
       (define-values (_where msg) (error-of lk))
       (check-true (string-contains? msg "unknown @before") msg)
       (check-true (string-contains? msg "@after") msg)
       (check-true (string-contains? msg "@blocks") msg)
       (check-true (string-contains? msg "@see") msg))))

  ;; @seen is not @see with a letter on the end: the alternation is bounded by
  ;; what follows it.
  (test-case "a field whose name merely starts with a relation is unknown"
    (link-one
     "olai-edge-seen"
     "#lang olai\ninstall\n  @seen ^order\n"
     (λ (lk)
       (define-values (_where msg) (error-of lk))
       (check-true (string-contains? msg "unknown @seen") msg))))

  ;; The set has one owner (lang/graph) and the reader reads its line grammar
  ;; off it — but the expander's keywords are written out, because a class
  ;; parameterized over the keyword costs the srcloc tests (see edge-kw). So
  ;; this is the check that keeps the two in step: every RATIFIED relation
  ;; parses, in both surfaces, and lands on the node as itself.
  (test-case "every relation in the set parses, in both surfaces"
    (for ([relation (in-list edge-relations)])
      (define outline
        (format "#lang olai\ninstall ^install\n  @~a ^order\norder ^order\n" relation))
      (define sexp
        (format "#lang olai/sexp\n(t \"install\" #:id \"install\" #:~a \"order\")\n(t \"order\" #:id \"order\")\n"
                relation))
      (for ([src (in-list (list outline sexp))])
        (link-one
         (format "olai-edge-set-~a" relation)
         src
         (λ (lk)
           (define install (by-title (tasks-of (linked-or-fail lk)) "install"))
           (check-equal? (map edge-ref-relation (task-edges install))
                         (list relation)
                         (format "~a did not parse as itself" relation)))))))

  (test-case "a node may be after any number of others"
    (link-one
     "olai-edge-many"
     "#lang olai\ninstall ^install\n  @after ^order\n  @after ^demo\norder ^order\ndemo ^demo\n"
     (λ (lk)
       (define install (by-title (tasks-of (linked-or-fail lk)) "install"))
       (check-equal? (map edge-ref-anchor (task-edges install)) '("order" "demo"))))))

;; ---- the checker ------------------------------------------------------------

(module+ test
  (test-case "a target no loaded file declares is an error at the edge"
    (link-one
     "olai-edge-dangling"
     "#lang olai\ninstall ^install\n  @after ^ordr\norder ^order\ndemo ^demo\n"
     (λ (lk)
       (define-values (where msg) (error-of lk))
       (check-true (string-contains? where "T.rkt") where)
       (check-true (string-contains? where ":3:") where)
       (check-true (regexp-match? #px"@after: unknown \\^ordr" msg) msg)
       ;; the linker's machinery, reused: the scope it looked in, everything
       ;; that IS in it, and the near miss
       (check-true (string-contains? msg "anchors in the loaded set") msg)
       (check-true (string-contains? msg "demo, install, order") msg)
       (check-true (string-contains? msg "did you mean ^order?") msg))))

  ;; The other half of that rule, and the reason it is the linker's alone: a
  ;; module cannot know which files it will be loaded beside.
  (test-case "a file whose edge names another file's anchor loads on its own"
    (in-dir
     "olai-edge-open"
     (λ (dir)
       (define p (write-outline dir "A.rkt"
                                "#lang olai\ninstall ^install\n  @after ^elsewhere\n"))
       (check-true (outline? (try-load-outline p))))))

  (test-case "an edge reaches an anchor another file declares"
    (in-dir
     "olai-edge-cross"
     (λ (dir)
       (define a (write-outline dir "A.rkt" "#lang olai\norder the doors ^order\n"))
       (define b (write-outline dir "B.rkt"
                                "#lang olai\ninstall ^install\n  @after ^order\n"))
       (define lk (linked-or-fail (load-set (list a b))))
       (check-equal? (edge-targets (linked-edges lk) 'after "install") '("order")))))

  (test-case "an @after cycle is an error with the cycle path"
    (link-one
     "olai-edge-cycle"
     "#lang olai\ninstall ^install\n  @after ^order\norder ^order\n  @after ^install\n"
     (λ (lk)
       (define-values (where msg) (error-of lk))
       ;; blamed at a form ON the cycle — the first edge of the path, which is
       ;; a fixed choice and not whichever one a hash happened to yield
       (check-true (string-contains? where "T.rkt:3:2") where)
       (check-true (regexp-match? #px"cycle in @after" msg) msg)
       (check-true (regexp-match? #px"\\^install -> \\^order -> \\^install|\\^order -> \\^install -> \\^order"
                                  msg)
                   msg)
       (check-true (string-contains? msg "@after must be acyclic") msg))))

  ;; The whole point of normalizing @blocks at derivation: the two spellings
  ;; are one edge, so they cannot disagree — and a pair that contradicts is a
  ;; cycle, named at the form that closed it.
  (test-case "@after and @blocks between the same two nodes is a cycle"
    (link-one
     "olai-edge-both"
     "#lang olai\ninstall ^install\n  @after ^order\n  @blocks ^order\norder ^order\n"
     (λ (lk)
       (define-values (_where msg) (error-of lk))
       (check-true (regexp-match? #px"cycle in @after" msg) msg))))

  (test-case "a cycle spans files, like a mirror's"
    (in-dir
     "olai-edge-cycle-files"
     (λ (dir)
       (define a (write-outline dir "A.rkt" "#lang olai\na ^a\n  @after ^b\n"))
       (define b (write-outline dir "B.rkt" "#lang olai\nb ^b\n  @after ^a\n"))
       (define-values (where msg) (error-of (load-set (list a b))))
       (check-true (regexp-match? #px"cycle in @after" msg) msg)
       (check-true (or (string-contains? where "A.rkt") (string-contains? where "B.rkt"))
                   where))))

  ;; The third reach: @include splices before anything is checked, so an edge
  ;; written in a fragment is checked with everything else and keeps the line
  ;; it was written on — in the fragment, not in the root.
  (test-case "an edge under @include still says file:line:col"
    (in-dir
     "olai-edge-include"
     (λ (dir)
       (write-outline dir "frag.rkt" "#lang olai\ninstall ^install\n  @after ^nope\n")
       (define root (write-outline dir "root.rkt"
                                   "#lang olai\nweek\n  @include frag.rkt\norder ^order\n"))
       (define-values (where msg) (error-of (load-set (list root))))
       (check-true (string-contains? where "frag.rkt") where)
       (check-true (string-contains? where ":3:") where)
       (check-true (regexp-match? #px"unknown \\^nope" msg) msg)
       (check-true (string-contains? msg "install, order") msg))))

  ;; The relation set is CLOSED and the checker owns it, so a relation the
  ;; language never had is refused wherever one turns up — which, since the
  ;; readers only spell the three, means a tree somebody built by hand.
  (test-case "a relation outside the set is refused, and the message names them"
    (define tk
      (make-task #:title "install" #:id "install"
                 #:edges (list (edge-ref 'before "order" #f))))
    (check-exn
     #px"unknown relation @before; relations: @after, @blocks, @see"
     (λ () (check-task-graph (list tk) #:scope "the loaded set"))))

  ;; Acyclicity is PER RELATION. A cross-reference is a link, and two nodes may
  ;; point at each other all day.
  (test-case "a @see cycle is not an error"
    (link-one
     "olai-edge-see-cycle"
     "#lang olai\na ^a\n  @see ^b\nb ^b\n  @see ^a\n"
     (λ (lk) (linked-or-fail lk))))

  ;; An edge from an unanchored node cannot be on a cycle — nothing can name it
  ;; — and it is still an edge.
  (test-case "@blocks from an unanchored node is an ordering all the same"
    (link-one
     "olai-edge-unanchored"
     "#lang olai\nclear the driveway\n  @blocks ^order\norder ^order\n"
     (λ (lk)
       (define idx (linked-edges (linked-or-fail lk)))
       (define driveway (by-title (tasks-of lk) "clear the driveway"))
       (check-equal? (edge-targets idx 'after "order") (list (task-key driveway)))))))

;; ---- what the load derives ---------------------------------------------------

(module+ test
  (define graph-source
    #<<EOF
#lang olai

kitchen ^kitchen
  [x] demo ^demo
  order ^order
  install ^install
    @after ^order
    @after ^demo
  paint ^paint
    @after ^install
    @see ^colour
  colour ^colour
  driveway
    @blocks ^order
elsewhere
  *kitchen
EOF
    )

  (test-case "the forward index is normalized: @blocks is one arrow, the other way"
    (link-one
     "olai-edge-index"
     graph-source
     (λ (lk)
       (define idx (linked-edges (linked-or-fail lk)))
       (check-equal? (edge-targets idx 'after "install") '("order" "demo"))
       (check-equal? (edge-targets idx 'after "paint") '("install"))
       (check-equal? (edge-targets idx 'see "paint") '("colour"))
       ;; the driveway node is unanchored, so its edge is named by its key
       (define driveway (by-title (tasks-of lk) "driveway"))
       (check-equal? (edge-targets idx 'after "order") (list (task-key driveway)))
       ;; and @blocks is nowhere: it is a spelling, not a relation the graph has
       (check-equal? (edge-targets idx 'blocks "driveway") '()))))

  (test-case "the reverse index holds edges and mirror sites alike"
    (link-one
     "olai-edge-back"
     graph-source
     (λ (lk)
       (define idx (linked-edges (linked-or-fail lk)))
       (check-equal? (edge-backlinks idx "install") (list (backlink "paint" 'after)))
       (check-equal? (edge-backlinks idx "colour") (list (backlink "paint" 'see)))
       ;; a mirror is one more thing pointing at a node, under its own kind
       (define elsewhere (by-title (tasks-of lk) "elsewhere"))
       (check-equal? (edge-backlinks idx "kitchen")
                     (list (backlink (task-key elsewhere) 'mirror))))))

  (test-case "topo puts a target before everything that is after it"
    (link-one
     "olai-edge-topo"
     graph-source
     (λ (lk)
       (define idx (linked-edges (linked-or-fail lk)))
       (define order (edge-order idx 'after))
       (define (before? a b)
         (< (index-of order a) (index-of order b)))
       (check-true (before? "order" "install") (format "~a" order))
       (check-true (before? "demo" "install") (format "~a" order))
       (check-true (before? "install" "paint") (format "~a" order))
       ;; a cross-reference has no order to be in
       (check-equal? (edge-order idx 'see) '())))))

;; ---- blocked ------------------------------------------------------------------

(module+ test
  (test-case "blocked is an unfinished @after target, and it says which"
    (link-one
     "olai-edge-blocked"
     graph-source
     (λ (lk)
       (define blocked (blocked-nodes (linked-edges (linked-or-fail lk))))
       ;; install waits on order (open) but not on demo (done)
       (check-equal? (map task-key (hash-ref blocked "install")) '("order"))
       ;; paint waits on install, which is itself blocked — being blocked is
       ;; not being done
       (check-equal? (map task-key (hash-ref blocked "paint")) '("install"))
       ;; nothing is after colour
       (check-false (hash-has-key? blocked "colour")))))

  (test-case "a done target blocks nothing"
    (link-one
     "olai-edge-unblocked"
     "#lang olai\ninstall ^install\n  @after ^order\norder ^order\n  @done 2026-08-01\n"
     (λ (lk)
       (check-equal? (blocked-nodes (linked-edges (linked-or-fail lk))) (hash)))))

  ;; THE RATIFIED CALL: done-ness does not propagate. A parent with every child
  ;; done is not done — done is explicit here, and deriving it would give the
  ;; outline two answers to one question and re-block everything after a
  ;; finished node the moment somebody added a child to it.
  (test-case "a target whose children are all done is still not done"
    (link-one
     "olai-edge-parent"
     #<<EOF
#lang olai

demo the old cabinets ^demo
  [x] haul it to the dump
  [x] sweep up
install ^install
  @after ^demo
EOF
     (λ (lk)
       (define blocked (blocked-nodes (linked-edges (linked-or-fail lk))))
       (check-equal? (map task-key (hash-ref blocked "install")) '("demo")))))

  ;; The other end of the same rule: being done is not a thing you can be
  ;; blocked out of. The agenda never sees such a node — done is off the plate
  ;; before this is asked — but the outline draws it, and a finished node
  ;; wearing "blocked" is the page contradicting the checkbox beside it.
  (test-case "a done node is waiting on nothing, whatever it is after"
    (link-one
     "olai-edge-done-source"
     "#lang olai\ninstall ^install\n  @after ^order\n  @done 2026-08-05\norder ^order\n"
     (λ (lk)
       (check-equal? (blocked-nodes (linked-edges (linked-or-fail lk))) (hash)))))

  (test-case "and marking that parent done is what unblocks it"
    (link-one
     "olai-edge-parent-done"
     #<<EOF
#lang olai

[x] demo the old cabinets ^demo
  [x] haul it to the dump
install ^install
  @after ^demo
EOF
     (λ (lk)
       (check-equal? (blocked-nodes (linked-edges (linked-or-fail lk))) (hash))))))

;; ---- the agenda ----------------------------------------------------------------

(module+ test
  (define agenda-source
    #<<EOF
#lang olai

order the doors ^order
  @date 2026-08-01
install ^install
  @after ^order
  @date 2026-08-02
sweep up
  @date 2026-08-02
EOF
    )

  ;; The agenda as a read command asks for it. `#:blocked` defaults to what the
  ;; set's own graph says; a caller passes an empty one to ask what an agenda
  ;; over a tree nobody linked looks like.
  (define (groups-of lk today #:blocked [blocked (blocked-nodes (linked-edges lk))])
    (agenda-groups-from-files (linked-entries lk) today #:blocked blocked))

  (test-case "a blocked node leaves the date buckets and keeps its bucket"
    (link-one
     "olai-edge-agenda"
     agenda-source
     (λ (lk)
       (define groups (groups-of (linked-or-fail lk) "2026-08-06"))
       (define overdue (cdr (assq 'overdue groups)))
       (define blocked (cdr (assq 'blocked groups)))
       ;; two nodes are overdue by date; the blocked one is not in that group
       (check-equal? (map agenda-item-title overdue)
                     '("order the doors" "sweep up"))
       (check-equal? (map agenda-item-title blocked) '("install"))
       ;; and it still says it is late — a node can be overdue AND blocked
       (define it (car blocked))
       (check-equal? (agenda-bucket it "2026-08-06") 'overdue)
       (check-equal? (map task-key (agenda-item-waiting it)) '("order")))))

  (test-case "with the blocker done, the node is back on the plate"
    (link-one
     "olai-edge-agenda-clear"
     #<<EOF
#lang olai

order the doors ^order
  @date 2026-08-01
  @done 2026-08-05
install ^install
  @after ^order
  @date 2026-08-02
sweep up
  @date 2026-08-02
EOF
     (λ (lk)
       (define groups (groups-of (linked-or-fail lk) "2026-08-06"))
       (check-false (assq 'blocked groups))
       (check-equal? (map agenda-item-title (cdr (assq 'overdue groups)))
                     '("install" "sweep up")))))

  ;; An agenda over a tree nobody linked has no graph to be blocked by, and
  ;; says so by having no such group.
  (test-case "no graph, no blocked group"
    (link-one
     "olai-edge-agenda-none"
     agenda-source
     (λ (lk)
       (define groups
         (groups-of (linked-or-fail lk) "2026-08-06" #:blocked (hash)))
       (check-false (assq 'blocked groups))))))

;; ---- what an agent is told -------------------------------------------------------

(module+ test
  (test-case "tree JSON: the node keeps what it wrote, the set publishes the graph"
    (link-one
     "olai-edge-json"
     graph-source
     (λ (lk)
       (define j (round-trip (linked->jsexpr (linked-or-fail lk))))
       (define kitchen (car (hash-ref j 'tasks)))
       (define (child title)
         (for/or ([c (in-list (hash-ref kitchen 'children))])
           (and (equal? (hash-ref c 'title #f) title) c)))
       ;; verbatim on the node: @blocks is still @blocks where it was written
       (check-equal? (hash-ref (child "install") 'edges)
                     (list (hasheq 'relation "after" 'target "order")
                           (hasheq 'relation "after" 'target "demo")))
       (check-equal? (hash-ref (child "driveway") 'edges)
                     (list (hasheq 'relation "blocks" 'target "order")))
       ;; and normalized in the index beside `anchors`
       (define edges (hash-ref j 'edges))
       (check-equal? (hash-ref (hash-ref edges 'after) 'install) '("order" "demo"))
       (check-equal? (hash-ref (hash-ref edges 'see) 'paint) '("colour"))
       (check-false (hash-has-key? edges 'blocks)))))

  (test-case "agenda JSON: the blocked array, and what it is waiting on"
    (link-one
     "olai-edge-json-agenda"
     agenda-source
     (λ (lk)
       (define j
         (round-trip (agenda-groups->jsexpr (groups-of (linked-or-fail lk) "2026-08-06")
                                            "2026-08-06")))
       (define blocked (hash-ref j 'blocked))
       (check-equal? (length blocked) 1)
       (define it (car blocked))
       (check-equal? (hash-ref it 'title) "install")
       (check-true (hash-ref it 'blocked))
       (check-equal? (hash-ref it 'bucket) "overdue")
       (check-equal? (hash-ref it 'waiting_on) '("order"))
       ;; every item carries the two new fields, blocked or not
       (define first-overdue (car (hash-ref j 'overdue)))
       (check-false (hash-ref first-overdue 'blocked))
       (check-equal? (hash-ref first-overdue 'waiting_on) '())))))

;; ---- what a page shows -----------------------------------------------------------

(module+ test
  (test-case "a blocked node wears a pill naming what it waits on"
    (in-dir
     "olai-edge-page"
     (λ (dir)
       (define p (write-outline dir "T.rkt" graph-source))
       (define snap (store-snapshot (make-store (list p))))
       (define html
         (xexpr->string
          (render-outline (snapshot-files-data snap)
                          #:today "2026-08-06"
                          #:zoom-base "/n/"
                          #:blocked (blocked-nodes (snapshot-edges snap)))))
       (check-true (string-contains? html "ol-blocked") "no blocked pill on the page")
       ;; it names the blocker as the outline does, and links to it
       (check-true (string-contains? html "after ^order") html)
       (check-true (string-contains? html "/n/order") html)
       ;; an open node with nothing in front of it wears none: the pill is a
       ;; fact about the graph, not about being open
       (define fragment
         (xexpr->string
          (render-node-fragment
           (make-task #:title "colour" #:id "colour" #:key "colour")
           #:today "2026-08-06"
           #:blocked (blocked-nodes (snapshot-edges snap)))))
       (check-false (string-contains? fragment "ol-blocked"))))))
