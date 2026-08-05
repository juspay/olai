#lang racket/base

;; Failures a PERSON reads.
;;
;; A text mutator that hits "already done" is not reporting an internal
;; invariant — it is answering the user. `(error 'mark-done-in-text ...)` put
;; the name of a private function in front of that answer, so the CLI printed
;;
;;   selfflowy: mark-done-in-text: already done: "Buy milk" (line 5)
;;
;; and agents got the same string in their JSON `message`. Three modules had
;; grown their own copy of "raise without a who:" to avoid it.
;;
;; This is that one. The ops layer decides what a failure MEANS (exn:fail:op
;; kinds -> exit codes, HTTP statuses); this only says it in words. Internal
;; invariants keep `error` and its who — there, the function name is the
;; point.

(require racket/contract)

(provide (contract-out
          [user-fail (->* (string?) #:rest list? none/c)]))

(define (user-fail fmt . args)
  (raise (exn:fail (apply format fmt args) (current-continuation-marks))))
