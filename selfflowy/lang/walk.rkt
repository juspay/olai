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

(require racket/contract
         racket/list
         (except-in selfflowy/lang/expander #%module-begin))

;; The mirror policy is an argument, so it is contracted: 'skip or 'visit and
;; nothing else. `proc` is checked for arity only — a (-> any/c list? any/c
;; any/c) wrapper would ride along on every node of every walk, and this is
;; the hot path everything else is built on.
(provide (contract-out
          [fold-tasks (->* (list? (procedure-arity-includes/c 3) any/c)
                           (#:mirrors (or/c 'skip 'visit) #:path list?)
                           any/c)]
          [task-path (-> list? any/c list?)]
          [find-task-by-id (-> list? (or/c string? #f) (or/c task? #f))]
          [find-tasks-by-title (-> list? string? list?)]
          [struct mirror-site ([of string?] [task (or/c task? #f)])]
          [resolve-mirrors (-> list? hash? list?)]))

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

;; ---- binding mirror sites -------------------------------------------------
;;
;; A (mirror "anchor") is an unbound reference: it names a node without
;; carrying it. The renderer used to do the binding itself, mid-walk, by
;; carrying an anchors hash down the recursion and hash-ref'ing at every
;; mirror site — so drawing a page and resolving a name were one function, and
;; "this anchor names nothing" was a failed lookup deep inside the drawing.
;;
;; This pass binds them once, before anyone draws: a mirror site becomes a
;; node it CARRIES plus the anchor it is a mirror OF (the defining site's key
;; — a mirror's target always has one, since anchored nodes key by anchor).
;; An anchor that names nothing carries #f, which is a state to draw, not a
;; lookup that failed.
;;
;; `anchors` is the defining file's own anchor hash: the language rejects a
;; mirror to an anchor its module cannot see, so there is no wider world to
;; resolve against.
(struct mirror-site (of task) #:transparent)

(define (resolve-mirrors tasks anchors)
  (define (resolve x)
    (cond
      [(task? x)
       (struct-copy task x [children (map resolve (task-children x))])]
      [(mirror-ref? x)
       (define anchor (mirror-ref-anchor x))
       (define target (hash-ref anchors anchor #f))
       ;; the mirrored subtree can hold mirrors of its own; the language
       ;; rejects cycles, so this terminates
       (mirror-site anchor (and target (resolve target)))]
      [else x]))
  (map resolve tasks))
