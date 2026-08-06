#lang racket/base

;; Which files a directory contributes as roots. One glob (olai/glob) with the
;; pattern already chosen, so this is where the four things that answer is
;; supposed to be — top level, sorted, files, no dotfiles — are written down.

(require racket/file
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
       (check-equal? (dir-roots dir) '())))))
