#lang racket/base

;; The four checks, each against a repository small enough to read.
;;
;; A finding is a message and a place, and both are the contract: the message
;; is what an agent acts on, and the srcloc is how it finds the thing to act
;; on. So every case here asserts the rule line, the facts under it, and the
;; file:line the finding points at.

(require racket/list
         racket/path
         racket/string
         arch/check
         arch/finding
         arch/tests/tree)

(module+ test
  (require rackunit))

(define (findings dir #:window [window 30])
  (report-findings (audit dir #:window window)))

;; The one finding a case is about — a fixture with two is a fixture that has
;; stopped being an example.
(define (only-finding dir #:window [window 30])
  (define fs (findings dir #:window window))
  (unless (= 1 (length fs))
    (error 'only-finding "expected one finding, got ~a:\n~a"
           (length fs)
           (string-join (for/list ([f (in-list fs)]) (finding->string f dir)) "\n")))
  (car fs))

(define (rule f) (finding-rule f))
(define (why f) (string-join (finding-why f) "\n"))
(define (at f dir)
  (list (path->string (find-relative-path (simple-form-path dir)
                                          (simple-form-path (srcloc-source (finding-loc f)))))
        (srcloc-line (finding-loc f))))

;; ---- 1: dependencies point volatile -> stable ------------------------------------

(module+ test
  (test-case "a stable module requiring a volatile one"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/grammar.rkt" "#lang racket/base\n(require \"../view/draw.rkt\")\n")
           (cons "view/arch.rkt" "#lang arch\n(clock volatile)\n(owns)\n")
           (cons "view/draw.rkt" "#lang racket/base\n"))
     (λ (dir)
       (define f (only-finding dir))
       (check-equal? (rule f) "requires view/draw.rkt: dependency points the wrong way")
       (check-true (string-contains? (why f) "core/grammar.rkt is declared stable (core/arch.rkt:2)"))
       (check-true (string-contains? (why f) "view/draw.rkt is declared volatile (view/arch.rkt:2)"))
       (check-true (string-contains? (why f) "stable code must not depend on volatile code"))
       ;; the require spec, not the module
       (check-equal? (at f dir) (list "core/grammar.rkt" 2)))))

  (test-case "the same edge the other way round is fine"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/grammar.rkt" "#lang racket/base\n")
           (cons "view/arch.rkt" "#lang arch\n(clock volatile)\n(owns)\n")
           (cons "view/draw.rkt" "#lang racket/base\n(require \"../core/grammar.rkt\")\n"))
     (λ (dir) (check-equal? (findings dir) '()))))

  (test-case "a module with no arch.rkt above it is nobody's dependency to police"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/grammar.rkt" "#lang racket/base\n(require \"../loose/thing.rkt\")\n")
           (cons "loose/thing.rkt" "#lang racket/base\n"))
     (λ (dir) (check-equal? (findings dir) '())))))

;; ---- 2: authority used only where owned -----------------------------------------

(module+ test
  (test-case "reaching for the filesystem without owning it"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/reader.rkt"
                 "#lang racket/base\n(require racket/file)\n(define (peek p)\n  (file->string p))\n"))
     (λ (dir)
       (define f (only-finding dir))
       (check-equal? (rule f) "file->string: ambient authority `filesystem` is not owned here")
       (check-true (string-contains? (why f) "core/reader.rkt owns: (none)"))
       (check-true (string-contains? (why f) "filesystem is owned by: nobody"))
       (check-true (string-contains? (why f) "take what you need as an argument"))
       (check-equal? (at f dir) (list "core/reader.rkt" 4)))))

  (test-case "an authority that is owned is not a finding"
    (call-with-tree
     (list (cons "core/arch.rkt"
                 "#lang arch\n(clock stable)\n(owns)\n(override \"reader.rkt\" (owns filesystem))\n")
           (cons "core/reader.rkt" "#lang racket/base\n(require racket/file)\n(define (peek p) (file->string p))\n"))
     (λ (dir) (check-equal? (findings dir) '()))))

  (test-case "a name taken as an argument is not a clock read"
    ;; the rule this whole check exists for: pure logic takes `today` as an
    ;; argument, and the argument must not read as the thing it replaces
    (call-with-tree
     (list (cons "core/arch.rkt"
                 (string-append "#lang arch\n(clock stable)\n(owns)\n"
                                "(override \"dates.rkt\" (owns clock))\n"))
           (cons "core/dates.rkt"
                 "#lang racket/base\n(provide today)\n(define (today) (current-seconds))\n")
           (cons "core/agenda.rkt"
                 (string-append "#lang racket/base\n(require \"dates.rkt\")\n"
                                "(define (overdue? day today) (string<? day today))\n")))
     (λ (dir) (check-equal? (findings dir) '()))))

  (test-case "an authority handed on under another name"
    (call-with-tree
     (list (cons "core/arch.rkt"
                 (string-append "#lang arch\n(clock stable)\n(owns)\n"
                                "(override \"dates.rkt\" (owns (clock \"today-string\")))\n"))
           (cons "core/dates.rkt"
                 (string-append "#lang racket/base\n(provide today-string)\n"
                                "(define (today-string) (number->string (current-seconds)))\n"))
           (cons "core/agenda.rkt"
                 (string-append "#lang racket/base\n(require \"dates.rkt\")\n"
                                "(define (now) (today-string))\n")))
     (λ (dir)
       (define f (only-finding dir))
       (check-equal? (rule f) "today-string: ambient authority `clock` is not owned here")
       (check-true (string-contains? (why f) "clock is owned by: core/dates.rkt"))
       (check-equal? (at f dir) (list "core/agenda.rkt" 3)))))

  (test-case "a spelling nothing exports is a rule that applies to nobody"
    (call-with-tree
     (list (cons "core/arch.rkt"
                 (string-append "#lang arch\n(clock stable)\n(owns)\n"
                                "(override \"dates.rkt\" (owns (clock \"today-strng\")))\n"))
           (cons "core/dates.rkt"
                 (string-append "#lang racket/base\n(provide today-string)\n"
                                "(define (today-string) (number->string (current-seconds)))\n")))
     (λ (dir)
       (define f (only-finding dir))
       (check-equal? (rule f) "today-strng: not an export of core/dates.rkt")
       (check-true (string-contains? (why f) "a name nothing exports is a rule that applies to nobody"))
       (check-equal? (at f dir) (list "core/arch.rkt" 4))))))

;; ---- 3: one owner per concept -----------------------------------------------------

(module+ test
  (test-case "a second module exporting into somebody else's concept"
    (call-with-tree
     (list (cons "core/arch.rkt"
                 (string-append "#lang arch\n(clock stable)\n(owns)\n"
                                "(override \"load.rkt\" (concept node-key-minting \"mint-*\"))\n"))
           (cons "core/load.rkt" "#lang racket/base\n(provide mint-keys)\n(define (mint-keys t) t)\n")
           (cons "view/arch.rkt" "#lang arch\n(clock volatile)\n(owns)\n")
           (cons "view/draw.rkt"
                 (string-append "#lang racket/base\n(provide mint-key*)\n"
                                "\n\n(define (mint-key* n) n)\n")))
     (λ (dir)
       (define f (only-finding dir))
       (check-equal? (rule f) "mint-key*: exports into concept `node-key-minting`")
       (check-true (string-contains? (why f) "that concept is owned by core/load.rkt (core/arch.rkt:4)"))
       (check-true (string-contains? (why f) "the pattern it matched: \"mint-*\""))
       (check-true (string-contains? (why f) "one owner per concept"))
       ;; the definition, not the provide
       (check-equal? (at f dir) (list "view/draw.rkt" 5)))))

  (test-case "a re-export is not a second owner"
    (call-with-tree
     (list (cons "core/arch.rkt"
                 (string-append "#lang arch\n(clock stable)\n(owns)\n"
                                "(override \"load.rkt\" (concept node-key-minting \"mint-*\"))\n"))
           (cons "core/load.rkt" "#lang racket/base\n(provide mint-keys)\n(define (mint-keys t) t)\n")
           (cons "core/facade.rkt"
                 "#lang racket/base\n(require \"load.rkt\")\n(provide (all-from-out \"load.rkt\"))\n"))
     (λ (dir) (check-equal? (findings dir) '()))))

  (test-case "two packages claiming one concept"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n(concept keys \"mint-*\")\n")
           (cons "core/load.rkt" "#lang racket/base\n")
           (cons "view/arch.rkt" "#lang arch\n(clock volatile)\n(owns)\n(concept keys \"key-*\")\n")
           (cons "view/draw.rkt" "#lang racket/base\n"))
     (λ (dir)
       (define f (only-finding dir))
       (check-equal? (rule f) "keys: a concept claimed twice")
       (check-true (string-contains? (why f) "one owner per concept, and two claimants is no owner at all"))))))

;; ---- 4: the declaration against the history ------------------------------------------

(module+ test
  (test-case "declared stable, and the history disagrees"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/busy.rkt" "#lang racket/base\n")
           (cons "core/calm.rkt" "#lang racket/base\n"))
     (λ (dir)
       ;; ten commits, eight of them touching busy.rkt: over stable's fifth
       (git-history! dir (append (for/list ([_ (in-range 8)]) (list "core/busy.rkt"))
                                 (for/list ([_ (in-range 2)]) (list "core/calm.rkt"))))
       (define f (only-finding dir #:window 10))
       (check-equal? (rule f) "core/busy.rkt: declared stable, changed in 8 of the last 10 commits")
       (check-true (string-contains? (why f) "stable allows up to 2 of 10"))
       (check-true (string-contains? (why f) "either the code settles or the declaration changes"))
       ;; the clock word that is the lie
       (check-equal? (at f dir) (list "core/arch.rkt" 2)))))

  (test-case "volatile has no ceiling"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock volatile)\n(owns)\n")
           (cons "core/busy.rkt" "#lang racket/base\n"))
     (λ (dir)
       (git-history! dir (for/list ([_ (in-range 6)]) (list "core/busy.rkt")))
       (check-equal? (findings dir #:window 6) '()))))

  (test-case "no history is said out loud, and the other checks still run"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/busy.rkt" "#lang racket/base\n"))
     (λ (dir)
       (define r (audit dir))
       (check-equal? (report-findings r) '())
       (check-equal? (length (report-notes r)) 1)
       (check-true (string-contains? (car (report-notes r)) "no git history here"))))))

;; ---- how a finding prints -------------------------------------------------------------

(module+ test
  (test-case "a finding prints as where, then the rule, then why"
    (call-with-tree
     (list (cons "core/arch.rkt" "#lang arch\n(clock stable)\n(owns)\n")
           (cons "core/reader.rkt"
                 "#lang racket/base\n(require racket/file)\n(define (peek p) (file->string p))\n"))
     (λ (dir)
       (define lines (string-split (finding->string (only-finding dir) dir) "\n"))
       (check-equal? (car lines)
                     "core/reader.rkt:3:18: file->string: ambient authority `filesystem` is not owned here")
       (check-true (andmap (λ (l) (string-prefix? l "  ")) (cdr lines)))))))
