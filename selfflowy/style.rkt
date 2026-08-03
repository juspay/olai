#lang racket/base

;; Shared terminal styling via ansi-color. ANSI only when stdout is a TTY.

(require racket/port
         ansi-color)

(provide use-ansi?
         style-dim
         style-tag
         style-title-tags)

(define (use-ansi?)
  (terminal-port? (current-output-port)))

(define (style-dim s)
  (if (use-ansi?)
      (with-output-to-string
        (λ ()
          ;; Approximate dim: white foreground (ansi-color has no dim SGR)
          (with-colors 'white (λ () (display s)))))
      s))

(define (style-tag s)
  (if (use-ansi?)
      (with-output-to-string
        (λ ()
          (with-colors 'cyan (λ () (display s)))))
      s))

(define (style-title-tags title)
  (if (use-ansi?)
      (regexp-replace* #px"#[A-Za-z0-9_-]+"
                       title
                       (λ (tok) (style-tag tok)))
      title))
