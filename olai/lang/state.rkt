#lang racket/base

;; WHAT STATE A NODE IS IN — the one rule, for every phase and every layer.
;;
;; A node's state used to be exactly what it stored: `@done` / `[x]`, `@doing`
;; / `[/]`, or nothing. That is one answer too many for a tree. A heading whose
;; children are all finished IS finished, and saying so a second time in a
;; checkbox of its own is a copy — one that nobody flips the day the last child
;; merges, which is precisely how a section stayed open on the page for a week.
;;
;; So a parent with task children and NO mark of its own has its state DERIVED
;; from them, here, and nothing stores the answer. A parent that has its own
;; completion criterion still writes a mark, which WINS — and then may not
;; contradict what it contains, which is the check below.
;;
;; Over a NODE PROTOCOL the caller supplies (lang/graph does the same for the
;; anchor rules): what a node stores, what its task children are, what it is
;; called. Nothing here knows what a node is, which is what lets the same rule
;; run over compile-time syntax, over a spliced tree, and over the write path's
;; view of raw text.

(require racket/list
         racket/string)

(provide derive-status
         status-derived?
         check-status-tree)

;; ---- the rule ---------------------------------------------------------------

;; stored : 'done | 'doing | 'open — what this node's OWN marks say
;; kids   : (listof (or/c 'done 'doing 'open)) — the states of its TASK
;;          children, each already derived the same way
;;
;; MIRROR SITES ARE NOT AMONG THE KIDS, and that is a rule and not an
;; oversight: a mirror is a reference, resolvable only once the whole set is in
;; hand, so counting one would make a module answer this question differently
;; at compile time than the linker does. Containment is what the tree says, and
;; containment is what a state is derived from.
;;
;; The order of the clauses is the whole policy:
;;
;;   * a mark WINS. A parent may have a completion criterion its children know
;;     nothing about ("ship it"), and writing one is how you say so.
;;   * nothing to derive from is `open`, exactly as today. A leaf keeps no
;;     state it did not write.
;;   * all children done is done. This is the drift the whole feature is about.
;;   * anything else — mixed done and open, all open — is OPEN.
;;
;; DONE-NESS IS THE ONLY THING DERIVED. A parent of an `[/]` child does not
;; become `[/]`: being in flight is a claim about somebody's attention (who and
;; where live in the node's notes, docs/cli.md), not a fact about what a node
;; contains, and it is not one this file may make on their behalf. It would
;; also propagate to the root — every ancestor of one in-flight leaf, up to and
;; including the file's own top node, reading as work in progress — and land
;; every one of them in the agenda's `doing` group, which ignores dates. The
;; child is already in that group, with a breadcrumb that names its parents.
;; Done-ness has neither problem: it stops at the first parent that is not
;; finished, and the agenda's answer to a finished node is to say nothing.
(define (derive-status stored kids)
  (cond
    [(not (eq? stored 'open)) stored]
    [(null? kids) 'open]
    [(andmap (λ (s) (eq? s 'done)) kids) 'done]
    [else 'open]))

;; Did that answer come from the CHILDREN rather than from the node? The
;; question every write asks before it stores anything (`olai done` refuses to
;; write derived state) and the one the JSON publishes, so a reader can tell a
;; state that is a fact about the file from a state that is a fact about the
;; tree.
;;
;; It is `open` + task children, whatever the children turn out to say: a
;; parent of one done and one open child derives OPEN, and writing `@done`
;; there is still storing what the tree is already answering.
(define (status-derived? stored kids)
  (and (eq? stored 'open) (pair? kids)))

;; ---- the contradiction ------------------------------------------------------

;; roots     : (listof node)
;; #:stored  : node -> 'done | 'doing | 'open
;; #:kids    : node -> (listof node)   — its TASK children, in order
;; #:title   : node -> string          — what to call a child in the message
;; #:fail    : who node message -> ⊥
;;
;; ONE rule: a node that SAYS it is done may not contain unfinished work. Every
;; other combination is fine — `@doing` above anything, a mark above children
;; that agree with it, a bare parent deriving whatever it derives.
;;
;; The child's state is the DERIVED one, so a grandchild counts through a
;; statusless middle node; and blaming the nearest parent that stored the wrong
;; thing is why this walks rather than asking about descendants directly.
(define (check-status-tree roots
                           #:stored stored-of
                           #:kids kids-of
                           #:title title-of
                           #:fail fail)
  (define (status n)
    (derive-status (stored-of n) (map status (kids-of n))))
  (define (visit n)
    (when (eq? (stored-of n) 'done)
      (define unfinished
        (for/list ([k (in-list (kids-of n))]
                   #:unless (eq? (status k) 'done))
          (cons (title-of k) (status k))))
      (unless (null? unfinished)
        (fail '@done n (contradiction-message unfinished))))
    (for-each visit (kids-of n)))
  (for-each visit roots))

;; Named, so an agent can go straight there, and counted, so it knows whether
;; one fix is the whole fix. The remedy is both ways round on purpose: the mark
;; is wrong, or the child is unfinished, and only the person writing knows
;; which.
(define (contradiction-message unfinished)
  (define first-two
    (string-join
     (for/list ([u (in-list (take unfinished (min 2 (length unfinished))))])
       (format "~s is ~a" (car u) (cdr u)))
     ", "))
  (define rest (- (length unfinished) (min 2 (length unfinished))))
  (format (string-append "marked done above unfinished work: ~a~a; "
                         "drop @done / [x] and done-ness derives from the "
                         "children, or finish them")
          first-two
          (if (zero? rest) "" (format " (and ~a more)" rest))))
