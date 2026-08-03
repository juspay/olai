#lang racket/base

(require rackunit
         racket/file
         racket/port
         racket/string
         xml
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/html)

(define (tk title date desc kids #:tags [tags '()])
  (task title date desc tags kids))

(module+ test
  (test-case "leaf is li without details"
    (define x (task->xexpr (tk "Leaf" #f #f '())))
    (check-equal? (car x) 'li)
    (define s (xexpr->string x))
    (check-false (string-contains? s "<details") s)
    (check-true (string-contains? s "Leaf") s))

  (test-case "parent uses details/summary"
    (define x
      (task->xexpr
       (tk "Parent" #f #f (list (tk "Child" #f #f '())))))
    (define s (xexpr->string x))
    (check-true (string-contains? s "<details") s)
    (check-true (string-contains? s "<summary") s)
    (check-true (string-contains? s "Parent") s)
    (check-true (string-contains? s "Child") s))

  (test-case "escapes quotes angle brackets and ampersands"
    (define x
      (task->xexpr
       (tk "A <b> & \"q\"" #f #f '())))
    (define s (xexpr->string x))
    (check-true (string-contains? s "&lt;") s)
    (check-true (string-contains? s "&amp;") s)
    (check-true (or (string-contains? s "&quot;")
                    (string-contains? s "\""))
                s)
    (check-false (regexp-match? #rx"<b>" s) s))

  (test-case "date badge and description present"
    (define x
      (task->xexpr
       (tk "T" "2026-01-02" "note" '())))
    (define s (xexpr->string x))
    (check-true (string-contains? s "2026-01-02") s)
    (check-true (string-contains? s "note") s))

  (test-case "tag tokens rendered as pill spans"
    (define x (task->xexpr (tk "Ship #lang work" #f #f '())))
    (define s (xexpr->string x))
    (check-true (string-contains? s "#lang") s)
    (check-true (regexp-match? #rx"rounded-full" s) s))

  (test-case "tasks->html includes doctype and tailwind cdn"
    (define html
      (tasks->html (list (tk "A" #f #f '())) "Demo"))
    (check-true (string-prefix? html "<!DOCTYPE html>") html)
    (check-true (string-contains? html "cdn.tailwindcss.com") html)
    (check-true (string-contains? html "<title>Demo</title>") html))

  (test-case "cli html --out writes file"
    (define dir (make-temporary-file "sfhtml~a" 'directory))
    (define outline (build-path dir "t.rkt"))
    (define out (build-path dir "t.html"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang selfflowy\nHello & <world>\n" outline #:exists 'truncate)
       (define-values (sp stdout stdin stderr)
         (subprocess #f #f #f
                     (find-executable-path "racket")
                     "-l" "selfflowy/cli" "--"
                     "html" "--out" (path->string out) (path->string outline)))
       (close-output-port stdin)
       (define o (port->string stdout))
       (define e (port->string stderr))
       (close-input-port stdout)
       (close-input-port stderr)
       (subprocess-wait sp)
       (check-equal? (subprocess-status sp) 0 (string-append o e))
       (check-true (file-exists? out))
       (define html (file->string out))
       (check-true (string-contains? html "Hello") html)
       (check-true (string-contains? html "&amp;") html)
       (check-true (string-contains? html "&lt;") html))
     (λ () (delete-directory/files dir)))))
