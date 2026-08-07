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
         racket/port
         racket/string
         racket/system)

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
  ;; Paths in the log are relative to the REPOSITORY, which is not necessarily
  ;; the directory being checked. `--show-prefix` says where the one sits
  ;; inside the other, so every path can be rebuilt from `root` — the same path
  ;; the declarations were found under.
  ;;
  ;; Rebuilt from `root` and not from `--show-toplevel` on purpose: git
  ;; resolves symlinks and Racket's `simple-form-path` does not, so on a macOS
  ;; temp directory (`/var/folders/…` against `/private/var/folders/…`) the two
  ;; spellings of one directory would never match and every count would be zero.
  (define prefix (and git (git-first git root "rev-parse" "--show-prefix")))
  (and prefix
       (let ([log (git-lines git root "log" (format "-n~a" window)
                             "--pretty=format:@" "--name-only")])
         (and log
              (let ([counts (make-hash)]
                    [commits 0])
                (for ([line (in-list log)])
                  (cond
                    [(string=? line "@") (set! commits (add1 commits))]
                    [(string=? line "") (void)]
                    [(under-prefix line prefix)
                     => (λ (rel) (hash-update! counts (build-path root rel) add1 0))]
                    [else (void)]))
                (churn (max commits 1) counts))))))

;; A repository-relative path, said relative to the directory being checked —
;; or #f when it is somewhere else in the repository entirely.
(define (under-prefix line prefix)
  (and (string-prefix? line prefix)
       (> (string-length line) (string-length prefix))
       (substring line (string-length prefix))))

(define (churn-count c path)
  (hash-ref (churn-counts c) path 0))

;; ---- talking to git -------------------------------------------------------------

;; `system*` and not `system`: no shell, so nothing in a path is ever a word
;; somebody else gets to parse. `/exit-code` because that is the whole of what
;; this needs to know about failure — a checkout with no repository in it is
;; not an error, it is an audit with nothing to audit.
(define (git-lines git dir . args)
  (define out (open-output-string))
  (define code
    (parameterize ([current-output-port out]
                   ;; drained, never read: a subprocess whose stderr pipe fills
                   ;; up stops
                   [current-error-port (open-output-nowhere)])
      (apply system*/exit-code git "-C" (path->string (path->complete-path dir)) args)))
  (and (zero? code) (string-split (get-output-string out) "\n" #:trim? #f)))

;; The first line, or "" when the command said nothing — which is what
;; `--show-prefix` says from the top of a repository, and is not the same
;; answer as "this is not a repository" (that one is #f).
(define (git-first git dir . args)
  (define lines (apply git-lines git dir args))
  (and lines (if (pair? lines) (string-trim (car lines)) "")))
