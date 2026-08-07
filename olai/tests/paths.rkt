#lang racket/base

;; Which files a directory contributes as roots. One glob (olai/glob) with the
;; pattern already chosen, so this is where the things that answer is supposed
;; to be — sorted, files, no dotfiles — are written down. And what `serve` was
;; POINTED at: one path, a directory or a file, and the three questions asked
;; of it.

(require racket/file
         racket/list
         racket/path
         olai/paths)

(module+ test
  (require rackunit))

(module+ test
  (define (with-temp-dir proc)
    (define dir (make-temporary-file "sfpaths~a" 'directory))
    (dynamic-wind void (λ () (proc dir)) (λ () (delete-directory/files dir))))

  (define (touch! path [text "#lang olai\n"])
    (make-parent-directory* path)
    (display-to-file text path #:exists 'truncate/replace))

  (test-case "dir-roots is the directory's own outlines, sorted"
    (with-temp-dir
     (λ (dir)
       (touch! (build-path dir "Tasks.rkt"))
       (touch! (build-path dir "Daily.rkt"))
       (touch! (build-path dir "notes.md"))
       ;; a fragment lives one level down and is included, never loaded twice
       (touch! (build-path dir "Daily" "2026-08.rkt"))
       ;; and an editor's lock file is not an outline anybody wrote — it is
       ;; usually a dangling symlink, so loading it would break the whole set
       (touch! (build-path dir ".#Tasks.rkt"))
       (check-equal? (map file-label (dir-roots dir))
                     '("Daily.rkt" "Tasks.rkt")))))

  (test-case "a directory of subdirectories has no roots"
    (with-temp-dir
     (λ (dir)
       (make-directory* (build-path dir "Daily.rkt"))
       (check-equal? (dir-roots dir) '()))))

  ;; ---- what `serve` was pointed at ------------------------------------------

  (test-case "files-named is every outline under a directory, at any depth"
    (with-temp-dir
     (λ (dir)
       (touch! (build-path dir "Tasks.rkt"))
       (touch! (build-path dir "notes.md"))
       (touch! (build-path dir "Daily" "2026-08.rkt"))
       (touch! (build-path dir "Daily" "old" "2019-01.rkt"))
       (touch! (build-path dir ".hidden" "Secret.rkt"))
       (touch! (build-path dir "Daily" ".#2026-08.rkt"))
       ;; the directory's own first, then down — and nothing dot-prefixed, at
       ;; any level, because that is the lock file rule the glob already keeps
       (check-equal? (map file-label (files-named dir))
                     '("Tasks.rkt" "2026-08.rkt" "2019-01.rkt"))
       ;; which of those are ROOTS is the loader's answer, not this one:
       ;; an included fragment is subtracted there (olai/load, load-roots)
       (check-equal? (map file-label (dirs-read dir)) (list (file-label dir) "Daily" "old"))
       (check-equal? (root-dir dir) (path->directory-path (simple-form-path dir))))))

  (test-case "a root spec that is a file is itself, and hangs off its own dir"
    (with-temp-dir
     (λ (dir)
       (define f (build-path dir "Tasks.rkt"))
       (touch! f)
       (touch! (build-path dir "Other.rkt"))
       (check-equal? (files-named f) (list (simple-form-path f)))
       (check-equal? (dirs-read f) (list (root-dir f)))
       (check-equal? (root-dir f) (path->directory-path (simple-form-path dir))))))

  ;; WHICH of the files under a tree are outlines is not this module's
  ;; question — a name cannot say what language a file is in — so it answers
  ;; with every `.rkt` and the load layer discriminates (olai/load,
  ;; outline-files). This is the seam, written down so it stays one.
  (test-case "files-named answers with names; the language is asked elsewhere"
    (with-temp-dir
     (λ (dir)
       (touch! (build-path dir "Tasks.rkt"))
       (touch! (build-path dir "helper.rkt") "#lang racket/base\n")
       (check-equal? (map file-label (files-named dir))
                     '("Tasks.rkt" "helper.rkt")))))

  ;; A link back at an ancestor is a walk that never ends, and this one runs on
  ;; every staleness probe.
  (test-case "a symlinked subdirectory is not descended into"
    (with-temp-dir
     (λ (dir)
       (touch! (build-path dir "Tasks.rkt"))
       (make-directory* (build-path dir "real"))
       (touch! (build-path dir "real" "Deep.rkt"))
       (make-file-or-directory-link (build-path dir "real") (build-path dir "loop"))
       (check-equal? (map file-label (files-named dir))
                     '("Tasks.rkt" "Deep.rkt"))))))
