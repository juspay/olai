#lang racket/base

;; What the two serializers PROMISE, at the level the modules themselves sit
;; at: json/model (what a node IS — durable) and json/reply (what a command
;; answered with). The CLI's own shapes are checked end to end in
;; tests/integration/; this file is about the fields, and especially about a
;; field a reader is told is append-only.

(require rackunit
         json
         (except-in olai/lang/expander #%module-begin)
         olai/agenda
         olai/json/model
         olai/json/reply)

(define (tk title #:date [date #f] #:done [done #f] #:doing [doing #f])
  (make-task #:title title #:date date #:done done #:doing doing #:key title))

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

  ;; Append-only within a version (docs/cli.md): the third state added keys,
  ;; it did not move the counter or reshape anything already there.
  (test-case "the model version did not move for a new field"
    (check-equal? json-model-version 1)
    (check-equal? json-reply-version 1))

  ;; ---- the agenda reply -----------------------------------------------------

  (test-case "the agenda answers with a doing array beside the date buckets"
    (define tasks
      (list (tk "Late" #:date "2026-07-01")
            (tk "In flight" #:doing #t)
            (tk "Due today" #:date "2026-08-03")))
    (define h (agenda-groups->jsexpr (agenda-groups tasks "2026-08-03")
                                     "2026-08-03"))
    (check-equal? (hash-ref h 'today) "2026-08-03")
    (for ([k (in-list '(overdue doing today_items upcoming))])
      (check-true (list? (hash-ref h k)) (format "~a" k)))
    (define doing (car (hash-ref h 'doing)))
    (check-equal? (hash-ref doing 'title) "In flight")
    (check-equal? (hash-ref doing 'status) "doing")
    ;; an undated node in flight is still on the agenda; its date is null
    (check-equal? (hash-ref doing 'date) (json-null))
    (check-equal? (hash-ref doing 'breadcrumb) "In flight")
    (define late (car (hash-ref h 'overdue)))
    (check-equal? (hash-ref late 'date) "2026-07-01")
    (check-equal? (hash-ref late 'status) "open"))

  (test-case "every group is present even when empty"
    (define h (agenda-groups->jsexpr (agenda-groups '() "2026-08-03")
                                     "2026-08-03"))
    (check-equal? (hash-ref h 'overdue) '())
    (check-equal? (hash-ref h 'doing) '())
    (check-equal? (hash-ref h 'today_items) '())
    (check-equal? (hash-ref h 'upcoming) '()))

  ;; The whole payload has to survive write-json — a jsexpr with a Racket
  ;; symbol or a #f in it type-checks nowhere until here.
  (test-case "the payloads are writable JSON"
    (check-true (jsexpr? (task->jsexpr (tk "T" #:doing "2026-08-03"))))
    (check-true (jsexpr? (agenda-groups->jsexpr
                          (agenda-groups (list (tk "In flight" #:doing #t))
                                         "2026-08-03")
                          "2026-08-03")))))
