#lang racket/base

;; OUTLINES ON DISK, for the tests that need several of them.
;;
;; An anchor's scope is the loaded SET, so the rules about one — a mirror, a
;; typed edge, an @include — can only be tested by writing real files and
;; loading them together. Three test files were doing that, and each had grown
;; its own copy of the same four helpers; the third copy is what made this a
;; module.
;;
;; Nothing here decides anything: it writes a file, makes a directory go away
;; again, and says which of a load's two answers came back.

(require racket/file
         rackunit
         olai/load)

(provide write-outline
         in-dir
         linked-or-fail
         error-of)

;; One outline in `dir`, named and written. -> its path. The name may reach
;; into a subdirectory ("Daily/2026-08.rkt"), which is where an @include
;; fragment lives, so the parent is made if it is not there.
(define (write-outline dir name body)
  (define p (build-path dir name))
  (make-parent-directory* p)
  (display-to-file body p #:exists 'truncate/replace)
  p)

;; A temporary directory for the length of `proc`, and gone afterwards whatever
;; happened in it.
(define (in-dir name proc)
  (define dir (make-temporary-file (string-append name "~a") 'directory))
  (dynamic-wind void (λ () (proc dir)) (λ () (delete-directory/files dir))))

;; The two answers `load-set` can give, each asserted at the moment a test says
;; which one it expected — so a test that wanted a linked set and got an error
;; fails saying what the error was, rather than three lines later on a struct
;; accessor.
(define (linked-or-fail lk)
  (check-true (linked? lk) (format "~a" lk))
  lk)

;; -> (values "file:line:col" message)
(define (error-of lk)
  (check-true (load-error? lk) (format "~a" lk))
  (values (or (load-error-where lk) "") (load-error-message lk)))
