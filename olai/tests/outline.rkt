#lang racket/base

(require rackunit
         racket/file
         racket/list
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/lang/outline)

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
    (check-equal? (eval-tasks "#lang olai\n") '()))

  (test-case "nested outline with date, description, tags"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai

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
#lang olai
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
#lang olai
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
       (eval-tasks "#lang olai\nRoot\n\tChild\n"))))

  (test-case "indent jump is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:indent|jump)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\nRoot\n    Jump\n"))))

  (test-case "metadata without title is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:no title|description)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\n  : orphan\n"))))

  (test-case "unknown @field is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:unknown|@layout|@date|@done)" (exn-message e))
            ;; the message lists what IS known, so a new field shows up there
            (regexp-match? #rx"@doing" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\nTask\n  @layout wide\n"))))

  (test-case "@done bare and with timestamp"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
Bare done
  @done
With stamp
  @done 2026-08-03
With datetime
  @done 2026-08-03 09:15
EOF
       ))
    (check-equal? (task-done (car tasks)) #t)
    (check-equal? (task-done (cadr tasks)) "2026-08-03")
    (check-equal? (task-done (caddr tasks)) "2026-08-03T09:15")
    (check-equal? (map task-status tasks) '(done done done))
    (check-equal? (map task-done-at tasks)
                  '(#f "2026-08-03" "2026-08-03T09:15"))
    (check-equal? (map task-title tasks)
                  '("Bare done" "With stamp" "With datetime")))

  (test-case "[x] / [ ] title checkbox sugar"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
[x] Finished task
[ ] Open task
[X] Also finished
EOF
       ))
    (check-equal? (map task-title tasks)
                  '("Finished task" "Open task" "Also finished"))
    (check-equal? (map task-status tasks) '(done open done)))

  (test-case "escaped checkbox is literal title, not sugar"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
\[x] literal checkbox text
EOF
       ))
    (check-equal? (task-title (car tasks)) "[x] literal checkbox text")
    (check-false (task-done (car tasks))))

  (test-case "duplicate @done is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:duplicate|@done)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\nTask\n  @done\n  @done 2026-01-01\n"))))

  (test-case "[x] plus @done is duplicate"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:duplicate|@done)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\n[x] Task\n  @done 2026-01-01\n"))))

  (test-case "@doing bare and with timestamp"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
Bare doing
  @doing
With stamp
  @doing 2026-08-03
With datetime
  @doing 2026-08-03 09:15
EOF
       ))
    (check-equal? (task-doing (car tasks)) #t)
    (check-equal? (task-doing (cadr tasks)) "2026-08-03")
    (check-equal? (task-doing (caddr tasks)) "2026-08-03T09:15")
    (check-equal? (map task-status tasks) '(doing doing doing))
    (check-equal? (map task-doing-at tasks)
                  '(#f "2026-08-03" "2026-08-03T09:15")))

  (test-case "[/] title checkbox sugar is the third state"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
[/] In flight
[x] Finished
[ ] Open
Plain
EOF
       ))
    (check-equal? (map task-title tasks)
                  '("In flight" "Finished" "Open" "Plain"))
    (check-equal? (map task-status tasks) '(doing done open open))
    ;; sugar is a bare mark; the stamped form is the @field
    (check-equal? (task-doing (car tasks)) #t))

  ;; [-] is not claimed by anything yet (a future cancelled), so it is a title
  (test-case "[-] is an ordinary title, not sugar"
    (define tasks (eval-tasks "#lang olai\n[-] Dropped\n"))
    (check-equal? (task-title (car tasks)) "[-] Dropped")
    (check-equal? (task-status (car tasks)) 'open))

  (test-case "escaped [/] is a literal title, not sugar"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
\[/] literal slash box
EOF
       ))
    (check-equal? (task-title (car tasks)) "[/] literal slash box")
    (check-false (task-doing (car tasks))))

  (test-case "duplicate @doing is a reader error"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:duplicate|@doing)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\nTask\n  @doing\n  @doing 2026-01-01\n"))))

  (test-case "[/] plus @doing is duplicate"
    (check-exn
     (λ (e)
       (and (exn:fail:read? e)
            (regexp-match? #rx"(?i:duplicate|@doing)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\n[/] Task\n  @doing 2026-01-01\n"))))

  (test-case "bad @doing timestamp fails expander"
    (check-exn
     (λ (e)
       (and (exn:fail? e)
            (regexp-match? #rx"(?i:date|ISO|datetime)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\nTask\n  @doing not-a-date\n"))))

  (test-case "bad @done timestamp fails expander"
    (check-exn
     (λ (e)
       (and (exn:fail? e)
            (regexp-match? #rx"(?i:date|ISO|datetime)" (exn-message e))))
     (λ ()
       (eval-tasks "#lang olai\nTask\n  @done not-a-date\n"))))

  (test-case "strip-checkbox-prefix helper"
    (define-values (t1 f1) (strip-checkbox-prefix "[x] hi"))
    (check-equal? t1 "hi")
    (check-equal? f1 'done)
    (define-values (t2 f2) (strip-checkbox-prefix "[ ] hi"))
    (check-equal? t2 "hi")
    (check-equal? f2 'open)
    (define-values (t3 f3) (strip-checkbox-prefix "plain"))
    (check-equal? t3 "plain")
    (check-false f3)
    (define-values (t4 f4) (strip-checkbox-prefix "[/] hi"))
    (check-equal? t4 "hi")
    (check-equal? f4 'doing)
    ;; unclaimed, so not sugar
    (define-values (t5 f5) (strip-checkbox-prefix "[-] hi"))
    (check-equal? t5 "[-] hi")
    (check-false f5))

  (test-case "datetime @date accepted (T and space forms)"
    (define tasks
      (eval-tasks
       #<<EOF
#lang olai
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
       (eval-tasks "#lang olai\nTask\n  @date 2026-01-01 extra\n"))))

  (test-case "bad @date value reports outline file:line:col via expander"
    (define tmp (make-temporary-file "sf-baddate~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        #<<EOF
#lang olai
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
