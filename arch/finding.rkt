#lang racket/base

;; What a violation looks like when it reaches somebody.
;;
;; The shape is the house's, and it is the same one the outline language and
;; the live forms use: where, then the rule that was broken, then the facts
;; that make it a rule, then what to do about it. Every line after the first is
;; indented, so a wall of them still reads as a list of problems and not as
;; prose.
;;
;;   olai/lang/expander.rkt:14:10: requires olai/web/render.rkt: dependency points the wrong way
;;     olai/lang/expander.rkt is stable (olai/lang/arch.rkt:2:0)
;;     olai/web/render.rkt is volatile (olai/web/arch.rkt:2:0)
;;     stable code must not depend on volatile code — invert the edge or move the code
;;
;; Longer than you would write for a human, on purpose: the reader is usually
;; an agent, verbosity measurably raises its odds of fixing the right thing,
;; and nobody reads any of this when the check passes.
;;
;; Paths print relative to the directory being checked. An absolute path in a
;; message is a path that differs on every machine, and this output is read in
;; a terminal, a CI log and a diff.

(require racket/contract
         racket/list
         racket/path
         racket/string)

(provide (struct-out finding)
         (contract-out
          [finding->string (-> finding? path? string?)]
          [loc->string (-> (or/c srcloc? #f) path? string?)]
          [path-label (-> (or/c path? string? #f) path? string?)]))

;; loc  : where the OFFENDING form is — the require spec, the identifier, the
;;        clock word. Never the module as a whole when something smaller is
;;        wrong.
;; rule : one line, the headline
;; why  : the facts, one per line
(struct finding (loc rule why) #:transparent)

(define (finding->string f root)
  (string-join
   (cons (format "~a: ~a" (loc->string (finding-loc f) root) (finding-rule f))
         (for/list ([l (in-list (finding-why f))]) (string-append "  " l)))
   "\n"))

(define (loc->string loc root)
  (cond
    [(not loc) "arch"]
    [else
     (format "~a:~a:~a"
             (path-label (srcloc-source loc) root)
             (or (srcloc-line loc) "?")
             (or (srcloc-column loc) 0))]))

(define (path-label p root)
  (cond
    [(not p) "?"]
    [else
     (define full (if (path? p) p (string->path (format "~a" p))))
     (define rel (find-relative-path (simple-form-path root) (simple-form-path full)))
     (path->string (if (relative-path? rel) rel full))]))
