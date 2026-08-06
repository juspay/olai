#lang racket/base

;; The wall clock: a SECOND producer, its own event name, its own cadence, and
;; no idea the counters exist.

(require racket/format
         live/dsl
         live/hub)

(provide clock clock-now start-clock!)

;; Its own vocabulary, declared beside the thread that sends it. No
;; `#:heartbeat`: a page has one connection and the counters' stream already
;; names its cadence — two streams, one beat, and nothing here to disagree
;; with.
(define-stream clock #:events (clock-tick))

(define (two n) (~r n #:min-width 2 #:pad-string "0"))

(define (clock-now)
  (define d (seconds->date (current-seconds)))
  (string-append (two (date-hour d)) ":" (two (date-minute d)) ":" (two (date-second d))))

;; -> a thread. No id on the frame: a tick is not a checkpoint. A client that
;; comes back should be told the last state it can be BEHIND, and the time is
;; never that — the next second catches it up. (olai's chat frames ride the
;; same reasoning.)
(define (start-clock! hub)
  (thread
   (λ ()
     (let loop ()
       (sleep 1)
       (hub-broadcast! hub (stream-frame clock 'clock-tick (clock-now)))
       (loop)))))
