#lang racket/base

;; `just arch` — the checker, from a terminal.
;;
;;   just arch                              check the tree
;;   just arch --explain olai/web/watch.rkt one module's effective declaration
;;   just arch --window 60                  audit a longer stretch of history
;;
;; Plain text, not JSON, and deliberately: this is a developer tool in the same
;; family as `just expand`, its whole output is a rule and how to satisfy it,
;; and the reader — human or agent — wants the sentence, not a field. The olai
;; CLI is the surface that answers in JSON, because it is the one with a
;; contract.
;;
;; Exit status is the contract here: 0 when the tree agrees with what it says
;; about itself, 1 when it does not.

(require racket/cmdline
         racket/list
         racket/path
         racket/string
         arch/check
         arch/churn
         arch/explain
         arch/finding
         arch/scope)

(module+ main
  (define window default-churn-window)
  (define target #f)
  (define root
    (command-line
     #:program "arch"
     #:once-each
     [("--explain") file "Print one module's effective declaration and stop"
                    (set! target file)]
     [("--window") n "Commits of history the churn audit reads (default 30)"
                   (set! window (string->number n))]
     #:args ([dir "."])
     dir))
  (unless (and (exact-integer? window) (positive? window))
    (raise-user-error 'arch "--window takes a positive number of commits"))
  (define here (simple-form-path (string->path root)))
  (exit (if target (run-explain here target window) (run-check here window))))

(define (run-explain root file window)
  (define scopes (find-scopes root))
  (displayln (explain (path->complete-path (simplify-path (string->path file)))
                      scopes
                      (read-churn root window)
                      root))
  0)

(define (run-check root window)
  (define r (audit root #:window window))
  (for ([f (in-list (report-findings r))])
    (displayln (finding->string f root))
    (newline))
  (for ([n (in-list (report-notes r))])
    (eprintf "arch: ~a\n" n))
  (define modules (length (report-sites r)))
  (define packages (length (report-scopes r)))
  (cond
    [(null? (report-findings r))
     (printf "arch: ~a modules in ~a declared packages — the tree agrees with itself\n"
             modules packages)
     0]
    [else
     (printf "arch: ~a finding~a across ~a modules in ~a declared packages\n"
             (length (report-findings r))
             (if (= 1 (length (report-findings r))) "" "s")
             modules packages)
     1]))
