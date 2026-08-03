#lang racket/base

;; selfflowy CLI: check | tree
;; Helpers are module-private; entry point is module+ main.

(require racket/list
         racket/path
         (except-in "lang/expander.rkt" #%module-begin)
         "tree.rkt")

(define default-file "Tasks.rkt")

(define (resolve-file maybe-path)
  (define p (or maybe-path default-file))
  (define path (simple-form-path (path->complete-path p)))
  (unless (file-exists? path)
    (eprintf "selfflowy: file not found: ~a\n" path)
    (eprintf "  hint: create ~a with `#lang selfflowy`, or pass a path\n"
             (if maybe-path p default-file))
    (exit 1))
  path)

(define (exn-message* e)
  (cond
    [(exn:fail:syntax? e)
     (define msgs (exn-message e))
     (define stxs (exn:fail:syntax-exprs e))
     (define loc
       (for/or ([s (in-list stxs)])
         (and (syntax-source s)
              (format "~a:~a:~a"
                      (syntax-source s)
                      (or (syntax-line s) "?")
                      (or (syntax-column s) "?")))))
     (if loc (format "~a\n  at: ~a" msgs loc) msgs)]
    [(exn:fail? e) (exn-message e)]
    [else (format "~a" e)]))

(define (load-tasks path)
  ;; Load in the current namespace so `task` struct types match
  ;; the ones from `selfflowy/lang/expander` (fresh namespaces re-instantiate).
  (with-handlers ([exn:fail?
                   (λ (e)
                     (eprintf "selfflowy: failed to load ~a\n" path)
                     (eprintf "~a\n" (exn-message* e))
                     (exit 1))])
    (dynamic-require `(file ,(path->string path)) 'tasks)))

(define (count-tasks tasks)
  (define (count tk)
    (add1 (for/sum ([c (in-list (task-children tk))])
            (count c))))
  (for/sum ([tk (in-list tasks)]) (count tk)))

(define (cmd-check path)
  (define tasks (load-tasks path))
  (define n (count-tasks tasks))
  (printf "ok: ~a (~a task~a)\n"
          path
          n
          (if (= n 1) "" "s"))
  (void))

(define (cmd-tree path)
  (define tasks (load-tasks path))
  (displayln (render-tree tasks)))

(define (usage)
  (eprintf "usage: selfflowy <command> [file]\n")
  (eprintf "\n")
  (eprintf "commands:\n")
  (eprintf "  check [file]   validate a #lang selfflowy module (default: ~a)\n" default-file)
  (eprintf "  tree  [file]   print the outline with box-drawing (default: ~a)\n" default-file)
  (eprintf "\n")
  (eprintf "A module is a list of top-level\n")
  (eprintf "  (t \"title\" [#:date \"YYYY-MM-DD\"] [#:description \"...\"] child ...)\n")
  (eprintf "forms.\n"))

(define (main)
  (define args (current-command-line-arguments))
  (cond
    [(zero? (vector-length args))
     (usage)
     (exit 1)]
    [else
     (define cmd (vector-ref args 0))
     (define file-arg
       (and (> (vector-length args) 1) (vector-ref args 1)))
     (when (> (vector-length args) 2)
       (eprintf "selfflowy: too many arguments\n")
       (usage)
       (exit 1))
     (case cmd
       [("check")
        (cmd-check (resolve-file file-arg))]
       [("tree")
        (cmd-tree (resolve-file file-arg))]
       [("help" "-h" "--help")
        (usage)]
       [else
        (eprintf "selfflowy: unknown command ~s\n" cmd)
        (usage)
        (exit 1)])]))

(module+ main
  (main))
