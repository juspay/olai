#lang racket/base

;; Finding a node by what it says. Hand-built trees, no files, no store, no
;; markup: this is a pure function of one loaded shape and a string somebody
;; typed, and every ranking decision in it is a line here.

(require racket/list
         file/sha1
         (except-in olai/lang/expander #%module-begin)
         olai/search)

(module+ test
  (require rackunit))

(module+ test
  (define (title-key title)
    (string-append
     "p" (substring (sha1 (open-input-bytes (string->bytes/utf-8 title))) 0 8)))

  (define (tk title
              #:note [note #f] #:tags [tags '()] #:id [id #f]
              #:done [done #f] #:kids [kids '()])
    (make-task #:title title #:description note #:tags tags #:id id
               #:done done #:children kids #:key (or id (title-key title))))

  ;; The titles a query answered with, best first — which is the whole
  ;; interface as far as a drawer is concerned.
  (define (titles hits) (map (λ (h) (task-title (search-hit-task h))) hits))

  (define (find fd q) (titles (search-outlines fd q))))

(module+ test
  ;; One small outline with a node per FIELD, so a query can name exactly one
  ;; of them and say which field it was found in.
  (define fd
    (list (list "/tmp/Tasks.rkt"
                (list (tk "Inbox #capture"
                          #:note "Where a thought lands before it is filed"
                          #:tags '("capture")
                          #:kids (list (tk "Buy oat milk"
                                           #:note "the barista kind, not the blue carton")
                                       (tk "Meeting prep" #:id "prep")
                                       (tk "Ship the server" #:done #t)))
                      (tk "Groceries" #:tags '("errand"))))
          (list "/tmp/Daily.rkt"
                (list (tk "2026-08-06"
                          #:kids (list (tk "Call the dentist")))))))

  ;; ---- what is searched -------------------------------------------------------

  (test-case "a title, a note, a tag and an anchor are all findable"
    (check-equal? (find fd "oat") '("Buy oat milk"))
    (check-equal? (find fd "barista") '("Buy oat milk"))
    (check-equal? (find fd "errand") '("Groceries"))
    (check-equal? (find fd "prep") '("Meeting prep"))
    ;; the anchor is a field of its own: a node found by the name it is
    ;; ADDRESSED by says so, whatever its title reads like
    (check-equal? (search-hit-fields (car (search-outlines fd "prep")))
                  '(title anchor)))

  (test-case "case does not matter, and neither does the order of the words"
    (check-equal? (find fd "OAT MILK") '("Buy oat milk"))
    (check-equal? (find fd "milk oat") '("Buy oat milk")))

  ;; Every word, somewhere in the same node — in any of its fields. This is the
  ;; whole query language, and the one case that proves it is a term matched by
  ;; the title and another by the note.
  (test-case "every term has to land, and they may land in different fields"
    (check-equal? (find fd "milk carton") '("Buy oat milk"))
    (check-equal? (find fd "milk dentist") '()))

  (test-case "an empty query names nothing at all"
    (check-equal? (search-outlines fd "") '())
    (check-equal? (search-outlines fd "   ") '()))

  (test-case "the trail above a hit is its ancestors, outermost first"
    (define hit (car (search-outlines fd "oat")))
    (check-equal? (search-hit-trail hit) '("Inbox #capture"))
    (check-equal? (search-hit-file hit) "/tmp/Tasks.rkt")
    ;; a top-level node's trail is empty, not a list with a file in it: what to
    ;; call the file is the drawing layer's, off search-hit-file
    (check-equal? (search-hit-trail (car (search-outlines fd "groceries"))) '()))

  (test-case "a node in another file is found the same way"
    (check-equal? (find fd "dentist") '("Call the dentist")))

  ;; ---- what ranks above what --------------------------------------------------

  (test-case "a title hit beats a note hit"
    ;; "capture" is the title (and tag) of one node and nothing at all in the
    ;; other; "thought" is only in a note
    (check-equal? (find fd "capture") '("Inbox #capture"))
    (define fd2
      (list (list "/tmp/T.rkt"
                  (list (tk "Widget" #:note "nothing to see")
                        (tk "Notes about it" #:note "the widget is here")))))
    (check-equal? (find fd2 "widget") '("Widget" "Notes about it")))

  (test-case "a term that starts a title beats one buried in the middle of it"
    (define fd2
      (list (list "/tmp/T.rkt"
                  (list (tk "The plan for planning")
                        (tk "Plan the week")))))
    (check-equal? (find fd2 "plan") '("Plan the week" "The plan for planning")))

  (test-case "a term that starts a word beats one inside a word"
    (define fd2
      (list (list "/tmp/T.rkt"
                  (list (tk "Replant the herbs")
                        (tk "The plan")))))
    (check-equal? (find fd2 "plan") '("The plan" "Replant the herbs")))

  (test-case "two words answered beats one word answered twice"
    (define fd2
      (list (list "/tmp/T.rkt"
                  (list (tk "Ship ship ship" #:note "ship")
                        (tk "Ship the server")))))
    (check-equal? (find fd2 "ship server") '("Ship the server"))
    ;; and a node that answers only one of them is not a hit at all
    (check-equal? (length (search-outlines fd2 "ship server")) 1))

  ;; ---- done, and mirrored -----------------------------------------------------

  (test-case "a done node is found, and loses a tie to an open one"
    (check-equal? (find fd "ship") '("Ship the server"))
    (define fd2
      (list (list "/tmp/T.rkt"
                  (list (tk "Ship the server" #:done "2026-08-01")
                        (tk "Ship the server")))))
    ;; same title, same everything: the open one comes first
    (define hits (search-outlines fd2 "ship"))
    (check-equal? (length hits) 2)
    (check-false (task-done (search-hit-task (first hits))))
    (check-not-false (task-done (search-hit-task (second hits))))
    ;; and the demotion does not cost a done node a title hit against an open
    ;; node matched on its note
    (define fd3
      (list (list "/tmp/T.rkt"
                  (list (tk "Elsewhere" #:note "about the server")
                        (tk "Ship the server" #:done #t)))))
    (check-equal? (find fd3 "server") '("Ship the server" "Elsewhere")))

  ;; A mirror site is the same node as its defining site — one node, one hit,
  ;; with the trail it was DEFINED at.
  (test-case "a mirrored node is one hit, at the site that defines it"
    (define fd2
      (list (list "/tmp/Tasks.rkt"
                  (list (tk "Work" #:kids (list (tk "Meeting prep" #:id "prep")))))
            (list "/tmp/Week.rkt"
                  (list (tk "Monday" #:kids (list (mirror-ref "prep" #f)))))))
    (define hits (search-outlines fd2 "meeting"))
    (check-equal? (length hits) 1)
    (check-equal? (search-hit-trail (car hits)) '("Work"))
    (check-equal? (search-hit-file (car hits)) "/tmp/Tasks.rkt"))

  ;; ---- ties -------------------------------------------------------------------
  ;;
  ;; Two nodes that score the same come out in the order they are written, and
  ;; not in whichever order a sort happened to take: an answer that moved under
  ;; the cursor between two keystrokes is a search you cannot use a keyboard on.
  (test-case "equal hits keep the order the outline is written in"
    (define fd2
      (list (list "/tmp/T.rkt"
                  (list (tk "Alpha task") (tk "Beta task") (tk "Gamma task")))))
    (check-equal? (find fd2 "task") '("Alpha task" "Beta task" "Gamma task"))))
