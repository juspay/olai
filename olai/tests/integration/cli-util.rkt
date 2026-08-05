#lang racket/base

;; Shared plumbing for the CLI tests. Every `run-olai` is a fresh racket VM,
;; which is what makes these tests slow and why they live under integration/
;; split across cli-read / cli-multi / cli-add / cli-done: four files run in
;; parallel, one does not. No tests of its own.

(require json
         racket/port)

(provide example run-olai parse-json)

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
