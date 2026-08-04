#lang racket/base

(require rackunit
         racket/file
         racket/hash
         racket/string
         json
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/lang/outline
         selfflowy/json-out
         selfflowy/agenda
         selfflowy/html
         selfflowy/done
         selfflowy/capture)

(define (eval-mod src)
  (define tmp (make-temporary-file "sf-mir~a.rkt"))
  (dynamic-wind
   void
   (λ ()
     (display-to-file src tmp #:exists 'truncate)
     (define tasks (dynamic-require `(file ,(path->string tmp)) 'tasks))
     (define anchors (dynamic-require `(file ,(path->string tmp)) 'anchors))
     (values tasks anchors))
   (λ () (delete-file tmp))))

(define (eval-tasks src)
  (define-values (t a) (eval-mod src))
  t)

(module+ test
  (test-case "sexp #:id and mirror resolve"
    (define-values (tasks anchors)
      (eval-mod
       #<<EOF
#lang selfflowy/sexp
(t "Agent work" #:id "agent"
   (t "notes"))
(t "This week"
   (mirror "agent"))
EOF
       ))
    (check-equal? (length tasks) 2)
    (check-equal? (task-id (car tasks)) "agent")
    (check-true (hash-has-key? anchors "agent"))
    (define week (cadr tasks))
    (check-true (mirror-ref? (car (task-children week))))
    (check-equal? (mirror-ref-anchor (car (task-children week))) "agent"))

  (test-case "outline ^anchor and *mirror"
    (define-values (tasks anchors)
      (eval-mod
       #<<EOF
#lang selfflowy
Agent work ^agent
  notes
This week
  *agent
EOF
       ))
    (check-equal? (task-title (car tasks)) "Agent work")
    (check-equal? (task-id (car tasks)) "agent")
    (check-equal? (mirror-ref-anchor (car (task-children (cadr tasks))))
                  "agent")
    (check-true (hash-has-key? anchors "agent")))

  (test-case "duplicate anchor rejected"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:duplicate)" (exn-message e)))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"A\" #:id \"x\")\n(t \"B\" #:id \"x\")\n"))))

  (test-case "unknown mirror rejected"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:unknown)" (exn-message e)))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"A\" (mirror \"missing\"))\n"))))

  (test-case "direct cycle rejected"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:cycle)" (exn-message e)))
     (λ ()
       (eval-tasks
        "#lang selfflowy/sexp\n(t \"A\" #:id \"a\" (mirror \"a\"))\n"))))

  (test-case "transitive cycle rejected"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:cycle)" (exn-message e)))
     (λ ()
       (eval-tasks
        #<<EOF
#lang selfflowy/sexp
(t "A" #:id "a" (mirror "b"))
(t "B" #:id "b" (mirror "a"))
EOF
        ))))

  (test-case "count tasks once; JSON mirror + anchors"
    (define-values (tasks anchors)
      (eval-mod
       #<<EOF
#lang selfflowy/sexp
(t "A" #:id "a" #:date "2026-01-01")
(t "B" (mirror "a"))
EOF
       ))
    (check-equal? (count-tasks tasks) 2)
    (check-equal? (count-mirrors tasks) 1)
    (check-equal? (hash-count anchors) 1)
    (define j (outline->jsexpr "/tmp/x.rkt" tasks anchors))
    (check-equal? (hash-ref j 'task_count) 2)
    (check-equal? (hash-ref j 'mirror_count) 1)
    (define kids (hash-ref (cadr (hash-ref j 'tasks)) 'children))
    (check-equal? (hash-ref (car kids) 'mirror) "a")
    (check-true (hash-has-key? (hash-ref j 'anchors) 'a)))

  (test-case "agenda dedupes mirrored dated task"
    (define-values (tasks anchors)
      (eval-mod
       #<<EOF
#lang selfflowy/sexp
(t "Milk" #:id "milk" #:date "2026-07-01")
(t "Elsewhere" (mirror "milk"))
EOF
       ))
    (define groups (agenda-groups tasks "2026-08-03"))
    (define ov (cdr (assq 'overdue groups)))
    (check-equal? (length ov) 1)
    (check-equal? (dated-task-title (car ov)) "Milk")
    (check-equal? (dated-task-breadcrumb (car ov)) "Milk"))

  (test-case "html id and mirror glyph"
    (define-values (tasks anchors)
      (eval-mod
       #<<EOF
#lang selfflowy/sexp
(t "Agent" #:id "agent")
(t "Week" (mirror "agent"))
EOF
       ))
    (define html (tasks->html tasks "T" #:anchors anchors))
    (check-true (string-contains? html "id=\"agent\"") html)
    (check-true (string-contains? html "href=\"#agent\"") html)
    (check-true (string-contains? html "↗") html))

  (test-case "done via ^anchor"
    (define src
      "#lang selfflowy\nShip it ^ship\n  : note\n")
    (define-values (new line)
      (mark-done-in-text src "^ship" "2026-08-03"))
    (check-true (string-contains? new "@done 2026-08-03") new)
    (check-true (string-contains? new "Ship it ^ship") new)
    (define ms (find-anchor-matches src "ship"))
    (check-equal? (length ms) 1)
    (check-equal? (title-match-title (car ms)) "Ship it"))

  (test-case "add --parent ^anchor"
    (define src
      "#lang selfflowy\nProject ^proj\n  existing\nOther\n")
    (define-values (new line created?)
      (append-capture src "fresh" #:parent "^proj"))
    (check-false created?)
    (check-true (regexp-match? #rx"Project \\^proj\n  existing\n  fresh\n" new)
                new)
    (check-true (string-contains? new "Other") new))

  (test-case "strip-trailing-anchor helper"
    (define-values (t a) (strip-trailing-anchor "Hello ^world"))
    (check-equal? t "Hello")
    (check-equal? a "world")))
