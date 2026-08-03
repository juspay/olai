#lang racket/base

;; Render a task tree with unicode box-drawing characters.
;; Optional #:description is shown dimmed on the next line, indented.

(require racket/list
         racket/string
         "lang/expander.rkt")

(provide render-tree
         render-task
         format-task-line
         format-description-line
         dim)

(define (dim s)
  (string-append "\x1b[2m" s "\x1b[0m"))

(define (format-task-line tk)
  (define title (task-title tk))
  (define date (task-date tk))
  (if date
      (format "~a  [~a]" title date)
      title))

(define (format-description-line tk)
  (define desc (task-description tk))
  (and desc (dim desc)))

;; prefix: string drawn before the connector for nested nodes
(define (render-task tk #:prefix [prefix ""] #:is-last? [is-last? #t] #:is-root? [is-root? #t])
  (define title-line
    (if is-root?
        (format-task-line tk)
        (string-append prefix
                       (if is-last? "└── " "├── ")
                       (format-task-line tk))))
  (define desc-line
    (let ([d (format-description-line tk)])
      (and d
           (if is-root?
               (string-append "    " d)
               (string-append prefix
                              (if is-last? "    " "│   ")
                              "    "
                              d)))))
  (define kids (task-children tk))
  (define n (length kids))
  (define child-prefix
    (cond
      [is-root? ""]
      [is-last? (string-append prefix "    ")]
      [else (string-append prefix "│   ")]))
  (append
   (list title-line)
   (if desc-line (list desc-line) '())
   (append*
    (for/list ([c (in-list kids)]
               [i (in-naturals)])
      (render-task c
                   #:prefix child-prefix
                   #:is-last? (= i (sub1 n))
                   #:is-root? #f)))))

(define (render-tree tasks)
  (string-join
   (append*
    (for/list ([tk (in-list tasks)])
      ;; top-level tasks are separate roots (no connectors between them)
      (render-task tk #:prefix "" #:is-last? #t #:is-root? #t)))
   "\n"))
