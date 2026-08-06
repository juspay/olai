#lang racket/base

;; Shared plumbing for the CLI tests. Every `run-olai` is a fresh racket VM,
;; which is what makes these tests slow and why they live under integration/
;; split across cli-read / cli-multi / cli-add / cli-done: four files run in
;; parallel, one does not. No tests of its own.

(require json
         racket/port
         racket/system)

(provide example run-olai parse-json git git-subject find-node)

(define root
  (simplify-path
   (build-path (collection-file-path "info.rkt" "olai") 'up 'up)))

(define example (build-path root "examples" "Example.rkt"))

(define (run-olai args)
  (define-values (sp stdout stdin stderr)
    (apply subprocess
           #f #f #f
           (find-executable-path "racket")
           "-l" "olai/cli"
           "--"
           args))
  (close-output-port stdin)
  (define out (port->string stdout))
  (define err (port->string stderr))
  (close-input-port stdout)
  (close-input-port stderr)
  (subprocess-wait sp)
  (values (subprocess-status sp) out err))

(define (parse-json s)
  (read-json (open-input-string s)))

;; ---- what a write test needs around the write ------------------------------

;; A repo to write into, and a way to read back what the write committed:
;; auto-commit is part of the contract (docs/cli.md), so every test of a write
;; command wants both.
(define (git . args)
  (apply system* (find-executable-path "git") args))

;; The subject of the last commit, read in `dir`.
(define (git-subject dir)
  (with-output-to-string
    (λ () (parameterize ([current-directory dir]) (git "log" "-1" "--pretty=%s")))))

;; The node titled `title` in a `tree` reply, wherever it sits. Drilling in by
;; index instead pins a test to the fixture's shape, and breaks when a sibling
;; is added above the node it meant.
(define (find-node tasks title)
  (for/or ([t (in-list tasks)])
    (cond
      [(not (hash? t)) #f]
      [(equal? (hash-ref t 'title #f) title) t]
      [else (find-node (hash-ref t 'children '()) title)])))
