#lang racket/base

;; The watcher's midnight arithmetic, without a clock. The stream it feeds is
;; the framework's and tested there (live/tests/); what a revision MEANS to a
;; connection that has been away is tested in tests/live.rkt; the wired-up
;; version of all three lives in tests/integration/serve.rkt.

(require gregor
         olai/web/watch)

(module+ test
  (require rackunit))

(module+ test
  (test-case "seconds-until-midnight is the distance to the next local one"
    (check-equal? (seconds-until-midnight (moment 2026 8 4 23 30 0 #:tz "UTC")) 1800)
    (check-equal? (seconds-until-midnight (moment 2026 8 4 0 0 1 #:tz "UTC")) 86399)
    ;; exactly midnight is a full day from the NEXT one, not zero
    (check-equal? (seconds-until-midnight (moment 2026 8 4 0 0 0 #:tz "UTC")) 86400))

  (test-case "midnight is the zone's, not UTC's"
    ;; 23:30 in New York is 03:30 UTC; the boundary that matters is local
    (check-equal? (seconds-until-midnight
                   (moment 2026 8 4 23 30 0 #:tz "America/New_York"))
                  1800))

  (test-case "a DST spring-forward day is 23 hours, and the calendar says so"
    ;; 2026-03-08 is the US spring-forward; midnight to midnight is 82800s
    (check-equal? (seconds-until-midnight
                   (moment 2026 3 8 0 0 0 #:tz "America/New_York"))
                  82800)))
