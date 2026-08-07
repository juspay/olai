#lang racket/base

;; The DURABLE serializer: what a node, a tree, an anchor index and a whole
;; outline look like as JSON. This is the model an agent stores, diffs and
;; writes tooling against, and it changes only when the model does — a new
;; node field, edges between nodes, a state a task can be in.
;;
;; Its version is its own (json-model-version). The shape of a `done` reply,
;; or of an error envelope, has nothing to do with what a task IS: those live
;; in olai/json/reply and version separately. They used to share one
;; constant, so adding a field to a node and changing an envelope were the
;; same breaking change, and neither could move without the other.

(require racket/contract
         json
         racket/path
         (except-in olai/lang/expander #%module-begin)
         ;; the derived graph, as one value: what a node WROTE is on the node,
         ;; what the set MEANS by it is the index below
         (only-in olai/edges edge-index? edge-index-edges)
         olai/load
         ;; task_count / mirror_count are queries, not a JSON concern
         (only-in olai/query count-tasks count-mirrors))

(define file-ref/c (or/c path? string? #f))

(provide (contract-out
          [json-model-version exact-positive-integer?]
          [nullish (-> any/c any/c)]
          [mark->json (-> any/c any/c)]
          [task->jsexpr (->* (task?) (#:root-file file-ref/c) hash?)]
          [child->jsexpr (->* (any/c) (#:root-file file-ref/c) hash?)]
          [tasks->jsexpr (->* (list?) (#:root-file file-ref/c) list?)]
          [edges->jsexpr (-> edge-index? hash?)]
          [anchors->jsexpr (->* (hash?) (#:root-file file-ref/c) hash?)]
          [outline->jsexpr (->* ((or/c path? string?) list? hash?)
                                (#:includes list?)
                                hash?)]
          [linked->jsexpr (-> linked? hash?)]))

(define json-model-version 1)

(define (nullish v)
  (if v v (json-null)))

;; How a stored MARK — `done`, `doing` — encodes: null | true | ISO timestamp
;; string. The model owns it, and a reply that carries a copy of one (a
;; calendar item) encodes it the same way rather than its own way.
(define (mark->json d)
  (cond
    [(eq? d #t) #t]
    [(string? d) d]
    [else (json-null)]))

(define (task->jsexpr tk #:root-file [root-file #f])
  (define h
    (hash 'title (task-title tk)
          'date (nullish (task-date tk))
          'description (nullish (task-description tk))
          ;; The @doc path, exactly as the outline wrote it — relative to the
          ;; node's defining file (the `file` key below, when it differs from
          ;; the root). Never resolved and never rendered: the document is a
          ;; file on disk, and a serializer that inlined it would be shipping
          ;; a copy of something an agent can already read, diff and edit.
          'doc (nullish (task-doc tk))
          'done (mark->json (task-done tk))
          'doing (mark->json (task-doing tk))
          ;; the state the marks mean: "open" | "doing" | "done". `done` and
          ;; `doing` keep their stored values (null | true | timestamp) —
          ;; both, so a reader can ask the question it actually has. `status`
          ;; is the one to switch on: it is where a fourth state would show up.
          'status (symbol->string (task-status tk))
          ;; …and where that answer CAME from: "stored" when the node wrote a
          ;; mark, "derived" when it has task children and no mark of its own,
          ;; so its state is computed from theirs (olai/lang/state). The two
          ;; are already told apart by `done` being null under a `"done"`
          ;; status, which is exactly the kind of inference an agent should not
          ;; be left to make — and a write aimed at a derived state is refused
          ;; (docs/cli.md), so this is the field that says so in advance.
          'status_source (if (task-status-derived? tk) "derived" "stored")
          'id (nullish (task-id tk))
          'key (nullish (task-key tk))
          'tags (task-tags tk)
          ;; The typed edges this node WROTE, in source order and in the
          ;; direction it wrote them: `@blocks` stays `blocks` here. What the
          ;; set makes of them — one ordering relation, both spellings folded
          ;; into it — is the `edges` index beside `anchors`, and a reader
          ;; after the graph wants that one.
          'edges (for/list ([e (in-list (task-edges tk))])
                   (hash 'relation (symbol->string (edge-ref-relation e))
                         'target (edge-ref-anchor e)))
          'children (map (λ (c) (child->jsexpr c #:root-file root-file))
                         (task-children tk))))
  (define tf (task-file tk))
  (define root*
    (and root-file
         (path->string (simple-form-path
                        (if (path? root-file) root-file (string->path root-file))))))
  (define tf*
    (and tf (path->string (simple-form-path (string->path tf)))))
  ;; `file` says where a write goes, so it rides along whenever it is not the
  ;; one the reader already has: the payload's own file, or — in an index that
  ;; spans the set, where there is no one root to compare against — always.
  (if (and tf* (not (equal? tf* root*)))
      (hash-set h 'file tf*)
      h))

(define (child->jsexpr x #:root-file [root-file #f])
  (cond
    [(mirror-ref? x)
     (hash 'mirror (mirror-ref-anchor x))]
    [(task? x)
     (task->jsexpr x #:root-file root-file)]
    [else (error 'child->jsexpr "unknown child ~a" x)]))

(define (tasks->jsexpr tasks #:root-file [root-file #f])
  (map (λ (t) (task->jsexpr t #:root-file root-file)) tasks))

(define (anchors->jsexpr anchors #:root-file [root-file #f])
  ;; hash id -> task; emit object with string keys
  (for/hash ([(id tk) (in-hash anchors)])
    (values (string->symbol id) (task->jsexpr tk #:root-file root-file))))

;; THE GRAPH, as the set derived it: relation -> source key -> target keys,
;; normalized, so an agent asks "what is this after" instead of grepping two
;; spellings of it in prose. Keys are node keys, the same ones `tree` addresses
;; a node by — a target's key is the ^anchor it names.
;;
;; Forwards only. `back` is this hash inverted and mirrors ride in it (see
;; olai/edges); publishing both would be publishing one fact twice, and the one
;; a reader can invert is the one that says what the file wrote.
(define (edges->jsexpr idx)
  (for/hash ([(relation g) (in-hash (edge-index-edges idx))])
    (values relation
            (for/hash ([(source targets) (in-hash g)])
              (values (string->symbol source) targets)))))

;; Single-file tree payload (version added by the caller, or by
;; linked->jsexpr below).
(define (outline->jsexpr path tasks anchors #:includes [includes '()])
  (define path-str (if (path? path) (path->string path) path))
  (define h
    (hash 'file path-str
          'tasks (tasks->jsexpr tasks #:root-file path-str)
          'anchors (anchors->jsexpr anchors #:root-file path-str)
          'task_count (count-tasks tasks)
          'mirror_count (count-mirrors tasks)
          'anchor_count (hash-count anchors)))
  (if (null? includes)
      h
      (hash-set h 'includes
                (for/list ([p (in-list includes)])
                  (hash 'file p)))))

;; The whole `tree` payload, which is a payload about a linked SET.
;; One file keeps the historical single-file shape; several nest under 'files.
;;
;; Top-level `anchors` is the SET's index — every `^id` any of these files
;; declares, once, with the file that defines it. That is the scope an anchor
;; actually has (olai/lang/link), so it is the one a mirror site's `{"mirror":
;; "id"}` is resolved against, whichever file the site is in. A file's own
;; `anchors` stays what it always was: the anchors that file declares.
(define (linked->jsexpr lk)
  (define entries (linked-outlines lk))
  (define (one o)
    (outline->jsexpr (outline-path o) (outline-tasks o) (outline-anchors o)
                     #:includes (outline-includes o)))
  (cond
    ;; A set of ONE file: that file's `anchors` already IS the set's index, at
    ;; the top level and rooted at the file the reader has. The graph is the
    ;; set's either way, so it sits beside that index in both shapes.
    [(= (length entries) 1)
     (hash-set* (one (car entries))
                'version json-model-version
                'edges (edges->jsexpr (linked-edges lk)))]
    [else
     (hash 'version json-model-version
           'files (map one entries)
           'edges (edges->jsexpr (linked-edges lk))
           ;; A node in the set's index carries its own `file`: the index
           ;; spans the files, so the answer differs per anchor and there is
           ;; no one root to leave out (the rule tasks follow, above).
           'anchors (anchors->jsexpr (linked-anchors lk)))]))
