#lang racket/base

(require rackunit
         json
         racket/file
         racket/path
         racket/port
         racket/string
         xml
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/html)

(define (tk title date desc kids #:tags [tags '()] #:done [done #f] #:id [id #f])
  (task title date desc done id tags kids))

(define (xstr x) (xexpr->string x))

(module+ test
  (test-case "leaf is li with list-disc, no details"
    (define s (xstr (task->xexpr (tk "Leaf" #f #f '()) (hash))))
    (check-true (string-contains? s "list-disc") s)
    (check-false (string-contains? s "<details") s)
    (check-true (string-contains? s "Leaf") s))

  (test-case "parent uses details/summary tree chrome"
    (define s
      (xstr (task->xexpr (tk "Parent" #f #f (list (tk "Child" #f #f '()))) (hash))))
    (check-true (string-contains? s "<details") s)
    (check-true (string-contains? s "<summary") s)
    (check-true (string-contains? s "Parent") s)
    (check-true (string-contains? s "Child") s)
    (check-false (string-contains? s "Expand all") s)
    (check-false (string-contains? s "Collapse all") s))

  (test-case "title bold italic code"
    (define xs (title->inline-xexprs "**bold** and *i* and `code`"))
    (define s (string-join (map xstr xs) ""))
    (check-true (string-contains? s "<strong") s)
    (check-true (string-contains? s "<em") s)
    (check-true (string-contains? s "<code") s)
    (check-true (string-contains? s "bold") s))

  (test-case "title link"
    (define xs (title->inline-xexprs "[hi](https://example.com)"))
    (define s (string-join (map xstr xs) ""))
    (check-true (string-contains? s "href=\"https://example.com\"") s)
    (check-true (string-contains? s "hi") s))

  (test-case "fenced block in notes"
    (define xs (note->xexprs "intro\n\n```\nblock\n```\n"))
    (define s (string-join (map xstr xs) ""))
    (check-true (string-contains? s "<pre") s)
    (check-true (string-contains? s "block") s))

  (test-case "script and raw HTML stripped (not injected)"
    (define xs (title->inline-xexprs "hi <script>alert(1)</script> & ok"))
    (define s (string-join (map xstr xs) ""))
    (check-false (string-contains? s "<script") s)
    (check-true (string-contains? s "alert(1)") s) ; text content may remain
    (define s2 (xstr (task->xexpr (tk "A <b>x</b> & y" #f #f '()) (hash))))
    (check-false (regexp-match? #rx"<b[ >]" s2) s2)
    (check-true (string-contains? s2 "x") s2)
    (check-true (string-contains? s2 "&amp;") s2))

  (test-case "tag pills outside code; code keeps #tag text"
    (define s1 (string-join (map xstr (title->inline-xexprs "Ship #lang work")) ""))
    (check-true (string-contains? s1 "rounded-full") s1)
    (check-true (string-contains? s1 "#lang") s1)
    (define s2 (string-join (map xstr (title->inline-xexprs "see `code #notag` please")) ""))
    (check-true (string-contains? s2 "<code") s2)
    (check-true (string-contains? s2 "#notag") s2)
    ;; no pill class wrapping the code's #notag
    (check-false (regexp-match? #rx"rounded-full[^>]*>#notag" s2) s2))

  (test-case "date badge and description present"
    (define s (xstr (task->xexpr (tk "T" "2026-01-02" "a **note**" '()) (hash))))
    (check-true (string-contains? s "2026-01-02") s)
    (check-true (string-contains? s "note") s)
    (check-true (string-contains? s "<strong") s)
    (check-true (string-contains? s "☐") s)
    (check-false (string-contains? s "line-through") s))

  (test-case "done task renders checked checkbox and strikethrough"
    (define s (xstr (task->xexpr (tk "Done item" #f #f '() #:done #t) (hash))))
    (check-true (string-contains? s "☑") s)
    (check-true (string-contains? s "line-through") s)
    (check-true (string-contains? s "Done item") s)
    (define s2 (xstr (task->xexpr (tk "Stamped" "2026-01-01" #f '()
                                       #:done "2026-01-02")
                                  (hash))))
    (check-true (string-contains? s2 "☑") s2)
    (check-true (string-contains? s2 "line-through") s2))

  (test-case "tasks->html has doctype and tailwind, no expand-all JS"
    (define html (tasks->html (list (tk "A" #f #f '())) "Demo"))
    (check-true (string-prefix? html "<!DOCTYPE html>") html)
    (check-true (string-contains? html "cdn.tailwindcss.com") html)
    (check-true (string-contains? html "<title>Demo</title>") html)
    (check-false (string-contains? html "expand-all") html)
    ;; single file: no per-file h2 section chrome
    (check-false (string-contains? html "<h2") html))

  (test-case "files->html multi-file sections use basenames as h2"
    (define html
      (files->html
       (list (list (string->path "/tmp/Tasks.rkt") (list (tk "Milk" #f #f '())) (hash))
             (list (string->path "/tmp/Roadmap.rkt") (list (tk "Ship" #f #f '())) (hash)))
       "selfflowy"))
    (check-true (string-contains? html "<h2") html)
    (check-true (string-contains? html "Tasks.rkt") html)
    (check-true (string-contains? html "Roadmap.rkt") html)
    (check-true (string-contains? html "Milk") html)
    (check-true (string-contains? html "Ship") html))

  (test-case "cli html --out writes file"
    (define dir (make-temporary-file "sfhtml~a" 'directory))
    (define outline (build-path dir "t.rkt"))
    (define out (build-path dir "t.html"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        "#lang selfflowy\nParent **bold** & stuff\n  Child\n"
        outline #:exists 'truncate)
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
       (check-true (string-contains? html "Parent") html)
       (check-true (string-contains? html "<strong") html)
       (check-true (string-contains? html "&amp;") html)
       (check-true (string-contains? html "<details") html)
       (check-true (string-contains? html "Child") html))
     (λ () (delete-directory/files dir))))

  (test-case "cli tree is always JSON"
    (define dir (make-temporary-file "sftree~a" 'directory))
    (define outline (build-path dir "t.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang selfflowy\nRoot\n" outline #:exists 'truncate)
       (define-values (code out err)
         (let ()
           (define-values (sp stdout stdin stderr)
             (subprocess #f #f #f
                         (find-executable-path "racket")
                         "-l" "selfflowy/cli" "--"
                         "tree" (path->string outline)))
           (close-output-port stdin)
           (define o (port->string stdout))
           (define e (port->string stderr))
           (close-input-port stdout)
           (close-input-port stderr)
           (subprocess-wait sp)
           (values (subprocess-status sp) o e)))
       (check-equal? code 0 err)
       (define j (read-json (open-input-string out)))
       (check-equal? (hash-ref j 'version) 1)
       (check-true (list? (hash-ref j 'tasks))))
     (λ () (delete-directory/files dir)))))
