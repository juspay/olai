#lang racket/base

;; The counters example, booted.
;;
;; A worked example that nothing runs is a worked example that rots, so this
;; is the net under it: the page serves, both surfaces deliver a frame on the
;; one stream, a client that says it has been away is caught up, and the two
;; regions keep the properties the example exists to show — a link that aims
;; only at its own region, and rows keyed by counter rather than by position.
;;
;; It lives with the example and not in live/tests: the example consumes the
;; framework, so a framework test that reached the other way would invert the
;; dependency it is here to demonstrate. Relative requires for the same
;; reason — this directory is the unit.
;;
;; In-process on an ephemeral port: no subprocess, so it stays in the fast set
;; with the rest of the racket tests (`just counters::test`).

(require net/http-client
         racket/port
         racket/string
         (only-in live/hub heartbeat-event)
         (only-in "../app.rkt" start-counters-server)
         (only-in "../counters.rkt" counter)
         (only-in "../list.rkt" clist-view render-list)
         (only-in "../header.rkt" ticker-view render-header))

(module+ test
  (require rackunit))

(module+ test
  (define (with-server proc)
    (define-values (stop port) (start-counters-server #:port 0))
    (dynamic-wind void (λ () (proc port)) stop))

  ;; -> (values status-code body-string)
  (define (GET port path)
    (define-values (status _headers in)
      (http-sendrecv "127.0.0.1" path #:port port #:method #"GET"))
    (define body (port->string in))
    (close-input-port in)
    (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
            body))

  ;; /events never ends, so this keeps the port. #:last-event-id is what a
  ;; reconnecting EventSource sends; a test that passes one is a browser that
  ;; has been asleep.
  (define (open-events port #:path [path "/events"] #:last-event-id [last-id #f])
    (define-values (status _headers in)
      (http-sendrecv "127.0.0.1" path #:port port #:method #"GET"
                     #:headers (if last-id
                                   (list (string->bytes/utf-8
                                          (string-append "Last-Event-ID: " last-id)))
                                   '())))
    (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
            in))

  ;; The stream a PAGE would open — the URL out of its own markup, cursor and
  ;; all. Rebuilding that URL here would be a test of this file's arithmetic.
  (define (open-events/page port body)
    (define m (regexp-match #px"sse-connect=\"([^\"]+)\"" body))
    (check-not-false m "the page carries no stream")
    (open-events port #:path (cadr m)))

  ;; Next real event: -> (list name data id) | #f on timeout. Heartbeats are
  ;; the transport keeping itself honest, not news.
  (define (next-event in #:timeout [timeout 20])
    (define deadline (+ (current-inexact-milliseconds) (* 1000.0 timeout)))
    (let loop ([name #f] [data '()] [id #f])
      (define left (/ (- deadline (current-inexact-milliseconds)) 1000.0))
      (define line (and (positive? left)
                        (sync/timeout left (read-line-evt in 'linefeed))))
      (cond
        [(or (not line) (eof-object? line)) #f]
        [(string=? line "")
         (cond
           [(equal? name heartbeat-event) (loop #f '() #f)]
           [name (list name (string-join (reverse data) "\n") id)]
           [else (loop #f '() #f)])]
        [(string-prefix? line "event: ") (loop (substring line 7) data id)]
        [(string-prefix? line "data: ") (loop name (cons (substring line 6) data) id)]
        [(string-prefix? line "id: ") (loop name data (substring line 4))]
        [else (loop name data id)])))

  ;; An xexpr's attributes, when it has them: (name "value") pairs.
  (define (attr x key) (cond [(assq key (cadr x)) => cadr] [else #f])))

(module+ test
  ;; ---- the page --------------------------------------------------------------

  (test-case "the page serves both regions, and one stream for both"
    (with-server
     (λ (port)
       (define-values (code body) (GET port "/"))
       (check-equal? code 200 body)
       (check-true (string-contains? body "id=\"clist\"") body)
       (check-true (string-contains? body "id=\"ticker\"") body)
       (check-true (string-contains? body "alpha") body)
       ;; the input box the demo asks you to type in, outside both regions
       (check-true (string-contains? body "id=\"scratch\"") body)
       ;; one EventSource for the page: two surfaces, one connection
       (check-equal? (length (regexp-match* #px"sse-connect=" body)) 1 body))))

  (test-case "a counter's own page answers with the region its link targets"
    (with-server
     (λ (port)
       (define-values (code body) (GET port "/c/alpha"))
       (check-equal? code 200 body)
       ;; the region re-fetches its own address and selects itself out of the
       ;; reply, so this page has to contain it
       (check-true (string-contains? body "id=\"clist\"") body)
       (check-true (string-contains? body "per bump") body)
       ;; and the ticker is on it, unchanged, as on every other page
       (check-true (string-contains? body "id=\"ticker\"") body))))

  ;; ---- the stream ------------------------------------------------------------

  (test-case "both surfaces deliver a frame on the one stream"
    (with-server
     (λ (port)
       (define-values (_code body) (GET port "/"))
       (define-values (code in) (open-events/page port body))
       (check-equal? code 200)
       ;; a bump every half second and a tick every second: six real events is
       ;; a couple of seconds, and both names are in there
       (define names (for/list ([_ (in-range 6)]) (let ([ev (next-event in)]) (and ev (car ev)))))
       (check-true (and (member "counts-changed" names) #t) (format "~a" names))
       (check-true (and (member "clock-tick" names) #t) (format "~a" names))
       (close-input-port in))))

  (test-case "a client that says it has been away is caught up"
    (with-server
     (λ (port)
       ;; an id from nowhere is not "older than" anything, and is owed a
       ;; re-fetch for exactly that reason
       (define-values (code in) (open-events port #:last-event-id "yesterday"))
       (check-equal? code 200)
       (define ev (next-event in))
       (check-not-false ev "the stream owed a frame and sent none")
       (check-equal? (car ev) "counts-changed")
       ;; a checkpoint: the cursor is both the payload and the stream's id
       (check-equal? (cadr ev) (caddr ev))
       (close-input-port in))))

  ;; ---- what the two regions promise each other -------------------------------

  (test-case "every counter link aims at the list, and rows are keyed by counter"
    (define lv (clist-view "/" "boot.1"))
    (define region (render-list lv (list (counter "alpha" 7 3) (counter "beta" 2 5))))
    (check-equal? (attr region 'id) "clist")
    (check-equal? (attr region 'hx-swap) "morph:outerHTML")
    ;; (div ATTRS (ol ROW ...)), and a row is (li ATTRS LINK VALUE)
    (define rows (cdr (caddr region)))
    (check-equal? (for/list ([r (in-list rows)]) (attr r 'id))
                  '("row-alpha" "row-beta"))
    (for ([r (in-list rows)])
      (define link (caddr r))
      ;; never "#ticker": a link is built from the view it belongs to, which
      ;; is what makes the second surface unreachable from the first
      (check-equal? (attr link 'hx-target) "#clist")
      (check-equal? (attr link 'hx-swap) "morph:outerHTML")))

  ;; live/client makes every region the history element and htmx honours the
  ;; first one in the document. Two regions is one more than that assumes, so
  ;; the ticker gives the list the history and keeps the swap.
  (test-case "the ticker yields the history element to the list"
    ;; (header REGION INPUT HEALTH): the region is the first of the three
    (define ticker (cadr (render-header (ticker-view "/" "boot.1") "00:00:00")))
    (check-equal? (attr ticker 'id) "ticker")
    (check-equal? (attr ticker 'hx-trigger) "sse:clock-tick")
    (check-false (attr ticker 'hx-history-elt))
    (check-not-false (attr (render-list (clist-view "/" "boot.1") '()) 'hx-history-elt))))
