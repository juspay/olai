#lang racket/base

(require rackunit
         racket/string
         olai/status)

(module+ test
  (define sample
    #<<EOF
#lang olai

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
    (check-equal? (title-match-status (car ms)) 'open))

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
    (define src "#lang olai\nSolo\n")
    (define-values (new line)
      (mark-done-in-text src "Solo" "2026-08-03"))
    (check-equal? new "#lang olai\nSolo\n  @done 2026-08-03\n")
    (check-equal? line 3))

  (test-case "mark-done rejects already done via @done"
    (define src "#lang olai\nX\n  @done 2026-01-01\n")
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:already done)" (exn-message e)))
     (λ () (mark-done-in-text src "X" "2026-08-03"))))

  (test-case "mark-done rejects already done via [x]"
    (define src "#lang olai\n[x] X\n")
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:already done)" (exn-message e)))
     (λ () (mark-done-in-text src "X" "2026-08-03"))))

  (test-case "undo removes @done"
    (define src "#lang olai\nX\n  : note\n  @done 2026-08-03\n  Child\n")
    (define-values (new line)
      (undo-done-in-text src "X"))
    (check-false (string-contains? new "@done") new)
    (check-true (string-contains? new "  : note\n") new)
    (check-true (string-contains? new "  Child\n") new)
    (check-equal? line 2))

  (test-case "undo strips [x] prefix"
    (define src "#lang olai\n[x] Finished\n  : note\n")
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
     (λ () (mark-done-in-text sample "Missing" "2026-08-03"))))

  ;; ---- doing ---------------------------------------------------------------

  (test-case "mark-doing inserts @doing with date"
    (define-values (new line)
      (mark-doing-in-text sample "Write docs" "2026-08-03"))
    (check-true (regexp-match? #rx"Write docs\n    : a note\n    @doing 2026-08-03\n"
                               new)
                new)
    (check-equal? line 8))

  (test-case "title-match-status reads either spelling"
    (define src "#lang olai\n[/] Sugar\nField\n  @doing 2026-08-01\nOpen\n")
    (define (status-of title)
      (title-match-status (car (find-title-matches src title))))
    (check-equal? (status-of "Sugar") 'doing)
    (check-equal? (status-of "Field") 'doing)
    (check-equal? (status-of "Open") 'open))

  (test-case "mark-doing rejects a node already doing, either spelling"
    (for ([src (in-list (list "#lang olai\nX\n  @doing 2026-01-01\n"
                              "#lang olai\n[/] X\n"))])
      (check-exn
       (λ (e) (regexp-match? #rx"(?i:already doing)" (exn-message e)))
       (λ () (mark-doing-in-text src "X" "2026-08-03")))))

  ;; A done node is refused rather than reopened: undo the done first, so
  ;; nothing decides for you that finished work is not.
  (test-case "mark-doing rejects a done node"
    (define src "#lang olai\n[x] X\n")
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:already done)" (exn-message e)))
     (λ () (mark-doing-in-text src "X" "2026-08-03"))))

  (test-case "undo-doing removes @doing and strips [/]"
    (define-values (new line)
      (undo-doing-in-text "#lang olai\nX\n  : note\n  @doing 2026-08-03\n  Child\n"
                          "X"))
    (check-false (string-contains? new "@doing") new)
    (check-true (string-contains? new "  : note\n") new)
    (check-true (string-contains? new "  Child\n") new)
    (check-equal? line 2)
    (define-values (new2 _l)
      (undo-doing-in-text "#lang olai\n[/] X\n  : note\n" "X"))
    (check-true (regexp-match? #rx"(?m:^X$)" new2) new2)
    (check-false (regexp-match? #rx"\\[/\\]" new2) new2))

  (test-case "undo-doing rejects a node that is not doing"
    (check-exn
     (λ (e) (regexp-match? #rx"(?i:not doing)" (exn-message e)))
     (λ () (undo-doing-in-text sample "Write docs"))))

  ;; ---- done clears doing ---------------------------------------------------
  ;;
  ;; Both spellings, because a file carrying both marks is a form the language
  ;; rejects on the next load — which is exactly when a write would be caught.

  (test-case "done drops the @doing line it replaces"
    (define-values (new line)
      (mark-done-in-text "#lang olai\nX\n  : note\n  @doing 2026-08-01\n"
                         "X" "2026-08-03"))
    (check-false (string-contains? new "@doing") new)
    (check-true (string-contains? new "  @done 2026-08-03\n") new)
    (check-true (string-contains? new "  : note\n") new)
    (check-equal? line 4))

  (test-case "done strips the [/] prefix it replaces"
    (define-values (new _line)
      (mark-done-in-text "#lang olai\n[/] X\n" "X" "2026-08-03"))
    (check-true (regexp-match? #rx"(?m:^X$)" new) new)
    (check-false (regexp-match? #rx"\\[/\\]" new) new)
    (check-true (string-contains? new "  @done 2026-08-03\n") new))

  (test-case "done on an open node leaves the title alone"
    (define-values (new _line)
      (mark-done-in-text "#lang olai\nX\n" "X" "2026-08-03"))
    (check-equal? new "#lang olai\nX\n  @done 2026-08-03\n")))
