#lang racket/base

(require rackunit
         racket/file
         racket/list
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/lang/outline)

(define (eval-tasks src)
  (define tmp (make-temporary-file "sf-outline~a.rkt"))
  (dynamic-wind
   void
   (λ ()
     (display-to-file src tmp #:exists 'truncate)
     (dynamic-require `(file ,(path->string tmp)) 'tasks))
   (λ () (delete-file tmp))))

(define (parse-string s)
  (parse-outline-string 'test s))

(module+ test
  (test-case "empty outline"
    (check-equal? (eval-tasks "#lang selfflowy\n") '()))

  (test-case "nested outline with date, description, tags"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy

Inbox #capture
  : Quick capture landing zone
  Buy milk — don't quote me
    : 2% "raw" milk is fine
    @date 2026-01-15T08:00
  Ship phase 0.1 #lang
    @date 2026-08-03 14:30
EOF
       ))
    (check-equal? (length tasks) 1)
    (define inbox (car tasks))
    (check-equal? (task-title inbox) "Inbox #capture")
    (check-equal? (task-tags inbox) '("capture"))
    (check-equal? (task-description inbox) "Quick capture landing zone")
    (check-equal? (length (task-children inbox)) 2)
    (define milk (car (task-children inbox)))
    (check-equal? (task-title milk) "Buy milk — don't quote me")
    (check-equal? (task-date milk) "2026-01-15T08:00")
    (check-equal? (task-description milk) "2% \"raw\" milk is fine")
    (define ship (cadr (task-children inbox)))
    (check-equal? (task-tags ship) '("lang"))
    (check-equal? (task-date ship) "2026-08-03T14:30"))

  (test-case "multi-line description joins with newline"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy
Parent
  : line one
  : line two
EOF
       ))
    (check-equal? (task-description (car tasks)) "line one\nline two"))

  (test-case "backslash escapes sigil titles"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy
\: not a description
\@date not a field
\\ still a title
EOF
       ))
    (check-equal? (map task-title tasks)
                  '(": not a description" "@date not a field" "\\ still a title")))

  (test-case "tab in indentation is a reader error with location"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:tab)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang selfflowy\nRoot\n\tChild\n"))))

  (test-case "indent jump is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:indent|jump)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang selfflowy\nRoot\n    Jump\n"))))

  (test-case "metadata without title is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:no title|description)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang selfflowy\n  : orphan\n"))))

  (test-case "unknown @field is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:unknown|@layout|@date)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang selfflowy\nTask\n  @layout wide\n"))))

  (test-case "datetime @date accepted (T and space forms)"
    (define tasks
      (eval-tasks
       #<<EOF
#lang selfflowy
Morning
  @date 2026-08-04 09:30
Afternoon
  @date 2026-08-04T18:00:00
EOF
       ))
    (check-equal? (task-date (car tasks)) "2026-08-04T09:30")
    (check-equal? (task-date (cadr tasks)) "2026-08-04T18:00:00"))

  (test-case "garbage after @date fails expander validation"
    (check-exn
     (λ (e)
       (and (exn:fail? e)
            (regexp-match? #rx"(?i:date|ISO|datetime)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang selfflowy\nTask\n  @date 2026-01-01 extra\n"))))

  (test-case "bad @date value reports outline file:line:col via expander"
    (define tmp (make-temporary-file "sf-baddate~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        #<<EOF
#lang selfflowy
Bad date task
  @date not-a-date
EOF
        tmp #:exists 'truncate)
       (with-handlers
           ([exn:fail:syntax?
             (λ (e)
               (define stxs (exn:fail:syntax-exprs e))
               (define with-src (filter (λ (s) (syntax-source s)) stxs))
               (check-true (pair? with-src) "expected syntax objects with source")
               (define s (last with-src))
               (check-equal? (syntax-source s) tmp)
               (check-equal? (syntax-line s) 3)
               (check-true (and (syntax-column s) (>= (syntax-column s) 2))
                           (format "col was ~a" (syntax-column s)))
               (check-true (regexp-match? #rx"(?i:date|YYYY-MM-DD)" (exn-message e))))]
            [exn:fail?
             (λ (e) (fail (format "expected syntax error, got: ~a" (exn-message e))))])
         (dynamic-require `(file ,(path->string tmp)) 'tasks)
         (fail "expected syntax error for bad date")))
     (λ () (delete-file tmp))))

  (test-case "parse-outline-string builds t forms"
    (define forms
      (parse-string "A\n  B\n    @date 2026-02-02\n"))
    (check-equal? (length forms) 1)
    (define d (syntax->datum (car forms)))
    (check-equal? d '(t "A" (t "B" #:date "2026-02-02")))))
