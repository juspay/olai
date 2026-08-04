#lang racket/base

;; The read-mostly web view. WP1 skeleton: routing + the existing renderers.
;;
;;   GET /              the html renderer's page (WP2 replaces the markup)
;;   GET /api/tree      byte-identical to `selfflowy tree`
;;   GET /api/agenda    byte-identical to `selfflowy agenda --json`
;;   GET /static/*      files from web/static/
;;   anything else      404, terse text/plain
;;
;; No auth: the network is the auth (Tailscale / Caddy in front of it).
;; Routing, static files, and MIME types come from racket web-server; the
;; only thing this module owns is which outline files get read.

(require racket/async-channel
         racket/list
         racket/match
         racket/path
         (for-syntax racket/base)
         json
         net/url
         racket/runtime-path
         web-server/web-server
         web-server/http
         web-server/dispatch
         web-server/dispatchers/dispatch
         web-server/dispatchers/filesystem-map
         (prefix-in files: web-server/dispatchers/dispatch-files)
         (prefix-in filter: web-server/dispatchers/dispatch-filter)
         (prefix-in lift: web-server/dispatchers/dispatch-lift)
         (prefix-in sequencer: web-server/dispatchers/dispatch-sequencer)
         (only-in web-server/private/mime-types make-path->mime-type)
         selfflowy/agenda
         selfflowy/dates
         selfflowy/html
         selfflowy/json-out
         selfflowy/load)

(provide start-server)

(define-runtime-path static-dir "static")
(define-runtime-path mime-types-path
  (list 'lib "default-web-root/mime.types" "web-server"))

;; ---- responses ------------------------------------------------------------

(define (html-response str #:code [code 200])
  (response/output
   (λ (out) (write-string str out))
   #:code code
   #:mime-type #"text/html; charset=utf-8"))

;; write-json + newline: the same bytes the CLI writes to stdout.
(define (json-response js #:code [code 200])
  (response/output
   (λ (out)
     (write-json js out)
     (newline out))
   #:code code
   #:mime-type #"application/json; charset=utf-8"))

(define (text-response str #:code [code 200])
  (response/output
   (λ (out) (write-string str out))
   #:code code
   #:mime-type #"text/plain; charset=utf-8"))

(define (not-found-response)
  (text-response "404 not found\n" #:code 404))

;; ---- outlines -------------------------------------------------------------

;; Outlines are loaded through the module registry, so a file is read once per
;; process: restart to pick up edits. Reloading needs a fresh namespace, which
;; a `raco exe` binary cannot populate from collection paths — the live view
;; lands with SSE, in the WP that owns pushing changes to the browser.
;;
;; -> (values entries #f) | (values #f (list msg file line col))
;; entries : (listof (list path tasks anchors includes))
(define (load-entries files)
  (let loop ([fs files] [acc '()])
    (cond
      [(null? fs) (values (reverse acc) #f)]
      [else
       (match (try-load-outline (car fs))
         [(list 'ok tasks anchors includes)
          (loop (cdr fs) (cons (list (car fs) tasks anchors includes) acc))]
         [(list 'error msg src line col)
          (values #f (list msg src line col))])])))

(define (load-error->json err)
  (match-define (list msg src line col) err)
  (err-hash msg #:file src #:line line #:col col))

(define (load-error->text err)
  (format "selfflowy: ~a\n" (car err)))

;; ---- handlers -------------------------------------------------------------

;; Placeholder page: whatever the html renderer already produces. WP2 owns
;; the real UI; this only proves the wiring.
(define (page-handler files)
  (define-values (entries err) (load-entries files))
  (cond
    [err (text-response (load-error->text err) #:code 500)]
    [else
     (define title
       (if (= (length files) 1)
           (path->string (file-name-from-path (car files)))
           "selfflowy"))
     (html-response
      (files->html (for/list ([e (in-list entries)])
                     (list (first e) (second e) (third e)))
                   title))]))

(define (tree-handler files)
  (define-values (entries err) (load-entries files))
  (if err
      (json-response (load-error->json err) #:code 500)
      (json-response (outlines->jsexpr entries))))

(define (agenda-handler files)
  (define-values (entries err) (load-entries files))
  (cond
    [err (json-response (load-error->json err) #:code 500)]
    [else
     (define today (today-iso-string))
     (define groups
       (agenda-groups-from-files
        (for/list ([e (in-list entries)]) (cons (first e) (second e)))
        today))
     (json-response (agenda-groups->jsexpr groups today))]))

;; ---- dispatch -------------------------------------------------------------

(define (make-router files)
  (define-values (route _url)
    (dispatch-rules
     [("") (λ (req) (page-handler files))]
     [("api" "tree") (λ (req) (tree-handler files))]
     [("api" "agenda") (λ (req) (agenda-handler files))]
     [else (λ (req) (not-found-response))]))
  route)

;; /static/foo.css -> static-dir/foo.css. make-url->path refuses anything that
;; climbs out of the base ("/static/../..") — we turn that into a plain 404
;; instead of an error page.
(define static-url->path
  (let ([u->p (make-url->path static-dir)])
    (λ (u)
      (define rest (if (pair? (url-path u)) (cdr (url-path u)) '()))
      (with-handlers ([exn:fail? (λ (_e) (next-dispatcher))])
        (u->p (struct-copy url u [path rest]))))))

(define (make-dispatcher files)
  (sequencer:make
   (filter:make #rx"^/static/"
                (files:make #:url->path static-url->path
                            #:path->mime-type (make-path->mime-type mime-types-path)
                            #:indices '()))
   (lift:make (make-router files))))

;; ---- server ---------------------------------------------------------------

;; Returns a stop procedure. #:on-listen gets the port actually bound (useful
;; when #:port is 0, i.e. "pick one").
(define (start-server #:port [port 8080]
                      #:bind [bind "127.0.0.1"]
                      #:files files
                      #:on-listen [on-listen void])
  (define paths
    (for/list ([f (in-list files)])
      (simple-form-path (if (path? f) f (string->path f)))))
  (define confirm (make-async-channel 1))
  (define stop
    (serve #:dispatch (make-dispatcher paths)
           #:port port
           #:listen-ip bind
           #:confirmation-channel confirm))
  (define bound (async-channel-get confirm))
  (when (exn? bound)
    (stop)
    (raise bound))
  (on-listen bound)
  stop)
