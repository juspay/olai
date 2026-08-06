#lang racket/base

(require rackunit
         racket/file
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/load)

(define (eval-tasks src)
  (define tmp (make-temporary-file "olai~a.rkt"))
  (dynamic-wind
   void
   (λ ()
     (display-to-file src tmp #:exists 'truncate)
     (dynamic-require `(file ,(path->string tmp)) 'tasks))
   (λ () (delete-file tmp))))

;; The same source through the load layer, which is what turns a syntax error
;; into the file:line:col an agent reads. -> (values where message)
(define (load-failure src [suffix "olai~a.rkt"])
  (define tmp (make-temporary-file suffix))
  (dynamic-wind
   void
   (λ ()
     (display-to-file src tmp #:exists 'truncate)
     (define r (try-load-outline tmp))
     (check-true (load-error? r) (format "expected a load error, got ~a" r))
     (values (or (load-error-where r) "") (load-error-message r)))
   (λ () (delete-file tmp))))

(module+ test
  (test-case "empty module yields empty task list"
    (check-equal? (eval-tasks "#lang olai/sexp\n") '()))

  (test-case "nested tasks with optional date and description"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai/sexp
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
    (check-equal? (task-status inbox) 'open)
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
#lang olai/sexp
(t "A" #:done)
(t "B" #:done "2026-08-03")
(t "C" #:done "2026-08-03 14:30" #:date "2026-08-01")
EOF
       ))
    (check-equal? (task-done (car tasks)) #t)
    (check-equal? (task-done (cadr tasks)) "2026-08-03")
    (check-equal? (task-done (caddr tasks)) "2026-08-03T14:30")
    (check-equal? (task-date (caddr tasks)) "2026-08-01")
    ;; the field is storage; the state is derived from it, and the timestamp
    ;; is asked for by name (a bare @done has none)
    (check-equal? (map task-status tasks) '(done done done))
    (check-equal? (map task-done-at tasks)
                  '(#f "2026-08-03" "2026-08-03T14:30")))

  (test-case "duplicate #:done rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:done|done)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:done #:done)\n"))))

  (test-case "bare #:doing and #:doing with timestamp"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai/sexp
(t "A" #:doing)
(t "B" #:doing "2026-08-03")
(t "C" #:doing "2026-08-03 14:30" #:date "2026-08-05")
EOF
       ))
    (check-equal? (task-doing (car tasks)) #t)
    (check-equal? (task-doing (cadr tasks)) "2026-08-03")
    (check-equal? (task-doing (caddr tasks)) "2026-08-03T14:30")
    (check-equal? (map task-status tasks) '(doing doing doing))
    (check-equal? (map task-doing-at tasks)
                  '(#f "2026-08-03" "2026-08-03T14:30"))
    ;; the two marks are separate fields; doing is not a kind of done
    (check-equal? (map task-done tasks) '(#f #f #f))
    (check-equal? (map task-done-at tasks) '(#f #f #f)))

  (test-case "duplicate #:doing rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:doing|doing)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:doing #:doing)\n"))))

  ;; Done and doing are STATES of one node, so it cannot be in both. Checked
  ;; per node at compile time (lang/expander): no tree walk, no splice, and
  ;; the error points at the @doing.
  (test-case "#:done and #:doing together is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:done or doing|not both)" (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:done #:doing)\n"))))

  (test-case "done-and-doing carries file:line:col, both surfaces"
    ;; sexp: the offending form is on line 3
    (define-values (where1 msg1)
      (load-failure "#lang olai/sexp\n(t \"ok\")\n(t \"x\" #:done \"2026-08-01\" #:doing)\n"))
    (check-true (string-contains? where1 ":3:") where1)
    (check-true (regexp-match? #rx"(?i:not both)" msg1) msg1)
    ;; outline: [/] on the title, @done two lines under it — the location is
    ;; the mark the reader saw second
    (define-values (where2 msg2)
      (load-failure "#lang olai\n[/] Task\n  : note\n  @done 2026-08-01\n"))
    (check-true (string-contains? where2 ":2:") where2)
    (check-true (regexp-match? #rx"(?i:not both)" msg2) msg2)
    ;; and the other way round: [x] plus an @doing under it
    (define-values (where3 msg3)
      (load-failure "#lang olai\n[x] Task\n  @doing 2026-08-01\n"))
    (check-true (string-contains? where3 ":3:") where3)
    (check-true (regexp-match? #rx"(?i:not both)" msg3) msg3))

  (test-case "bad #:doing timestamp rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:ISO|date|datetime|YYYY)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:doing \"not-a-date\")\n"))))

  (test-case "bad #:done timestamp rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:ISO|date|datetime|YYYY)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:done \"not-a-date\")\n"))))

  (test-case "inline #tags extracted, title stays verbatim"
    (define tasks
      (eval-tasks
       "#lang olai/sexp\n(t \"Ship #lang and #lang again #docs\")\n"))
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
       "#lang olai/sexp\n(t \"x\" #:description \"hi\" #:date \"2026-01-02\")\n"))
    (define tk (car tasks))
    (check-equal? (task-description tk) "hi")
    (check-equal? (task-date tk) "2026-01-02"))

  (test-case "datetime #:date accepted and space normalized to T"
    (define tasks
      (eval-tasks
       "#lang olai/sexp\n(t \"x\" #:date \"2026-08-04 09:30\")\n"))
    (check-equal? (task-date (car tasks)) "2026-08-04T09:30")
    (define tasks2
      (eval-tasks
       "#lang olai/sexp\n(t \"y\" #:date \"2026-08-04T18:00\")\n"))
    (check-equal? (task-date (car tasks2)) "2026-08-04T18:00"))

  (test-case "invalid date is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:ISO|date|datetime|YYYY)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:date \"not-a-date\")\n"))))

  (test-case "non-string date is a syntax error"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:date 42)\n"))))

  (test-case "non-string description is a syntax error"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:description 42)\n"))))

  (test-case "duplicate #:date rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:date|date)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:date \"2026-01-01\" #:date \"2026-01-02\")\n"))))

  (test-case "duplicate #:description rejected"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:too many|#:description|description)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:description \"a\" #:description \"b\")\n"))))

  (test-case "bad month/day rejected"
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:date \"2026-13-01\")\n")))
    (check-exn
     (λ (e) (exn:fail:syntax? e))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" #:date \"2026-02-30\")\n"))))

  (test-case "non-string title is a syntax error"
    (check-exn
     exn:fail?
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t 42)\n"))))

  (test-case "malformed child is a syntax error (closed grammar)"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:nested|task form|expected)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n(t \"x\" 42)\n"))))

  (test-case "non-task top-level form is a syntax error"
    (check-exn
     (λ (e)
       (and (exn:fail:syntax? e)
            (regexp-match? #rx"(?i:nested|task form|expected)"
                           (exn-message e))))
     (λ ()
       (eval-tasks
        "#lang olai/sexp\n42\n")))))
