#lang racket/base

;; DERIVED DONE-NESS: what a parent's state is when it stores none, and the one
;; contradiction it may not be in with what it contains.
;;
;; The rule is olai/lang/state's and is applied in two worlds — to a loaded
;; task (the expander) and to the file under a write's pen (olai/ops) — so both
;; are asked here, plus the three checker entry points the language promises
;; the same message from.

(require json
         racket/file
         racket/list
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/json/model
         olai/lang/link
         olai/lang/state
         olai/load
         olai/ops
         olai/query
         olai/tests/outlines)

(module+ test
  (require rackunit))

(module+ test
  (define (eval-tasks src)
    (define tmp (make-temporary-file "sf-state~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file src tmp #:exists 'truncate)
       (dynamic-require `(file ,(path->string tmp)) 'tasks))
     (λ () (delete-file tmp))))

  ;; The state of a source's top-level nodes, in order.
  (define (states src) (map task-status (eval-tasks src)))

  ;; What loading `src` says, as a message — #f when it loads.
  (define (load-problem src)
    (define tmp (make-temporary-file "sf-state~a.rkt"))
    (dynamic-wind
     void
     (λ ()
       (display-to-file src tmp #:exists 'truncate)
       (define r (try-load-outline tmp))
       (and (load-error? r) (load-error-message r)))
     (λ () (delete-file tmp)))))

;; ---- the rule, on its own ---------------------------------------------------

(module+ test
  (test-case "a mark wins over anything the children say"
    (check-eq? (derive-status 'done '(open open)) 'done)
    (check-eq? (derive-status 'doing '(done done)) 'doing))

  (test-case "nothing to derive from is open"
    (check-eq? (derive-status 'open '()) 'open)
    (check-false (status-derived? 'open '())))

  (test-case "all children done is done, anything else is open"
    (check-eq? (derive-status 'open '(done done)) 'done)
    (check-eq? (derive-status 'open '(done open)) 'open)
    (check-eq? (derive-status 'open '(open open)) 'open))

  ;; The sub-call, spelled out: `[/]` is a claim about somebody's attention and
  ;; is never derived. A parent of an in-flight child is open, not doing.
  (test-case "doing does not propagate"
    (check-eq? (derive-status 'open '(doing open)) 'open)
    (check-eq? (derive-status 'open '(done doing)) 'open))

  (test-case "derived is open plus children, whatever they say"
    (check-true (status-derived? 'open '(done open)))
    (check-true (status-derived? 'open '(done done)))
    (check-false (status-derived? 'done '(done done)))))

;; ---- the rule, over a loaded tree -------------------------------------------

(module+ test
  (test-case "a statusless parent of all-done children is done"
    (check-equal?
     (states "#lang olai\nsection\n  [x] a\n  [x] b\n")
     '(done)))

  (test-case "one open child leaves the parent open"
    (check-equal?
     (states "#lang olai\nsection\n  [x] a\n  b\n")
     '(open)))

  (test-case "it nests: a middle node that derives done counts as done"
    (check-equal?
     (states "#lang olai\ntop\n  middle\n    [x] a\n    [x] b\n  [x] c\n")
     '(done)))

  (test-case "a leaf keeps the state it wrote, and no other"
    (check-equal?
     (states "#lang olai\nplain\n[x] marked\n[/] started\n")
     '(open done doing)))

  ;; A mirror site is a reference, not containment: it has no state to lend a
  ;; parent, and counting one would make this module answer differently from
  ;; the linker.
  (test-case "a mirror child derives nothing"
    (in-dir
     "olai-state-mirror"
     (λ (dir)
       (define t (write-outline dir "Tasks.rkt"
                                "#lang olai\n[x] done work ^dw\n"))
       (define d (write-outline dir "Daily.rkt"
                                "#lang olai\nday\n  *dw\n"))
       (define lk (linked-or-fail (load-set (list t d))))
       (define day (car (outline-tasks (cadr (linked-outlines lk)))))
       (check-eq? (task-status day) 'open))))

  (test-case "an @include splices the children a parent derives from"
    (in-dir
     "olai-state-include"
     (λ (dir)
       (write-outline dir "Frag.rkt" "#lang olai\n[x] one\n[x] two\n")
       (define root
         (write-outline dir "Root.rkt"
                        "#lang olai\nmonth\n  @include Frag.rkt\n"))
       (define lk (linked-or-fail (load-set (list root))))
       (check-eq? (task-status (car (outline-tasks (car (linked-outlines lk)))))
                  'done)))))

;; ---- the contradiction, from every entry point ------------------------------

(module+ test
  ;; Compile time, over one module's syntax: no @include anywhere, so the pass
  ;; that reads the forms is the one that answers.
  (test-case "a done parent above an open child is refused at compile time"
    (define msg (load-problem "#lang olai\n\nkitchen\n  [x] install\n    tiles\n"))
    (check-true (and msg (string-contains? msg "@done: marked done above unfinished work"))
                msg)
    (check-true (and msg (string-contains? msg "\"tiles\" is open")) msg)
    ;; the srcloc is the OFFENDING form: the parent that stored the mark
    (check-true (and msg (string-contains? msg ":4:2")) msg))

  ;; The same rule after a splice, where there is no syntax left — the node
  ;; carries its own srcloc, and the message is the same sentence.
  (test-case "the spliced tree is checked the same way, with the same message"
    (in-dir
     "olai-state-splice"
     (λ (dir)
       (write-outline dir "Frag.rkt" "#lang olai\nloose end\n")
       (define root
         (write-outline dir "Root.rkt"
                        "#lang olai\n\n[x] shipped\n  @include Frag.rkt\n"))
       (define r (try-load-outline root))
       (check-true (load-error? r))
       (check-true (string-contains? (load-error-message r)
                                     "marked done above unfinished work")
                   (load-error-message r))
       (check-true (string-contains? (load-error-message r) "\"loose end\" is open")
                   (load-error-message r))
       (check-equal? (load-error-line r) 3))))

  ;; And the LINKER, the third entry point, asked directly: no outline on disk
  ;; can reach it (a module that would fail this fails while it loads), and the
  ;; promise is that every entry point says the same thing — so the rule has to
  ;; be there whether or not a file can get to it.
  (test-case "the linker refuses it over the loaded set"
    (define kid (make-task #:title "loose end"))
    (define parent
      (make-task #:title "shipped" #:done #t #:children (list kid)))
    (define e
      (with-handlers ([exn:fail:syntax? values])
        (link-anchors (list parent))
        #f))
    (check-pred exn:fail:syntax? e)
    (check-true (string-contains? (exn-message e)
                                  "marked done above unfinished work")
                (exn-message e)))

  (test-case "a done parent whose children are all done is fine"
    (check-false (load-problem "#lang olai\nkitchen\n  [x] a\n  [x] b\n")))

  (test-case "an in-flight parent above open work is nobody's business"
    (check-false (load-problem "#lang olai\n[/] kitchen\n  install\n")))

  ;; More than one is counted, so an agent knows whether one fix is the fix.
  (test-case "three unfinished children name two and count the rest"
    (define msg
      (load-problem "#lang olai\n[x] top\n  a\n  b\n  c\n"))
    (check-true (and msg (string-contains? msg "(and 1 more)")) msg)))

;; ---- what the graph and the JSON make of it ---------------------------------

(module+ test
  ;; ONE done predicate: the typed-edge graph reads the same one, so a
  ;; statusless parent of all-done children stops blocking what is after it.
  (test-case "a derived-done parent blocks nobody"
    (in-dir
     "olai-state-edges"
     (λ (dir)
       (define f
         (write-outline dir "T.rkt"
                        (string-append "#lang olai\n"
                                       "demo ^demo\n  [x] haul\n  [x] sweep\n"
                                       "install ^install\n  @after ^demo\n")))
       (define lk (linked-or-fail (load-set (list f))))
       (check-equal? (blocked-nodes (linked-edges lk)) (hash)))))

  (test-case "status_source tells a derived state from a stored one"
    (define tasks (eval-tasks "#lang olai\nsection\n  [x] a\n  [x] b\n[x] leaf\n"))
    (define section (task->jsexpr (first tasks)))
    (define leaf (task->jsexpr (second tasks)))
    (check-equal? (hash-ref section 'status) "done")
    (check-equal? (hash-ref section 'status_source) "derived")
    ;; and the stored marks stay exactly what the file wrote
    (check-equal? (hash-ref section 'done) (json-null))
    (check-equal? (hash-ref leaf 'status_source) "stored")
    (check-equal? (hash-ref leaf 'done) #t)))

;; ---- the write path ---------------------------------------------------------
;;
;; A derived state is not a state you can store, and the refusal names what to
;; do instead. Its own failure kind, which the CLI maps to its own exit code.

(module+ test
  (define (mark-failure dir spec #:undo? [undo? #f])
    (with-handlers ([exn:fail:op? values])
      (ops-mark! (build-path dir "Tasks.rkt") 'done spec "2026-08-07"
                 #:undo? undo? #:commit? #f)
      #f))

  (define sample
    (string-append "#lang olai\n"
                   "section ^section\n  [x] a\n  b\n"
                   "shipped ^shipped\n  [x] c\n  [x] d\n"
                   "leaf ^leaf\n"))

  (test-case "done on a statusless parent is refused, naming the open children"
    (in-dir
     "olai-state-write"
     (λ (dir)
       (write-outline dir "Tasks.rkt" sample)
       (define e (mark-failure dir "^section"))
       (check-pred exn:fail:op? e)
       (check-eq? (exn:fail:op-kind e) 'derived)
       (check-true (string-contains? (exn-message e) "derives its done-ness")
                   (exn-message e))
       ;; the children ride in the error object, so nobody parses the sentence
       (define kids (hash-ref (exn:fail:op-detail e) 'children))
       (check-equal? (map (λ (k) (hash-ref k 'title)) kids) '("b"))
       (check-equal? (map (λ (k) (hash-ref k 'status)) kids) '("open"))
       ;; and nothing was written
       (check-false (string-contains? (file->string (build-path dir "Tasks.rkt"))
                                      "@done")))))

  (test-case "done on a parent that already derives done says so"
    (in-dir
     "olai-state-write-alldone"
     (λ (dir)
       (write-outline dir "Tasks.rkt" sample)
       (define e (mark-failure dir "^shipped"))
       (check-eq? (exn:fail:op-kind e) 'derived)
       (check-true (string-contains? (exn-message e) "is already done")
                   (exn-message e))
       (check-equal? (hash-ref (exn:fail:op-detail e) 'children) '()))))

  (test-case "undo has nothing to take off a derived state"
    (in-dir
     "olai-state-write-undo"
     (λ (dir)
       (write-outline dir "Tasks.rkt" sample)
       (define e (mark-failure dir "^shipped" #:undo? #t))
       (check-eq? (exn:fail:op-kind e) 'derived)
       (check-true (string-contains? (exn-message e) "no @done to undo")
                   (exn-message e)))))

  (test-case "a leaf is written as it always was"
    (in-dir
     "olai-state-write-leaf"
     (λ (dir)
       (write-outline dir "Tasks.rkt" sample)
       (check-false (mark-failure dir "^leaf"))
       (check-true (string-contains? (file->string (build-path dir "Tasks.rkt"))
                                     "@done 2026-08-07")))))

  ;; `doing` is not derived from anything, so writing one on a parent stores
  ;; something the tree does not already say.
  (test-case "doing on a parent is still a write"
    (in-dir
     "olai-state-write-doing"
     (λ (dir)
       (write-outline dir "Tasks.rkt" sample)
       (ops-mark! (build-path dir "Tasks.rkt") 'doing "^section" "2026-08-07"
                  #:commit? #f)
       (check-true (string-contains? (file->string (build-path dir "Tasks.rkt"))
                                     "@doing 2026-08-07"))))))
