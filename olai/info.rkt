#lang info

(define collection "olai")
(define deps '("base" "css-expr" "gregor" "markdown" "web-server-lib"))
(define build-deps '("rackunit-lib"))
(define pkg-desc "Self-hosted outliner: #lang olai + CLI")
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)

(define racket-launcher-names '("olai"))
(define racket-launcher-libraries '("cli.rkt"))
