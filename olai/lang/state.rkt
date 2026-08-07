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
         node-status
         status-derived?
         check-status-tree)

;; ---- the rule ---------------------------------------------------------------

;; stored     : 'done | 'doing | 'open — what this node's OWN marks say
;; kid-states : (listof (or/c 'done 'doing 'open)) — the states of its TASK
;;              children, each already derived the same way
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
;;   * STARTED BUT NOT FINISHED is `doing` — a child in flight, or a child
;;     finished beside one that is not. Both say the same thing about the
;;     parent: somebody has begun it and nobody has ended it, which is the
;;     whole of what the third state means.
;;   * nothing started is open.
;;
;; The three states derive, not just done-ness, and `doing` is the one that
;; costs something: it propagates, so an ancestor of one in-flight leaf is in
;; flight all the way to the file's own top node. That is TRUE — the work under
;; it has started — and it is a fact about a node, which is this module's only
;; business. What it must not become is an agenda full of ancestors, and that
;; is the agenda's rule to make rather than a reason for the tree to answer
;; wrongly: `doing` there means somebody CLAIMED a node (olai/agenda), which is
;; a stored mark and never a derived one.
(define (derive-status stored kid-states)
  (define (any? s) (memq s kid-states))
  (cond
    [(not (eq? stored 'open)) stored]
    [(null? kid-states) 'open]
    [(andmap (λ (s) (eq? s 'done)) kid-states) 'done]
    [(or (any? 'doing) (any? 'done)) 'doing]
    [else 'open]))

;; The rule over a whole node, which is the recursion the rule implies: a
;; child's state is derived before it is counted. Every phase reads a state
;; through this — the checker below, and the expander for `task-status` — so
;; the walk exists once and cannot come out two answers.
;;
;; #:stored / #:kids as in check-status-tree.
(define (node-status n #:stored stored-of #:kids kids-of)
  (derive-status
   (stored-of n)
   (for/list ([k (in-list (kids-of n))])
     (node-status k #:stored stored-of #:kids kids-of))))

;; Did that answer come from the CHILDREN rather than from the node? The
;; question every write asks before it stores anything (`olai done` refuses to
;; write derived state) and the one the JSON publishes, so a reader can tell a
;; state that is a fact about the file from a state that is a fact about the
;; tree.
;;
;; `kids` is the task children THEMSELVES, not their states, and the asymmetry
;; with derive-status above is the point: whether an answer is derived is
;; `open` plus having any children at all, whatever they turn out to say. A
;; parent of one done and one open child derives OPEN, and writing `@done`
;; there is still storing what the tree is already answering. Asking it costs
;; nothing, where asking for the state itself walks the subtree.
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
  (define (status n) (node-status n #:stored stored-of #:kids kids-of))
  (define (visit n)
    (when (eq? (stored-of n) 'done)
      (define unfinished
        (for/list ([k (in-list (kids-of n))]
                   #:unless (eq? (status k) 'done))
          (format "~s is ~a" (title-of k) (status k))))
      (unless (null? unfinished)
        (fail '@done n (contradiction-message unfinished))))
    (for-each visit (kids-of n)))
  (for-each visit roots))

;; Named, so an agent can go straight there, and counted, so it knows whether
;; one fix is the whole fix. The remedy is both ways round on purpose: the mark
;; is wrong, or the child is unfinished, and only the person writing knows
;; which.
(define (contradiction-message unfinished)
  (define-values (named more) (split-at unfinished (min 2 (length unfinished))))
  (format (string-append "marked done above unfinished work: ~a~a; "
                         "drop @done / [x] and done-ness derives from the "
                         "children, or finish them")
          (string-join named ", ")
          (if (null? more) "" (format " (and ~a more)" (length more)))))
