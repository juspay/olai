#lang racket/base

;; Pure queries over a loaded outline. No I/O, no clocks, no JSON.
;;
;; What is left after the dated queries were retired: how big an outline is,
;; and what the typed-edge graph says cannot start yet.

(require racket/list
         (except-in olai/lang/expander #%module-begin)
         ;; which nodes are done work put away, and therefore neither blocking
         ;; nor blocked
         (only-in olai/archive archived-task?)
         ;; what a day node is TITLED, which is the whole of what one is
         (only-in olai/dates bare-iso-date-title?)
         olai/edges
         olai/lang/walk)

(provide (struct-out day-site)
         collect-day-sites
         day-site-for
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
;; ONE DONE PREDICATE, and it is `task-status` — the same one the checkbox, the
;; agenda and the JSON read. A target counts as done when its STATE says so,
;; stored or derived from its children (olai/lang/state), because the outline
;; must not have two answers to "is this done": a statusless parent whose last
;; child was finished has happened, and going on blocking what comes after it
;; would be this function disagreeing with the page.
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

;; ARCHIVED work was the other half of this module: the dated queries dropped
;; it, because the agenda, the calendar and the ICS feed were three ways of
;; asking what is going on and work that was put away is not an answer to any
;; of them. Those queries are gone; the rule survives where it still has a
;; reader, which is the graph above (a node in Archive.rkt neither blocks nor
;; is blocked) and the web view's own page for reading them.
;;
;; WHERE THE DAY NODES ARE — one walk, and the only one that looks for them.
;;
;; A day node is a bare ISO title (Daily.rkt's own shape, olai/dates); this is
;; where the tree is asked which of them it holds and what each one is. Callers
;; want different things off it — the node to open for a day (the sidebar's
;; cells), the node a month hangs under (its header), the one node today is
;; (/today) — and a walk each is a place each to disagree about what a day is.
;;
;;   key    the day node's own key: what addresses that day
;;   parent the key of the node it hangs under — the month in a Daily.rkt, the
;;          year in the monolithic shape — or #f at a file's top level, where
;;          a day has nothing above it
;;
;; -> hash "YYYY-MM-DD" -> day-site. FIRST site wins, in tree order, which is
;; the rule the store's own day lookup keeps: an outline with two nodes titled
;; one day says one thing twice, and every surface agrees on the first.
(struct day-site (key parent) #:transparent)

(define (collect-day-sites tasks)
  (fold-tasks tasks
              (λ (tk path acc)
                (define title (task-title tk))
                (if (and (bare-iso-date-title? title)
                         (not (hash-has-key? acc title)))
                    (hash-set acc title (site-of tk path))
                    acc))
              (hash)))

;; ONE day, asked for by name: the same rule, and the same first-wins, without
;; indexing every day the outline holds to answer about one of them. The title
;; is the whole test — a day node is a node titled a bare ISO date, and the
;; caller has just said which date.
(define (day-site-for tasks iso-day)
  (and (bare-iso-date-title? iso-day)
       (fold-tasks tasks
                   (λ (tk path acc)
                     (or acc
                         (and (equal? (task-title tk) iso-day)
                              (site-of tk path))))
                   #f)))

(define (site-of tk path)
  (day-site (task-key tk) (and (pair? path) (task-key (last path)))))
