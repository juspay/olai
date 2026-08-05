#lang s-exp syntax/module-reader
olai/lang/expander

#:whole-body-readers? #t
#:read sf-read
#:read-syntax sf-read-syntax

(require racket/port
         "outline.rkt")

(define (sf-read in)
  (syntax->datum (sf-read-syntax #f in)))

(define (sf-read-syntax src in)
  (define forms (parse-outline-port (or src (object-name in)) in))
  ;; whole-body reader returns a list of body forms as a single syntax list?
  ;; syntax/module-reader with #:whole-body-readers? #t expects read-syntax
  ;; to return a list of syntax objects (the body forms).
  forms)
