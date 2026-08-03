#lang racket/base

;; selfflowy CLI — agent-first: check | tree | agenda | add
;; Exit codes: 0 ok, 1 usage, 2 validation/load, 3 not found.

(require json
         racket/date
         racket/file
         racket/list
         racket/match
         racket/path
         racket/string
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/tree
         selfflowy/agenda
         selfflowy/json-out
         selfflowy/capture)

(define exit-ok 0)
(define exit-usage 1)
(define exit-validation 2)
(define exit-not-found 3)

(define default-file "Tasks.rkt")

(define (die code msg #:json? json? #:file [file #f] #:line [line #f] #:col [col #f])
  (if json?
      (write-json-stderr (err-hash msg #:file file #:line line #:col col))
      (eprintf "selfflowy: ~a\n" msg))
  (exit code))

(define (exn-location e fallback-path)
  (cond
    [(exn:fail:syntax? e)
     (define stxs (exn:fail:syntax-exprs e))
     (define s (findf (λ (x) (syntax-source x)) stxs))
     (if s
         (values (syntax-source s) (syntax-line s) (syntax-column s))
         (values fallback-path #f #f))]
    [(exn:fail:read? e)
     (define locs (exn:fail:read-srclocs e))
     (if (pair? locs)
         (let ([loc (car locs)])
           ;; srcloc or list
           (cond
             [(srcloc? loc)
              (values (srcloc-source loc) (srcloc-line loc) (srcloc-column loc))]
             [(list? loc)
              (values (list-ref loc 0) (list-ref loc 1) (list-ref loc 2))]
             [else (values fallback-path #f #f)]))
         (values fallback-path #f #f))]
    [else (values fallback-path #f #f)]))

(define (exn-message* e)
  (cond
    [(exn:fail:syntax? e)
     (define msgs (exn-message e))
     (define-values (src line col) (exn-location e #f))
     (if (and src line)
         (format "~a\n  at: ~a:~a:~a" msgs src line (or col "?"))
         msgs)]
    [(exn:fail? e) (exn-message e)]
    [else (format "~a" e)]))

(define (resolve-file maybe-path json?)
  (define p (or maybe-path default-file))
  (define path (simple-form-path (path->complete-path p)))
  (unless (file-exists? path)
    (die exit-not-found
         (format "file not found: ~a" path)
         #:json? json?
         #:file path))
  path)

(define (load-tasks path json?)
  (with-handlers
      ([exn:fail?
        (λ (e)
          (define-values (src line col) (exn-location e path))
          (define msg (exn-message* e))
          (die exit-validation
               (if json? (exn-message e) (format "failed to load ~a\n~a" path msg))
               #:json? json?
               #:file (or src path)
               #:line line
               #:col col))])
    (dynamic-require `(file ,(path->string path)) 'tasks)))

(define (count-tasks tasks)
  (define (count tk)
    (add1 (for/sum ([c (in-list (task-children tk))])
            (count c))))
  (for/sum ([tk (in-list tasks)]) (count tk)))

(define (today-iso)
  (define d (seconds->date (current-seconds)))
  (define (pad2 n)
    (if (< n 10) (format "0~a" n) (number->string n)))
  (format "~a-~a-~a" (date-year d) (pad2 (date-month d)) (pad2 (date-day d))))

(define (cmd-check path json?)
  (define tasks (load-tasks path json?))
  (define n (count-tasks tasks))
  (if json?
      (write-json-stdout
       (ok-hash 'file (path->string path) 'tasks n))
      (printf "ok: ~a (~a task~a)\n" path n (if (= n 1) "" "s"))))

(define (cmd-tree path json?)
  (define tasks (load-tasks path json?))
  (if json?
      (write-json-stdout
       (hash 'version json-version
             'file (path->string path)
             'tasks (tasks->jsexpr tasks)))
      (displayln (render-tree tasks))))

(define (cmd-agenda path json?)
  (define tasks (load-tasks path json?))
  (define today (today-iso))
  (define groups (agenda-groups tasks today))
  (if json?
      (write-json-stdout (agenda-groups->jsexpr groups today))
      (displayln (format-agenda groups))))

(define (cmd-add json? file-arg date desc no-commit? title-parts)
  (when (null? title-parts)
    (die exit-usage "add requires a TITLE" #:json? json?))
  (define title (string-join title-parts " "))
  (when (and date (not (regexp-match? #px"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" date)))
    (die exit-usage
         (format "invalid --date ~s; expected YYYY-MM-DD" date)
         #:json? json?))
  (define path
    (simple-form-path
     (path->complete-path (or file-arg default-file))))
  (define original
    (if (file-exists? path)
        (file->string path)
        "#lang selfflowy\n"))
  ;; Must be outline lang if non-empty existing
  (when (and (file-exists? path)
             (not (regexp-match? #px"(?m:^#lang selfflowy\\s*$)" original))
             (not (regexp-match? #px"(?m:^#lang selfflowy\\s)" original)))
    ;; Allow #lang selfflowy with options; reject sexp
    (when (regexp-match? #px"(?m:^#lang selfflowy/sexp)" original)
      (die exit-validation
           "add only writes outline syntax (#lang selfflowy), not selfflowy/sexp"
           #:json? json?
           #:file path)))
  (define-values (new-text line created-inbox?)
    (append-capture original title #:date date #:description desc))
  (define tmp (string->path (string-append (path->string path) ".sf-tmp")))
  (with-handlers
      ([exn:fail?
        (λ (e)
          (when (file-exists? tmp) (delete-file tmp))
          (die exit-validation (exn-message e) #:json? json? #:file path))])
    (display-to-file new-text tmp #:exists 'truncate/replace)
    ;; Validate by loading
    (with-handlers
        ([exn:fail?
          (λ (e)
            (when (file-exists? tmp) (delete-file tmp))
            (define-values (src ln col) (exn-location e path))
            (die exit-validation
                 (format "capture failed validation: ~a" (exn-message e))
                 #:json? json?
                 #:file (or src path)
                 #:line ln
                 #:col col))])
      (dynamic-require `(file ,(path->string tmp)) 'tasks)
      ;; Atomic-ish replace; original preserved until rename succeeds
      (rename-file-or-directory tmp path #t)))
  (define committed?
    (and (not no-commit?)
         (try-git-commit path (format "capture: ~a" title))))
  (if json?
      (write-json-stdout
       (ok-hash 'file (path->string path)
                'title title
                'date (nullish date)
                'description (nullish desc)
                'line line
                'created_inbox created-inbox?
                'committed committed?))
      (printf "added ~s under Inbox in ~a (line ~a)~a\n"
              title
              path
              line
              (if committed? ", committed" ""))))

(define (usage)
  (eprintf "usage: selfflowy <command> [options] ...\n")
  (eprintf "\n")
  (eprintf "commands:\n")
  (eprintf "  check  [--json] [file]     validate outline (default: ~a)\n" default-file)
  (eprintf "  tree   [--json] [file]     print outline tree\n")
  (eprintf "  agenda [--json] [file]     OVERDUE / TODAY / UPCOMING\n")
  (eprintf "  add    [--json] [--file F] [--date YYYY-MM-DD] [--description TEXT]\n")
  (eprintf "         [--no-commit] TITLE...   capture under Inbox\n")
  (eprintf "\n")
  (eprintf "exit codes: 0 ok | 1 usage | 2 validation/load | 3 not found\n")
  (eprintf "agent contract: docs/cli.md\n"))

(define (take-flag args flag)
  (define i (index-of args flag))
  (if i
      (values #t (append (take args i) (drop args (add1 i))))
      (values #f args)))

(define (take-opt args flag)
  ;; --flag VALUE
  (define i (index-of args flag))
  (cond
    [(not i) (values #f args)]
    [(>= (add1 i) (length args))
     (values 'missing args)]
    [else
     (values (list-ref args (add1 i))
             (append (take args i) (drop args (+ i 2))))]))

(define (parse-common args)
  (define-values (json? a1) (take-flag args "--json"))
  (values json? a1))

(define (main)
  (define argv (vector->list (current-command-line-arguments)))
  (cond
    [(null? argv)
     (usage)
     (exit exit-usage)]
    [else
     (define cmd (car argv))
     (define rest (cdr argv))
     (case cmd
       [("help" "-h" "--help")
        (usage)
        (exit exit-ok)]
       [("check" "tree" "agenda")
        (define-values (json? args) (parse-common rest))
        (define file-arg
          (match args
            ['() #f]
            [(list f) f]
            [_ (die exit-usage "too many arguments" #:json? json?)]))
        (define path (resolve-file file-arg json?))
        (case cmd
          [("check") (cmd-check path json?)]
          [("tree") (cmd-tree path json?)]
          [("agenda") (cmd-agenda path json?)])]
       [("add")
        (define-values (json? a0) (parse-common rest))
        (define-values (no-commit? a1) (take-flag a0 "--no-commit"))
        (define-values (file-opt a2) (take-opt a1 "--file"))
        (define-values (date-opt a3) (take-opt a2 "--date"))
        (define-values (desc-opt a4) (take-opt a3 "--description"))
        (when (eq? file-opt 'missing)
          (die exit-usage "--file requires a path" #:json? json?))
        (when (eq? date-opt 'missing)
          (die exit-usage "--date requires YYYY-MM-DD" #:json? json?))
        (when (eq? desc-opt 'missing)
          (die exit-usage "--description requires text" #:json? json?))
        ;; remaining flags?
        (when (ormap (λ (s) (regexp-match? #px"^--" s)) a4)
          (die exit-usage
               (format "unknown option in add: ~a" (findf (λ (s) (regexp-match? #px"^--" s)) a4))
               #:json? json?))
        (cmd-add json? file-opt date-opt desc-opt no-commit? a4)]
       [else
        (die exit-usage (format "unknown command ~s" cmd) #:json? #f)])]))

(module+ main
  (main))
