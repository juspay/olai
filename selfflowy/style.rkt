#lang racket/base

;; Shared terminal styling. ANSI only when stdout is a TTY.

(provide use-ansi?
         style-dim
         style-tag
         style-title-tags)

(define (use-ansi?)
  (terminal-port? (current-output-port)))

(define (style-dim s)
  (if (use-ansi?)
      (string-append "\x1b[2m" s "\x1b[0m")
      s))

;; Underline a tag token (including the leading #).
(define (style-tag s)
  (if (use-ansi?)
      (string-append "\x1b[4m" s "\x1b[0m")
      s))

;; Style #tag tokens inside a title when on a TTY; plain otherwise.
(define (style-title-tags title)
  (if (use-ansi?)
      (regexp-replace* #px"#[A-Za-z0-9_-]+"
                       title
                       (λ (tok) (style-tag tok)))
      title))
