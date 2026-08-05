#lang racket/base

;; Agent-facing JSON helpers (versioned envelope).

(require json
         racket/path
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/agenda
         selfflowy/calendar
         selfflowy/load
         ;; task_count / mirror_count are queries, not a JSON concern
         (only-in selfflowy/query count-tasks count-mirrors))

(provide json-version
         write-json-stdout
         write-json-stderr
         ok-hash
         err-hash
         task->jsexpr
         tasks->jsexpr
         child->jsexpr
         anchors->jsexpr
         outline->jsexpr
         outlines->jsexpr
         dated-task->jsexpr
         agenda-groups->jsexpr
         cal-item->jsexpr
         calendar->jsexpr
         nullish)

(define json-version 1)

(define (nullish v)
  (if v v (json-null)))

;; done field: null | true | ISO timestamp string
(define (done->json d)
  (cond
    [(eq? d #t) #t]
    [(string? d) d]
    [else (json-null)]))

(define (write-json-stdout h)
  (write-json h (current-output-port))
  (newline (current-output-port)))

(define (write-json-stderr h)
  (write-json h (current-error-port))
  (newline (current-error-port)))

(define (ok-hash . kvs)
  (apply hash 'version json-version 'ok #t kvs))

(define (err-hash message #:file [file #f] #:line [line #f] #:col [col #f])
  (hash 'version json-version
        'ok #f
        'error (hash 'file (nullish (and file
                                         (if (path? file) (path->string file) file)))
                     'line (nullish line)
                     'col (nullish col)
                     'message message)))

(define (task->jsexpr tk #:root-file [root-file #f])
  (define h
    (hash 'title (task-title tk)
          'date (nullish (task-date tk))
          'description (nullish (task-description tk))
          'done (done->json (task-done tk))
          ;; the state the field means: "open" | "done". `done` keeps the
          ;; stored value (null | true | timestamp) — both, so a reader can
          ;; ask the question it actually has.
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

;; Single-file tree payload (version added by caller or here).
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
      (hash-set (one (car entries)) 'version json-version)
      (hash 'version json-version
            'files (map one entries))))

(define (dated-task->jsexpr it)
  (hash 'title (dated-task-title it)
        'date (dated-task-date it)
        'breadcrumb (dated-task-breadcrumb it)))

(define (agenda-groups->jsexpr groups today)
  (define (items-for sym)
    (define p (assq sym groups))
    (if p (map dated-task->jsexpr (cdr p)) '()))
  (hash 'version json-version
        'today today
        'overdue (items-for 'overdue)
        'today_items (items-for 'today)
        'upcoming (items-for 'upcoming)))

(define (cal-item->jsexpr it)
  (hash 'title (cal-item-title it)
        'date (cal-item-date it)
        'breadcrumb (cal-item-breadcrumb it)
        'done (done->json (cal-item-done it))
        'status (symbol->string (cal-item-status it))
        'id (nullish (cal-item-id it))))

(define (calendar->jsexpr cal)
  (hash 'version json-version
        'month (hash-ref cal 'month)
        'days
        (for/list ([d (in-list (hash-ref cal 'days))])
          (hash 'date (hash-ref d 'date)
                'day_node (hash-ref d 'day_node #f)
                'items (map cal-item->jsexpr (hash-ref d 'items))))))
