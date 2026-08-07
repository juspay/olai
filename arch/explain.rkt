#lang racket/base

;; What one module's declaration comes to, after the package default and its
;; own override.
;;
;; A declaration a reader cannot see through is a declaration they argue with
;; from memory. The composition here is small — a clock replaced, two lists
;; appended — and it is still two files away from the module it is about, so
;; the dump is part of the interface and not a debugging convenience. Same
;; reason `just expand` prints what a live form becomes.
;;
;;   $ just arch --explain olai/web/watch.rkt
;;   olai/web/watch.rkt
;;     governed by  olai/web/arch.rkt
;;     clock        volatile           olai/web/arch.rkt:29 (package default)
;;     owns         clock              olai/web/arch.rkt:44 (override "watch.rkt")
;;                  filesystem-events  olai/web/arch.rkt:44 (override "watch.rkt")
;;     churn        1 of the last 30 commits — volatile has no ceiling
;;     requires     olai/store.rkt (settling)

(require racket/contract
         racket/format
         racket/list
         racket/string
         arch/churn
         arch/decl
         arch/finding
         arch/scope
         arch/source
         arch/vocabulary)

(provide (contract-out
          [explain (-> path? (listof scope?) (or/c churn? #f) path? string?)]))

(define (explain module scopes history root)
  (define label (make-labeller root))
  (define s (governing scopes module))
  (cond
    [(not s)
     (string-join
      (list (format "~a" (label module))
            "  governed by  nothing"
            "  no arch.rkt sits above this module, so no check applies to it"
            "  put one beside it, or move the module into a package that has one")
      "\n")]
    [else
     (define decl (effective-for s module))
     (define over (effective-module decl))
     (string-join
      (append
       (list (format "~a" (label module))
             (row "governed by" (label (scope-file s)))
             (row "clock"
                  (said (format "~a" (effective-clock decl))
                        (origin-of (and over (module-decl-clock over) over)
                                   (effective-clock-loc decl) label))))
       (rows "owns"
             (for/list ([g (in-list (effective-grants decl))])
               (said (format "~a~a" (grant-authority g) (spelling-note g))
                     (origin-of (and (memq g (own-grants over)) over) (grant-loc g) label)))
             #:empty "nothing")
       (rows "concepts"
             (for/list ([c (in-list (effective-claims decl))])
               (said (format "~a ~a" (claim-concept c)
                             (string-join (map (λ (g) (format "~s" g)) (claim-globs c)) " "))
                     (loc-brief (claim-loc c) label))))
       (list (churn-row module decl history))
       (rows "requires" (dependency-lines module scopes label)
             #:empty "nothing else that is declared"))
      "\n")]))

;; The label sits on the first row and the rest hang under it — one shape for
;; every column, including the empty case, which was three different
;; conventions when each list built its own rows.
(define (rows name values #:empty [empty #f])
  (cond
    [(and (null? values) empty) (list (row name empty))]
    [else (for/list ([v (in-list values)] [i (in-naturals)])
            (row (if (zero? i) name "") v))]))

(define (row name value)
  (format "  ~a ~a" (pad name 12) value))

;; A value and where it came from, in two columns.
(define (said value origin)
  (format "~a~a" (pad value 19) origin))

;; Padded to a column, and always at least one space: a value that overflows
;; its column still has to separate from the next one.
(define (pad s n)
  (~a s " " #:min-width n))

;; Which file said it, and whether it said it about this module or about the
;; whole package. `over` is the override to attribute it to, or #f — the two
;; are one fact, and asking for them separately meant a reader had to check
;; that the second could not contradict the first.
(define (origin-of over loc label)
  (format "~a ~a"
          (loc-brief loc label)
          (if over (format "(override ~s)" (module-decl-file over)) "(package default)")))

(define (own-grants over) (if over (module-decl-grants over) '()))

(define (spelling-note g)
  (if (null? (grant-spellings g))
      ""
      (format " (~a)" (string-join (grant-spellings g) ", "))))

(define (churn-row module decl history)
  (cond
    [(not history) (row "churn" "no git history here — the audit did not run")]
    [else
     (define window (churn-window history))
     (define allowed (clock-allows (effective-clock decl) window))
     (row "churn"
          (format "~a of the last ~a commits — ~a"
                  (churn-count history module)
                  window
                  (if allowed
                      (format "~a allows up to ~a" (effective-clock decl) allowed)
                      (format "~a has no ceiling" (effective-clock decl)))))]))

;; What it depends on, inside the declared world, and at what clock — the other
;; half of "why is this edge legal".
(define (dependency-lines module scopes label)
  (sort
   (remove-duplicates
    (for*/list ([entry (in-list (source-requires (read-source module)))]
                [dep (in-value (car entry))]
                #:unless (equal? dep module)
                [s (in-value (governing scopes dep))]
                #:when s)
      (format "~a (~a)" (label dep) (effective-clock (effective-for s dep)))))
   string<?))
