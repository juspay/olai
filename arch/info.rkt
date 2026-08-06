#lang info

(define collection "arch")
;; Nothing. The checker reads source, compiled modules and `git log`, and all
;; three come with the distribution — a tool that tells a repo what it may
;; depend on has no business growing dependencies of its own.
(define deps '("base"))
(define build-deps '("rackunit-lib"))
(define pkg-desc "#lang arch: a package's architecture as data, and the checker that holds it to it")
(define version "0.1")
(define pkg-authors '(srid))
(define license 'AGPL-3.0-or-later)
