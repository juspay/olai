#lang info

(define collection "olai")
;; "live" is the live-view framework in this repo's own live/ directory, not a
;; catalog package: olai is its first consumer, and the two are installed
;; together (justfile, nix/olai.nix). It is listed anyway — a dependency the
;; package file does not name is one a build can forget.
(define deps '("base" "css-expr" "gregor" "live" "markdown" "web-server-lib"))
(define build-deps '("rackunit-lib"))
(define pkg-desc "Self-hosted outliner: #lang olai + CLI")
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)

(define racket-launcher-names '("olai"))
(define racket-launcher-libraries '("cli.rkt"))
