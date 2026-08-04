#lang racket/base

;; Agent-facing JSON helpers (versioned envelope).

(require json
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/agenda
         selfflowy/calendar)

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
         dated-task->jsexpr
         agenda-groups->jsexpr
         cal-item->jsexpr
         calendar->jsexpr
         nullish
         count-tasks
         count-mirrors)

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

;; Count unique defining task nodes (mirrors do not add to the count).
(define (count-tasks tasks)
  (define (count x)
    (cond
      [(task? x)
       (add1 (for/sum ([c (in-list (task-children x))])
               (count c)))]
      [else 0]))
  (for/sum ([t (in-list tasks)]) (count t)))

(define (count-mirrors tasks)
  (define (count x)
    (cond
      [(mirror-ref? x) 1]
      [(task? x)
       (for/sum ([c (in-list (task-children x))])
         (count c))]
      [else 0]))
  (for/sum ([t (in-list tasks)]) (count t)))

(define (child->jsexpr x)
  (cond
    [(mirror-ref? x)
     (hash 'mirror (mirror-ref-anchor x))]
    [(task? x)
     (task->jsexpr x)]
    [else (error 'child->jsexpr "unknown child ~a" x)]))

(define (task->jsexpr tk)
  (define h
    (hash 'title (task-title tk)
          'date (nullish (task-date tk))
          'description (nullish (task-description tk))
          'done (done->json (task-done tk))
          'id (nullish (task-id tk))
          'tags (task-tags tk)
          'children (map child->jsexpr (task-children tk))))
  h)

(define (tasks->jsexpr tasks)
  (map task->jsexpr tasks))

(define (anchors->jsexpr anchors)
  ;; hash id -> task; emit object with string keys
  (for/hash ([(id tk) (in-hash anchors)])
    (values (string->symbol id) (task->jsexpr tk))))

;; Single-file tree payload (version added by caller or here).
(define (outline->jsexpr path tasks anchors)
  (hash 'file (if (path? path) (path->string path) path)
        'tasks (tasks->jsexpr tasks)
        'anchors (anchors->jsexpr anchors)
        'task_count (count-tasks tasks)
        'mirror_count (count-mirrors tasks)
        'anchor_count (hash-count anchors)))

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
        'id (nullish (cal-item-id it))))

(define (calendar->jsexpr cal)
  (hash 'version json-version
        'month (hash-ref cal 'month)
        'days
        (for/list ([d (in-list (hash-ref cal 'days))])
          (hash 'date (hash-ref d 'date)
                'day_node (hash-ref d 'day_node #f)
                'items (map cal-item->jsexpr (hash-ref d 'items))))))
