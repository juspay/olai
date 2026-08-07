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
;; A DONE node is waiting on nothing, whatever it is after: it has happened,
;; and the order it happened in is no longer a question. Without that, a
;; finished node whose blocker is still open wears a "blocked" affordance on
;; the page — the agenda never showed it, because a done node is off the plate
;; before this is asked, and the outline would have.
;;
;; ARCHIVED is the same answer arrived at from the other side, and it goes both
;; ways: work that was put away (olai/archive) is neither blocked nor blocking.
;; Not blocked, because it is not in any live view to be told it cannot start —
;; and the archive HAS a page, which is where the pill would otherwise turn up.
;; Not blocking, because archiving is what you do to work that is over: a live
;; node still waiting on one would be waiting forever, on something no list will
;; ever show it again.
;;
;; This is the graph's half of the rule `collect-nodes` states above; both are
;; here, in the query layer, because that is where "is this an answer to a
;; question about live work" is decided (olai/archive).
;;
;; idx : the set's edge index (olai/edges), which is also what knows the node
;;       at the far end of an arrow
(define (blocked-nodes idx)
  (for*/hash ([(source targets) (in-hash (edge-graph idx 'after))]
              #:when (live? (edge-node idx source))
              [waiting (in-value (filter live? (map (λ (k) (edge-node idx k))
                                                    targets)))]
              #:unless (null? waiting))
    (values source waiting)))

;; STILL IN PLAY: it exists, it is not finished, and it has not been put away.
;; One predicate for both ends of an arrow — a source this can be said about
;; and a target that still stands in the way are the same question asked from
;; either side, and two spellings of it would be two chances to disagree about
;; what finished means.
(define (live? tk)
  (and tk (not (eq? (task-status tk) 'done)) (not (archived-task? tk))))

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
