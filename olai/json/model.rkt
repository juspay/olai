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
          [anchors->jsexpr (->* (hash?) (#:root-file file-ref/c) hash?)]
          [outline->jsexpr (->* ((or/c path? string?) list? hash?)
                                (#:includes list?)
                                hash?)]
          [outlines->jsexpr (-> (listof outline?) hash?)]))

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
          'done (mark->json (task-done tk))
          'doing (mark->json (task-doing tk))
          ;; the state the marks mean: "open" | "doing" | "done". `done` and
          ;; `doing` keep their stored values (null | true | timestamp) —
          ;; both, so a reader can ask the question it actually has. `status`
          ;; is the one to switch on: it is where a fourth state would show up.
          'status (symbol->string (task-status tk))
          'id (nullish (task-id tk))
          'key (nullish (task-key tk))
          'tags (task-tags tk)
          'children (map (λ (c) (child->jsexpr c #:root-file root-file))
                         (task-children tk))))
  (define tf (task-file tk))
  (define root*
    (and root-file
         (path->string (simple-form-path
                        (if (path? root-file) root-file (string->path root-file))))))
  (define tf*
    (and tf (path->string (simple-form-path (string->path tf)))))
  (if (and tf* root* (not (equal? tf* root*)))
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

;; Single-file tree payload (version added by the caller, or by
;; outlines->jsexpr below).
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

;; The whole `tree` payload. entries : (listof outline).
;; One file keeps the historical single-file shape; several nest under 'files.
(define (outlines->jsexpr entries)
  (define (one o)
    (outline->jsexpr (outline-path o) (outline-tasks o) (outline-anchors o)
                     #:includes (outline-includes o)))
  (if (= (length entries) 1)
      (hash-set (one (car entries)) 'version json-model-version)
      (hash 'version json-model-version
            'files (map one entries))))
