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

(require racket/file
         racket/path
         racket/string
         selfflowy/load
         selfflowy/store)

(provide apply-outline-edit!)

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

;; The exn talks about the temp file; the user edited `path`.
(define (edit-error e tmp path)
  (define-values (src line col) (exn-location e tmp))
  (define at (path->string tmp))
  (load-error (string-replace (exn-message e) at (path->string path))
              path
              line
              col))

(define (default-invalid err)
  (error 'outline "~a" (load-error-message err)))
