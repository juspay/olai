#lang racket/base

;; What the write commands DO, with no idea that a terminal exists.
;;
;; add / done / move / daily each used to be one CLI function that resolved,
;; edited, wrote, committed, decided an exit code and printed — so nothing
;; but a subprocess could call them, and `die` was reachable from the middle
;; of the logic. Here each op is a function from arguments to a result struct
;; (or an exn:fail:op naming what went wrong and how bad it is); cli.rkt turns
;; those into JSON, text and exit codes, and the web mutation routes will call
;; the same functions.

(require racket/contract
         racket/file
         racket/path
         racket/string
         ;; where done work goes, and the file name everything agrees on
         olai/archive
         olai/capture
         olai/daily
         olai/dates
         ;; what state a node is in, and whether it is one the file stores at
         ;; all — the rule is the language's, and a write only asks it
         (only-in olai/lang/expander
                  task-title task-status task-child-tasks task-status-derived?)
         (only-in olai/lang/jsonl jsonl-path?)
         olai/jsonl-edit
         olai/status
         olai/edit
         olai/load
         olai/move
         olai/resolve
         ;; the namespace an outline is read in — the store owns it, and a
         ;; write reads what is on disk now or it is not a write
         (only-in olai/store call-in-outline-namespace)
         ;; moving a whole subtree between two outline texts
         olai/subtree)

;; The write surface: the CLI calls it, the web mutation routes will. Both
;; get told what an op takes and what its result carries — including that a
;; result's `file` is the file actually written, as a string, and that a
;; failure arrives as exn:fail:op (not contracted: an exn is not a value the
;; caller constructs).
;; op-fail is exported because a failure of this kind is raised from three
;; other modules too (the ACP bridge, the chat routes, the CLI's unset-home
;; check), and they used to build the struct positionally — so the field count
;; was their problem, and adding `detail` was an edit at four unrelated sites.
;; One constructor, keyword-defaulted, and the next field is an edit here.
(provide (struct-out exn:fail:op)
         op-fail
         (contract-out
          [struct add-result ([file string?]
                              [title string?]
                              [date (or/c string? #f)]
                              [description (or/c string? #f)]
                              [parent (or/c string? #f)]
                              [line exact-positive-integer?]
                              [created-inbox? boolean?]
                              [committed? boolean?])]
          [struct mark-result ([file string?]
                               [title string?]
                               [line exact-positive-integer?]
                               [state mark-state/c]
                               [stamp (or/c string? #f)]
                               [undone? boolean?]
                               [committed? boolean?])]
          [struct move-result ([file string?]
                               [title string?]
                               [line exact-positive-integer?]
                               [date (or/c string? #f)]
                               [committed? boolean?])]
          [struct archive-result ([file string?]
                                  [from string?]
                                  [title string?]
                                  [line exact-positive-integer?]
                                  [ancestors (listof string?)]
                                  [created-archive? boolean?]
                                  [committed? boolean?])]
          [struct daily-result ([file string?]
                                [day string?]
                                [line exact-positive-integer?]
                                [created-month? boolean?]
                                [created-day? boolean?]
                                [covered-by-glob (or/c string? #f)]
                                [committed? boolean?])]
          [ops-add! (->* ((or/c path? string?) string?)
                         (#:date (or/c string? #f)
                          #:description (or/c string? #f)
                          #:parent (or/c string? #f)
                          #:commit? boolean?)
                         add-result?)]
          [mark-state/c flat-contract?]
          [ops-mark! (->* ((or/c path? string?) mark-state/c string? string?)
                          (#:undo? boolean? #:commit? boolean?)
                          mark-result?)]
          [ops-move! (->* ((or/c path? string?) string? (or/c string? #f))
                          (#:clear? boolean? #:commit? boolean?)
                          move-result?)]
          [ops-archive! (->* ((or/c path? string?) string?)
                             (#:commit? boolean?)
                             archive-result?)]
          [ops-daily! (->* ((or/c path? string?) string?)
                           (#:commit? boolean?)
                           daily-result?)]))

;; kind: 'usage | 'validation | 'not-found | 'derived | 'busy — what the caller
;; should make of it (the CLI maps kinds to exit codes; a web route maps them
;; to statuses). 'derived is a write that would STORE a state the tree already
;; answers (olai/lang/state) — its own kind because it is nobody's mistake and
;; there is something else to do instead, which the detail names. 'busy is
;; likewise nobody's fault and reaches no CLI command: the ACP bridge raises it
;; when a second prompt arrives mid-turn, and a route turns it into 409.
;; file/line/col carry the srcloc when there is one (CLAUDE.md: errors carry
;; file:line:col).
;; detail: what the failure knows about ITSELF, as keys for the error object
;; beside the message (olai/json/reply). The values are DOMAIN values — the
;; unfinished children below are tasks, not JSON — because every other thing
;; this layer answers with is a domain value and the reply layer renders it.
;; Empty for most failures.
(struct exn:fail:op exn:fail (kind file line col detail) #:transparent)

(define (op-fail kind fmt #:file [file #f] #:line [line #f] #:col [col #f]
                 #:detail [detail (hash)]
                 . args)
  (raise (exn:fail:op (apply format fmt args)
                      (current-continuation-marks)
                      kind file line col detail)))

;; Anything the layers below raise (append-capture, the metadata engine, the
;; resolver) is a validation failure about `file` until proven otherwise.
(define (as-validation file thunk)
  (with-handlers ([exn:fail:op? raise]
                  [exn:fail? (λ (e) (op-fail 'validation "~a" #:file file
                                             (exn-message e)))])
    (thunk)))

;; The one write: validate-then-rename over every file the op touched (as the
;; set they are — olai/edit), then commit them, together, if asked.
;; edits: (listof (cons path text)). -> committed?
;;
;; The files to commit are the ones the edit named: the write applies all of
;; them or none, so there is nothing to collect on the way out.
(define (write! edits #:commit [message #f])
  (as-validation
   (car (car edits))
   (λ ()
     (apply-outline-edits!
      edits
      #:on-invalid
      (λ (err)
        (op-fail 'validation "~a" #:file (load-error-file err)
                 #:line (load-error-line err) #:col (load-error-col err)
                 (load-error-message err))))))
  ;; One change, one commit, however many files it landed in.
  (and message (try-git-commit (map car edits) message) #t))

(define (load-outline-or-fail path)
  (define r (try-load-outline path))
  (when (load-error? r)
    (op-fail 'validation "~a" #:file (load-error-file r)
             #:line (load-error-line r) #:col (load-error-col r)
             (load-error-message r)))
  r)

;; Where the node a command named actually is — which may be another file:
;; an @include fragment, or the sibling root that declares the `^anchor`
;; (olai/resolve). The write lands wherever that is.
;;
;; In a FRESH namespace, for the same reason the write path validates in one
;; (olai/edit): the module registry caches a loaded outline for the life of the
;; process, so a second op in one process would resolve against the trees as
;; they were before the first one wrote. A CLI process runs one op and never
;; noticed; `archive` moves a node BETWEEN files, and a caller that holds the
;; process open — a web mutation route, a test — would be told it is still
;; where it was.
(define (locate-in-set root-path spec)
  (call-in-outline-namespace
   (λ () (locate (load-outline-or-fail root-path) spec))))

(define (existing-file path)
  (define full (simple-form-path (path->complete-path path)))
  (unless (file-exists? full)
    (op-fail 'not-found "file not found: ~a" #:file full full))
  full)

;; The text a write starts from: what is on disk, or what a brand new outline
;; says before anybody has written a node into it. Two ops create a file that
;; was not there — `add` its Inbox, `archive` the archive — and they agree here
;; about what an empty one is. JSONL's empty file is empty (no header line).
(define (outline-text-or-new path)
  (cond
    [(file-exists? path) (file->string path)]
    [(jsonl-path? path) ""]
    [else "#lang olai\n"]))

(define (jsonl-file? path)
  (or (jsonl-path? path)
      (eq? (outline-lang path) 'jsonl)))

;; ---- add ------------------------------------------------------------------

(struct add-result (file title date description parent line created-inbox? committed?)
  #:transparent)

;; parent: #f (Inbox) | "TITLE" | "^anchor". A ^anchor parent routes the write
;; into the file that DEFINES it, which may be an @include fragment.
(define (ops-add! file title
                  #:date [date #f]
                  #:description [desc #f]
                  #:parent [parent #f]
                  #:commit? [commit? #t])
  (when (and date (not (valid-iso-date-string? date)))
    (op-fail 'usage
             "invalid --date ~s; expected YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]"
             date))
  (define date* (and date (normalize-date-string date)))
  (define root-path (simple-form-path (path->complete-path file)))
  (define path
    (cond
      [(and parent (regexp-match? #px"^\\^[A-Za-z0-9_-]+$" (string-trim parent)))
       (as-validation root-path
                      (λ () (located-file (locate-in-set root-path parent))))]
      [else root-path]))
  (define original (outline-text-or-new path))
  (define-values (new-text line created-inbox?)
    (as-validation
     path
     (λ ()
       (if (jsonl-file? path)
           (jsonl-append-capture original title
                                 #:date date*
                                 #:description desc
                                 #:parent parent)
           (append-capture original title
                           #:date date*
                           #:description desc
                           #:parent parent)))))
  (define committed?
    (write! (list (cons path new-text)) #:commit (and commit? (format "capture: ~a" title))))
  (add-result (path->string path) title date* desc parent
              line created-inbox? committed?))

;; ---- done / doing ---------------------------------------------------------
;;
;; ONE op. Marking a node done and marking it doing are the same four steps —
;; resolve TITLE|^anchor against the loaded tree, edit the DEFINING file's
;; text with the usual write safety, commit, answer — and they differ only in
;; the row of the table below. Written twice, a new flag on one of them (or a
;; fourth state) would be an edit nobody makes to the other.

(define mark-state/c (or/c 'done 'doing))

;; mark/undo are the text mutators olai/status owns. The verbs are what a
;; `git log` reads like, which is the only reason they are not just the
;; state's name.
(struct mark-ops (mark undo verb undo-verb) #:transparent)

(define marks
  (hash 'done (mark-ops mark-done-in-text undo-done-in-text "done" "undone")
        'doing (mark-ops mark-doing-in-text undo-doing-in-text
                         "doing" "not-doing")))

;; state: which mark this is, so a caller (and the CLI's JSON) need not be
;;        told twice
;; stamp: #f when undone, else the ISO day the mark was written with
(struct mark-result (file title line state stamp undone? committed?)
  #:transparent)

;; A DERIVED STATE IS NOT A STATE YOU CAN WRITE.
;;
;; A parent with task children and no mark of its own is done exactly when they
;; all are (olai/lang/state), and `done` on it would store the answer the tree
;; is already giving — the second copy this whole feature exists to delete, and
;; the one that goes stale. So it is refused before anything is edited, and the
;; refusal names the unfinished children: doing them one at a time is the thing
;; to do instead, and marking them all would be inventing a state for each of
;; them that nobody asked for.
;;
;; `doing` is not guarded. It is a claim about somebody's attention, never
;; derived from anything (olai/lang/state), so writing one on a parent stores
;; something the tree does not already say.
;;
;; It is HERE and not with the other two preconditions (olai/status, which
;; refuses a node that is already done and demands one that is not), for two
;; reasons that are the same reason: those are answerable from the file's TEXT,
;; where this one has to ask the tree — an @include splices children under a
;; node no text scan sees — and only this layer decides what a failure MEANS.
;; A precondition with a kind of its own lives where kinds are.
;;
;; `hit` is the resolver's answer (olai/resolve): the node, the file it is
;; defined in, and the line it is on, which is exactly what the refusal needs.
(define (refuse-derived-done hit undo?)
  (define tk (located-task hit))
  (when (and tk (task-status-derived? tk))
    (define kids (task-child-tasks tk))
    (define unfinished
      (for/list ([k (in-list kids)] #:unless (eq? (task-status k) 'done)) k))
    (define label (format "~s" (located-title hit)))
    (op-fail
     'derived
     #:file (located-file hit)
     #:line (add1 (located-index hit))
     #:detail (hash 'children unfinished)
     "~a"
     (cond
       [undo?
        (format (string-append "~a has no @done to undo: its done-ness is "
                               "derived from its ~a children")
                label (length kids))]
       [(null? unfinished)
        (format (string-append "~a is already done: all ~a of its children "
                               "are, so it derives done")
                label (length kids))]
       [else
        (format (string-append "~a derives its done-ness from its children, "
                               "~a of ~a unfinished: ~a; done those instead")
                label (length unfinished) (length kids)
                (string-join (for/list ([k (in-list unfinished)])
                               (format "~s" (task-title k)))
                             ", "))]))))

(define (ops-mark! file state spec today
                   #:undo? [undo? #f]
                   #:commit? [commit? #t])
  (define ops (hash-ref marks state))
  (define root-path (existing-file file))
  (define hit
    (as-validation root-path (λ () (locate-in-set root-path spec))))
  (define path (located-file hit))
  (define title (located-title hit))
  (define at (located-index hit))
  (when (eq? state 'done) (refuse-derived-done hit undo?))
  (define original (file->string path))
  (define-values (new-text line)
    (as-validation
     path
     (λ ()
       (cond
         [(jsonl-file? path)
          (case state
            [(done)
             (if undo?
                 (jsonl-undo-done-in-text original spec #:at at)
                 (jsonl-mark-done-in-text original spec today #:at at))]
            [(doing)
             (if undo?
                 (jsonl-undo-doing-in-text original spec #:at at)
                 (jsonl-mark-doing-in-text original spec today #:at at))])]
         [else
          (if undo?
              ((mark-ops-undo ops) original spec #:at at)
              ((mark-ops-mark ops) original spec today #:at at))]))))
  (define verb (if undo? (mark-ops-undo-verb ops) (mark-ops-verb ops)))
  (define committed?
    (write! (list (cons path new-text)) #:commit (and commit? (format "~a: ~a" verb title))))
  (mark-result (path->string path) title line state
               (and (not undo?) today) undo? committed?))

;; ---- move (set / clear @date) ---------------------------------------------

;; date: #f when cleared, else the normalized ISO date written.
(struct move-result (file title line date committed?) #:transparent)

(define (ops-move! file spec date
                   #:clear? [clear? #f]
                   #:commit? [commit? #t])
  (when (and (not clear?) (not date))
    (op-fail 'usage "move requires DATE (YYYY-MM-DD[THH:MM[:SS]]) or --clear"))
  (define root-path (existing-file file))
  (define hit
    (as-validation root-path (λ () (locate-in-set root-path spec))))
  (define path (located-file hit))
  (define at (located-index hit))
  (define original (file->string path))
  (define-values (new-text line title date-val)
    (as-validation
     path
     (λ ()
       (cond
         [(jsonl-file? path)
          (if clear?
              (let-values ([(t l ttl) (jsonl-clear-date-in-text original spec #:at at)])
                (values t l ttl #f))
              (jsonl-set-date-in-text original spec date #:at at))]
         [else
          (if clear?
              (let-values ([(t l ttl) (clear-date-in-text original spec #:at at)])
                (values t l ttl #f))
              (set-date-in-text original spec date #:at at))]))))
  (define committed?
    (write! (list (cons path new-text))
            #:commit (and commit?
                          (if clear?
                              (format "move: ~a (cleared date)" title)
                              (format "move: ~a -> ~a" title date-val)))))
  (move-result (path->string path) title line date-val committed?))

;; ---- archive --------------------------------------------------------------
;;
;; The only op that moves a node rather than editing one in place, and the only
;; one that writes two files: the outline it left and the archive it arrived
;; in. Both are validated as one set before either moves, and both land in one
;; commit — it is one change.
;;
;; It stamps nothing. Archiving is not finishing: a done node keeps its @done,
;; an open one stays open, and what changes is only where the node lives.

;; file: the archive it now lives in (the file a reader should open)
;; from: the outline it left — which may be an @include fragment, not the
;;       file the command named
;; ancestors: the titles re-created (or merged into) above it
(struct archive-result (file from title line ancestors created-archive? committed?)
  #:transparent)

(define (ops-archive! file spec #:commit? [commit? #t])
  (define root-path (existing-file file))
  ;; Beside the outline the command NAMED, never beside the defining file: a
  ;; fragment lives in a subdirectory and `serve DIR` globs the top level, so
  ;; an archive down there is one nothing loads (olai/archive).
  (define dest (archive-path-for root-path))
  (define hit (as-validation root-path (λ () (locate-in-set root-path spec))))
  (define src (located-file hit))
  (define title (located-title hit))
  ;; Asked of the file, not of "is this the file we were about to write": the
  ;; question is whether the node is already archived, and olai/archive is what
  ;; answers that one.
  (when (archived-file? src)
    (op-fail 'validation "~s is already archived (~a)" #:file src title src))
  ;; cut/graft are outline-text operations; JSONL archive needs its own
  ;; subtree rewrite and is not in this PR.
  (when (or (jsonl-file? src) (jsonl-file? dest))
    (op-fail 'validation
             #:file src
             "archive does not yet support .jsonl outlines (~a); use #lang olai"
             src))
  (define created? (not (file-exists? dest)))
  (define-values (src-text* block ancestors)
    (as-validation src (λ () (cut-subtree (file->string src)
                                          (located-index hit)))))
  (define-values (dest-text* line)
    (as-validation dest
                   (λ () (graft-subtree (outline-text-or-new dest)
                                        ancestors
                                        block))))
  (define committed?
    (write! (list (cons src src-text*) (cons dest dest-text*))
            #:commit (and commit? (format "archive: ~a" title))))
  (archive-result (path->string dest) (path->string src) title line ancestors
                  created? committed?))

;; ---- daily ----------------------------------------------------------------

;; covered-by-glob: the @include pattern the root had already written that
;; names this month's fragment, verbatim — #f when none does, which is the run
;; that writes the literal line. A covered fragment leaves the root alone: it
;; is already spliced, and a second include is the same days twice.
(struct daily-result (file day line created-month? created-day? covered-by-glob
                           committed?)
  #:transparent)

;; Ensures today's day node (and the month fragment + @include that hold it).
;; Commits like every other write does — it used to be the one command that
;; changed the outline behind git's back.
(define (ops-daily! home day #:commit? [commit? #t])
  (unless (bare-iso-date-title? day)
    (op-fail 'usage "invalid --date ~s; expected YYYY-MM-DD" day))
  ;; The day can land in two files (the month fragment and the root that
  ;; includes it) — one change, so one commit.
  (define written '())
  (define result
    (as-validation
     #f
     (λ ()
       (ensure-daily-day! home day
                          #:on-applied (λ (p) (set! written (cons p written)))))))
  (define committed?
    (and commit?
         (try-git-commit (reverse written) (format "daily: ~a" day))
         #t))
  (daily-result (hash-ref result 'file)
                (hash-ref result 'day)
                (hash-ref result 'line)
                (hash-ref result 'created_month)
                (hash-ref result 'created_day)
                (hash-ref result 'covered_by_glob)
                committed?))
