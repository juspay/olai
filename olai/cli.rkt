#lang racket/base

;; olai CLI — the agent tool surface and the write-safety layer, nothing else.
;; The human view is the web app (`olai serve`), so every command that has a
;; JSON reply emits it always: --json is accepted and does nothing. `ics`
;; (its output IS the format) and `serve` are the exceptions and talk plain.
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
         olai/agenda
         olai/calendar
         olai/json/model
         olai/json/reply
         olai/query
         olai/ics
         olai/dates
         olai/load
         olai/ops
         (only-in olai/paths dir-roots)
         (only-in olai/acp acp-command-problem)
         olai/web/serve)
(define exit-ok 0)
(define exit-usage 1)
(define exit-validation 2)
(define exit-not-found 3)

;; Personal outline data lives outside the repo; OLAI_HOME names the directory.
;; There is no default — the tool does not guess where your notes are — so an
;; unset OLAI_HOME is a usage error (kind 'usage, like any other op failure),
;; raised only when a command actually needs the home. Auto-commit fires when
;; that dir is a git work tree; otherwise your sync layer is the history.
(define (olai-home)
  (define env (getenv "OLAI_HOME"))
  (unless (and env (non-empty-string? env))
    (raise (exn:fail:op
            (string-append
             "OLAI_HOME is not set; set it to your outline directory, "
             "or name the outline explicitly (a path argument, --file, --home)")
            (current-continuation-marks)
            'usage #f #f #f)))
  (expand-user-path env))

(define (default-file)
  (path->string (build-path (olai-home) "Tasks.rkt")))

;; Two error surfaces, one per output kind: the error object on stderr for the
;; JSON commands (everything an agent drives), `olai: message` for the two that
;; do not speak JSON at all — `ics` and `serve`, which have no envelope to put
;; it in.
(define (die code msg #:json? json? #:file [file #f] #:line [line #f] #:col [col #f])
  (if json?
      (write-json-stderr (err-hash msg #:file file #:line line #:col col))
      (eprintf "olai: ~a\n" msg))
  (exit code))

(define (resolve-path p json?)
  (define path (simple-form-path (path->complete-path p)))
  (unless (file-exists? path)
    (die exit-not-found
         (format "file not found: ~a" path)
         #:json? json?
         #:file path))
  path)

;; Resolve zero-or-more path args; empty => $OLAI_HOME/Tasks.rkt (run-op so an
;; unset home dies as the usage error it is, in the mode asked for).
(define (resolve-files file-args json?)
  (define raw (if (null? file-args) (list (run-op json? default-file)) file-args))
  (map (λ (p) (resolve-path p json?)) raw))

(define (load-outline path json?)
  (match (try-load-outline path)
    [(outline _p tasks anchors includes) (values tasks anchors includes)]
    [(load-error msg src line col)
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

(define (cmd-check paths)
  (define results
    (for/list ([path (in-list paths)])
      (match (try-load-outline path)
        [(outline _p tasks anchors includes)
         (list 'ok path
               (count-tasks tasks)
               (hash-count anchors)
               (count-mirrors tasks)
               includes)]
        [(load-error msg src line col)
         (list 'error path msg src line col)])))
  (define any-bad? (ormap (λ (r) (eq? (car r) 'error)) results))
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
         (hash 'version json-reply-version
               'ok (not any-bad?)
               'files files))
        (when any-bad? (exit exit-validation)))))

(define (cmd-tree paths)
  (define entries
    (mint-outline-keys
     (for/list ([path (in-list paths)])
       (define-values (tasks anchors includes) (load-outline path #t))
       (outline path tasks anchors includes))))
  (write-json-stdout (outlines->jsexpr entries)))

(define (cmd-agenda paths)
  (define entries
    (for/list ([path (in-list paths)])
      (cons path (load-tasks path #t))))
  (define today (today-iso))
  (write-json-stdout
   (agenda-groups->jsexpr (agenda-groups-from-files entries today) today)))

(define (cmd-calendar paths month)
  (define entries
    (for/list ([path (in-list paths)])
      (cons path (load-tasks path #t))))
  (define ym (or month (substring (today-iso) 0 7)))
  (define-values (y m) (parse-year-month ym))
  (unless y
    (die exit-usage
         (format "invalid --month ~s; expected YYYY-MM" ym)
         #:json? #t))
  (write-json-stdout (calendar->jsexpr (calendar-from-files entries ym))))

;; ---- write commands: parse, call the op, render --------------------------
;;
;; Everything below is presentation. The ops (olai/ops) do the work and
;; know nothing about exit codes, JSON or stdout; `die` lives on this side of
;; that line only.

(define (exit-code-for kind)
  (case kind
    [(usage) exit-usage]
    [(not-found) exit-not-found]
    [else exit-validation]))

;; Run an op, or die with the exit code its failure asked for.
(define (run-op json? thunk)
  (with-handlers
      ([exn:fail:op?
        (λ (e)
          (die (exit-code-for (exn:fail:op-kind e))
               (exn-message e)
               #:json? json?
               #:file (exn:fail:op-file e)
               #:line (exn:fail:op-line e)
               #:col (exn:fail:op-col e)))]
       [exn:fail?
        (λ (e) (die exit-validation (exn-message e) #:json? json?))])
    (thunk)))

(define (cmd-add file-arg date desc no-commit? parent title-parts)
  (when (null? title-parts)
    (die exit-usage "add requires a TITLE" #:json? #t))
  (define title (string-join title-parts " "))
  (define r
    (run-op #t
            (λ ()
              (ops-add! (or file-arg (default-file)) title
                        #:date date
                        #:description desc
                        #:parent parent
                        #:commit? (not no-commit?)))))
  (write-json-stdout
   (ok-hash 'file (add-result-file r)
            'title (add-result-title r)
            'date (nullish (add-result-date r))
            'description (nullish (add-result-description r))
            'parent (nullish (add-result-parent r))
            'line (add-result-line r)
            'created_inbox (add-result-created-inbox? r)
            'committed (add-result-committed? r))))

;; `done` and `doing` are one command with the state filled in — same flags,
;; same reply, and the stamp rides under the state's own name so an agent
;; reads `done` out of `olai done` and `doing` out of `olai doing`.
(define (cmd-mark state file-arg undo? no-commit? title-parts)
  (when (null? title-parts)
    (die exit-usage (format "~a requires a TITLE" state) #:json? #t))
  (define spec (string-join title-parts " "))
  (define r
    (run-op #t
            (λ ()
              (ops-mark! (or file-arg (default-file)) state spec (today-iso)
                         #:undo? undo?
                         #:commit? (not no-commit?)))))
  (write-json-stdout
   (ok-hash 'file (mark-result-file r)
            'title (mark-result-title r)
            'line (mark-result-line r)
            state (nullish (mark-result-stamp r))
            'undone (mark-result-undone? r)
            'committed (mark-result-committed? r))))

(define (cmd-move file-arg no-commit? clear? title-parts date-arg)
  (when (null? title-parts)
    (die exit-usage "move requires TITLE|^anchor" #:json? #t))
  (define spec (string-join title-parts " "))
  (define r
    (run-op #t
            (λ ()
              (ops-move! (or file-arg (default-file)) spec date-arg
                         #:clear? clear?
                         #:commit? (not no-commit?)))))
  (write-json-stdout
   (ok-hash 'file (move-result-file r)
            'title (move-result-title r)
            'line (move-result-line r)
            'date (nullish (move-result-date r))
            'committed (move-result-committed? r))))

(define (cmd-daily date-arg home-arg no-commit?)
  (define r
    (run-op #t
            (λ ()
              (ops-daily! (or home-arg (path->string (olai-home)))
                          (or date-arg (today-iso))
                          #:commit? (not no-commit?)))))
  (write-json-stdout
   (ok-hash 'day (daily-result-day r)
            'file (daily-result-file r)
            'created_month (daily-result-created-month? r)
            'created_day (daily-result-created-day? r)
            'line (daily-result-line r)
            'committed (daily-result-committed? r))))

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

;; The agent `serve` chats with. No fallback and no PATH lookup: an agent the
;; server picked for you is an agent you did not choose, and a serve command
;; that silently has no chat panel is worse than one that will not start. Nix
;; sets the variable (Nix package --set-default, the dev shell, `just serve`).
(define (acp-command-or-die)
  (define v (getenv "OLAI_ACP_AGENT"))
  (unless (and v (non-empty-string? v))
    (die exit-usage
         "OLAI_ACP_AGENT is not set; serve needs the path to an ACP agent (docs/cli.md)"
         #:json? #f))
  (define problem (acp-command-problem v))
  (when problem
    (die exit-usage
         (format "OLAI_ACP_AGENT ~a: ~a" problem v)
         #:json? #f))
  v)

;; What `serve` was pointed AT: -> (values roots dir), dir being #f unless the
;; front door was used.
;;
;; A DIRECTORY (or no argument at all, which means this one) is the front door:
;; the roots are its top-level `*.rkt` and the agent works IN it, which is what
;; makes "the last session" a thing that survives a restart — Claude Code keys
;; its stored sessions by the directory the agent runs in, and a derived one
;; moves when the file set does. Explicit files are the plumbing: the roots are
;; those files and the agent works from the directory they hang off.
(define (serve-roots file-args)
  (define dir-arg
    (cond
      [(null? file-args) (path->string (current-directory))]
      [(and (null? (cdr file-args)) (directory-exists? (car file-args))) (car file-args)]
      [else #f]))
  (cond
    [dir-arg
     (define dir (simple-form-path (path->complete-path dir-arg)))
     (define roots (dir-roots dir))
     (when (null? roots)
       (die exit-not-found
            (format "no outlines in ~a (serve wants *.rkt at its top level)" dir)
            #:json? #f))
     (values roots dir)]
    [else (values (resolve-files file-args #f) #f)]))

;; Blocks until Ctrl-C. No auth: the network is the auth (put it behind
;; Tailscale or Caddy). A custodian shutdown drops listeners and connections.
;;
;; `dir` is the directory the agent works in when there was one to name (see
;; serve-roots); #f leaves it to the outlines' own common base.
;;
;; `fallback?` is "nobody asked for this port" — the default. Taken, we bind a
;; free one and say which. A port typed on the command line is a request, and
;; a taken one is an error.
(define (cmd-serve paths dir port fallback? bind)
  (define acp-command (acp-command-or-die))
  (define cust (make-custodian))
  (define stop
    (parameterize ([current-custodian cust])
      (with-handlers
          ([exn:fail?
            (λ (e) (die exit-usage (exn-message e) #:json? #f))])
        (start-server
         #:port port
         #:port-fallback? fallback?
         #:bind bind
         #:files paths
         #:acp-command acp-command
         #:agent-cwd dir
         #:on-listen
         (λ (bound)
           ;; The URL below is always the port actually bound; this line is
           ;; why it is not the one you expected.
           (when (and fallback? (not (= bound port)))
             (eprintf "olai: port ~a is taken; serving on ~a\n" port bound))
           (printf "olai serve http://~a:~a ~afiles: ~a\n"
                   (or bind "0.0.0.0") bound
                   (if dir (format "dir: ~a " dir) "")
                   (string-join (map path->string paths) " "))
           (flush-output))))))
  (with-handlers ([exn:break? (λ (_e) (void))])
    (sync/enable-break never-evt))
  (stop)
  (custodian-shutdown-all cust)
  (exit exit-ok))

(define (usage)
  (eprintf "usage: olai <command> [options] ...\n")
  (eprintf "\n")
  (eprintf "commands:\n")
  (eprintf "  check    [file ...]  validate outline(s) (default: $OLAI_HOME/Tasks.rkt)\n")
  (eprintf "  tree     [file ...]  outline(s) as JSON\n")
  (eprintf "  agenda   [file ...]  overdue / doing / today / upcoming (merged)\n")
  (eprintf "  calendar [--month YYYY-MM] [file ...]  days with dated items\n")
  (eprintf "  serve    [--port N] [--bind ADDR] [DIR | file ...]  web view (Ctrl-C to stop)\n")
  (eprintf "           DIR (default: .) serves DIR/*.rkt; the agent works in DIR\n")
  (eprintf "  add      [--file F] [--date ISO] [--description TEXT]\n")
  (eprintf "           [--parent TITLE|^anchor] [--no-commit] TITLE...\n")
  (eprintf "  done     [--file F] [--undo] [--no-commit] TITLE|^anchor\n")
  (eprintf "  doing    [--file F] [--undo] [--no-commit] TITLE|^anchor\n")
  (eprintf "           mark in progress ([/]); done clears it\n")
  (eprintf "  move     [--file F] [--no-commit] [--clear] TITLE|^anchor DATE\n")
  (eprintf "  daily    [--date YYYY-MM-DD] [--home DIR] [--no-commit]\n")
  (eprintf "           ensure today in Daily/\n")
  (eprintf "  ics      [--out PATH] [file ...]  RFC 5545 VCALENDAR of dated tasks\n")
  (eprintf "\n")
  (eprintf "everything but ics and serve replies in JSON; --json does nothing.\n")
  (eprintf "the human view is the web app: olai serve\n")
  (eprintf "exit codes: 0 ok | 1 usage | 2 validation/load | 3 not found\n")
  (eprintf "agent contract: docs/cli.md\n"))

;; ---- subcommand parsers via racket/cmdline ----
;;
;; `--json` is what agents already type. The output is JSON either way now, so
;; the flag stays as a no-op rather than turning a working invocation into a
;; usage error.
(define json-noop "No-op (the reply is always JSON)")

(define (cli-check)
  (define file-args '())
  (command-line
   #:program "olai check"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   #:args paths
   (set! file-args paths))
  (cmd-check (resolve-files file-args #t)))

(define (cli-tree)
  (define file-args '())
  (command-line
   #:program "olai tree"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   #:args paths
   (set! file-args paths))
  (cmd-tree (resolve-files file-args #t)))

(define (cli-agenda)
  (define file-args '())
  (command-line
   #:program "olai agenda"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   #:args paths
   (set! file-args paths))
  (cmd-agenda (resolve-files file-args #t)))

(define (cli-calendar)
  (define month #f)
  (define file-args '())
  (command-line
   #:program "olai calendar"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   [("--month") m "Month YYYY-MM (default: current)" (set! month m)]
   #:args paths
   (set! file-args paths))
  (cmd-calendar (resolve-files file-args #t) month))

(define (cli-serve)
  (define port 8080)
  (define asked? #f)
  (define bind "127.0.0.1")
  (define file-args '())
  (command-line
   #:program "olai serve"
   #:once-each
   [("--port") p "TCP port (default: 8080, or a free one if taken; 0 picks a free one)"
               (define n (string->number p))
               (unless (and (exact-nonnegative-integer? n) (< n 65536))
                 (die exit-usage (format "invalid --port ~s" p) #:json? #f))
               (set! port n)
               (set! asked? #t)]
   [("--bind") a "Listen address (default: 127.0.0.1; \"\" for all)"
               (set! bind a)]
   #:args paths
   (set! file-args paths))
  (define-values (roots dir) (serve-roots file-args))
  (cmd-serve roots dir port (not asked?) (if (string=? bind "") #f bind)))

(define (cli-add)
  (define file-arg #f)
  (define date #f)
  (define desc #f)
  (define no-commit? #f)
  (define parent #f)
  (define titles '())
  (command-line
   #:program "olai add"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   [("--file") f "Outline file (default: $OLAI_HOME/Tasks.rkt)" (set! file-arg f)]
   [("--date") d "ISO date or datetime (YYYY-MM-DD[THH:MM[:SS]])" (set! date d)]
   [("--description") t "Description text" (set! desc t)]
   [("--parent") p "Parent title or ^anchor (default: Inbox)" (set! parent p)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args title-words
   (set! titles title-words))
  (cmd-add file-arg date desc no-commit? parent titles))

(define (cli-mark state)
  (define file-arg #f)
  (define undo? #f)
  (define no-commit? #f)
  (define titles '())
  (command-line
   #:program (format "olai ~a" state)
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   [("--file") f "Outline file (default: $OLAI_HOME/Tasks.rkt)" (set! file-arg f)]
   ;; A literal: racket/cmdline reads the help slot at expansion time, so a
   ;; computed string there is taken for the handler.
   [("--undo") "Remove this state instead of marking it" (set! undo? #t)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args title-words
   (set! titles title-words))
  (cmd-mark state file-arg undo? no-commit? titles))

(define (cli-move)
  (define file-arg #f)
  (define no-commit? #f)
  (define clear? #f)
  (define words '())
  (command-line
   #:program "olai move"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   [("--file") f "Outline file (default: $OLAI_HOME/Tasks.rkt)" (set! file-arg f)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   [("--clear") "Remove @date instead of setting one" (set! clear? #t)]
   #:args args
   (set! words args))
  ;; Last arg is DATE unless --clear; rest is TITLE.
  (cond
    [clear?
     (cmd-move file-arg no-commit? #t words #f)]
    [(null? words)
     (die exit-usage "move requires TITLE|^anchor DATE" #:json? #t)]
    [else
     (define date-arg (last words))
     (define title-parts (drop-right words 1))
     (cmd-move file-arg no-commit? #f title-parts date-arg)]))

(define (cli-ics)
  (define out-path #f)
  (define file-args '())
  (command-line
   #:program "olai ics"
   #:once-each
   [("--out") path "Write ICS to path (default: stdout)" (set! out-path path)]
   #:args paths
   (set! file-args paths))
  (cmd-ics (resolve-files file-args #f) out-path))

(define (cli-daily)
  (define date-arg #f)
  (define home-arg #f)
  (define no-commit? #f)
  (command-line
   #:program "olai daily"
   #:once-each
   [("--json") "No-op (the reply is always JSON)" (void)]
   [("--date") d "Day YYYY-MM-DD (default: today)" (set! date-arg d)]
   [("--home") h "Outline home (default: $OLAI_HOME)" (set! home-arg h)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args ()
   (void))
  (cmd-daily date-arg home-arg no-commit?))

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
           [("serve") (cli-serve)]
           [("add") (cli-add)]
           [("done") (cli-mark 'done)]
           [("doing") (cli-mark 'doing)]
           [("move") (cli-move)]
           [("daily") (cli-daily)]
           [("ics") (cli-ics)]
           [else
            (die exit-usage (format "unknown command ~s" cmd) #:json? #f)])))]))

(module+ main
  (main))
