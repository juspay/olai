#lang racket/base

;; One walk over a task tree.
;;
;; Eight hand-written recursions used to walk it — agenda, calendar twice,
;; the store twice, the JSON counts, the finders — and every one of them
;; restated the MIRROR POLICY in its own `cond`: is a *mirror site a node you
;; visit, or the same node you already visited at its defining site? They did
;; not all answer the same way, and nothing said so out loud.
;;
;; fold-tasks says it once, as an argument:
;;
;;   #:mirrors 'skip   a mirror site is the node it points at, already
;;                     visited where it is defined — do not visit it here
;;                     (what a count, an index or a query wants)
;;   #:mirrors 'visit  visit mirror sites too (what counting SITES wants)
;;
;; `proc` gets each node, the list of its ancestor tasks (outermost first,
;; node not included), and the accumulator.

(require racket/list
         (except-in selfflowy/lang/expander #%module-begin))

(provide fold-tasks
         task-path
         find-task-by-id
         find-tasks-by-title)

(define (fold-tasks roots proc init
                    #:mirrors [mirrors 'skip]
                    #:path [path0 '()])
  (let walk ([xs roots] [path path0] [acc init])
    (for/fold ([acc acc]) ([x (in-list xs)])
      (cond
        [(task? x)
         (walk (task-children x)
               (append path (list x))
               (proc x path acc))]
        [(mirror-ref? x)
         (if (eq? mirrors 'visit) (proc x path acc) acc)]
        [else acc]))))

;; The trail down to `tk` inclusive — what a breadcrumb is built from.
(define (task-path path tk)
  (append path (list tk)))

(define (find-task-by-id tasks id)
  (fold-tasks tasks
              (λ (tk _path acc)
                (or acc (and (equal? (task-id tk) id) tk)))
              #f))

(define (find-tasks-by-title tasks title)
  (reverse
   (fold-tasks tasks
               (λ (tk _path acc)
                 (if (equal? (task-title tk) title) (cons tk acc) acc))
               '())))
