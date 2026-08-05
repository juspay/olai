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

;; Run body with the server up: (proc port outline-path). The path is handed
;; back so a test can edit the outline underneath a running server.
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
   (λ () (proc bound f))
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
     (λ (port f)
       (define-values (code headers body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/html")
                   (format "~a" headers))
       (check-true (string-contains? body "Buy milk") body))))

  (test-case "the sidebar Today link is a real route"
    (with-server
     (λ (port f)
       ;; no day node in the outline yet: terse empty state, not a 404
       (define-values (code _h body) (GET port "/today"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "No day node for") body)
       ;; and the link the page ships points here
       (define-values (_c _hh home) (GET port "/"))
       (check-true (string-contains? home "href=\"/today\"") home)
       ;; add today's day node and it zooms to it
       (define today
         (let ()
           (define j (read-json (open-input-string
                                 (let-values ([(_c2 _h2 b) (GET port "/api/agenda")]) b))))
           (hash-ref j 'today)))
       (display-to-file (string-append outline today "\n  Water the plants\n")
                        f #:exists 'truncate)
       (define-values (code2 _h3 body2) (GET port "/today"))
       (check-equal? code2 200 body2)
       (check-true (string-contains? body2 "Water the plants") body2)
       ;; zoomed: the main pane holds that subtree and nothing else
       (define pane (cadr (string-split body2 "<main class=\"sf-main\">")))
       (check-true (string-contains? pane "sf-zoom") pane)
       (check-false (string-contains? pane "Buy milk") pane))))

  (test-case "GET /api/tree matches the tree JSON contract"
    (with-server
     (λ (port f)
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
     (λ (port f)
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
     (λ (port f)
       (define-values (code headers body) (GET port "/static/app.css"))
       (check-equal? code 200 body)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/css")
                   (format "~a" headers))
       (check-true (string-contains? body "selfflowy") body))))

  (test-case "GET /static/collapse.js serves the collapse script"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/static/collapse.js"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "selfflowy.collapsed") body))))

  (test-case "unknown path is a terse 404"
    (with-server
     (λ (port f)
       (define-values (code headers body) (GET port "/nope"))
       (check-equal? code 404)
       (check-true (string-contains? (or (header-value headers "content-type:") "")
                                     "text/plain")
                   (format "~a" headers))
       (check-true (string-contains? body "404") body))))

  (test-case "static path traversal is rejected"
    (with-server
     (λ (port f)
       (for ([p (in-list '("/static/../.."
                           "/static/../serve.rkt"
                           "/static/../../cli.rkt"))])
         (define-values (code headers body) (GET port p))
         (check-equal? code 404 (format "~a -> ~a" p body))
         (check-false (string-contains? body "#lang") body)))))

  ;; ---- the store, over HTTP ------------------------------------------------

  (test-case "a saved edit shows up on the next request"
    (with-server
     (λ (port f)
       (define-values (c1 _h1 b1) (GET port "/"))
       (check-false (string-contains? b1 "Water the plants") b1)
       (display-to-file (string-append outline "Water the plants\n")
                        f #:exists 'truncate)
       (define-values (c2 _h2 b2) (GET port "/"))
       (check-equal? c2 200 b2)
       (check-true (string-contains? b2 "Water the plants") b2)
       (check-true (string-contains? b2 "Buy milk") b2)
       ;; the JSON surface sees the same snapshot
       (define j (read-json (open-input-string
                             (let-values ([(_c _h b) (GET port "/api/tree")]) b))))
       (check-true (for/or ([t (in-list (hash-ref j 'tasks))])
                     (equal? (hash-ref t 'title) "Water the plants"))
                   (format "~a" j)))))

  (test-case "a broken file keeps the page and its banner carries file:line:col"
    (with-server
     (λ (port f)
       (display-to-file (string-append outline "Broken\n  @date not-a-date\n")
                        f #:exists 'truncate)
       ;; the page still serves last-good content, with the error in the banner
       (define-values (code _h body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "Buy milk") body)
       (check-true (string-contains? body "sf-error") body)
       (check-true (string-contains? body "Tasks.rkt:") body)
       ;; agents get the failure, not stale data
       (define-values (jcode _jh jbody) (GET port "/api/tree"))
       (check-equal? jcode 500 jbody)
       (define j (read-json (open-input-string jbody)))
       (check-false (hash-ref j 'ok))
       (define e (hash-ref j 'error))
       (check-true (string-contains? (hash-ref e 'file) "Tasks.rkt") jbody)
       (check-true (number? (hash-ref e 'line)) jbody)
       ;; fixing the file un-breaks both
       (display-to-file outline f #:exists 'truncate)
       (define-values (c3 _h3 b3) (GET port "/"))
       (check-equal? c3 200 b3)
       (check-false (string-contains? b3 "sf-error") b3)
       (define-values (c4 _h4 _b4) (GET port "/api/tree"))
       (check-equal? c4 200)))))
