#lang racket/base

;; The shared write path. Temp dirs only, never personal data.

(require racket/file
         racket/list
         racket/path
         racket/string
         olai/edit
         olai/load)

(module+ test
  (require rackunit))

(module+ test
  (define (with-temp-dir proc)
    (define dir (make-temporary-file "sfedit~a" 'directory))
    (dynamic-wind void (λ () (proc dir)) (λ () (delete-directory/files dir))))

  (define (write-file! path text)
    (make-parent-directory* path)
    (display-to-file text path #:exists 'truncate/replace))

  (define (leftovers dir)
    (filter (λ (p) (regexp-match? #px"sf-edit|sf-tmp" (path->string p)))
            (directory-list dir)))

  ;; Collect the load-error instead of raising.
  (define (try-edit! path text)
    (try-edits! (list (cons path text))))

  (define (try-edits! edits)
    (define err #f)
    (define applied '())
    (apply-outline-edits! edits
                          #:on-invalid (λ (e) (set! err e))
                          #:on-applied (λ (p) (set! applied (cons p applied))))
    (values err (reverse applied))))

(module+ test
  (test-case "a valid edit is applied atomically and announced"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n")
       (define-values (err applied) (try-edit! f "#lang olai\nInbox\n  Buy milk\n"))
       (check-false err)
       (check-equal? (length applied) 1)
       (check-equal? (file->string f) "#lang olai\nInbox\n  Buy milk\n")
       (check-equal? (leftovers dir) '()))))

  (test-case "an invalid edit leaves the file alone and reports the real file"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (define before "#lang olai\nInbox\n")
       (write-file! f before)
       (define-values (err applied)
         (try-edit! f "#lang olai\nInbox\n  Buy milk\n    @date nope\n"))
       (check-true (load-error? err))
       (check-equal? applied '())
       (check-equal? (file->string f) before)
       (check-equal? (leftovers dir) '())
       ;; the temp file is an implementation detail: it must not surface
       (check-equal? (load-error-file err) (simple-form-path f))
       (check-false (regexp-match? #px"sf-edit" (load-error-message err))
                    (load-error-message err))
       (check-true (number? (load-error-line err)) (format "~a" err)))))

  ;; The regression this module exists for: a fixed <file>.sf-tmp name is a
  ;; module path, so in one long-lived process the SECOND edit used to be
  ;; validated against the FIRST temp file — and anything went through.
  (test-case "a second edit is validated against its own text"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (write-file! f "#lang olai\nInbox\n")
       (define-values (err1 _a1) (try-edit! f "#lang olai\nInbox\n  first\n"))
       (check-false err1)
       (define-values (err2 a2) (try-edit! f "#lang olai\nInbox\n  @date nope\n"))
       (check-true (load-error? err2) "second edit slipped through")
       (check-equal? a2 '())
       (check-equal? (file->string f) "#lang olai\nInbox\n  first\n")
       ;; and a third, valid one still lands
       (define-values (err3 _a3) (try-edit! f "#lang olai\nInbox\n  third\n"))
       (check-false err3)
       (check-true (string-contains? (file->string f) "third")))))

  ;; ---- two files, one write ------------------------------------------------
  ;;
  ;; `archive` moves a node out of one file and into another, so the write path
  ;; has to be able to hold both — and to hold them as the SET they are, which
  ;; is the only scope a pair can be broken in.

  (test-case "two files land together, or neither does"
    (with-temp-dir
     (λ (dir)
       (define a (build-path dir "Tasks.rkt"))
       (define b (build-path dir "Archive.rkt"))
       (write-file! a "#lang olai\nInbox\n  Buy milk\n")
       (write-file! b "#lang olai\n")
       (define-values (err applied)
         (try-edits! (list (cons a "#lang olai\nInbox\n")
                           (cons b "#lang olai\nInbox\n  Buy milk\n"))))
       (check-false err (format "~a" err))
       (check-equal? (length applied) 2)
       (check-equal? (file->string a) "#lang olai\nInbox\n")
       (check-true (string-contains? (file->string b) "Buy milk"))
       ;; and one bad half keeps the other's edit off the disk
       (define before-a (file->string a))
       (define before-b (file->string b))
       (define-values (err2 applied2)
         (try-edits! (list (cons a "#lang olai\nInbox\n  later\n")
                           (cons b "#lang olai\nBroken\n  @date nope\n"))))
       (check-true (load-error? err2))
       (check-equal? applied2 '())
       (check-equal? (file->string a) before-a)
       (check-equal? (file->string b) before-b)
       (check-equal? (leftovers dir) '())
       (check-equal? (load-error-file err2) (simple-form-path b))
       (check-false (regexp-match? #px"sf-edit" (load-error-message err2))
                    (load-error-message err2)))))

  ;; The whole reason the pair is validated together: an ^anchor is unique
  ;; across files, so a name that now exists in both is a failure neither file
  ;; has on its own.
  (test-case "a pair that collides is rejected, though each half loads"
    (with-temp-dir
     (λ (dir)
       (define a (build-path dir "Tasks.rkt"))
       (define b (build-path dir "Archive.rkt"))
       (write-file! a "#lang olai\nShip it ^ship\n")
       (write-file! b "#lang olai\n")
       (define-values (err applied)
         (try-edits! (list (cons a "#lang olai\nShip it ^ship\n")
                           (cons b "#lang olai\nShip it ^ship\n"))))
       (check-true (load-error? err) (format "~a" err))
       (check-equal? applied '())
       (check-true (regexp-match? #px"duplicate \\^ship" (load-error-message err))
                   (load-error-message err))
       (check-false (regexp-match? #px"sf-edit" (load-error-message err))
                    (load-error-message err))
       (check-equal? (leftovers dir) '()))))

  ;; And the rule that stays OPEN: a write is not a load. The mirror below
  ;; names an anchor in a file this write is not touching, which is the whole
  ;; point of cross-file mirrors — refusing it would make every write hostage
  ;; to every other outline in the directory.
  (test-case "a mirror into a file the write does not touch is not its problem"
    (with-temp-dir
     (λ (dir)
       (define a (build-path dir "Daily.rkt"))
       (define b (build-path dir "Archive.rkt"))
       (write-file! (build-path dir "Tasks.rkt") "#lang olai\nMeeting ^meeting\n")
       (write-file! a "#lang olai\n2026-08-06\n")
       (write-file! b "#lang olai\n")
       (define-values (err _applied)
         (try-edits! (list (cons a "#lang olai\n2026-08-06\n  *meeting\n")
                           (cons b "#lang olai\nold\n"))))
       (check-false err (format "~a" err))
       (check-true (string-contains? (file->string a) "*meeting")))))

  (test-case "validation sees the file's @include fragments"
    (with-temp-dir
     (λ (dir)
       (define root (build-path dir "Daily.rkt"))
       (define frag (build-path dir "Daily" "2026-08.rkt"))
       (write-file! frag "#lang olai\n2026-08-04\n")
       (write-file! root "#lang olai\n2026\n")
       ;; the temp sits beside the root, so the relative include resolves
       (define-values (err _a)
         (try-edit! root "#lang olai\n2026\n  August\n    @include Daily/2026-08.rkt\n"))
       (check-false err (format "~a" err))
       (check-true (string-contains? (file->string root) "@include"))
       ;; a missing fragment is a validation failure, not a half-written file
       (define before (file->string root))
       (define-values (err2 _a2)
         (try-edit! root "#lang olai\n2026\n  September\n    @include Daily/nope.rkt\n"))
       (check-true (load-error? err2))
       (check-equal? (file->string root) before)
       (check-equal? (leftovers dir) '())))))
