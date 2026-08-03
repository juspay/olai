#lang racket/base

;; Agent-facing JSON helpers (versioned envelope).

(require json
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/agenda)

(provide json-version
         write-json-stdout
         write-json-stderr
         ok-hash
         err-hash
         task->jsexpr
         tasks->jsexpr
         dated-task->jsexpr
         agenda-groups->jsexpr
         nullish)

(define json-version 1)

(define (nullish v)
  (if v v (json-null)))

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

(define (task->jsexpr tk)
  (hash 'title (task-title tk)
        'date (nullish (task-date tk))
        'description (nullish (task-description tk))
        'tags (task-tags tk)
        'children (map task->jsexpr (task-children tk))))

(define (tasks->jsexpr tasks)
  (map task->jsexpr tasks))

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
