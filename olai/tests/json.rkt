#lang racket/base

;; What the two serializers PROMISE, at the level the modules themselves sit
;; at: json/model (what a node IS — durable) and json/reply (what a command
;; answered with). The CLI's own shapes are checked end to end in
;; tests/integration/; this file is about the fields, and especially about a
;; field a reader is told is append-only.

(require json
         (except-in olai/lang/expander #%module-begin)
         olai/json/model
         olai/json/reply)

(module+ test
  (require rackunit))

(module+ test
  (define (tk title #:date [date #f] #:done [done #f] #:doing [doing #f])
    (make-task #:title title #:date date #:done done #:doing doing #:key title)))

(module+ test

  ;; ---- a node's states ------------------------------------------------------
  ;;
  ;; `done` and `doing` keep their STORED value (null | true | timestamp);
  ;; `status` is what they mean. Both, so a reader can ask the question it
  ;; actually has — and `status` is the one to switch on, because that is
  ;; where a fourth state would show up.

  (test-case "an open node carries both marks as null"
    (define h (task->jsexpr (tk "Open")))
    (check-equal? (hash-ref h 'done) (json-null))
    (check-equal? (hash-ref h 'doing) (json-null))
    (check-equal? (hash-ref h 'status) "open"))

  (test-case "a doing node: the mark, and what it means"
    (define bare (task->jsexpr (tk "Bare" #:doing #t)))
    (check-equal? (hash-ref bare 'doing) #t)
    (check-equal? (hash-ref bare 'done) (json-null))
    (check-equal? (hash-ref bare 'status) "doing")
    (define stamped (task->jsexpr (tk "Stamped" #:doing "2026-08-03")))
    (check-equal? (hash-ref stamped 'doing) "2026-08-03")
    (check-equal? (hash-ref stamped 'status) "doing"))

  (test-case "a done node still says done, and the doing key is there"
    (define h (task->jsexpr (tk "Shipped" #:done "2026-08-02")))
    (check-equal? (hash-ref h 'done) "2026-08-02")
    (check-equal? (hash-ref h 'doing) (json-null))
    (check-equal? (hash-ref h 'status) "done"))

  ;; ---- the document a node attaches -----------------------------------------
  ;;
  ;; The path, and only the path: the document is a file an agent can already
  ;; read, diff and edit, so a serializer that inlined it would be shipping a
  ;; second copy of it that nothing keeps in step.

  (test-case "doc is the path the outline wrote, verbatim"
    (define h (task->jsexpr (make-task #:title "Ship it" #:key "k"
                                       #:doc "docs/plan.md")))
    (check-equal? (hash-ref h 'doc) "docs/plan.md")
    ;; nothing of the file itself
    (check-false (hash-has-key? h 'doc_html))
    (check-false (hash-has-key? h 'doc_text)))

  (test-case "a node with no document says so with null, not by omission"
    (define h (task->jsexpr (tk "Plain")))
    (check-equal? (hash-ref h 'doc) (json-null)))

  ;; Append-only within a version (docs/cli.md): the third state added keys,
  ;; and so did @doc — neither moved the counter or reshaped anything already
  ;; there.
  (test-case "the model version did not move for a new field"
    (check-equal? json-model-version 1)
    (check-equal? json-reply-version 1))

  ;; The whole payload has to survive write-json — a jsexpr with a Racket
  ;; symbol or a #f in it type-checks nowhere until here.
  (test-case "the payloads are writable JSON"
    (check-true (jsexpr? (task->jsexpr (tk "T" #:doing "2026-08-03"))))))
