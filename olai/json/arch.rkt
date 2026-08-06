#lang arch

;; The two JSON modules, and two version counters: what a node IS (durable) and
;; what a command answered (envelopes). Both are append-only within a version,
;; so they move with the core rather than with the view.
(clock settling)
(owns)
