#lang racket/base

;; The read-mostly web view.
;;
;;   GET /              the html page: sidebar + outline
;;   GET /api/tree      byte-identical to `selfflowy tree`
;;   GET /api/agenda    byte-identical to `selfflowy agenda --json`
;;   GET /static/*      files from web/static/
;;   anything else      404, terse text/plain
;;
;; No auth: the network is the auth (Tailscale / Caddy in front of it).
;; Routing, static files, and MIME types come from racket web-server. Outline
;; content comes from selfflowy/store — this module owns routes and responses,
;; never a load.

(require racket/async-channel
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
         selfflowy/json-out
         selfflowy/load
         selfflowy/store
         selfflowy/web/render)

(provide start-server)

;; static files: render owns the directory and the URL prefix (it also
;; writes the <head> that links them); this module only mounts them.
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

;; ---- the store ------------------------------------------------------------

;; Every route starts here: refresh the store (a cheap mtime probe unless a
;; file actually changed), then hand the handler ONE consistent snapshot.
;;
;; A live load error means the file is mid-edit. JSON routes fail loudly —
;; agents must never be handed stale data quietly — while the page keeps the
;; last good content and shows the error in its banner (#:stale-ok? #t). With
;; no last-good snapshot at all, everything fails.
(define (with-snapshot st fail proc #:stale-ok? [stale-ok? #f])
  (store-invalidate! st)
  (define snap (store-snapshot st))
  (define err (store-error st))
  (if (and err (or (not stale-ok?) (null? (snapshot-outlines snap))))
      (fail err)
      (proc snap err)))

(define (load-error->json err)
  (err-hash (load-error-message err)
            #:file (load-error-file err)
            #:line (load-error-line err)
            #:col (load-error-col err)))

(define (json-failure err)
  (json-response (load-error->json err) #:code 500))

(define (error-banner err)
  (render-error-banner (load-error-detail err) #:where (load-error-where err)))

(define (page-failure err)
  (html-response
   (page->html-string
    (render-page `(div ((class "sf-pane")) (p ((class "sf-empty")) "No outline loaded."))
                 #:title "selfflowy"
                 #:banner (error-banner err)))
   #:code 500))

;; ---- handlers -------------------------------------------------------------

(define (page-title files)
  (if (= (length files) 1)
      (file-label (car files))
      "selfflowy"))

(define (page-handler st)
  (with-snapshot st page-failure #:stale-ok? #t
    (λ (snap err)
      (define files-data (snapshot-files-data snap))
      (html-response
       (page->html-string
        (render-page (render-outline files-data #:today (today-iso-string))
                     #:title (page-title (store-files st))
                     #:sidebar (render-sidebar files-data)
                     #:banner (and err (error-banner err))))))))

(define (tree-handler st)
  (with-snapshot st json-failure
    (λ (snap _err) (json-response (outlines->jsexpr (snapshot-outlines snap))))))

(define (agenda-handler st)
  (with-snapshot st json-failure
    (λ (snap _err)
      (define today (today-iso-string))
      (define groups
        (agenda-groups-from-files
         (for/list ([o (in-list (snapshot-outlines snap))])
           (cons (outline-path o) (outline-tasks o)))
         today))
      (json-response (agenda-groups->jsexpr groups today)))))

;; ---- dispatch -------------------------------------------------------------

(define (make-router st)
  (define-values (route _url)
    (dispatch-rules
     [("") (λ (req) (page-handler st))]
     [("api" "tree") (λ (req) (tree-handler st))]
     [("api" "agenda") (λ (req) (agenda-handler st))]
     [else (λ (req) (not-found-response))]))
  route)

;; /static/foo.css -> the render collection's static/foo.css. make-url->path
;; refuses anything that climbs out of the base ("/static/../..") — we turn
;; that into a plain 404 instead of an error page.
(define static-url->path
  (let ([u->p (make-url->path (web-static-dir))])
    (λ (u)
      (define rest (if (pair? (url-path u)) (cdr (url-path u)) '()))
      (with-handlers ([exn:fail? (λ (_e) (next-dispatcher))])
        (u->p (struct-copy url u [path rest]))))))

(define (make-dispatcher st)
  (sequencer:make
   (filter:make (regexp (string-append "^" (regexp-quote web-static-prefix)))
                (files:make #:url->path static-url->path
                            #:path->mime-type (make-path->mime-type mime-types-path)
                            #:indices '()))
   (lift:make (make-router st))))

;; ---- server ---------------------------------------------------------------

;; Returns a stop procedure. #:on-listen gets the port actually bound (useful
;; when #:port is 0, i.e. "pick one").
(define (start-server #:port [port 8080]
                      #:bind [bind "127.0.0.1"]
                      #:files files
                      #:on-listen [on-listen void])
  (define st (make-store files))
  (define confirm (make-async-channel 1))
  (define stop
    (serve #:dispatch (make-dispatcher st)
           #:port port
           #:listen-ip bind
           #:confirmation-channel confirm))
  (define bound (async-channel-get confirm))
  (when (exn? bound)
    (stop)
    (raise bound))
  (on-listen bound)
  stop)
