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
         selfflowy/calendar
         selfflowy/json-out
         selfflowy/capture
         selfflowy/done
         selfflowy/move
         selfflowy/ics
         selfflowy/daily
         selfflowy/html
         selfflowy/dates
         selfflowy/load
         selfflowy/web/serve
         (only-in selfflowy/lang/expander
                  find-task-by-id
                  find-tasks-by-title
                  task-file
                  task-title
                  task-id))
(define exit-ok 0)
(define exit-usage 1)
(define exit-validation 2)
(define exit-not-found 3)

;; Personal outline data lives outside the repo (Dropbox by default).
;; Override with SELFFLOWY_HOME. Auto-commit only fires when that dir is
;; a git work tree; Dropbox alone is the sync layer (no-op otherwise).
(define (selfflowy-home)
  (define env (getenv "SELFFLOWY_HOME"))
  (if (and env (non-empty-string? env))
      (expand-user-path env)
      (build-path (expand-user-path "~") "Dropbox" "Selfflowy-Srid")))

(define default-file
  (path->string (build-path (selfflowy-home) "Tasks.rkt")))

(define (die code msg #:json? json? #:file [file #f] #:line [line #f] #:col [col #f])
  (if json?
      (write-json-stderr (err-hash msg #:file file #:line line #:col col))
      (eprintf "selfflowy: ~a\n" msg))
  (exit code))

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

(define (load-outline path json?)
  (match (try-load-outline path)
    [(list 'ok tasks anchors includes) (values tasks anchors includes)]
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
  (define-values (tasks _anchors _includes) (load-outline path json?))
  tasks)

(define (today-iso)
  (today-iso-string))

(define (format-check-plain path n anchors mirrors includes)
  (define extras
    (filter values
            (list (and (positive? anchors)
                       (format "~a anchor~a" anchors (if (= anchors 1) "" "s")))
                  (and (positive? mirrors)
                       (format "~a mirror~a" mirrors (if (= mirrors 1) "" "s")))
                  (and (positive? (length includes))
                       (format "~a include~a" (length includes)
                               (if (= (length includes) 1) "" "s"))))))
  (if (null? extras)
      (format "ok: ~a (~a task~a)\n" path n (if (= n 1) "" "s"))
      (format "ok: ~a (~a task~a, ~a)\n"
              path n (if (= n 1) "" "s")
              (string-join extras ", "))))

(define (cmd-check paths json?)
  (define results
    (for/list ([path (in-list paths)])
      (match (try-load-outline path)
        [(list 'ok tasks anchors includes)
         (list 'ok path
               (count-tasks tasks)
               (hash-count anchors)
               (count-mirrors tasks)
               includes)]
        [(list 'error msg src line col)
         (list 'error path msg src line col)])))
  (define any-bad? (ormap (λ (r) (eq? (car r) 'error)) results))
  (cond
    [json?
     (if (= (length paths) 1)
         (match (car results)
           [(list 'ok path n ac mc includes)
            (write-json-stdout
             (let ([h (ok-hash 'file (path->string path)
                               'tasks n
                               'anchors ac
                               'mirrors mc)])
               (if (null? includes)
                   h
                   (hash-set h 'includes
                             (for/list ([p includes])
                               (hash 'file p))))))]
           [(list 'error path msg src line col)
            (die exit-validation msg #:json? #t #:file src #:line line #:col col)])
         (let ([files
                (for/list ([r (in-list results)])
                  (match r
                    [(list 'ok path n ac mc includes)
                     (define h
                       (hash 'file (path->string path)
                             'ok #t
                             'tasks n
                             'anchors ac
                             'mirrors mc))
                     (if (null? includes)
                         h
                         (hash-set h 'includes
                                   (for/list ([p includes])
                                     (hash 'file p))))]
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
         [(list 'ok path n ac mc includes)
          (display (format-check-plain path n ac mc includes))]
         [(list 'error path msg src line col)
          (eprintf "selfflowy: failed to load ~a\n~a\n" path msg)]))
     (when any-bad? (exit exit-validation))]))

;; tree is JSON-only (human view is `html`). --json is accepted as a no-op.
(define (cmd-tree paths json?)
  (define entries
    (for/list ([path (in-list paths)])
      (define-values (tasks anchors includes) (load-outline path #t))
      (list path tasks anchors includes)))
  (write-json-stdout (outlines->jsexpr entries)))

(define (cmd-agenda paths json?)
  (define entries
    (for/list ([path (in-list paths)])
      (cons path (load-tasks path json?))))
  (define today (today-iso))
  (define groups (agenda-groups-from-files entries today))
  (if json?
      (write-json-stdout (agenda-groups->jsexpr groups today))
      (displayln (format-agenda groups))))

(define (cmd-calendar paths json? month)
  (define entries
    (for/list ([path (in-list paths)])
      (cons path (load-tasks path json?))))
  (define today (today-iso))
  (define ym
    (or month (substring today 0 7)))
  (define-values (y m) (parse-year-month ym))
  (unless y
    (die exit-usage
         (format "invalid --month ~s; expected YYYY-MM" ym)
         #:json? json?))
  (define cal (calendar-from-files entries ym))
  (if json?
      (write-json-stdout (calendar->jsexpr cal))
      (displayln (format-calendar cal))))

(define (cmd-html paths out-path)
  (define entries
    (for/list ([path (in-list paths)])
      (define-values (tasks anchors includes) (load-outline path #f))
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

;; Resolve TITLE or ^anchor against the outline at path; return the defining
;; file that must be edited (may differ under @include).
(define (resolve-defining-file path title-or-anchor json?)
  (define-values (tasks anchors _includes) (load-outline path json?))
  (define kind (parse-title-or-anchor title-or-anchor))
  (match kind
    [(cons 'anchor a)
     (define tk (or (hash-ref anchors a #f)
                    (find-task-by-id tasks a)))
     (unless tk
       (die exit-validation
            (format "no task matching ^~a in ~a" a path)
            #:json? json?
            #:file path))
     (define f (or (task-file tk) (path->string path)))
     (values (simple-form-path f) (task-title tk))]
    [(cons 'title t)
     (define ms (find-tasks-by-title tasks t))
     (cond
       [(null? ms)
        (die exit-validation
             (format "no task matching ~s in ~a" t path)
             #:json? json?
             #:file path)]
       [(> (length ms) 1)
        ;; Prefer line numbers from the root file text when all matches live there.
        (define text (file->string path))
        (define matches (find-title-matches text t))
        (define where
          (if (pair? matches)
              (format-match-lines path matches)
              (string-join
               (for/list ([tk (in-list ms)])
                 (or (task-file tk) (path->string path)))
               ", ")))
        (die exit-validation
             (format "ambiguous title ~s; matches: ~a; add a ^anchor to disambiguate"
                     t where)
             #:json? json?
             #:file path)]
       [else
        (define tk (car ms))
        (define f (or (task-file tk) (path->string path)))
        (values (simple-form-path f) (task-title tk))])]))

(define (cmd-add json? file-arg date desc no-commit? parent title-parts)
  (when (null? title-parts)
    (die exit-usage "add requires a TITLE" #:json? json?))
  (define title (string-join title-parts " "))
  (when (and date (not (valid-iso-date-string? date)))
    (die exit-usage
         (format "invalid --date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]" date)
         #:json? json?))
  (define date* (and date (normalize-date-string date)))
  (define root-path
    (simple-form-path
     (path->complete-path (or file-arg default-file))))
  ;; Route writes into the parent's defining file when --parent ^anchor.
  (define path
    (cond
      [(and parent (regexp-match? #px"^\\^[A-Za-z0-9_-]+$" (string-trim parent)))
       (define-values (f _t) (resolve-defining-file root-path parent json?))
       f]
      [else root-path]))
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
  (define root-path
    (simple-form-path
     (path->complete-path (or file-arg default-file))))
  (unless (file-exists? root-path)
    (die exit-not-found
         (format "file not found: ~a" root-path)
         #:json? json?
         #:file root-path))
  ;; Edit the defining file (may be an @include fragment).
  (define-values (path _resolved)
    (resolve-defining-file root-path title json?))
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
  ;; Resolved node title (not the raw ^anchor input).
  (define resolved-title (title-match-title (car matches)))
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
    (if undo?
        (format "undone: ~a" resolved-title)
        (format "done: ~a" resolved-title)))
  (define committed?
    (and (not no-commit?)
         (try-git-commit path commit-msg)))
  (if json?
      (write-json-stdout
       (ok-hash 'file (path->string path)
                'title resolved-title
                'line line
                'done done-val
                'undone undo?
                'committed committed?))
      (printf "~a ~s in ~a (line ~a)~a\n"
              (if undo? "undone" "done")
              resolved-title
              path
              line
              (if committed? ", committed" ""))))

(define (cmd-move json? file-arg no-commit? clear? title-parts date-arg)
  (when (null? title-parts)
    (die exit-usage "move requires TITLE|^anchor" #:json? json?))
  (when (and (not clear?) (not date-arg))
    (die exit-usage
         "move requires DATE (YYYY-MM-DD[THH:MM[:SS]]) or --clear"
         #:json? json?))
  (define title (string-join title-parts " "))
  (define root-path
    (simple-form-path
     (path->complete-path (or file-arg default-file))))
  (unless (file-exists? root-path)
    (die exit-not-found
         (format "file not found: ~a" root-path)
         #:json? json?
         #:file root-path))
  (define-values (path _resolved)
    (resolve-defining-file root-path title json?))
  (define original (file->string path))
  (when (regexp-match? #px"(?m:^#lang selfflowy/sexp)" original)
    (die exit-validation
         "move only writes outline syntax (#lang selfflowy), not selfflowy/sexp"
         #:json? json?
         #:file path))
  (define-values (new-text line resolved-title date-val)
    (with-handlers
        ([exn:fail?
          (λ (e)
            (die exit-validation (exn-message e) #:json? json? #:file path))])
      (if clear?
          (let-values ([(t l title) (clear-date-in-text original title)])
            (values t l title (json-null)))
          (let-values ([(t l title d) (set-date-in-text original title date-arg)])
            (values t l title d)))))
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
                 (format "move failed validation: ~a" (exn-message e))
                 #:json? json?
                 #:file (or src path)
                 #:line ln
                 #:col col))])
      (dynamic-require `(file ,(path->string tmp)) 'tasks)
      (rename-file-or-directory tmp path #t)))
  (define commit-msg
    (if clear?
        (format "move: ~a (cleared date)" resolved-title)
        (format "move: ~a -> ~a" resolved-title date-val)))
  (define committed?
    (and (not no-commit?)
         (try-git-commit path commit-msg)))
  (if json?
      (write-json-stdout
       (ok-hash 'file (path->string path)
                'title resolved-title
                'line line
                'date date-val
                'committed committed?))
      (printf "moved ~s in ~a (line ~a)~a~a\n"
              resolved-title
              path
              line
              (if clear? " date cleared"
                  (format " -> ~a" date-val))
              (if committed? ", committed" ""))))

(define (cmd-ics paths out-path)
  (define entries
    (for/list ([path (in-list paths)])
      (cons path (load-tasks path #f))))
  (define ics (tasks->ics entries))
  (cond
    [out-path
     (display-to-file ics out-path #:exists 'truncate/replace)
     (printf "~a\n" (path->string (simple-form-path (path->complete-path out-path))))]
    [else
     (display ics)]))

;; Blocks until Ctrl-C. No auth: the network is the auth (put it behind
;; Tailscale or Caddy). A custodian shutdown drops listeners and connections.
(define (cmd-serve paths port bind)
  (define cust (make-custodian))
  (define stop
    (parameterize ([current-custodian cust])
      (with-handlers
          ([exn:fail?
            (λ (e) (die exit-usage (exn-message e) #:json? #f))])
        (start-server
         #:port port
         #:bind bind
         #:files paths
         #:on-listen
         (λ (bound)
           (printf "selfflowy serve http://~a:~a files: ~a\n"
                   (or bind "0.0.0.0") bound
                   (string-join (map path->string paths) " "))
           (flush-output))))))
  (with-handlers ([exn:break? (λ (_e) (void))])
    (sync/enable-break never-evt))
  (stop)
  (custodian-shutdown-all cust)
  (exit exit-ok))

(define (usage)
  (eprintf "usage: selfflowy <command> [options] ...\n")
  (eprintf "\n")
  (eprintf "commands:\n")
  (eprintf "  check    [--json] [file ...]  validate outline(s) (default: ~a)\n" default-file)
  (eprintf "  tree     [--json] [file ...]  outline(s) as JSON (human view: html)\n")
  (eprintf "  agenda   [--json] [file ...]  OVERDUE / TODAY / UPCOMING (merged)\n")
  (eprintf "  calendar [--json] [--month YYYY-MM] [file ...]  days with dated items\n")
  (eprintf "  html     [--out PATH] [file ...]  tree + month calendar\n")
  (eprintf "  serve    [--port N] [--bind ADDR] [file ...]  web view (Ctrl-C to stop)\n")
  (eprintf "  add      [--json] [--file F] [--date ISO] [--description TEXT]\n")
  (eprintf "           [--parent TITLE|^anchor] [--no-commit] TITLE...\n")
  (eprintf "  done     [--json] [--file F] [--undo] [--no-commit] TITLE|^anchor\n")
  (eprintf "  move     [--json] [--file F] [--no-commit] [--clear] TITLE|^anchor DATE\n")
  (eprintf "  daily    [--json] [--date YYYY-MM-DD] [--home DIR]  ensure today in Daily/\n")
  (eprintf "  ics      [--out PATH] [file ...]  RFC 5545 VCALENDAR of dated tasks\n")
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

(define (cli-calendar)
  (define json? #f)
  (define month #f)
  (define file-args '())
  (command-line
   #:program "selfflowy calendar"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--month") m "Month YYYY-MM (default: current)" (set! month m)]
   #:args paths
   (set! file-args paths))
  (cmd-calendar (resolve-files file-args json?) json? month))

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

(define (cli-serve)
  (define port 8080)
  (define bind "127.0.0.1")
  (define file-args '())
  (command-line
   #:program "selfflowy serve"
   #:once-each
   [("--port") p "TCP port (default: 8080; 0 picks a free one)"
               (define n (string->number p))
               (unless (and (exact-nonnegative-integer? n) (< n 65536))
                 (die exit-usage (format "invalid --port ~s" p) #:json? #f))
               (set! port n)]
   [("--bind") a "Listen address (default: 127.0.0.1; \"\" for all)"
               (set! bind a)]
   #:args paths
   (set! file-args paths))
  (cmd-serve (resolve-files file-args #f)
             port
             (if (string=? bind "") #f bind)))

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
   [("--file") f "Outline file (default: $SELFFLOWY_HOME/Tasks.rkt)" (set! file-arg f)]
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
   [("--file") f "Outline file (default: $SELFFLOWY_HOME/Tasks.rkt)" (set! file-arg f)]
   [("--undo") "Remove done state instead of marking done" (set! undo? #t)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args title-words
   (set! titles title-words))
  (cmd-done json? file-arg undo? no-commit? titles))

(define (cli-move)
  (define json? #f)
  (define file-arg #f)
  (define no-commit? #f)
  (define clear? #f)
  (define words '())
  (command-line
   #:program "selfflowy move"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: $SELFFLOWY_HOME/Tasks.rkt)" (set! file-arg f)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   [("--clear") "Remove @date instead of setting one" (set! clear? #t)]
   #:args args
   (set! words args))
  ;; Last arg is DATE unless --clear; rest is TITLE.
  (cond
    [clear?
     (cmd-move json? file-arg no-commit? #t words #f)]
    [(null? words)
     (die exit-usage "move requires TITLE|^anchor DATE" #:json? json?)]
    [else
     (define date-arg (last words))
     (define title-parts (drop-right words 1))
     (cmd-move json? file-arg no-commit? #f title-parts date-arg)]))

(define (cli-ics)
  (define out-path #f)
  (define file-args '())
  (command-line
   #:program "selfflowy ics"
   #:once-each
   [("--out") path "Write ICS to path (default: stdout)" (set! out-path path)]
   #:args paths
   (set! file-args paths))
  (cmd-ics (resolve-files file-args #f) out-path))

(define (cmd-daily json? date-arg home-arg)
  (define day
    (cond
      [(not date-arg) (today-iso)]
      [(bare-iso-date-title? date-arg) date-arg]
      [else
       (die exit-usage
            (format "invalid --date ~s; expected YYYY-MM-DD" date-arg)
            #:json? json?)]))
  (define home
    (or home-arg
        (path->string (selfflowy-home))))
  (define result
    (with-handlers
        ([exn:fail?
          (λ (e)
            (die exit-validation (exn-message e) #:json? json?))])
      (ensure-daily-day! home day)))
  (if json?
      (write-json-stdout
       (ok-hash 'day (hash-ref result 'day)
                'file (hash-ref result 'file)
                'created_month (hash-ref result 'created_month)
                'created_day (hash-ref result 'created_day)
                'line (hash-ref result 'line)))
      (printf "daily ~a in ~a (line ~a)~a~a\n"
              (hash-ref result 'day)
              (hash-ref result 'file)
              (hash-ref result 'line)
              (if (hash-ref result 'created_month) ", created month" "")
              (if (hash-ref result 'created_day) ", created day" ""))))

(define (cli-daily)
  (define json? #f)
  (define date-arg #f)
  (define home-arg #f)
  (command-line
   #:program "selfflowy daily"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--date") d "Day YYYY-MM-DD (default: today)" (set! date-arg d)]
   [("--home") h "Outline home (default: $SELFFLOWY_HOME)" (set! home-arg h)]
   #:args ()
   (void))
  (cmd-daily json? date-arg home-arg))

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
           [("calendar") (cli-calendar)]
           [("html") (cli-html)]
           [("serve") (cli-serve)]
           [("add") (cli-add)]
           [("done") (cli-done)]
           [("move") (cli-move)]
           [("daily") (cli-daily)]
           [("ics") (cli-ics)]
           [else
            (die exit-usage (format "unknown command ~s" cmd) #:json? #f)])))]))

(module+ main
  (main))
