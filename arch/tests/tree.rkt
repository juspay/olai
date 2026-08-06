#lang racket/base

;; A whole repository, three files long.
;;
;; The checker's subject is a DIRECTORY: declarations beside modules, modules
;; requiring each other, sometimes a git history over the lot. So the fixtures
;; are directories, written into a temp dir and deleted after — nothing
;; committed, because a committed fixture that is meant to FAIL a check is a
;; fixture the real `just arch` run would then trip over.

(require racket/contract
         racket/file
         racket/list
         racket/path
         racket/port
         racket/string)

(provide (contract-out
          [call-with-tree (-> (listof (cons/c string? string?)) (-> path? any) any)]
          [git-history! (-> path? (listof (listof string?)) void?)]))

;; files : ("olai/arch.rkt" . "#lang arch\n(clock stable)\n") — in order, so a
;; declaration can name a module the list writes later.
(define (call-with-tree files proc)
  (define dir (make-temporary-directory))
  (dynamic-wind
   (λ ()
     (for ([f (in-list files)])
       (define target (build-path dir (car f)))
       (make-parent-directory* target)
       (display-to-file (cdr f) target #:exists 'replace)))
   (λ () (proc dir))
   (λ () (delete-directory/files dir #:must-exist? #f))))

;; One commit per element, each naming the files it touched. The content it
;; writes does not matter — the churn audit counts commits, not diffs — so this
;; appends a line and commits.
;;
;; Identity comes from -c flags: a test must not depend on whose machine it is
;; running on, and must not care whether that machine has a git identity at all.
(define (git-history! dir commits)
  (git! dir "init" "--quiet" "--initial-branch" "main")
  ;; The tree as it stands goes in first, on its own. Otherwise the first
  ;; listed commit would carry every fixture file along with it and every
  ;; module in the fixture would show one change it did not ask for.
  (git! dir "add" "--all")
  (git! dir "-c" "user.email=arch@example.invalid" "-c" "user.name=arch"
        "commit" "--quiet" "--message" "the tree")
  (for ([touched (in-list commits)] [n (in-naturals)])
    (for ([f (in-list touched)])
      (define target (build-path dir f))
      (make-parent-directory* target)
      (call-with-output-file target #:exists 'append
        (λ (out) (fprintf out "\n;; commit ~a\n" n))))
    (git! dir "add" "--all")
    (git! dir "-c" "user.email=arch@example.invalid" "-c" "user.name=arch"
          "commit" "--quiet" "--message" (format "commit ~a" n))))

(define (git! dir . args)
  (define git (find-executable-path "git"))
  (unless git (error 'git-history! "no git on PATH"))
  (define-values (sp out in err)
    (apply subprocess #f #f #f git "-C" (path->string dir) args))
  (close-output-port in)
  (define trouble (string-append (port->string out) (port->string err)))
  (subprocess-wait sp)
  (close-input-port out)
  (close-input-port err)
  (unless (zero? (subprocess-status sp))
    (error 'git-history! "git ~a failed: ~a" (string-join args " ") trouble)))
