#lang racket/base

;; olai CLI — agent-first: check | tree | agenda | add | done | move | css
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
         ;; the skin, for `css`: the same string the server answers with
         (only-in olai/web/skin stylesheet)
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
        [(outline _p tasks anchors includes)
         (list 'ok path
               (count-tasks tasks)
               (hash-count anchors)
               (count-mirrors tasks)
               includes)]
        [(load-error msg src line col)
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
            (hash 'version json-reply-version
                  'ok (not any-bad?)
                  'files files))
           (when any-bad? (exit exit-validation))))]
    [else
     (for ([r (in-list results)])
       (match r
         [(list 'ok path n ac mc includes)
          (display (format-check-plain path n ac mc includes))]
         [(list 'error path msg src line col)
          (eprintf "olai: failed to load ~a\n~a\n" path msg)]))
     (when any-bad? (exit exit-validation))]))

;; tree is JSON-only (human view is the web app). --json is accepted as a no-op.
(define (cmd-tree paths json?)
  (define entries
    (mint-outline-keys
     (for/list ([path (in-list paths)])
       (define-values (tasks anchors includes) (load-outline path #t))
       (outline path tasks anchors includes))))
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

(define (committed-suffix committed?)
  (if committed? ", committed" ""))

(define (cmd-add json? file-arg date desc no-commit? parent title-parts)
  (when (null? title-parts)
    (die exit-usage "add requires a TITLE" #:json? json?))
  (define title (string-join title-parts " "))
  (define r
    (run-op json?
            (λ ()
              (ops-add! (or file-arg (default-file)) title
                        #:date date
                        #:description desc
                        #:parent parent
                        #:commit? (not no-commit?)))))
  (if json?
      (write-json-stdout
       (ok-hash 'file (add-result-file r)
                'title (add-result-title r)
                'date (nullish (add-result-date r))
                'description (nullish (add-result-description r))
                'parent (nullish (add-result-parent r))
                'line (add-result-line r)
                'created_inbox (add-result-created-inbox? r)
                'committed (add-result-committed? r)))
      (printf "added ~s under ~a in ~a (line ~a)~a\n"
              (add-result-title r)
              (or (add-result-parent r) "Inbox")
              (add-result-file r)
              (add-result-line r)
              (committed-suffix (add-result-committed? r)))))

(define (cmd-done json? file-arg undo? no-commit? title-parts)
  (when (null? title-parts)
    (die exit-usage "done requires a TITLE" #:json? json?))
  (define spec (string-join title-parts " "))
  (define r
    (run-op json?
            (λ ()
              (ops-done! (or file-arg (default-file)) spec (today-iso)
                         #:undo? undo?
                         #:commit? (not no-commit?)))))
  (if json?
      (write-json-stdout
       (ok-hash 'file (done-result-file r)
                'title (done-result-title r)
                'line (done-result-line r)
                'done (nullish (done-result-done r))
                'undone (done-result-undone? r)
                'committed (done-result-committed? r)))
      (printf "~a ~s in ~a (line ~a)~a\n"
              (if (done-result-undone? r) "undone" "done")
              (done-result-title r)
              (done-result-file r)
              (done-result-line r)
              (committed-suffix (done-result-committed? r)))))

(define (cmd-move json? file-arg no-commit? clear? title-parts date-arg)
  (when (null? title-parts)
    (die exit-usage "move requires TITLE|^anchor" #:json? json?))
  (define spec (string-join title-parts " "))
  (define r
    (run-op json?
            (λ ()
              (ops-move! (or file-arg (default-file)) spec date-arg
                         #:clear? clear?
                         #:commit? (not no-commit?)))))
  (if json?
      (write-json-stdout
       (ok-hash 'file (move-result-file r)
                'title (move-result-title r)
                'line (move-result-line r)
                'date (nullish (move-result-date r))
                'committed (move-result-committed? r)))
      (printf "moved ~s in ~a (line ~a)~a~a\n"
              (move-result-title r)
              (move-result-file r)
              (move-result-line r)
              (if (move-result-date r)
                  (format " -> ~a" (move-result-date r))
                  " date cleared")
              (committed-suffix (move-result-committed? r)))))

(define (cmd-daily json? date-arg home-arg no-commit?)
  (define r
    (run-op json?
            (λ ()
              (ops-daily! (or home-arg (path->string (olai-home)))
                          (or date-arg (today-iso))
                          #:commit? (not no-commit?)))))
  (if json?
      (write-json-stdout
       (ok-hash 'day (daily-result-day r)
                'file (daily-result-file r)
                'created_month (daily-result-created-month? r)
                'created_day (daily-result-created-day? r)
                'line (daily-result-line r)
                'committed (daily-result-committed? r)))
      (printf "daily ~a in ~a (line ~a)~a~a~a\n"
              (daily-result-day r)
              (daily-result-file r)
              (daily-result-line r)
              (if (daily-result-created-month? r) ", created month" "")
              (if (daily-result-created-day? r) ", created day" "")
              (committed-suffix (daily-result-committed? r)))))

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
(define (cmd-serve paths dir port bind)
  (define acp-command (acp-command-or-die))
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
         #:acp-command acp-command
         #:agent-cwd dir
         #:on-listen
         (λ (bound)
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

;; The skin on stdout, the same bytes /static/app.css serves. No --json: CSS
;; is the output, and a diff of two of these is how you read a skin change.
(define (cmd-css)
  (displayln (stylesheet))
  (exit exit-ok))

(define (usage)
  (eprintf "usage: olai <command> [options] ...\n")
  (eprintf "\n")
  (eprintf "commands:\n")
  (eprintf "  check    [--json] [file ...]  validate outline(s) (default: $OLAI_HOME/Tasks.rkt)\n")
  (eprintf "  tree     [--json] [file ...]  outline(s) as JSON (human view: web)\n")
  (eprintf "  agenda   [--json] [file ...]  OVERDUE / TODAY / UPCOMING (merged)\n")
  (eprintf "  calendar [--json] [--month YYYY-MM] [file ...]  days with dated items\n")
  (eprintf "  serve    [--port N] [--bind ADDR] [DIR | file ...]  web view (Ctrl-C to stop)\n")
  (eprintf "           DIR (default: .) serves DIR/*.rkt; the agent works in DIR\n")
  (eprintf "  add      [--json] [--file F] [--date ISO] [--description TEXT]\n")
  (eprintf "           [--parent TITLE|^anchor] [--no-commit] TITLE...\n")
  (eprintf "  done     [--json] [--file F] [--undo] [--no-commit] TITLE|^anchor\n")
  (eprintf "  move     [--json] [--file F] [--no-commit] [--clear] TITLE|^anchor DATE\n")
  (eprintf "  daily    [--json] [--date YYYY-MM-DD] [--home DIR] [--no-commit]\n")
  (eprintf "           ensure today in Daily/\n")
  (eprintf "  ics      [--out PATH] [file ...]  RFC 5545 VCALENDAR of dated tasks\n")
  (eprintf "  css      the generated stylesheet on stdout (what serve answers)\n")
  (eprintf "\n")
  (eprintf "exit codes: 0 ok | 1 usage | 2 validation/load | 3 not found\n")
  (eprintf "agent contract: docs/cli.md\n"))

;; ---- subcommand parsers via racket/cmdline ----

(define (cli-check)
  (define json? #f)
  (define file-args '())
  (command-line
   #:program "olai check"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   #:args paths
   (set! file-args paths))
  (cmd-check (resolve-files file-args json?) json?))

(define (cli-tree)
  (define json? #t) ; always JSON; flag kept as no-op for agents
  (define file-args '())
  (command-line
   #:program "olai tree"
   #:once-each
   [("--json") "No-op (tree is always JSON)" (set! json? #t)]
   #:args paths
   (set! file-args paths))
  (cmd-tree (resolve-files file-args #t) #t))

(define (cli-agenda)
  (define json? #f)
  (define file-args '())
  (command-line
   #:program "olai agenda"
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
   #:program "olai calendar"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--month") m "Month YYYY-MM (default: current)" (set! month m)]
   #:args paths
   (set! file-args paths))
  (cmd-calendar (resolve-files file-args json?) json? month))

(define (cli-serve)
  (define port 8080)
  (define bind "127.0.0.1")
  (define file-args '())
  (command-line
   #:program "olai serve"
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
  (define-values (roots dir) (serve-roots file-args))
  (cmd-serve roots dir port (if (string=? bind "") #f bind)))

(define (cli-add)
  (define json? #f)
  (define file-arg #f)
  (define date #f)
  (define desc #f)
  (define no-commit? #f)
  (define parent #f)
  (define titles '())
  (command-line
   #:program "olai add"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: $OLAI_HOME/Tasks.rkt)" (set! file-arg f)]
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
   #:program "olai done"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: $OLAI_HOME/Tasks.rkt)" (set! file-arg f)]
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
   #:program "olai move"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--file") f "Outline file (default: $OLAI_HOME/Tasks.rkt)" (set! file-arg f)]
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
   #:program "olai ics"
   #:once-each
   [("--out") path "Write ICS to path (default: stdout)" (set! out-path path)]
   #:args paths
   (set! file-args paths))
  (cmd-ics (resolve-files file-args #f) out-path))

(define (cli-css)
  (command-line
   #:program "olai css"
   #:args ()
   (void))
  (cmd-css))

(define (cli-daily)
  (define json? #f)
  (define date-arg #f)
  (define home-arg #f)
  (define no-commit? #f)
  (command-line
   #:program "olai daily"
   #:once-each
   [("--json") "Emit versioned JSON on stdout" (set! json? #t)]
   [("--date") d "Day YYYY-MM-DD (default: today)" (set! date-arg d)]
   [("--home") h "Outline home (default: $OLAI_HOME)" (set! home-arg h)]
   [("--no-commit") "Do not auto-commit even in a git repo" (set! no-commit? #t)]
   #:args ()
   (void))
  (cmd-daily json? date-arg home-arg no-commit?))

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
           [("done") (cli-done)]
           [("move") (cli-move)]
           [("daily") (cli-daily)]
           [("ics") (cli-ics)]
           [("css") (cli-css)]
           [else
            (die exit-usage (format "unknown command ~s" cmd) #:json? #f)])))]))

(module+ main
  (main))
