#lang racket/base

;; What a COMMAND answers with: the ok/error envelope every write command
;; wears — what a command answered, not what the model has.
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
         ;; a failure may name nodes, and a node has a shape json/model owns
         (only-in olai/lang/expander task?)
         (only-in olai/json/model nullish task-mention->jsexpr))

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
                         hash?)])
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
;;
;; Its values arrive as DOMAIN values (olai/ops raises tasks, not JSON) and are
;; rendered here, which is where every other reply is rendered. The four fields
;; WIN a collision: a detail may not quietly redefine where the error is.
(define (error-object message
                      #:file [file #f] #:line [line #f] #:col [col #f]
                      #:detail [detail (hash)])
  (hash-set* (for/hash ([(k v) (in-hash detail)])
               (values k (detail->jsexpr v)))
             'file (nullish (and file (if (path? file) (path->string file) file)))
             'line (nullish line)
             'col (nullish col)
             'message message))

;; A detail value, as JSON. A NODE is published as a mention — what it is
;; called, what state it is in, the name you can address it by — which is
;; json/model's shape and not this module's. Everything else is already jsexpr
;; and rides through. By VALUE and not by key: a failure that names nodes under
;; some other key needs no entry in a table here, and there is no table to
;; forget to add one to.
(define (detail->jsexpr v)
  (cond
    [(task? v) (task-mention->jsexpr v)]
    [(list? v) (map detail->jsexpr v)]
    [else v]))

(define (err-hash message
                  #:file [file #f] #:line [line #f] #:col [col #f]
                  #:detail [detail (hash)])
  (hash 'version json-reply-version
        'ok #f
        'error (error-object message
                             #:file file #:line line #:col col
                             #:detail detail)))

