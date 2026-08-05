#lang racket/base

;; What a COMMAND answers with: the ok/error envelope every write command
;; wears, and the per-command payloads (agenda groups, a calendar month) that
;; exist because a command was asked, not because the model has them.
;;
;; Its version is its own (json-reply-version), separate from the model's:
;; adding a field to a task and changing the shape of an error are different
;; promises to a different reader, and each can now move without dragging the
;; other along. Both start at 1 — that is a coincidence, not a constraint.
;;
;; This module knows the model module (a reply may carry a tree), never the
;; other way round.

(require racket/contract
         json
         racket/path
         selfflowy/agenda
         selfflowy/calendar
         (only-in selfflowy/json/model nullish done->json))

(provide (contract-out
          [json-reply-version exact-positive-integer?]
          [write-json-stdout (-> hash? void?)]
          [write-json-stderr (-> hash? void?)]
          [ok-hash (->* () #:rest list? hash?)]
          [err-hash (->* (string?)
                         (#:file (or/c path? string? #f)
                          #:line (or/c exact-integer? #f)
                          #:col (or/c exact-integer? #f))
                         hash?)]
          [dated-task->jsexpr (-> dated-task? hash?)]
          [agenda-groups->jsexpr (-> list? string? hash?)]
          [cal-item->jsexpr (-> cal-item? hash?)]
          [calendar->jsexpr (-> hash? hash?)])
         ;; re-exported so a command needs one require to write a reply
         nullish)

(define json-reply-version 1)

(define (write-json-stdout h)
  (write-json h (current-output-port))
  (newline (current-output-port)))

(define (write-json-stderr h)
  (write-json h (current-error-port))
  (newline (current-error-port)))

(define (ok-hash . kvs)
  (apply hash 'version json-reply-version 'ok #t kvs))

(define (err-hash message #:file [file #f] #:line [line #f] #:col [col #f])
  (hash 'version json-reply-version
        'ok #f
        'error (hash 'file (nullish (and file
                                         (if (path? file) (path->string file) file)))
                     'line (nullish line)
                     'col (nullish col)
                     'message message)))

(define (dated-task->jsexpr it)
  (hash 'title (dated-task-title it)
        'date (dated-task-date it)
        'breadcrumb (dated-task-breadcrumb it)))

(define (agenda-groups->jsexpr groups today)
  (define (items-for sym)
    (define p (assq sym groups))
    (if p (map dated-task->jsexpr (cdr p)) '()))
  (hash 'version json-reply-version
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
  (hash 'version json-reply-version
        'month (hash-ref cal 'month)
        'days
        (for/list ([d (in-list (hash-ref cal 'days))])
          (hash 'date (hash-ref d 'date)
                'day_node (hash-ref d 'day_node #f)
                'items (map cal-item->jsexpr (hash-ref d 'items))))))
