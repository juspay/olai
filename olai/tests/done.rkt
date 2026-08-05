#lang racket/base

(require rackunit
         racket/string
         selfflowy/done)

(module+ test
  (define sample
    #<<EOF
#lang selfflowy

Inbox
  Buy milk
    @date 2026-01-15
  Write docs
    : a note
Other
  Buy milk
EOF
    )

  (test-case "find-title-matches exact title"
    (define ms (find-title-matches sample "Write docs"))
    (check-equal? (length ms) 1)
    (check-equal? (title-match-line (car ms)) 6)
    (check-false (title-match-already-done? (car ms))))

  (test-case "ambiguous title lists both"
    (define ms (find-title-matches sample "Buy milk"))
    (check-equal? (length ms) 2)
    (check-equal? (map title-match-line ms) '(4 9)))

  (test-case "mark-done inserts @done with date"
    (define-values (new line)
      (mark-done-in-text sample "Write docs" "2026-08-03"))
    (check-true (regexp-match? #rx"Write docs\n    : a note\n    @done 2026-08-03\n"
                               new)
                new)
    (check-true (string-contains? new "Buy milk") new)
    (check-equal? line 8))

  (test-case "mark-done after title with no meta"
    (define src "#lang selfflowy\nSolo\n")
    (define-values (new line)
      (mark-done-in-text src "Solo" "2026-08-03"))
    (check-equal? new "#lang selfflowy\nSolo\n  @done 2026-08-03\n")
    (check-equal? line 3))

  (test-case "mark-done rejects already done via @done"
    (define src "#lang selfflowy\nX\n  @done 2026-01-01\n")
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:already done)" (exn-message e)))
     (λ () (mark-done-in-text src "X" "2026-08-03"))))

  (test-case "mark-done rejects already done via [x]"
    (define src "#lang selfflowy\n[x] X\n")
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:already done)" (exn-message e)))
     (λ () (mark-done-in-text src "X" "2026-08-03"))))

  (test-case "undo removes @done"
    (define src "#lang selfflowy\nX\n  : note\n  @done 2026-08-03\n  Child\n")
    (define-values (new line)
      (undo-done-in-text src "X"))
    (check-false (string-contains? new "@done") new)
    (check-true (string-contains? new "  : note\n") new)
    (check-true (string-contains? new "  Child\n") new)
    (check-equal? line 2))

  (test-case "undo strips [x] prefix"
    (define src "#lang selfflowy\n[x] Finished\n  : note\n")
    (define-values (new line)
      (undo-done-in-text src "Finished"))
    (check-true (regexp-match? #rx"(?m:^Finished$)" new) new)
    (check-false (regexp-match? #rx"\\[x\\]" new) new)
    (check-true (string-contains? new "  : note\n") new))

  (test-case "undo rejects not-done"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:not done)" (exn-message e)))
     (λ () (undo-done-in-text sample "Write docs"))))

  (test-case "no match errors"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:no task)" (exn-message e)))
     (λ () (mark-done-in-text sample "Missing" "2026-08-03")))))
