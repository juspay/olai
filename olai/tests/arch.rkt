#lang arch

;; The tests. They move with whatever they are about, they reach across every
;; layer on purpose, and they own every authority there is — a test that could
;; not spawn a process, bind a port or write a file would not be testing this
;; program.
;;
;; Declared rather than skipped. A directory the checker steps over is a
;; directory anything can be hidden in; a directory that declares itself
;; volatile and omnipotent says exactly what it is, in a file somebody can read.
(clock volatile)
(owns clock filesystem filesystem-events network subprocess threads randomness)
