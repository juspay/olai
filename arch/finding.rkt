#lang racket/base

;; What a violation looks like when it reaches somebody, and how a place is
;; said.
;;
;; The shape is the house's, and it is the same one the outline language and
;; the live forms use: where, then the rule that was broken, then the facts
;; that make it a rule, then what to do about it. Every line after the first is
;; indented, so a wall of them still reads as a list of problems and not as
;; prose.
;;
;;   olai/lang/expander.rkt:14:10: requires olai/web/render.rkt: dependency points the wrong way
;;     olai/lang/expander.rkt is stable (olai/lang/arch.rkt:2)
;;     olai/web/render.rkt is volatile (olai/web/arch.rkt:2)
;;     stable code must not depend on volatile code — invert the edge or move the code
;;
;; Longer than you would write for a human, on purpose: the reader is usually
;; an agent, verbosity measurably raises its odds of fixing the right thing,
;; and nobody reads any of this when the check passes.
;;
;; Paths print relative to the directory being checked, and this module is the
;; only place that knows how: `make-labeller` hands out the one function, and
;; the checks and `--explain` both build their message lines with it. An
;; absolute path in a message is a path that differs on every machine, and this
;; output is read in a terminal, a CI log and a diff.
;;
;; Racket's own `srcloc->string` would do the first line, but only by
;; parameterizing `current-directory-for-user` — an ambient read, in the tool
;; whose whole job is to say where ambient reads are allowed. Six lines are
;; cheaper than that joke.

(require racket/contract
         racket/path)

(provide (struct-out finding)
         (contract-out
          [make-labeller (-> path? labeller/c)]
          [finding->string (-> finding? path? string?)]
          [loc-brief (-> (or/c srcloc? #f) labeller/c string?)]))

;; How a path is said inside a message.
(define labeller/c (-> (or/c path? string? #f) string?))

;; loc  : where the OFFENDING form is — the require spec, the identifier, the
;;        clock word. Never the module as a whole when something smaller is
;;        wrong.
;; rule : one line, the headline
;; why  : the facts, one per line
(struct finding (loc rule why) #:transparent)

(define (make-labeller root)
  (define here (simple-form-path root))
  (λ (p)
    (cond
      [(not p) "?"]
      [else
       (define full (simple-form-path (if (path? p) p (string->path (format "~a" p)))))
       (define rel (find-relative-path here full))
       (path->string (if (relative-path? rel) rel full))])))

(define (finding->string f root)
  (define label (make-labeller root))
  (apply string-append
         (format "~a: ~a" (loc-full (finding-loc f) label) (finding-rule f))
         (for/list ([l (in-list (finding-why f))]) (string-append "\n  " l))))

;; file:line:col — the line an editor jumps to.
(define (loc-full loc label)
  (if loc
      (format "~a:~a:~a" (label (srcloc-source loc)) (or (srcloc-line loc) "?")
              (or (srcloc-column loc) 0))
      "arch"))

;; file:line — enough to find a declaration that a message is quoting, inside
;; a line that is already saying something else.
(define (loc-brief loc label)
  (if loc
      (format "~a:~a" (label (srcloc-source loc)) (or (srcloc-line loc) "?"))
      "?"))
