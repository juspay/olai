#lang racket/base

(require rackunit
         racket/file
         (except-in selfflowy/lang/expander #%module-begin))

(define (eval-tasks src)
  (define tmp (make-temporary-file "selfflowy~a.rkt"))
  (dynamic-wind
   void
   (λ ()
     (display-to-file src tmp #:exists 'truncate)
     ;; Same namespace as this module so `task?` / accessors match.
     (dynamic-require `(file ,(path->string tmp)) 'tasks))
   (λ () (delete-file tmp))))

(module+ test
  (test-case "empty module yields empty task list"
    (check-equal? (eval-tasks "#lang selfflowy\n") '()))

  (test-case "nested tasks with optional date and description"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy
(t "Inbox"
   #:description "landing"
   (t "Buy milk" #:date "2026-08-04" #:description "2%")
   (t "Write docs"
      (t "Compare Racket vs Rhombus")))
EOF
       ))
    (check-equal? (length tasks) 1)
    (define inbox (car tasks))
    (check-equal? (task-title inbox) "Inbox")
    (check-false (task-date inbox))
    (check-equal? (task-description inbox) "landing")
    (check-equal? (length (task-children inbox)) 2)
    (define milk (car (task-children inbox)))
    (check-equal? (task-title milk) "Buy milk")
    (check-equal? (task-date milk) "2026-08-04")
    (check-equal? (task-description milk) "2%")
    (define docs (cadr (task-children inbox)))
    (check-equal? (task-title docs) "Write docs")
    (check-false (task-description docs))
    (check-equal? (length (task-children docs)) 1))

  (test-case "description before date is allowed"
    (define tasks
      (eval-tasks
       "#lang selfflowy\n(t \"x\" #:description \"hi\" #:date \"2026-01-02\")\n"))
    (define tk (car tasks))
    (check-equal? (task-description tk) "hi")
    (check-equal? (task-date tk) "2026-01-02"))

  (test-case "invalid date is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:YYYY-MM-DD|date)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:date \"not-a-date\")\n"))))

  (test-case "non-string date is a syntax error"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:date 42)\n"))))

  (test-case "non-string description is a syntax error"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:description 42)\n"))))

  (test-case "duplicate #:date rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:date|date)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:date \"2026-01-01\" #:date \"2026-01-02\")\n"))))

  (test-case "duplicate #:description rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:description|description)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:description \"a\" #:description \"b\")\n"))))

  (test-case "bad month/day rejected"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:date \"2026-13-01\")\n")))
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" #:date \"2026-02-30\")\n"))))

  (test-case "non-string title is a syntax error"
    (check-exn
     exn:fail?
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t 42)\n"))))

  (test-case "malformed child is a syntax error (closed grammar)"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:nested|task form|expected)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n(t \"x\" 42)\n"))))

  (test-case "non-task top-level form is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:nested|task form|expected)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy\n42\n")))))
