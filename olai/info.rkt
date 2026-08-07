#lang info

(define collection "olai")
;; "live" is the live-view framework in this repo's own live/ directory, and
;; "arch" is the language the arch.rkt declarations beside every package are
;; written in — neither is a catalog package. olai is live's first consumer,
;; arch is under both of them, and all three are installed together (justfile,
;; nix/olai.nix). They are listed anyway — a dependency the package file does
;; not name is one a build can forget.
(define deps '("arch" "base" "css-expr" "gregor" "live" "markdown" "web-server-lib"))
(define build-deps '("rackunit-lib"))
(define pkg-desc "Self-hosted outliner: #lang olai + CLI")
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)

(define racket-launcher-names '("olai"))
(define racket-launcher-libraries '("cli.rkt"))
