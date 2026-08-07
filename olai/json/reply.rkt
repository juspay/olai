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
         racket/hash
         json
         racket/path
         olai/agenda
         olai/calendar
         ;; a blocker is a node, and a node is addressed by its key
         (only-in olai/lang/expander task-key)
         (only-in olai/json/model nullish mark->json))

(provide (contract-out
          [json-reply-version exact-positive-integer?]
          [write-json-stdout (-> hash? void?)]
          [write-json-stderr (-> hash? void?)]
          [ok-hash (->* () #:rest list? hash?)]
          [error-object (->* (string?)
                             (#:file (or/c path? string? #f)
                              #:line (or/c exact-integer? #f)
                              #:col (or/c exact-integer? #f)
                              #:detail hash?)
                             hash?)]
          [err-hash (->* (string?)
                         (#:file (or/c path? string? #f)
                          #:line (or/c exact-integer? #f)
                          #:col (or/c exact-integer? #f)
                          #:detail hash?)
                         hash?)]
          [agenda-item->jsexpr (-> agenda-item? symbol? hash?)]
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

;; What went wrong, as the four fields every surface reports it in. On its own
;; because it rides in two places: alone inside a reply that is ABOUT several
;; things (a multi-file `check`, where a failure may belong to one file or to
;; the set), and wrapped in the envelope below when the failure IS the reply.
;;
;; `detail` is what a failure knows about ITSELF, as keys beside the four: the
;; refusal to write a derived state names the children the state came from, and
;; an agent that has to act on them must not be reading them back out of a
;; sentence (docs/cli.md: agents do not regex pretty-printed messages). Empty
;; for every failure that has nothing to add, which is most of them.
;; The four fields WIN a collision: a detail may not quietly redefine where the
;; error is.
(define (error-object message
                      #:file [file #f] #:line [line #f] #:col [col #f]
                      #:detail [detail (hash)])
  (hash-union
   (hash 'file (nullish (and file (if (path? file) (path->string file) file)))
         'line (nullish line)
         'col (nullish col)
         'message message)
   detail
   #:combine (λ (four _detail) four)))

(define (err-hash message
                  #:file [file #f] #:line [line #f] #:col [col #f]
                  #:detail [detail (hash)])
  (hash 'version json-reply-version
        'ok #f
        'error (error-object message
                             #:file file #:line line #:col col
                             #:detail detail)))

(define (agenda-item->jsexpr it bucket)
  (hash 'title (agenda-item-title it)
        ;; null in the `doing` group: a node in flight need not be dated
        'date (nullish (agenda-item-date it))
        'breadcrumb (agenda-item-breadcrumb it)
        'status (symbol->string (agenda-item-status it))
        ;; Where the item sits by its own facts (see items-for below): the
        ;; group it is in, unless it is BLOCKED — and then what it would have
        ;; been. An overdue node waiting on an unfinished one is both, and an
        ;; agent that only heard "blocked" would not know it was already late.
        'bucket (symbol->string bucket)
        'blocked (agenda-item-blocked? it)
        ;; What it is waiting on, as KEYS — the way everything else addresses a
        ;; node (docs/cli.md). An anchored blocker's key IS its anchor, so the
        ;; common case reads as the outline wrote it, and an unanchored one is
        ;; still something `tree` can be asked about.
        'waiting_on (map task-key (agenda-item-waiting it))))

(define (agenda-groups->jsexpr groups today)
  ;; In four of the five groups the bucket IS the group — `overdue` holds what
  ;; is overdue, and the agenda put it there by asking exactly that. BLOCKED is
  ;; the exception the field exists for: those items are here INSTEAD of in the
  ;; bucket they belong to, so that bucket is the one thing the reply still has
  ;; to go and ask.
  (define (items-for sym)
    (define p (assq sym groups))
    (if p
        (for/list ([it (in-list (cdr p))])
          (agenda-item->jsexpr it (if (eq? sym 'blocked) (agenda-bucket it today) sym)))
        '()))
  (hash 'version json-reply-version
        'today today
        'overdue (items-for 'overdue)
        ;; above today_items, as the agenda reads it (olai/agenda)
        'doing (items-for 'doing)
        'today_items (items-for 'today)
        'upcoming (items-for 'upcoming)
        ;; and under all of them: what you cannot act on yet
        'blocked (items-for 'blocked)))

(define (cal-item->jsexpr it)
  (hash 'title (cal-item-title it)
        'date (cal-item-date it)
        'breadcrumb (cal-item-breadcrumb it)
        'done (mark->json (cal-item-done it))
        'doing (mark->json (cal-item-doing it))
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
