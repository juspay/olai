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
         ;; which nodes are done work put away, and therefore not an answer to
         ;; any of the questions below
         (only-in olai/archive archived-task? live-entries)
         olai/dates
         olai/lang/walk
         olai/paths)

(provide (struct-out crumbed-node)
         collect-nodes
         collect-dated-nodes
         breadcrumb-of
         with-file-roots
         collect-day-titles
         count-tasks
         count-mirrors)

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
;;
;; ARCHIVED nodes are out of all of them, and this is the line that says so:
;; the agenda, the calendar and the ICS feed are three ways of asking what is
;; going on, and work that was put away is not an answer to any of them. It is
;; a rule about QUERIES and not about loading — the tree still holds every
;; archived node, `olai tree` still prints it, an anchor in it still resolves,
;; and the web view has a page of its own for reading them.
(define (collect-nodes tasks keep? #:root [root #f])
  (reverse
   (fold-tasks tasks
               (λ (tk path acc)
                 (if (and (keep? tk) (not (archived-task? tk)))
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
;;
;; The archive is not one of the files: it holds no answers (collect-nodes
;; drops its nodes above), and counting it would change what "more than one
;; file is loaded" MEANS — a one-outline home would start reading
;; `Tasks.rkt > Inbox > …` the day it archived anything.
(define (with-file-roots file-entries proc)
  (define live (live-entries file-entries))
  (define multi? (> (length live) 1))
  (append*
   (for/list ([e (in-list live)])
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
