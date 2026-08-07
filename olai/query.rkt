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
         (struct-out day-site)
         collect-nodes
         collect-dated-nodes
         breadcrumb-of
         with-file-roots
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

;; WHERE THE DAY NODES ARE — one walk, and the only one that looks for them.
;;
;; A day node is a bare ISO title (Daily.rkt's own shape, olai/dates); this is
;; where the tree is asked which of them it holds and what each one is. Callers
;; want three different things off it — which days exist (the calendar's set),
;; the node to open for one of them (the sidebar's cells), and the node a
;; month hangs under (its header) — and three walks looking for one kind of
;; node is three places to disagree about what one is.
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
