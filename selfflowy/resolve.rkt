#lang racket/base

;; Where is TITLE|^anchor?
;;
;; It used to be answered twice: once against the MODEL (which file defines
;; the node — it may be an @include fragment), then again against the raw
;; TEXT of that file (which line to edit). Two worlds, two ambiguity errors,
;; and nothing making them agree. This module answers once, and the text
;; mutators are handed the line.

(require racket/file
         racket/list
         racket/match
         racket/path
         racket/string
         (only-in selfflowy/lang/expander
                  task-file
                  find-task-by-id
                  find-tasks-by-title)
         selfflowy/load
         selfflowy/meta)

(provide (struct-out located)
         locate)

;; file  : path of the file that DEFINES the node (what a write must edit)
;; index : 0-based index of its title line in that file
;; title : the resolved title (never the "^anchor" the user typed)
(struct located (file index title) #:transparent)

;; These messages are shown to a user (and to an agent, as JSON), so they
;; carry no `who:` prefix — the command already said who it was.
(define (fail fmt . args)
  (raise (exn:fail (apply format fmt args) (current-continuation-marks))))

;; The files that could hold this node: the defining file of every model
;; match. No match in the model means no candidate, which is the "no task"
;; case — the text is never scanned on a hunch.
(define (candidate-files out spec)
  (define root (outline-path out))
  (define tasks (outline-tasks out))
  (define (file-of tk)
    (simple-form-path (or (task-file tk) root)))
  (remove-duplicates
   (match (parse-title-or-anchor spec)
     [(cons 'anchor a)
      (define tk (or (hash-ref (outline-anchors out) a #f)
                     (find-task-by-id tasks a)))
      (if tk (list (file-of tk)) '())]
     [(cons 'title t)
      (map file-of (find-tasks-by-title tasks t))])
   #:key path->string))

(define (matches-in text spec)
  (match (parse-title-or-anchor spec)
    [(cons 'anchor a) (find-anchor-matches text a)]
    [(cons 'title t) (find-title-matches text t)]))

;; -> located; raises exn:fail naming file:line for every candidate when the
;; spec does not pick out exactly one node.
(define (locate out spec)
  (define hits
    (append*
     (for/list ([f (in-list (candidate-files out spec))])
       (define text (file->string f))
       (for/list ([m (in-list (matches-in text spec))])
         (cons f m)))))
  (define label (spec-label spec))
  (cond
    [(null? hits)
     (fail "no task matching ~a in ~a" label (outline-path out))]
    [(> (length hits) 1)
     (fail "ambiguous title ~a; matches: ~a; add a ^anchor to disambiguate"
           label
           (string-join
            (for/list ([h (in-list hits)])
              (format "~a:~a" (car h) (title-match-line (cdr h))))
            ", "))]
    [else
     (define f (car (car hits)))
     (define m (cdr (car hits)))
     (located f (title-match-index m) (title-match-title m))]))
