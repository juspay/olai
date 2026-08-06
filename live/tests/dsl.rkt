#lang racket/base

;; The forms, and the two things they are for.
;;
;; THE EXPANSION. Every form is sugar over live/client, so every case in the
;; first half asserts the sugar against the function it stands in for. Nothing
;; here checks what an attribute MEANS — live/tests/client.rkt owns that, and a
;; second opinion about it would be a second thing to keep in step.
;;
;; THE REFUSAL. The other half is the error contract, which is the whole point
;; of having macros at all: the source location of the offending form, the rule
;; it broke, what was in scope instead, and a did-you-mean. Agents read these,
;; so they are asserted line by line — a message that quietly lost its
;; candidate list would still be a passing "it raised something" test.

(require racket/file
         racket/string
         syntax/modread
         live/client
         live/dsl
         live/expand
         live/frame)

(module+ test
  (require rackunit))

;; ---- the vocabulary under test ------------------------------------------------

(define-stream counts #:events (counts-changed) #:heartbeat 20)
(define-stream quiet #:events (a b))
(define-live-region app #:stream counts)
(define-live-region second #:stream counts #:history? #f)
(define-live-region picky #:stream quiet #:event b)

(module+ test
  ;; What the example used to build by hand, and what every form below has to
  ;; agree with.
  (define view
    (make-live-view #:region "app" #:event "counts-changed"
                    #:stream live-stream-path #:href "/today"))

  ;; ---- the expansion ---------------------------------------------------------

  (test-case "a declared region draws what a hand-built view draws"
    (check-equal? (live-region app #:href "/today") (live-region-attributes view))
    ;; the id is the declared NAME: written once, and every selector below is
    ;; derived from it
    (check-equal? (cadr (assq 'id (live-region app #:href "/today"))) "app"))

  (test-case "a declared region can yield the history element"
    (check-false (assq 'hx-history-elt (live-region second #:href "/")))
    (check-not-false (assq 'hx-history-elt (live-region app #:href "/"))))

  (test-case "a declared link aims at its region and keeps its href"
    (check-equal? (live-link app "/n/ship") (live-link-attributes view "/n/ship"))
    ;; the second region is a different target, and no link into the first can
    ;; name it by accident
    (check-equal? (cadr (assq 'hx-target (live-link second "/n/ship"))) "#second"))

  (test-case "a declared connection is the stream's address and the page's cursor"
    (check-equal? (live-connect counts #:cursor "41")
                  (live-stream-attributes live-stream-path "41"))
    ;; every stream on the page is named, and they all ride the one connection
    (check-equal? (live-connect counts quiet #:cursor "41")
                  (live-connect counts #:cursor "41"))
    ;; a page with no cursor gets the old behaviour and the old gap
    (check-equal? (live-connect counts) (live-stream-attributes live-stream-path #f)))

  (test-case "an item is its region's id, a key, and the element around them"
    (check-equal? (live-item app li "ship" "x" "y")
                  (list 'li (list (list 'id (live-item-id "app" "ship"))) "x" "y"))
    ;; two regions cannot mint the same id for two different things
    (check-not-equal? (live-item app li "ship") (live-item second li "ship")))

  (test-case "a frame in a stream's vocabulary is a frame"
    (check-equal? (stream-frame counts 'counts-changed "7" #:id "7")
                  (make-frame "counts-changed" "7" #:id "7"))
    ;; no id: what a client is behind is not everything that happened
    (check-equal? (stream-frame counts 'counts-changed "7")
                  (make-frame "counts-changed" "7")))

  (test-case "a stream's cadence is its own, or the transport's"
    (check-equal? (stream-heartbeat counts) 20)
    (check-equal? (stream-heartbeat quiet) live-default-heartbeat-seconds))

  ;; A stream with several events makes the region say which one it redraws on,
  ;; and that name is checked like every other.
  (test-case "a region picks one event out of a stream that carries several"
    (check-equal? (cadr (assq 'hx-trigger (live-region picky #:href "/"))) "sse:b")))

;; ---- the refusal ---------------------------------------------------------------

(module+ test
  ;; Expand a module written here, under a source name of its own. The name is
  ;; per-case on purpose: what a module DECLARES is recorded against its
  ;; source, and two cases sharing a name would see each other's regions in the
  ;; candidate list.
  (define (expand-lines name lines)
    (define path (build-path (find-system-path 'temp-dir) name))
    (define in (open-input-string (string-join lines "\n")))
    (port-count-lines! in)
    (parameterize ([current-namespace (make-base-namespace)]
                   [read-accept-reader #t]
                   [read-accept-lang #t])
      (with-module-reading-parameterization
       (λ () (expand (read-syntax path in))))))

  ;; -> the exn, or #f if it expanded. The message and the srclocs are both
  ;; part of the contract, so both come back.
  (define (refusal name lines)
    (with-handlers ([exn:fail:syntax? values])
      (expand-lines name lines)
      #f))

  ;; Where a token is in the source, worked out from the source rather than
  ;; counted by hand: this is a test OF srclocs, so the expected one has to
  ;; come from somewhere other than the thing under test.
  (define (locate lines token)
    (or (for/or ([l (in-list lines)] [n (in-naturals 1)])
          (define m (regexp-match-positions (regexp (regexp-quote token)) l))
          (and m (list n (caar m))))
        (error 'locate "~a is not in the source" token)))

  ;; file:line:col of the OFFENDING form, first, as everything in this repo
  ;; reports it — and the same location on the exception, where a tool reads it.
  (define (check-points-at e name lines token)
    (define where (locate lines token))
    (define path (path->string (build-path (find-system-path 'temp-dir) name)))
    (check-true (string-prefix? (exn-message e)
                                (format "~a:~a:~a: " path (car where) (cadr where)))
                (exn-message e))
    (define stx (car (exn:fail:syntax-exprs e)))
    (check-equal? (list (syntax-line stx) (syntax-column stx)) where))

  (define (check-says e . parts)
    (for ([p (in-list parts)])
      (check-true (string-contains? (exn-message e) p) (exn-message e))))

  ;; ---- a region nobody declared ---------------------------------------------

  ;; The worked example from the design doc, asserted line by line.
  (test-case "an unbound region names the rule, the candidates and a guess"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed))"
        "(define-live-region clist #:stream counts)"
        "(define (draw) (live-link clsit \"/x\"))"))
    (define e (refusal "unbound-region.rkt" lines))
    (check-not-false e "a link into a region nobody declared expanded")
    (check-points-at e "unbound-region.rkt" lines "clsit")
    (check-says e
                "clsit: unbound live region"
                "live-link's first argument must be a region bound by define-live-region"
                (format "regions in scope in this module: clist (declared at unbound-region.rkt:~a:~a)"
                        (car (locate lines "clist")) (cadr (locate lines "clist")))
                "did you mean: clist?"))

  ;; A module that declares none of its own is the common case for a STREAM,
  ;; which a drawer requires from the producer. Saying "nothing is in scope"
  ;; would be true and useless; where to look is the useful half.
  (test-case "with no declarations in the module the message says where to look"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define (draw) (live-region nope #:href \"/\"))"))
    (define e (refusal "no-regions.rkt" lines))
    (check-not-false e "a region nobody declared expanded")
    (check-points-at e "no-regions.rkt" lines "nope")
    (check-says e
                "nope: unbound live region"
                "this module declares no regions: declare one with define-live-region, or require it from the module that does"))

  (test-case "a name bound to something else is told apart from an unbound one"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define clist 1)"
        "(define (draw) (live-link clist \"/x\"))"))
    (define e (refusal "not-a-region.rkt" lines))
    (check-not-false e "a link into a number expanded")
    (check-says e
                "clist: not a live region"
                "clist is bound here, but to something else"))

  ;; ---- an event nobody declared ----------------------------------------------

  (test-case "an event outside the stream's vocabulary names the vocabulary"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed))"
        "(define (bump) (stream-frame counts 'count-changed \"7\"))"))
    (define e (refusal "unknown-event.rkt" lines))
    (check-not-false e "a frame in a name the stream never declared expanded")
    (check-points-at e "unknown-event.rkt" lines "count-changed")
    (check-says e
                "count-changed: not an event of counts"
                "stream-frame's event must be one of the names counts declares with #:events"
                "events of counts: counts-changed"
                "did you mean: counts-changed?"))

  (test-case "a region redrawing on an event its stream never declared is refused"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed))"
        "(define-live-region clist #:stream counts #:event counts-cahnged)"))
    (define e (refusal "region-event.rkt" lines))
    (check-not-false e "a region on an undeclared event expanded")
    (check-points-at e "region-event.rkt" lines "counts-cahnged")
    (check-says e "define-live-region's event must be one of the names counts declares"))

  ;; Two events and no #:event is a coin toss, and a macro that guesses is a
  ;; macro that is wrong half the time in a browser.
  (test-case "a region on a stream with several events must say which"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed counts-reset))"
        "(define-live-region clist #:stream counts)"))
    (define e (refusal "ambiguous.rkt" lines))
    (check-not-false e "a region with no event to redraw on expanded")
    (check-says e
                "ambiguous event"
                "define-live-region needs #:event when its stream declares more than one"
                "clist redraws on ONE of counts's events: counts-changed, counts-reset"))

  ;; ---- the rest of the grammar -----------------------------------------------

  (test-case "an event that has to be run to know is no event at all"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed))"
        "(define (bump n) (stream-frame counts (pick n) \"7\"))"))
    (define e (refusal "computed-event.rkt" lines))
    (check-not-false e "a computed event name expanded")
    (check-says e
                "not a literal event"
                "stream-frame's event must be a quoted name, like 'counts-changed"))

  (test-case "a stream that declares an event twice is refused"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed counts-changed))"))
    (define e (refusal "duplicate-event.rkt" lines))
    (check-not-false e "a stream with the same event twice expanded")
    (check-says e "duplicate event name"))

  (test-case "a cadence that is not a cadence is refused"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed) #:heartbeat 0)"))
    (define e (refusal "zero-beat.rkt" lines))
    (check-not-false e "a stream that beats never expanded")
    (check-says e "not a cadence"))

  ;; A declaration is compile-time and has no runtime value at all. The error
  ;; for using one as an expression says which forms it IS for, because
  ;; "illegal use of syntax" tells an agent nothing it can act on.
  (test-case "a declared name used as a value says what it is for"
    (define lines
      '("#lang racket/base"
        "(require live/dsl)"
        "(define-stream counts #:events (counts-changed))"
        "(define (get) counts)"))
    (define e (refusal "stream-as-value.rkt" lines))
    (check-not-false e "a stream used as a value expanded")
    (check-points-at e "stream-as-value.rkt" lines "counts)")
    (check-says e
                "counts: a live stream is not a value"
                "stream-frame, stream-heartbeat, define-live-region, live-connect")))

;; ---- the dump ------------------------------------------------------------------

(module+ test
  ;; `just expand FILE` is part of the interface, so what it reads is part of
  ;; the contract: every form labels its own output with the form that produced
  ;; it, and losing that label would lose the only way to see through a macro.
  (test-case "every form's expansion is dumpable, source form and all"
    (define path (make-temporary-file "live-dump-~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file
        (string-join
         '("#lang racket/base"
           "(require live/dsl)"
           "(define-stream counts #:events (counts-changed))"
           "(define-live-region clist #:stream counts)"
           "(define (draw href) (live-region clist #:href href))"
           "(define (row k) (live-item clist li k (live-link clist \"/x\")))")
         "\n")
        path
        #:exists 'truncate)
       (define dumped (live-form-expansions path))
       ;; in source order, and every form in the file is in it
       (check-equal? (map (λ (p) (car (syntax->datum (car p)))) dumped)
                     '(define-stream define-live-region live-region live-item live-link))
       ;; and what each became is the call it stands in for
       (define (expansion-of form)
         (for/or ([p (in-list dumped)])
           (and (eq? (car (syntax->datum (car p))) form) (cdr p))))
       (check-equal? (car (expansion-of 'live-link)) 'live-link-attributes)
       (check-equal? (cadr (expansion-of 'live-link)) "clist")
       (check-equal? (car (expansion-of 'live-region)) 'live-region-attributes)
       ;; ONE level: the item's dump still shows the link as written, not as
       ;; the expander went on to rewrite it
       (define (source-of form)
         (for/or ([p (in-list dumped)])
           (define written (syntax->datum (car p)))
           (and (eq? (car written) form) written)))
       (check-not-false (member '(live-link clist "/x") (source-of 'live-item))
                        "the item's source form lost the link inside it"))
     (λ () (delete-file path)))))
