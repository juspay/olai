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
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/dates
         selfflowy/lang/walk
         selfflowy/paths)

(provide (struct-out dated-node)
         collect-dated-nodes
         breadcrumb-of
         with-file-roots
         collect-day-titles)

;; task: the node itself; breadcrumb: "Tasks.rkt > Inbox > Buy milk"
(struct dated-node (task breadcrumb) #:transparent)

;; #:root — a label prepended to the trail (a file's name, when more than one
;; file is loaded).
(define (breadcrumb-of path tk #:root [root #f])
  (string-join
   (append (if root (list root) '())
           (map task-title (task-path path tk)))
   " > "))

;; Every dated node, at its DEFINING site: a mirror site is the same node, so
;; a mirrored dated task appears once, with the breadcrumb it was defined at.
(define (collect-dated-nodes tasks #:root [root #f])
  (reverse
   (fold-tasks tasks
               (λ (tk path acc)
                 (if (task-date tk)
                     (cons (dated-node tk (breadcrumb-of path tk #:root root))
                           acc)
                     acc))
               '())))

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
