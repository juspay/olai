#lang racket/base

;; The markup a page wears, and the border between this collection's two
;; languages.
;;
;; Racket spells the heartbeat's name, the state classes and the swap; live.js
;; spells them again, because a browser cannot require a module. Every one of
;; those is a string that has to be the same string in both files, and nothing
;; but this suite would notice the day it stopped being.

(require rackunit
         racket/file
         racket/string
         live/client
         (only-in live/hub heartbeat-event))

;; live/tests/frame.rkt owns the wire format; this file owns the markup. The
;; one thing both ends of the cursor have to agree on is asserted in each.

(define lv (make-live-view #:region "app" #:event "changed" #:stream "/events"))

;; -> the value of `key`, or #f. Attributes are xexpr pairs: (name "value").
(define (attr attrs key)
  (cond [(assq key attrs) => cadr] [else #f]))

(define (script-source name)
  (file->string (build-path (live-static-dir) name)))

(module+ test
  ;; ---- the three attribute sets --------------------------------------------

  (test-case "the connection names the extensions and the stream"
    (define a (live-connect-attributes lv))
    (check-equal? (attr a 'sse-connect) "/events")
    ;; both extensions, on one element: the swap is useless without morph and
    ;; the trigger is useless without sse
    (check-true (string-contains? (attr a 'hx-ext) "sse"))
    (check-true (string-contains? (attr a 'hx-ext) "morph")))

  ;; A page is rendered at one moment and its stream connects at a later one.
  ;; The cursor is how the page says which moment it was, so the first
  ;; connection can be told about an edit that landed in between.
  (test-case "a cursor rides in the stream's URL"
    (define with-cursor
      (make-live-view #:region "app" #:event "changed" #:stream "/events"
                      #:cursor "41"))
    (check-equal? (attr (live-connect-attributes with-cursor) 'sse-connect)
                  "/events?last-event-id=41")
    ;; a stream URL that already has a query keeps it
    (define queried
      (make-live-view #:region "app" #:event "changed" #:stream "/events?tab=2"
                      #:cursor "41"))
    (check-equal? (attr (live-connect-attributes queried) 'sse-connect)
                  "/events?tab=2&last-event-id=41")
    ;; an id is an opaque string, so it may contain anything a URL cannot
    (define odd
      (make-live-view #:region "app" #:event "changed" #:stream "/events"
                      #:cursor "a b&c"))
    (check-equal? (attr (live-connect-attributes odd) 'sse-connect)
                  "/events?last-event-id=a%20b%26c"))

  (test-case "the region re-fetches its own page and lifts itself out of it"
    (define a (live-region-attributes lv "/today"))
    (check-equal? (attr a 'id) "app")
    (check-equal? (attr a 'hx-get) "/today")
    ;; the event is the host's word, prefixed with the one htmx knows
    (check-equal? (attr a 'hx-trigger) "sse:changed")
    (check-equal? (attr a 'hx-select) "#app")
    (check-equal? (attr a 'hx-target) "#app")
    ;; morph, not replace: that is the whole point of the region
    (check-equal? (attr a 'hx-swap) "morph:outerHTML")
    ;; and back restores THIS, not the page around it
    (check-true (and (assq 'hx-history-elt a) #t)))

  (test-case "a link keeps its href and aims at the region"
    (define a (live-link-attributes lv "/n/ship"))
    ;; first, and always: no-JS, middle-click and copy-link all read this
    (check-equal? (car a) '(href "/n/ship"))
    (check-equal? (attr a 'hx-get) "/n/ship")
    (check-equal? (attr a 'hx-target) "#app")
    (check-equal? (attr a 'hx-select) "#app")
    (check-equal? (attr a 'hx-swap) "morph:outerHTML")
    (check-equal? (attr a 'hx-push-url) "true"))

  (test-case "with no live view a link is just a link"
    (check-equal? (live-link-attributes #f "/n/ship") '((href "/n/ship"))))

  ;; ---- the assets ----------------------------------------------------------

  (test-case "the scripts load htmx before the extensions that register into it"
    (define scripts live-scripts)
    (check-equal? (car scripts) "htmx.min.js")
    (for ([name (in-list scripts)])
      (check-true (file-exists? (build-path (live-static-dir) name))
                  (format "~a is listed and missing" name))))

  (test-case "script hrefs are the names under the prefix the host chose"
    (check-equal? (live-script-hrefs "/live/")
                  (for/list ([n (in-list live-scripts)]) (string-append "/live/" n))))

  ;; ---- the border with the runtime -----------------------------------------

  (test-case "live.js spells the heartbeat event this collection sends"
    (check-true (string-contains? (script-source "live.js")
                                  (string-append "'" heartbeat-event "'"))))

  (test-case "live.js writes the state classes this collection publishes"
    (define src (script-source "live.js"))
    (for ([c (in-list (list live-connecting-class live-stale-class))])
      (check-true (string-contains? src (string-append "'" c "'"))
                  (format "live.js never spells ~a" c))))

  ;; The morph extension is vendored, and the swap above is only a swap if it
  ;; registered under that name.
  (test-case "the vendored idiomorph registers the extension the swap names"
    (check-true (string-contains? (script-source "idiomorph.min.js")
                                  "defineExtension(\"morph\""))))
