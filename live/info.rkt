#lang info

(define collection "live")
(define deps '("base" "web-server-lib"))
(define build-deps '("rackunit-lib"))
(define pkg-desc "Live views for Racket web apps: an SSE hub with reconnect catch-up, and an htmx+idiomorph client runtime")
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)
