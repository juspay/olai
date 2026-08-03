#lang info

(define collection "selfflowy")
(define deps '("base" "gregor" "ansi-color"))
(define build-deps '("rackunit-lib"))
(define pkg-desc "Self-hosted outliner: #lang selfflowy + CLI")
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)

(define racket-launcher-names '("selfflowy"))
(define racket-launcher-libraries '("cli.rkt"))
