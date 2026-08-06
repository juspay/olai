#lang arch

;; The checker's tests. They write little trees of declarations and modules
;; into temp directories, run git in them and read the findings back, so they
;; own what a test owns.
(clock volatile)
(owns clock filesystem filesystem-events network subprocess threads randomness)
