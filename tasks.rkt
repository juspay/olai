#lang racket
;; Blind attempt #1 — mini task DSL: macro with optional #:date, structs, query.
(require (for-syntax syntax/parse))

(struct task (title date children) #:transparent)

(define-syntax (t stx)
  (syntax-parse stx
    [(_ title:str (~optional (~seq #:date d) #:defaults ([d #'#f])) child ...)
     #'(task title d (list child ...))]))

(define inbox
  (t "Inbox"
     (t "Buy milk" #:date "2026-08-04")
     (t "Write Selfflowy README"
        (t "Compare Racket vs Rhombus"))))

(define (count-tasks tk)
  (add1 (for/sum ([c (in-list (task-children tk))])
          (count-tasks c))))

(define (due tk)
  (append (if (task-date tk) (list tk) '())
          (append-map due (task-children tk))))

(module+ main
  (printf "total: ~a\n" (count-tasks inbox))
  (for ([tk (in-list (due inbox))])
    (printf "due ~a: ~a\n" (task-date tk) (task-title tk))))
