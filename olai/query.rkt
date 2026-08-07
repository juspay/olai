#lang racket/base

;; Pure queries over a loaded outline. No I/O, no clocks, no JSON.
;;
;; agenda and calendar are the same question asked twice — which nodes carry
;; a @date, and what is the trail to each — differing only in what they keep
;; (agenda drops done ones) and what they project it into. That question is
;; answered here, once, and the same file-rooted breadcrumb rule serves both
;; and the ICS writer.

(require racket/list
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/dates
         olai/edges
         olai/lang/walk
         olai/paths)

(provide (struct-out crumbed-node)
         collect-nodes
         collect-dated-nodes
         breadcrumb-of
         with-file-roots
         collect-day-titles
         count-tasks
         count-mirrors
         blocked-nodes)

;; WHAT IS NOT ACTIONABLE YET: key -> the nodes it is waiting on, for every
;; node with an unfinished `@after` target. Absent from the hash is the answer
;; for everything else, so membership IS blocked-ness and the value is why —
;; the nodes themselves, because every surface that draws this wants something
;; different off them (a key to link to, a name to show, a count).
;;
;; `@after` means ORDERING, never scheduling (docs/syntax.md): a blocked node
;; keeps its `@date` and is overdue on exactly the day it always was — being
;; blocked is a second fact about it, not a replacement for the first.
;;
;; Done-ness does NOT propagate: a target counts as done when it SAYS it is
;; done, whatever its children say. Deriving it would give the outline two
;; answers to "is this done" — the one `status` publishes and the one this
;; function believed — and would make adding a child to a finished parent
;; silently re-block everything after it. Point `@after` at the child you
;; actually mean, or mark the parent.
;;
;; idx : the set's edge index (olai/edges), which is also what knows the node
;;       at the far end of an arrow
(define (blocked-nodes idx)
  (for*/hash ([(source targets) (in-hash (edge-graph idx 'after))]
              [waiting (in-value (filter unfinished? (map (λ (k) (edge-node idx k))
                                                          targets)))]
              #:unless (null? waiting))
    (values source waiting)))

(define (unfinished? tk)
  (and tk (not (eq? (task-status tk) 'done))))

;; How big is this outline? Two folds, and the difference between them is the
;; whole mirror policy: a node is counted where it is DEFINED, a mirror site
;; is counted as a site.
(define (count-tasks tasks)
  (fold-tasks tasks (λ (_tk _path n) (add1 n)) 0))

(define (count-mirrors tasks)
  (fold-tasks tasks
              (λ (x _path n) (if (mirror-ref? x) (add1 n) n))
              0
              #:mirrors 'visit))

;; task: the node itself; breadcrumb: "Tasks.rkt > Inbox > Buy milk"
;; Named for what it carries and not for why it was picked: the agenda's DOING
;; group asks for nodes that have no @date at all.
(struct crumbed-node (task breadcrumb) #:transparent)

;; #:root — a label prepended to the trail (a file's name, when more than one
;; file is loaded).
(define (breadcrumb-of path tk #:root [root #f])
  (string-join
   (append (if root (list root) '())
           (map task-title (task-path path tk)))
   " > "))

;; Every node `keep?` says yes to, in tree order, at its DEFINING site: a
;; mirror site is the same node, so a mirrored node appears once, with the
;; breadcrumb it was defined at.
(define (collect-nodes tasks keep? #:root [root #f])
  (reverse
   (fold-tasks tasks
               (λ (tk path acc)
                 (if (keep? tk)
                     (cons (crumbed-node tk (breadcrumb-of path tk #:root root))
                           acc)
                     acc))
               '())))

(define (collect-dated-nodes tasks #:root [root #f])
  (collect-nodes tasks task-date #:root root))

;; file-entries: (listof (cons path tasks)). Calls `proc` with each entry's
;; tasks and the root label to prefix breadcrumbs with — the file's name when
;; several files are loaded, #f when there is only one (nothing to
;; disambiguate) — and appends the results.
(define (with-file-roots file-entries proc)
  (define multi? (> (length file-entries) 1))
  (append*
   (for/list ([e (in-list file-entries)])
     (proc (cdr e) (and multi? (file-label (car e)))))))

;; Bare ISO day titles (Daily.rkt day nodes). -> (listof string)
(define (collect-day-titles tasks)
  (reverse
   (fold-tasks tasks
               (λ (tk _path acc)
                 (if (bare-iso-date-title? (task-title tk))
                     (cons (task-title tk) acc)
                     acc))
               '())))
