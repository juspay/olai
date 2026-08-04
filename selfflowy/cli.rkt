#lang racket/base

;; selfflowy CLI — agent-first: check | tree | agenda | add | done | html
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
         selfflowy/agenda
         selfflowy/json-out
         selfflowy/capture
         selfflowy/done
         selfflowy/html
         selfflowy/dates)
(define exit-ok 0)
(define exit-usage 1)
(define exit-validation 2)
(define exit-not-found 3)

(define default-file "private/Tasks.rkt")

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

(define (resolve-path p json?)
  (define path (simple-form-path (path->complete-path p)))
  (unless (file-exists? path)
    (die exit-not-found
         (format "file not found: ~a" path)
         #:json? json?
         #:file path))
  path)

;; Resolve zero-or-more path args; empty => default Tasks.rkt.
(define (resolve-files file-args json?)
  (define raw (if (null? file-args) (list default-file) file-args))
  (map (λ (p) (resolve-path p json?)) raw))

;; -> (list 'ok tasks anchors) | (list 'error msg src line col)
(define (try-load-outline path)
  (with-handlers
      ([exn:fail?
        (λ (e)
          (define-values (src line col) (exn-location e path))
          (list 'error (exn-message* e) (or src path) line col))])
    (define mod `(file ,(path->string path)))
    (define tasks (dynamic-require mod 'tasks))
    (define anchors
      (with-handlers ([exn:fail? (λ (_) (hash))])
        (dynamic-require mod 'anchors)))
    (list 'ok tasks anchors)))

(define (load-outline path json?)
  (match (try-load-outline path)
    [(list 'ok tasks anchors) (values tasks anchors)]
    [(list 'error msg src line col)
     (die exit-validation
          (if json?
              msg
              (format "failed to load ~a\n~a" path msg))
          #:json? json?
          #:file src
          #:line line
          #:col col)]))

(define (load-tasks path json?)
  (define-values (tasks _anchors) (load-outline path json?))
  tasks)

(define (today-iso)
  (today-iso-string))

(define (format-check-plain path n anchors mirrors)
  (define extras
    (filter values
            (list (and (positive? anchors)
                       (format "~a anchor~a" anchors (if (= anchors 1) "" "s")))
                  (and (positive? mirrors)
                       (format "~a mirror~a" mirrors (if (= mirrors 1) "" "s"))))))
  (if (null? extras)
      (format "ok: ~a (~a task~a)\n" path n (if (= n 1) "" "s"))
      (format "ok: ~a (~a task~a, ~a)\n"
              path n (if (= n 1) "" "s")
              (string-join extras ", "))))

(define (cmd-check paths json?)
  (define results
    (for/list ([path (in-list paths)])
      (match (try-load-outline path)
        [(list 'ok tasks anchors)
         (list 'ok path
               (count-tasks tasks)
               (hash-count anchors)
               (count-mirrors tasks))]
        [(list 'error msg src line col)
         (list 'error path msg src line col)])))
  (define any-bad? (ormap (λ (r) (eq? (car r) 'error)) results))
  (cond
    [json?
     (if (= (length paths) 1)
         (match (car results)
           [(list 'ok path n ac mc)
            (write-json-stdout
             (ok-hash 'file (path->string path)
                      'tasks n
                      'anchors ac
                      'mirrors mc))]
           [(list 'error path msg src line col)
            (die exit-validation msg #:json? #t #:file src #:line line #:col col)])
         (let ([files
                (for/list ([r (in-list results)])
                  (match r
                    [(list 'ok path n ac mc)
                     (hash 'file (path->string path)
                           'ok #t
                           'tasks n
                           'anchors ac
                           'mirrors mc)]
                    [(list 'error path msg src line col)
                     (hash 'file (path->string path)
                           'ok #f
                           'error (hash 'file (nullish (and src
                                                            (if (path? src)
                                                                (path->string src)
                                                                src)))
                                        'line (nullish line)
                                        'col (nullish col)
                                        'message msg))]))])
           (write-json-stdout
            (hash 'version json-version
                  'ok (not any-bad?)
                  'files files))
           (when any-bad? (exit exit-validation))))]
    [else
     (for ([r (in-list results)])
       (match r
         [(list 'ok path n ac mc)
          (display (format-check-plain path n ac mc))]
         [(list 'error path msg src line col)
          (eprintf "selfflowy: failed to load ~a\n~a\n" path msg)]))
     (when any-bad? (exit exit-validation))]))

;; tree is JSON-only (human view is `html`). --json is accepted as a no-op.
(define (cmd-tree paths json?)
  (define entries
    (for/list ([path (in-list paths)])
      (define-values (tasks anchors) (load-outline path #t))
      (list path tasks anchors)))
  (if (= (length entries) 1)
      (match (car entries)
        [(list path tasks anchors)
         (write-json-stdout
          (hash-set (outline->jsexpr path tasks anchors)
                    'version json-version))])
      (write-json-stdout
       (hash 'version json-version
             'files
             (for/list ([e (in-list entries)])
               (match e
                 [(list path tasks anchors)
                  (outline->jsexpr path tasks anchors)]))))))

(define (cmd-agenda paths json?)
  (define entries
    (for/list ([path (in-list paths)])
      (cons path (load-tasks path json?))))
  (define today (today-iso))
  (define groups (agenda-groups-from-files entries today))
  (if json?
      (write-json-stdout (agenda-groups->jsexpr groups today))
      (displayln (format-agenda groups))))

(define (cmd-html paths out-path)
  (define entries
    (for/list ([path (in-list paths)])
      (define-values (tasks anchors) (load-outline path #f))
      (list path tasks anchors)))
  (define page-title
    (if (= (length paths) 1)
        (path->string (file-name-from-path (car paths)))
        "selfflowy"))
  (define html (files->html entries page-title))
  (cond
    [out-path
     (display-to-file html out-path #:exists 'truncate/replace)
     (printf "~a\n" (path->string (simple-form-path (path->complete-path out-path))))]
    [else
     (display html)]))

(define (cmd-add json? file-arg date desc no-commit? parent title-parts)
  (when (null? title-parts)
    (die exit-usage "add requires a TITLE" #:json? json?))
  (define title (string-join title-parts " "))
  (when (and date (not (valid-iso-date-string? date)))
    (die exit-usage
         (format "invalid --date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]" date)
         #:json? json?))
  (define date* (and date (normalize-date-string date)))
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
    (with-handlers
        ([exn:fail?
          (λ (e)
            (die exit-validation (exn-message e) #:json? json? #:file path))])
      (append-capture original title
                      #:date date*
                      #:description desc
                      #:parent parent)))
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
  (define under
    (cond
      [(not parent) "Inbox"]
      [else parent]))
  (if json?
      (write-json-stdout
       (ok-hash 'file (path->string path)
                'title title
                'date (nullish date*)
                'description (nullish desc)
                'parent (nullish parent)
                'line line
                'created_inbox created-inbox?
                'committed committed?))
      (printf "added ~s under ~a in ~a (line ~a)~a\n"
              title
              under
              path
              line
              (if committed? ", committed" ""))))

(define (format-match-lines path matches)
  (string-join
   (for/list ([m (in-list matches)])
     (format "~a:~a" path (title-match-line m)))
   ", "))

(define (cmd-done json? file-arg undo? no-commit? title-parts)
  (when (null? title-parts)
    (die exit-usage "done requires a TITLE" #:json? json?))
  (define title (string-join title-parts " "))
  (define path
    (simple-form-path
     (path->complete-path (or file-arg default-file))))
  (unless (file-exists? path)
    (die exit-not-found
         (format "file not found: ~a" path)
         #:json? json?
         #:file path))
  (define original (file->string path))
  (when (regexp-match? #px"(?m:^#lang selfflowy/sexp)" original)
    (die exit-validation
         "done only writes outline syntax (#lang selfflowy), not selfflowy/sexp"
         #:json? json?
         #:file path))
  (define kind (parse-title-or-anchor title))
  (define matches
    (match kind
      [(cons 'anchor a) (find-anchor-matches original a)]
      [(cons 'title t) (find-title-matches original t)]))
  (define label
    (match kind
      [(cons 'anchor a) (format "^~a" a)]
      [(cons 'title t) t]))
  (cond
    [(null? matches)
     (die exit-validation
          (format "no task matching ~s in ~a" label path)
          #:json? json?
          #:file path)]
    [(> (length matches) 1)
     (die exit-validation
          (format "ambiguous title ~s; matches: ~a; add a ^anchor to disambiguate"
                  label (format-match-lines path matches))
          #:json? json?
          #:file path)])
  (define today (today-iso))
  (define-values (new-text line done-val)
    (with-handlers
        ([exn:fail?
          (λ (e)
            (die exit-validation (exn-message e) #:json? json? #:file path))])
      (if undo?
          (let-values ([(t l) (undo-done-in-text original title)])
            (values t l (json-null)))
          (let-values ([(t l) (mark-done-in-text original title today)])
            (values t l today)))))
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
                 (format "done failed validation: ~a" (exn-message e))
                 #:json? json?
                 #:file (or src path)
                 #:line ln
                 #:col col))])
      (dynamic-require `(file ,(path->string tmp)) 'tasks)
      (rename-file-or-directory tmp path #t)))
  (define commit-msg
    (if undo? (format "undone: ~a" title) (format "done: ~a" title)))
  (define committed?
    (and (not no-commit?)
         (try-git-commit path commit-msg)))
  (if json?
      (write-json-stdout
       (ok-hash 'file (path->string path)
                'title title
                'line line
                'done done-val
                'undone undo?
                'committed committed?))
      (printf "~a ~s in ~a (line ~a)~a\n"
              (if undo? "undone" "done")
              title
              path
              line
              (if committed? ", committed" ""))))

(define (usage)
  (eprintf "usage: selfflowy <command> [options] ...\n")
  (eprintf "\n")
  (eprintf "commands:\n")
  (eprintf "  check  [--json] [file ...]  validate outline(s) (default: ~a)\n" default-file)
  (eprintf "  tree   [--json] [file ...]  outline(s) as JSON (human view: html)\n")
  (eprintf "  agenda [--json] [file ...]  OVERDUE / TODAY / UPCOMING (merged)\n")
  (eprintf "  html   [--out PATH] [file ...]  interactive HTML (sections if multi)\n")
  (eprintf "  add    [--json] [--file F] [--date ISO] [--description TEXT]\n")
  (eprintf "         [--parent TITLE|^anchor] [--no-commit] TITLE...\n")
  (eprintf "  done   [--json] [--file F] [--undo] [--no-commit] TITLE|^anchor\n")
  (eprintf "                                 mark task done (one file)\n")
  (eprintf "\n")
  (eprintf "exit codes: 0 ok | 1 usage | 2 validation/load | 3 not found\n")
  (eprintf "agent contract: docs/cli.md\n"))

;; ---- subcommand parsers via racket/cmdline ----

(define (cli-check)
  (define json? #f)
  (define file-args '())
  (command-line
   #:program "selfflowy check"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   #:args paths
   (set! file-args paths))
  (cmd-check (resolve-files file-args json?) json?))

(define (cli-tree)
  (define json? #t) ; always JSON; flag kept as no-op for agents
  (define file-args '())
  (command-line
   #:program "selfflowy tree"
   #:once-each
   [("--json") "No-op (tree is always JSON)" (set! json? #t)]
   #:args paths
   (set! file-args paths))
  (cmd-tree (resolve-files file-args #t) #t))

(define (cli-agenda)
  (define json? #f)
  (define file-args '())
  (command-line
   #:program "selfflowy agenda"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   #:args paths
   (set! file-args paths))
  (cmd-agenda (resolve-files file-args json?) json?))

(define (cli-html)
  (define out-path #f)
  (define file-args '())
  (command-line
   #:program "selfflowy html"
   #:once-each
   [("--out") path "Write HTML to path (default: stdout)" (set! out-path path)]
   #:args paths
   (set! file-args paths))
  (cmd-html (resolve-files file-args #f) out-path))

(define (cli-add)
  (define json? #f)
  (define file-arg #f)
  (define date #f)
  (define desc #f)
  (define no-commit? #f)
  (define parent #f)
  (define titles '())
  (command-line
   #:program "selfflowy add"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: private/Tasks.rkt)" (set! file-arg f)]
   [("--date") d "ISO date or datetime (YYYY-MM-DD[THH:MM[:SS]])" (set! date d)]
   [("--description") t "Description text" (set! desc t)]
   [("--parent") p "Parent title or ^anchor (default: Inbox)" (set! parent p)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args title-words
   (set! titles title-words))
  (cmd-add json? file-arg date desc no-commit? parent titles))

(define (cli-done)
  (define json? #f)
  (define file-arg #f)
  (define undo? #f)
  (define no-commit? #f)
  (define titles '())
  (command-line
   #:program "selfflowy done"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: private/Tasks.rkt)" (set! file-arg f)]
   [("--undo") "Remove done state instead of marking done" (set! undo? #t)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args title-words
   (set! titles title-words))
  (cmd-done json? file-arg undo? no-commit? titles))

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
           [("done") (cli-done)]
           [else
            (die exit-usage (format "unknown command ~s" cmd) #:json? #f)])))]))

(module+ main
  (main))
