#lang racket/base

;; FINDING A NODE by what it says.
;;
;; A pure query over a loaded set: no I/O, no clocks, no markup, no addresses.
;; It is handed the same `files-data` a renderer is handed (olai/store) and
;; answers with the nodes a query names, best first — which is all a search box
;; and all a command palette ever wanted, and the reason the two can share it.
;;
;; What is searched is what a node SAYS about itself, in four fields: its title,
;; the ^anchor it is named by, its #tags, and its note. Not its ancestors' — a
;; query that matched every node under "Work" would answer with the file — and
;; not the document a @doc attaches, which is a file this layer has never read.
;;
;; The matching is deliberately dull: case-folded substrings, every term of the
;; query somewhere in the same node, in any order and in any of the four
;; fields. Fuzzy matching buys "meetng" and sells the property that a search
;; you can predict is a search you can trust — and a node with a typo in it is
;; a node you fix rather than a ranking problem. What ranking there is says one
;; thing: the closer a hit is to what a node CALLS itself, the higher it goes.
;;
;; Done nodes are found. Search is not the agenda: the reason to look for a
;; node you finished is precisely that you finished it. They are pushed down a
;; field's worth, which is enough for an open node to win a tie and not enough
;; to lose a node somebody is actually looking for.

(require racket/contract
         racket/list
         racket/match
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/lang/walk)

(provide (contract-out
          ;; One node a query named:
          ;;   task   the node itself, at its DEFINING site (a mirror site is
          ;;          the same node, and is not a second hit)
          ;;   file   the file it was reached through, as the loaded set named
          ;;          it — a file, not a label, for the same reason olai/index
          ;;          keeps one: what to READ it as is the drawing layer's call
          ;;   trail  the titles above it, outermost first, its own not in it
          ;;   score  what ranked it; comparable only against another hit for
          ;;          the SAME query
          ;;   fields the fields the query was found in, best first — which is
          ;;          what lets a drawer show the note when the note is why
          [struct search-hit ([task task?]
                              [file (or/c path? string?)]
                              [trail (listof string?)]
                              [score real?]
                              [fields (listof symbol?)])]
          ;; files-data (olai/store) + what was typed -> the hits, best first.
          ;; An empty query names no nodes: a search box with nothing in it is
          ;; not a request for the whole outline.
          [search-outlines (-> list? string? (listof search-hit?))]))

;; One node a query named. See the contract above for what each field is.
(struct search-hit (task file trail score fields) #:transparent)

;; ---- what a hit is worth ----------------------------------------------------
;;
;; One table, and the whole ranking policy is in it. A term is scored in the
;; best field it appears in; a node's score is the sum over the query's terms,
;; so a node that answers two words in its title beats one that answers one
;; word twice.

(define field-weights
  '((title . 100)     ; what the node calls itself
    (anchor . 80)     ; what it is NAMED — how a power user addresses it
    (tag . 60)        ; what it was filed under
    (note . 40)))     ; what was said about it

(define search-fields (map car field-weights))

;; Where in the field the term landed. Starting it is the strongest signal a
;; substring match has ("meet" for "Meeting prep"), starting a word in it the
;; next ("prep"), and landing mid-word is the weakest thing that is still a hit.
(define starts-field-bonus 25)
(define starts-word-bonus 10)

;; A finished node is still a node, and still findable. One field's worth of
;; demotion: an open node wins a tie, and a done node with a title hit still
;; outranks an open one matched on its note.
(define done-penalty 30)

(define (field-weight field) (cdr (assq field field-weights)))

;; ---- the query --------------------------------------------------------------

;; One word of a query: what it reads as, and the pattern that finds it. The
;; pattern is built once per query rather than once per node — the same
;; question is asked of every field of every node in the set.
(struct term (text rx) #:transparent)

;; "Meeting Prep" -> two terms, folded and deduplicated. Whitespace is the only
;; separator, and there are no operators: a query is words, and every word has
;; to be somewhere in the node.
(define (query-terms query)
  (for/list ([w (in-list (remove-duplicates
                          (string-split (string-downcase query))))])
    (term w (regexp (regexp-quote w)))))

;; ---- what a node offers a query ---------------------------------------------

;; (listof (cons field text)), folded, in field order, with the fields this
;; node has nothing in left out.
(define (node-texts tk)
  (define (folded s) (and (string? s) (non-empty-string? s) (string-downcase s)))
  (define tags (task-tags tk))
  (filter cdr
          (list (cons 'title (folded (task-title tk)))
                (cons 'anchor (folded (task-id tk)))
                (cons 'tag (and (pair? tags) (folded (string-join tags " "))))
                (cons 'note (folded (task-description tk))))))

;; What `t` is worth in `text`, or #f when it is not in it.
(define (field-score field text t)
  (define at (regexp-match-positions (term-rx t) text))
  (and at
       (+ (field-weight field)
          (let ([start (caar at)])
            (cond
              [(zero? start) starts-field-bonus]
              [(word-boundary? text start) starts-word-bonus]
              [else 0])))))

;; A term that starts a word is a term somebody meant; one that starts in the
;; middle of a longer word usually is not.
(define (word-boundary? text at)
  (not (regexp-match? #px"[[:alnum:]]" (substring text (sub1 at) at))))

;; Where one term landed in this node, and what each landing is worth:
;; (listof (cons field score)), empty when it landed nowhere — which is the
;; node not matching at all, since every term has to land somewhere.
;;
;; ONE pass answers both questions the caller has. What a term is WORTH is the
;; best of these; where the query was FOUND is all of them, over every term.
;; Asking the second question with a second sweep of the same regexps over the
;; same strings was two derivations of one fact — and two places for the score
;; and the reported field to come to disagree about what matched.
(define (term-landings texts t)
  (for*/list ([entry (in-list texts)]
              [score (in-value (field-score (car entry) (cdr entry) t))]
              #:when score)
    (cons (car entry) score)))

;; Every field the query landed in, in field order: what a drawer reads to know
;; whether the note is why this node is on the screen.
(define (landed-fields landings)
  (define found (append* landings))
  (for/list ([field (in-list search-fields)]
             #:when (assq field found))
    field))

;; The node, scored — or #f, which is every node in the set but a handful.
(define (score-node tk file path terms)
  (define texts (node-texts tk))
  (define landings (for/list ([t (in-list terms)]) (term-landings texts t)))
  (and (andmap pair? landings)
       (search-hit tk
                   file
                   (map task-title path)
                   (- (for/sum ([l (in-list landings)]) (apply max (map cdr l)))
                      (if (eq? (task-status tk) 'done) done-penalty 0))
                   (landed-fields landings))))

;; ---- the search --------------------------------------------------------------

(define (search-outlines files-data query)
  (define terms (query-terms query))
  (cond
    [(null? terms) '()]
    [else
     (define hits
       (for/fold ([acc '()]) ([entry (in-list files-data)])
         (match-define (list file tasks) entry)
         (fold-tasks tasks
                     (λ (tk path acc)
                       (define hit (score-node tk file path terms))
                       (if hit (cons hit acc) acc))
                     acc)))
     ;; `sort` is stable, so nodes that scored the same come out in the order
     ;; they are written: file order, then tree order. A ranking that shuffled
     ;; equals would move an answer under the cursor between two keystrokes.
     (sort (reverse hits) > #:key search-hit-score)]))
