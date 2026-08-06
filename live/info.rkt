#lang info

(define collection "live")
;; "arch" is the declaration language this repo's arch.rkt files are written
;; in — its own package (repo root, arch/), not a catalog one, for the same
;; reason `live` is: a collection with its own reason to be built. live/arch.rkt
;; is a `#lang arch` module, so it is a real compile-time dependency. It is NOT
;; a dependency on olai, which this package still has none of.
(define deps '("arch" "base" "web-server-lib"))
(define build-deps '("rackunit-lib"))
(define pkg-desc
  (string-append "Live views for Racket web apps: an SSE hub with reconnect"
                 " catch-up, and an htmx+idiomorph client runtime"))
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)
