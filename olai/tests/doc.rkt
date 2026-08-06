#lang racket/base

;; What a @doc path MEANS, on its own: the closed extension set, where a
;; relative one resolves to, and the one line of a document a collapsed node
;; shows. Pure — the only thing here that touches a disk is doc-text, and it
;; is handed a temp file.
;;
;; The language's use of these rules is tested where the language is
;; (tests/outline, tests/expander); this file is about the rules.

(require racket/file
         racket/path
         racket/string
         olai/doc)

(module+ test
  (require rackunit))

(module+ test

  ;; ---- the closed set ------------------------------------------------------

  (test-case "two extensions, and the phrase that names them"
    (check-equal? (doc-kind "notes/plan.md") 'md)
    (check-equal? (doc-kind "deep.scrbl") 'scrbl)
    (check-equal? doc-extensions '(".md" ".scrbl"))
    (check-true (string-contains? doc-extensions-phrase ".md"))
    (check-true (string-contains? doc-extensions-phrase ".scrbl")))

  (test-case "anything else is not a document"
    (for ([rel (in-list '("plan.txt" "plan" "plan." "notes/" "" "plan.markdown"))])
      (check-false (doc-kind rel) rel))
    ;; closed, not approximately closed: the set is spelled in one case
    (check-false (doc-kind "PLAN.MD"))
    ;; a non-string is a question about something that is not a path
    (check-false (doc-kind #f)))

  ;; ---- where it points -----------------------------------------------------

  (test-case "a doc resolves against the file that defined the node"
    (check-equal? (doc-path "notes/plan.md" "/tmp/outlines/Tasks.rkt")
                  "/tmp/outlines/notes/plan.md")
    ;; a fragment names its document from its OWN directory
    (check-equal? (doc-path "plan.md" "/tmp/outlines/Daily/2026-08.rkt")
                  "/tmp/outlines/Daily/plan.md")
    ;; and the answer is simplified, so two spellings are one key
    (check-equal? (doc-path "../notes/plan.md" "/tmp/outlines/Daily/2026-08.rkt")
                  (doc-path "notes/plan.md" "/tmp/outlines/Tasks.rkt")))

  (test-case "nothing to resolve is #f, never a crash"
    (check-false (doc-path #f "/tmp/outlines/Tasks.rkt"))
    (check-false (doc-path "plan.md" #f))
    ;; an absolute path is not a relative one — and build-path would have
    ;; raised here, with no srcloc for the language to report
    (check-false (doc-relative? "/etc/hostname.md"))
    (check-false (doc-path "/etc/hostname.md" "/tmp/outlines/Tasks.rkt"))
    (check-true (doc-relative? "notes/plan.md")))

  ;; ---- reading it ----------------------------------------------------------

  (test-case "doc-text reads it, or says it could not"
    (define tmp (make-temporary-file "olai-doc~a.md"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "# Plan\n" tmp #:exists 'truncate)
       (check-equal? (doc-text tmp) "# Plan\n"))
     (λ () (delete-file tmp)))
    ;; the file went away between the load and the read: a state, not an exn
    (check-false (doc-text "/tmp/olai-no-such-document.md")))

  ;; ---- the one line a preview shows ----------------------------------------

  (test-case "the lead is the first line that says something"
    (check-equal? (doc-lead "# The plan\n\nbody\n") "The plan")
    (check-equal? (doc-lead "\n\n   \nAt last\n") "At last")
    (check-equal? (doc-lead "- first bullet\n") "first bullet")
    (check-equal? (doc-lead "> quoted\n") "quoted")
    (check-equal? (doc-lead "1. one\n") "one")
    ;; a line that is nothing but marks is not a line that says something
    (check-equal? (doc-lead "---\n# After the rule\n") "After the rule")
    ;; CRLF is a document somebody edited on another machine
    (check-equal? (doc-lead "# The plan\r\nbody\r\n") "The plan")
    ;; nothing to say
    (check-equal? (doc-lead "") "")
    (check-equal? (doc-lead "\n\n") ""))

  (test-case "the lead is one line's worth, not a paragraph's"
    (define long (make-string 400 #\x))
    (define lead (doc-lead (string-append long "\n")))
    (check-true (< (string-length lead) 200) (number->string (string-length lead)))
    (check-true (string-suffix? lead "…") lead)))
