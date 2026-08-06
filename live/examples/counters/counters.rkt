#lang racket/base

;; alpha, beta and gamma, and the thread that moves them: this example's first
;; PRODUCER. It owns its stream's vocabulary — the event name, and what an id
;; means — and has never seen a page.

(require racket/list
         live/frame
         live/hub)

(provide (struct-out counter) counter-values counter-named
         counts-cursor counts-catch-up start-counters!)

(struct counter (name value step) #:transparent)

;; Random rates, seeded: the same demo every boot, so a test that reads a value
;; can say what it was looking at.
(define rng (make-pseudo-random-generator))
(parameterize ([current-pseudo-random-generator rng]) (random-seed 20260806))
(define (roll n) (parameterize ([current-pseudo-random-generator rng]) (random n)))

(define state
  (box (for/list ([name (in-list '("alpha" "beta" "gamma"))])
         (counter name 0 (+ 3 (roll 6))))))

;; How many bumps into this process we are. Paired with live-boot-id it is the
;; cursor: a counter alone restarts with the process, so "7" would name two
;; different states and every tab that reconnected across a restart would be
;; told it was up to date.
(define bumps (box 0))

(define bump-seconds 0.5)

;; Sorted by value, which is the whole point: the rows REORDER twice a second.
;; Values wrap at 100 — a lap counter, not a total, or the fastest one wins
;; within the minute and nothing ever moves again.
(define (counter-values)
  (sort (unbox state) > #:key counter-value))

(define (counter-named name)
  (findf (λ (c) (equal? (counter-name c) name)) (unbox state)))

(define (counts-cursor)
  (string-append live-boot-id "." (number->string (unbox bumps))))

;; convention 2 (event name), the PRODUCER's end: list.rkt spells this same
;; word in the live view it draws the region with.
(define counts-event "counts-changed")

;; The payload is the cursor, never markup: the region re-fetches its own page,
;; so there is no second renderer to keep in step. The id is the same string —
;; what a client hands back when it comes home.
(define (counts-frame)
  (define cursor (counts-cursor))
  (make-frame counts-event cursor #:id cursor))

;; What a connection that last saw `last-id` is owed. Anything but the current
;; cursor is owed one re-fetch — not "older than", since an id from a previous
;; process cannot be ordered against this one. A connection that says nothing
;; is owed nothing: it has seen nothing because there was nothing to see.
(define (counts-catch-up last-id)
  (if (and last-id (not (equal? last-id (counts-cursor))))
      (list (counts-frame))
      '()))

;; -> a thread. Bumps every counter, then says so. The values move before the
;; count of them does, so the worst a page rendered mid-bump can do is
;; understate where it is and be told to re-fetch what it already has.
(define (start-counters! hub)
  (thread
   (λ ()
     (let loop ()
       (sleep bump-seconds)
       (set-box! state
                 (for/list ([c (in-list (unbox state))])
                   (struct-copy counter c
                                [value (modulo (+ (counter-value c) (roll (counter-step c)))
                                               100)])))
       (set-box! bumps (add1 (unbox bumps)))
       (hub-broadcast! hub (counts-frame))
       (loop)))))
