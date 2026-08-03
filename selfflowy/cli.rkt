#lang racket/base

;; selfflowy CLI — agent-first: check | tree | agenda | add | html
;; Exit codes: 0 ok, 1 usage, 2 validation/load, 3 not found.
;; Arg parsing: racket/cmdline. JSON: json package write-json.

(require json
         racket/cmdline
         racket/file
         racket/list
         racket/match
         racket/path
         racket/string
         racket/vector
         (except-in selfflowy/lang/expander #%module-begin)
         selfflowy/tree
         selfflowy/agenda
         selfflowy/json-out
         selfflowy/capture
         selfflowy/html
         selfflowy/dates)
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

;; Prefer the most specific syntax object for agents: highest line/col among
;; exprs that carry a source (outline @date values are later subforms).
(define (exn-location e fallback-path)
  (cond
    [(exn:fail:syntax? e)
     (define stxs (exn:fail:syntax-exprs e))
     (define with-src
       (filter (λ (x) (and (syntax-source x) (syntax-line x))) stxs))
     (define s
       (if (null? with-src)
           #f
           (argmax
            (λ (x)
              (+ (* 100000 (or (syntax-line x) 0))
                 (or (syntax-column x) 0)))
            with-src)))
     (if s
         (values (syntax-source s) (syntax-line s) (syntax-column s))
         (values fallback-path #f #f))]
    [(exn:fail:read? e)
     (define locs (exn:fail:read-srclocs e))
     (if (pair? locs)
         (let ([loc (last locs)])
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
     (define-values (src line col) (exn-location e #f))
     (define core
       ;; Drop Racket's leading "file:line:col: " if we re-emit a better loc
       (regexp-replace #px"^[^\\s:]+:[0-9]+:[0-9]+:\\s*" (exn-message e) ""))
     (if (and src line)
         (format "~a:~a:~a: ~a" src line (or col 0) core)
         (exn-message e))]
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
               (if json?
                   msg
                   (format "failed to load ~a\n~a" path msg))
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
  (today-iso-string))

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

(define (cmd-html path out-path)
  (define tasks (load-tasks path #f))
  (define html (tasks->html tasks (path->string (file-name-from-path path))))
  (cond
    [out-path
     (display-to-file html out-path #:exists 'truncate/replace)
     (printf "~a\n" (path->string (simple-form-path (path->complete-path out-path))))]
    [else
     (display html)]))

(define (cmd-add json? file-arg date desc no-commit? title-parts)
  (when (null? title-parts)
    (die exit-usage "add requires a TITLE" #:json? json?))
  (define title (string-join title-parts " "))
  (when (and date (not (valid-iso-date-string? date)))
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
  (when (and (file-exists? path)
             (regexp-match? #px"(?m:^#lang selfflowy/sexp)" original))
    (die exit-validation
         "add only writes outline syntax (#lang selfflowy), not selfflowy/sexp"
         #:json? json?
         #:file path))
  (define-values (new-text line created-inbox?)
    (append-capture original title #:date date #:description desc))
  (define tmp (string->path (string-append (path->string path) ".sf-tmp")))
  (with-handlers
      ([exn:fail?
        (λ (e)
          (when (file-exists? tmp) (delete-file tmp))
          (die exit-validation (exn-message e) #:json? json? #:file path))])
    (display-to-file new-text tmp #:exists 'truncate/replace)
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
  (eprintf "  html   [--out PATH] [file] render interactive HTML (stdout default)\n")
  (eprintf "  add    [--json] [--file F] [--date YYYY-MM-DD] [--description TEXT]\n")
  (eprintf "         [--no-commit] TITLE...   capture under Inbox\n")
  (eprintf "\n")
  (eprintf "exit codes: 0 ok | 1 usage | 2 validation/load | 3 not found\n")
  (eprintf "agent contract: docs/cli.md\n"))

;; ---- subcommand parsers via racket/cmdline ----

(define (cli-check)
  (define json? #f)
  (define file-arg #f)
  (command-line
   #:program "selfflowy check"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   #:args file-args
   (set! file-arg
         (match file-args
           ['() #f]
           [(list f) f]
           [_ (die exit-usage "too many arguments" #:json? json?)])))
  (cmd-check (resolve-file file-arg json?) json?))

(define (cli-tree)
  (define json? #f)
  (define file-arg #f)
  (command-line
   #:program "selfflowy tree"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   #:args file-args
   (set! file-arg
         (match file-args
           ['() #f]
           [(list f) f]
           [_ (die exit-usage "too many arguments" #:json? json?)])))
  (cmd-tree (resolve-file file-arg json?) json?))

(define (cli-agenda)
  (define json? #f)
  (define file-arg #f)
  (command-line
   #:program "selfflowy agenda"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   #:args file-args
   (set! file-arg
         (match file-args
           ['() #f]
           [(list f) f]
           [_ (die exit-usage "too many arguments" #:json? json?)])))
  (cmd-agenda (resolve-file file-arg json?) json?))

(define (cli-html)
  (define out-path #f)
  (define file-arg #f)
  (command-line
   #:program "selfflowy html"
   #:once-each
   [("--out") path "Write HTML to path (default: stdout)" (set! out-path path)]
   #:args file-args
   (set! file-arg
         (match file-args
           ['() #f]
           [(list f) f]
           [_ (die exit-usage "too many arguments" #:json? #f)])))
  (cmd-html (resolve-file file-arg #f) out-path))

(define (cli-add)
  (define json? #f)
  (define file-arg #f)
  (define date #f)
  (define desc #f)
  (define no-commit? #f)
  (define titles '())
  (command-line
   #:program "selfflowy add"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: Tasks.rkt)" (set! file-arg f)]
   [("--date") d "YYYY-MM-DD date on the new task" (set! date d)]
   [("--description") t "Description text" (set! desc t)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args title-words
   (set! titles title-words))
  (cmd-add json? file-arg date desc no-commit? titles))

(define (main)
  (define argv (current-command-line-arguments))
  (cond
    [(zero? (vector-length argv))
     (usage)
     (exit exit-usage)]
    [else
     (define cmd (vector-ref argv 0))
     (define rest (vector-drop argv 1))
     (parameterize ([current-command-line-arguments rest])
       (with-handlers
           ([exn:fail:user?
             (λ (e)
               (eprintf "~a\n" (exn-message e))
               (exit exit-usage))])
         (case cmd
           [("help" "-h" "--help")
            (usage)
            (exit exit-ok)]
           [("check") (cli-check)]
           [("tree") (cli-tree)]
           [("agenda") (cli-agenda)]
           [("html") (cli-html)]
           [("add") (cli-add)]
           [else
            (die exit-usage (format "unknown command ~s" cmd) #:json? #f)])))]))

(module+ main
  (main))
