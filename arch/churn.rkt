#lang racket/base

;; How often a file actually changed, out of `git log`.
;;
;; This is the only fact in the checker that is not in the tree: a declaration
;; can be read, an import can be resolved, but "settling" is a claim about
;; TIME, and the only record of that is the history. No judgment lives here —
;; the module counts commits, and arch/vocabulary owns what a count means.
;;
;; Git's output format is the volatility this module exists to encapsulate.
;; `--name-only` with a machine-readable pretty format, no porcelain, no
;; parsing of anything a locale could translate.
;;
;; When there is no history to read — no git, a checkout with none of it, a
;; build sandbox — the answer is #f and the audit says so out loud in the
;; report. That is not a waiver: a waiver is a module exempting itself from a
;; rule, and this is the rule having nothing to apply to.

(require racket/contract
         racket/list
         racket/path
         racket/port
         racket/string)

(provide (struct-out churn)
         (contract-out
          [default-churn-window exact-positive-integer?]
          [read-churn (-> path? exact-positive-integer? (or/c churn? #f))]
          [churn-count (-> churn? path? exact-nonnegative-integer?)]))

;; How much history an audit reads unless somebody says otherwise. One number,
;; here rather than in the checker AND the command line, because two defaults
;; for one fact is how they drift apart.
(define default-churn-window 30)

;; window : how many commits were actually read (a young repo has fewer than
;;          were asked for, and the fraction has to be out of what exists)
;; counts : (hash path -> commits touching it), paths absolute and simplified
(struct churn (window counts) #:transparent)

(define (read-churn root window)
  (define git (find-executable-path "git"))
  (define top (and git (git-line git root "rev-parse" "--show-toplevel")))
  (and top
       (let ()
         ;; Paths in the log are relative to the repository, which is not
         ;; necessarily the directory being checked.
         (define repo (path->complete-path (string->path top)))
         (define log (git-lines git root "log" (format "-n~a" window)
                                "--pretty=format:@" "--name-only"))
         (and log
              (let ([counts (make-hash)]
                    [commits 0])
                (for ([line (in-list log)])
                  (cond
                    [(string=? line "@") (set! commits (add1 commits))]
                    [(string=? line "") (void)]
                    [else
                     (define p (simplify-path (build-path repo line) #f))
                     (hash-update! counts p add1 0)]))
                (churn (max commits 1) counts))))))

(define (churn-count c path)
  (hash-ref (churn-counts c) (simplify-path path) 0))

;; ---- talking to git -------------------------------------------------------------

(define (git-lines git dir . args)
  (define-values (sp out in err)
    (apply subprocess #f #f #f git "-C" (path->string (path->complete-path dir)) args))
  (close-output-port in)
  (define lines (port->lines out))
  ;; drained, never read: a subprocess whose stderr pipe fills up stops
  (void (port->string err))
  (subprocess-wait sp)
  (close-input-port out)
  (close-input-port err)
  (and (zero? (subprocess-status sp)) lines))

(define (git-line git dir . args)
  (define lines (apply git-lines git dir args))
  (and lines (pair? lines) (string-trim (car lines))))
