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
     (dynamic-require `(file ,(path->string tmp)) 'tasks))
   (λ () (delete-file tmp))))

(module+ test
  (test-case "empty module yields empty task list"
    (check-equal? (eval-tasks "#lang selfflowy/sexp\n") '()))

  (test-case "nested tasks with optional date and description"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy/sexp
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
    (check-false (task-done inbox))
    (check-false (task-id inbox))
    (check-equal? (task-tags inbox) '())
    (check-equal? (length (task-children inbox)) 2)
    (define milk (car (task-children inbox)))
    (check-equal? (task-title milk) "Buy milk")
    (check-equal? (task-date milk) "2026-08-04")
    (check-equal? (task-description milk) "2%")
    (check-false (task-done milk))
    (check-false (task-id milk)))

  (test-case "bare #:done and #:done with timestamp"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy/sexp
(t "A" #:done)
(t "B" #:done "2026-08-03")
(t "C" #:done "2026-08-03 14:30" #:date "2026-08-01")
EOF
       ))
    (check-equal? (task-done (car tasks)) #t)
    (check-equal? (task-done (cadr tasks)) "2026-08-03")
    (check-equal? (task-done (caddr tasks)) "2026-08-03T14:30")
    (check-equal? (task-date (caddr tasks)) "2026-08-01"))

  (test-case "duplicate #:done rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:done|done)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:done #:done)\n"))))

  (test-case "bad #:done timestamp rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:ISO|date|datetime|YYYY)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:done \"not-a-date\")\n"))))

  (test-case "inline #tags extracted, title stays verbatim"
    (define tasks
      (eval-tasks
       "#lang selfflowy/sexp\n(t \"Ship #lang and #lang again #docs\")\n"))
    (define tk (car tasks))
    (check-equal? (task-title tk) "Ship #lang and #lang again #docs")
    (check-equal? (task-tags tk) '("lang" "docs")))

  (test-case "title-tags order, dedup, punctuation edges"
    (check-equal? (title-tags "plain") '())
    (check-equal? (title-tags "#a #b #a") '("a" "b"))
    ;; #word matches anywhere (including mid-token after #)
    (check-equal? (title-tags "see #yes_1 and #ok-2.") '("yes_1" "ok-2"))
    (check-equal? (title-tags "c++ not a #tag!") '("tag"))
    (check-equal? (title-tags "#A #a") '("A" "a")))

  (test-case "description before date is allowed"
    (define tasks
      (eval-tasks
       "#lang selfflowy/sexp\n(t \"x\" #:description \"hi\" #:date \"2026-01-02\")\n"))
    (define tk (car tasks))
    (check-equal? (task-description tk) "hi")
    (check-equal? (task-date tk) "2026-01-02"))

  (test-case "datetime #:date accepted and space normalized to T"
    (define tasks
      (eval-tasks
       "#lang selfflowy/sexp\n(t \"x\" #:date \"2026-08-04 09:30\")\n"))
    (check-equal? (task-date (car tasks)) "2026-08-04T09:30")
    (define tasks2
      (eval-tasks
       "#lang selfflowy/sexp\n(t \"y\" #:date \"2026-08-04T18:00\")\n"))
    (check-equal? (task-date (car tasks2)) "2026-08-04T18:00"))

  (test-case "invalid date is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:ISO|date|datetime|YYYY)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:date \"not-a-date\")\n"))))

  (test-case "non-string date is a syntax error"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:date 42)\n"))))

  (test-case "non-string description is a syntax error"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:description 42)\n"))))

  (test-case "duplicate #:date rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:date|date)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:date \"2026-01-01\" #:date \"2026-01-02\")\n"))))

  (test-case "duplicate #:description rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:description|description)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:description \"a\" #:description \"b\")\n"))))

  (test-case "bad month/day rejected"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:date \"2026-13-01\")\n")))
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" #:date \"2026-02-30\")\n"))))

  (test-case "non-string title is a syntax error"
    (check-exn
     exn:fail?
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t 42)\n"))))

  (test-case "malformed child is a syntax error (closed grammar)"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:nested|task form|expected)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"x\" 42)\n"))))

  (test-case "non-task top-level form is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:nested|task form|expected)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n42\n")))))
