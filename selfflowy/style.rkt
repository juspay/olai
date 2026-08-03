#lang racket/base

;; Shared terminal styling. ANSI only when stdout is a TTY.

(provide use-ansi?
         style-dim)

(define (use-ansi?)
  (terminal-port? (current-output-port)))

(define (style-dim s)
  (if (use-ansi?)
      (string-append "\x1b[2m" s "\x1b[0m")
      s))
