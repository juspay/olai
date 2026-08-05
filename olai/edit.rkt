#lang racket/base

;; The one write path for outline files.
;;
;; Every mutation is the same three steps: write the new text beside the file,
;; validate it (the expander is the only validator), rename over the original.
;; Doing that inline was fine in a CLI process that exits right after — but a
;; FIXED <file>.sf-tmp name is a module path, and the module registry caches
;; it, so the SECOND edit in a long-lived process validates the FIRST temp
;; file and waves anything through. A unique name per edit plus the store's
;; fresh namespace fix that, and having one function means the CLI commands
;; and the coming web mutations cannot drift apart.

(require racket/contract
         racket/file
         racket/path
         racket/port
         racket/string
         olai/fail
         olai/load
         olai/store)

;; The callbacks are part of this contract: #:on-invalid is handed a
;; load-error and #:on-applied the path that was replaced — a caller that
;; expects the other shape finds out here, not after the rename.
(provide (contract-out
          [apply-outline-edit!
           (->* ((or/c path? string?) string?)
                (#:on-invalid (-> load-error? any)
                 #:on-applied (-> path? any))
                boolean?)]
          [try-git-commit
           (-> (or/c path? string? (listof (or/c path? string?))) string? boolean?)]))

;; Replace `path` with `text`, but only if `text` still validates.
;;
;;   #:on-invalid  called with a load-error when it does not; the file on disk
;;                 is untouched and nothing is left behind. file/line/col point
;;                 at `path` — the temp file is an implementation detail and
;;                 must never reach an agent's JSON.
;;   #:on-applied  called with `path` after the rename: where a store hooks its
;;                 invalidation.
;;
;; -> #t when applied, #f when rejected (if on-invalid returns at all).
;; I/O failures raise; the caller reports them as it likes.
(define (apply-outline-edit! path text
                             #:on-invalid [on-invalid default-invalid]
                             #:on-applied [on-applied void])
  (define full (simple-form-path path))
  (guard-sexp-file! full)
  ;; Same directory, always: rename is atomic only within one filesystem, and
  ;; a file's @include paths resolve relative to the file being validated.
  (define tmp (make-temporary-file "sf-edit~a.rkt" #f (path-only full)))
  (define (discard!)
    (when (file-exists? tmp) (delete-file tmp)))
  (with-handlers ([(λ (_e) #t) (λ (e) (discard!) (raise e))])
    (display-to-file text tmp #:exists 'truncate/replace))
  (define err
    (with-handlers ([exn:fail? (λ (e) (edit-error e tmp full))])
      (call-in-outline-namespace
       (λ () (dynamic-require `(file ,(path->string tmp)) 'tasks)))
      #f))
  (cond
    [err (discard!) (on-invalid err) #f]
    [else
     (rename-file-or-directory tmp full #t)
     (on-applied full)
     #t]))

;; Every writer emits outline syntax, so a #lang olai/sexp file would be
;; rewritten into a different language. Refuse here rather than in each
;; command: the write path is where the rule can actually be enforced.
(define (guard-sexp-file! full)
  (when (and (file-exists? full)
             (regexp-match? #px"(?m:^#lang olai/sexp)" (file->string full)))
    (user-fail
     "~a is #lang olai/sexp; writes emit outline syntax (#lang olai)"
     full)))

;; Auto-commit what a write applied — one path or several (an edit that lands
;; in a fragment and its root is still one change). Only fires inside a git
;; work tree; a Dropbox-only home no-ops (#f).
(define (try-git-commit path-or-paths message)
  (define paths
    (if (list? path-or-paths) path-or-paths (list path-or-paths)))
  (define git (find-executable-path "git"))
  (cond
    [(null? paths) #f]
    [(not git) #f]
    [else
     (define dir (path-only (path->complete-path (car paths))))
     (define fulls
       (for/list ([p (in-list paths)])
         (path->string (path->complete-path p))))
     (define (git-run . args)
       (define-values (sp out in err)
         (apply subprocess #f #f #f git args))
       (close-output-port in)
       (void (port->string out))
       (void (port->string err))
       (close-input-port out)
       (close-input-port err)
       (subprocess-wait sp)
       (subprocess-status sp))
     (define-values (sp out in err)
       (subprocess #f #f #f git "-C" (path->string dir)
                   "rev-parse" "--show-toplevel"))
     (close-output-port in)
     (define _top (port->string out))
     (close-input-port out)
     (close-input-port err)
     (subprocess-wait sp)
     (cond
       [(not (zero? (subprocess-status sp))) #f]
       [else
        (and (zero? (apply git-run "-C" (path->string dir) "add" "--" fulls))
             (zero? (apply git-run "-C" (path->string dir) "commit"
                           "-m" message "--" fulls)))])]))

;; The exn talks about the temp file; the user edited `path`.
(define (edit-error e tmp path)
  (define-values (src line col) (exn-location e tmp))
  (define at (path->string tmp))
  (load-error (string-replace (exn-message e) at (path->string path))
              path
              line
              col))

(define (default-invalid err)
  (user-fail "~a" (load-error-message err)))
