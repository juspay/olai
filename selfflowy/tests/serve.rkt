#lang racket/base

;; Web server routes. Boots the real server on an ephemeral port against a
;; temp outline; no personal data, no fixed ports.

(require rackunit
         json
         net/http-client
         racket/file
         racket/port
         racket/string
         selfflowy/web/serve)

(define outline
  (string-append
   "#lang selfflowy\n"
   "Inbox\n"
   "  Buy milk\n"
   "    @date 2026-01-15\n"
   "Ship the server ^serve\n"))

;; Run body with the server up: (proc port).
(define (with-server proc)
  (define dir (make-temporary-file "sfserve~a" 'directory))
  (define f (build-path dir "Tasks.rkt"))
  (display-to-file outline f #:exists 'truncate)
  (define bound #f)
  (define stop
    (start-server #:port 0
                  #:bind "127.0.0.1"
                  #:files (list f)
                  #:on-listen (λ (p) (set! bound p))))
  (dynamic-wind
   void
   (λ () (proc bound))
   (λ ()
     (stop)
     (delete-directory/files dir))))

;; -> (values status-code headers body-string)
(define (GET port path)
  (define-values (status headers in)
    (http-sendrecv "127.0.0.1" path #:port port #:method #"GET"))
  (define body (port->string in))
  (close-input-port in)
  (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
          (map bytes->string/utf-8 headers)
          body))

(define (header-value headers name)
  (for/or ([h (in-list headers)])
    (and (string-prefix? (string-downcase h) (string-downcase name))
         h)))

(module+ test
  (test-case "GET / is an html page with the outline in it"
    (with-server
     (λ (port)
       (define-values (code headers body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/html")
                   (format "~a" headers))
       (check-true (string-contains? body "Buy milk") body))))

  (test-case "GET /api/tree matches the tree JSON contract"
    (with-server
     (λ (port)
       (define-values (code headers body) (GET port "/api/tree"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "application/json")
                   (format "~a" headers))
       (define j (read-json (open-input-string body)))
       (check-equal? (hash-ref j 'version) 1)
       (check-true (hash-has-key? j 'file))
       (define titles (map (λ (t) (hash-ref t 'title)) (hash-ref j 'tasks)))
       (check-equal? titles '("Inbox" "Ship the server"))
       (define inbox (car (hash-ref j 'tasks)))
       (check-equal? (map (λ (t) (hash-ref t 'title)) (hash-ref inbox 'children))
                     '("Buy milk")))))

  (test-case "GET /api/agenda matches the agenda JSON contract"
    (with-server
     (λ (port)
       (define-values (code headers body) (GET port "/api/agenda"))
       (check-equal? code 200 body)
       (define j (read-json (open-input-string body)))
       (check-equal? (hash-ref j 'version) 1)
       (check-true (string? (hash-ref j 'today)))
       (check-true (list? (hash-ref j 'overdue)))
       (check-true (list? (hash-ref j 'today_items)))
       (check-true (list? (hash-ref j 'upcoming)))
       (check-true
        (for/or ([grp (in-list (list (hash-ref j 'overdue)
                                     (hash-ref j 'today_items)
                                     (hash-ref j 'upcoming)))])
          (for/or ([it (in-list grp)])
            (equal? (hash-ref it 'title) "Buy milk")))
        body))))

  (test-case "GET /static/app.css serves the stylesheet"
    (with-server
     (λ (port)
       (define-values (code headers body) (GET port "/static/app.css"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/css")
                   (format "~a" headers))
       (check-true (string-contains? body "selfflowy") body))))

  (test-case "unknown path is a terse 404"
    (with-server
     (λ (port)
       (define-values (code headers body) (GET port "/nope"))
       (check-equal? code 404)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/plain")
                   (format "~a" headers))
       (check-true (string-contains? body "404") body))))

  (test-case "static path traversal is rejected"
    (with-server
     (λ (port)
       (for ([p (in-list '("/static/../.."
                           "/static/../serve.rkt"
                           "/static/../../cli.rkt"))])
         (define-values (code headers body) (GET port p))
         (check-equal? code 404 (format "~a -> ~a" p body))
         (check-false (string-contains? body "#lang") body))))))
