#lang racket/base

;; The #tag grammar, in one place.
;;
;; The expander needs it at compile time (tags land in the task struct) and
;; at run time; the web view needs the same spans to wrap a title's tags in
;; pills. Three copies of one regexp is three chances to disagree about what
;; a tag is.

(require racket/list)

(provide tag-rx
         title-tags)

(define tag-rx #px"#([A-Za-z0-9_-]+)")

;; "Ship #lang work #lang" -> '("lang")
(define (title-tags title)
  (remove-duplicates
   (regexp-match* tag-rx title #:match-select cadr)))
