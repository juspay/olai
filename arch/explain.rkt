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
         racket/list
         racket/path
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
  (define (label p) (path-label p root))
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
     (define decl (declaration-for (scope-declaration s) (scope-relative s module)))
     (string-join
      (append
       (list (format "~a" (label module))
             (row "governed by" (label (scope-file s)))
             (row "clock"
                  (format "~a~a"
                          (pad (format "~a" (effective-clock decl)) 19)
                          (origin-of (effective-module decl)
                                     (and (effective-module decl)
                                          (module-decl-clock (effective-module decl)))
                                     (effective-clock-loc decl)
                                     label))))
       (owns-rows decl label)
       (concept-rows decl label)
       (list (churn-row module decl history))
       (requires-rows module scopes label))
      "\n")]))

(define (row name value)
  (format "  ~a ~a" (pad name 12) value))

(define (pad s n)
  (string-append s (make-string (max 1 (- n (string-length s))) #\space)))

;; Which file said it, and whether it said it about this module or about the
;; whole package.
(define (origin-of over from-override? loc label)
  (format "~a:~a ~a"
          (label (srcloc-source loc)) (or (srcloc-line loc) "?")
          (if (and over from-override?)
              (format "(override ~s)" (module-decl-file over))
              "(package default)")))

(define (owns-rows decl label)
  (define over (effective-module decl))
  (define own (if over (module-decl-grants over) '()))
  (define grants (effective-grants decl))
  (cond
    [(null? grants) (list (row "owns" "nothing"))]
    [else
     (for/list ([g (in-list grants)] [i (in-naturals)])
       (row (if (zero? i) "owns" "")
            (format "~a~a"
                    (pad (format "~a~a" (grant-authority g) (spelling-note g)) 19)
                    (origin-of over (memq g own) (grant-loc g) label))))]))

(define (spelling-note g)
  (if (null? (grant-spellings g))
      ""
      (format " (~a)" (string-join (grant-spellings g) ", "))))

(define (concept-rows decl label)
  (for/list ([c (in-list (effective-claims decl))] [i (in-naturals)])
    (row (if (zero? i) "concepts" "")
         (format "~a~a"
                 (pad (format "~a ~a" (claim-concept c)
                              (string-join (for/list ([g (in-list (claim-globs c))]) (format "~s" g)) " "))
                      19)
                 (format "~a:~a" (label (srcloc-source (claim-loc c)))
                         (or (srcloc-line (claim-loc c)) "?"))))))

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
(define (requires-rows module scopes label)
  (define deps
    (sort
     (remove-duplicates
      (for*/list ([entry (in-list (source-requires (read-source module)))]
                  [dep (in-value (car entry))]
                  #:unless (equal? dep module)
                  [d (in-value (declaration-of scopes dep))]
                  #:when d)
        (format "~a (~a)" (label dep) (effective-clock d))))
     string<?))
  (if (null? deps)
      (list (row "requires" "nothing else that is declared"))
      (for/list ([d (in-list deps)] [i (in-naturals)])
        (row (if (zero? i) "requires" "") d))))
