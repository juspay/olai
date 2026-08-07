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
;; load-error and #:on-applied each path that was replaced — a caller that
;; expects the other shape finds out here, not after the rename.
(provide (contract-out
          [apply-outline-edit!
           (->* ((or/c path? string?) string?)
                (#:on-invalid (-> load-error? any)
                 #:on-applied (-> path? any))
                boolean?)]
          [apply-outline-edits!
           (->* ((listof (cons/c (or/c path? string?) string?)))
                (#:on-invalid (-> load-error? any)
                 #:on-applied (-> path? any))
                boolean?)]
          [try-git-commit
           (-> (or/c path? string? (listof (or/c path? string?))) string? boolean?)]))

;; Replace `path` with `text`, but only if `text` still validates. The one-file
;; case of the one below, which is what every write but `archive` is.
(define (apply-outline-edit! path text
                             #:on-invalid [on-invalid default-invalid]
                             #:on-applied [on-applied void])
  (apply-outline-edits! (list (cons path text))
                        #:on-invalid on-invalid
                        #:on-applied on-applied))

;; Replace each `(path . text)`, but only if they ALL still validate — and
;; validate as the set they are, so a pair that is broken in a way neither half
;; is (an ^anchor that now exists twice) is caught before either file moves.
;;
;;   #:on-invalid  called with a load-error when they do not; the files on disk
;;                 are untouched and nothing is left behind. file/line/col point
;;                 at the real paths — the temp files are an implementation
;;                 detail and must never reach an agent's JSON.
;;   #:on-applied  called with each path after its rename: where a store hooks
;;                 its invalidation, and where a caller collects what to commit.
;;
;; -> #t when applied, #f when rejected (if on-invalid returns at all).
;; I/O failures raise; the caller reports them as it likes.
(define (apply-outline-edits! edits
                              #:on-invalid [on-invalid default-invalid]
                              #:on-applied [on-applied void])
  (define fulls (for/list ([e (in-list edits)]) (simple-form-path (car e))))
  (for ([full (in-list fulls)]) (guard-sexp-file! full))
  ;; Same directory as the file it will replace, always: rename is atomic only
  ;; within one filesystem, and a file's @include and @doc paths resolve
  ;; relative to the file being validated.
  (define tmps
    (for/list ([full (in-list fulls)])
      (make-temporary-file "sf-edit~a.rkt" #f (path-only full))))
  (define (discard!)
    (for ([tmp (in-list tmps)])
      (when (file-exists? tmp) (delete-file tmp))))
  (with-handlers ([(λ (_e) #t) (λ (e) (discard!) (raise e))])
    (for ([tmp (in-list tmps)] [e (in-list edits)])
      (display-to-file (cdr e) tmp #:exists 'truncate/replace)))
  (define err
    (with-handlers ([exn:fail? (λ (e) (exn->load-error e (car fulls)))])
      (call-in-outline-namespace (λ () (check-written tmps)))))
  (cond
    [err (discard!) (on-invalid (as-written err tmps fulls)) #f]
    [else
     (for ([tmp (in-list tmps)] [full (in-list fulls)])
       (rename-file-or-directory tmp full #t)
       (on-applied full))
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

;; The error talks about a temp file; the user edited the file it stands in
;; for. Every mention of one — the srcloc it carries and every spelling inside
;; the message — is put back, so what reaches an agent's JSON names a file it
;; can open.
(define (as-written err tmps fulls)
  (define (rebase-path f)
    (or (for/or ([tmp (in-list tmps)] [full (in-list fulls)])
          (and f (equal? (path->string (simple-form-path f)) (path->string tmp))
               full))
        f))
  (load-error (for/fold ([m (load-error-message err)])
                        ([tmp (in-list tmps)] [full (in-list fulls)])
                (string-replace m (path->string tmp) (path->string full)))
              (rebase-path (load-error-file err))
              (load-error-line err)
              (load-error-col err)))

(define (default-invalid err)
  (user-fail "~a" (load-error-message err)))
