#lang racket/base

;; The wall clock: a SECOND producer, its own event name, its own cadence, and
;; no idea the counters exist.

(require racket/format
         live/frame
         live/hub)

(provide clock-now start-clock!)

(define (two n) (~r n #:min-width 2 #:pad-string "0"))

(define (clock-now)
  (define d (seconds->date (current-seconds)))
  (string-append (two (date-hour d)) ":" (two (date-minute d)) ":" (two (date-second d))))

;; convention 2 (event name), the PRODUCER's end: header.rkt spells this same
;; word in the live view it draws the ticker with.
(define clock-event "clock-tick")

;; -> a thread. No id on the frame: a tick is not a checkpoint. A client that
;; comes back should be told the last state it can be BEHIND, and the time is
;; never that — the next second catches it up. (olai's chat frames ride the
;; same reasoning.)
(define (start-clock! hub)
  (thread
   (λ ()
     (let loop ()
       (sleep 1)
       (hub-broadcast! hub (make-frame clock-event (clock-now)))
       (loop)))))
