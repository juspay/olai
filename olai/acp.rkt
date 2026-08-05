#lang racket/base

;; The ACP client: one subprocess, one protocol, no browser.
;;
;; `selfflowy serve` spawns an agent that speaks the Agent Client Protocol
;; (JSON-RPC 2.0, one object per line, over stdio). Everything about that
;; protocol stops here — nothing else spells "session/prompt" — and nothing in
;; here knows what a page, a frame or an SSE event is. What a caller gets is a
;; thing it can boot, prompt, cancel, load, reset and stop, plus a stream of
;; TYPED EVENTS through the one handler it gave at construction. web/chat.rkt
;; is that caller: it turns the events into a conversation.
;;
;; What this owns, and why:
;;
;;   * the subprocess, and the conversation it comes up in. Boot is EAGER
;;     (`acp-boot!`, off the server's own start) because the panel is meant to
;;     show your last conversation before anybody types into it: after
;;     initialize the client asks for the agent's stored sessions and ADOPTS
;;     the most recently updated one, replaying it; with nothing stored it
;;     starts a new one. Boot runs in its own thread, so pages serve while it
;;     happens, and a boot that fails changes nothing — the next prompt retries
;;     it exactly like a crash does.
;;
;;     Adopt-or-create is HERE rather than in the conversation because it is a
;;     sequence of round trips whose order is a protocol fact: a load replays
;;     before it answers, a mode can only be asked of a session that exists,
;;     and the model is read off the result that made the session. What the
;;     panel comes up SHOWING is still the conversation's business — it is
;;     derived, whole, from the events below.
;;
;;   * ids and correlation: every outstanding request owns a channel, and a
;;     subprocess that died fails all of them at once. Nobody waits on a
;;     process that is gone.
;;   * the answer to session/request_permission. An unanswered one hangs the
;;     turn forever, so it is answered immediately with the first allow-flavored
;;     option — that is about not wedging the wire, which is why it is protocol
;;     and not policy. The session asks for bypassPermissions mode at boot;
;;     this is the backstop for when that was refused (it is, running as root).
;;   * reading the payloads: which update kind this is, which configOptions
;;     entry is the model, what a command list says, how a session list sorts.
;;     An event carries what was READ, never the raw jsexpr.
;;
;; Threads: the caller's (prompt / cancel / load / stop), one READER draining
;; the agent's stdout, one draining its stderr into the log, one per BOOT and
;; one per turn's wait. `sema` guards the state below; `boot-sema` covers the
;; spawn/session handshake (never both at once, and never `sema` around a
;; blocking call); `out-sema` serializes writes to the agent's stdin, which
;; three threads share.
;;
;; The seam has one rule: an event is NEVER delivered with `sema` held. The
;; handler takes a lock of its own, and a client that called out under its own
;; would be one half of a deadlock.

(require json
         racket/async-channel
         racket/contract
         racket/path
         racket/string
         (only-in selfflowy/fail user-fail)
         (only-in selfflowy/ops exn:fail:op))

;; The surface a caller sees. `make-acp-client` is told how to reach the agent
;; (a command, a directory) and where to put what it hears; every other export
;; is a verb, a read, or one of the events.
(provide (contract-out
          [acp-command-problem (-> (or/c path? string?) (or/c string? #f))]
          [make-acp-client (->* (#:command (or/c path? string?)
                                 #:cwd (or/c path? string?)
                                 #:on-event (-> acp-event? any))
                                (#:log-port output-port?)
                                acp-client?)]
          [acp-client? (-> any/c boolean?)]
          [acp-boot! (-> acp-client? void?)]
          [acp-prompt! (->* (acp-client? string?) (#:on-send (-> any)) string?)]
          [acp-cancel! (-> acp-client? void?)]
          [acp-new-session! (-> acp-client? void?)]
          [acp-load-session! (-> acp-client? string? void?)]
          [acp-sessions (-> acp-client? (listof hash?))]
          [acp-kill! (-> acp-client? void?)]
          [acp-stop! (-> acp-client? void?)]
          [acp-stopped? (-> acp-client? boolean?)]
          [acp-log! (-> acp-client? string? void?)]
          [acp-log-once! (-> acp-client? string? string? void?)]
          [struct acp-event ()]
          [struct (acp-said acp-event) ((text string?))]
          [struct (acp-user-said acp-event) ((text string?))]
          [struct (acp-tool acp-event) ((id string?) (title string?) (status string?))]
          [struct (acp-tool-moved acp-event) ((id string?)
                                              (title (or/c string? #f))
                                              (status (or/c string? #f)))]
          [struct (acp-config-model acp-event) ((name (or/c string? #f))
                                                (labels (hash/c string? string?)))]
          [struct (acp-live-model acp-event) ((id string?))]
          [struct (acp-commands acp-event) ((commands (listof hash?)))]
          [struct (acp-session acp-event) ((id string?) (title (or/c string? #f)))]
          [struct (acp-session-titled acp-event) ((title string?))]
          [struct (acp-session-over acp-event) ()]
          [struct (acp-replay-started acp-event) ()]
          [struct (acp-replay-ended acp-event) ()]
          [struct (acp-gone acp-event) ((why string?))]
          [struct (acp-trouble acp-event) ((message string?))]))

;; ---- what the client hears --------------------------------------------------
;;
;; The whole vocabulary, and the only way anything leaves this module. A caller
;; that needs something not in here needs a new event, not a peek at the wire.
;;
;;   acp-said           the agent's text, one chunk as it arrived
;;   acp-user-said      a user message; only a REPLAY carries these (live, the
;;                      agent is echoing the prompt the caller just sent)
;;   acp-tool           a tool call, announced
;;   acp-tool-moved     ... changed. #f is "unchanged", not "cleared"
;;   acp-config-model   the model the session was told to run, labelled the way
;;                      the picker labels it, plus that picker as value -> label
;;                      (the labels for whatever the LIVE model turns out to be)
;;   acp-live-model     the model a turn is actually running on, raw id
;;   acp-commands       the whole slash-command list, replaced not merged
;;   acp-session        which stored conversation this now is. `title` is what
;;                      it was listed under, #f when nobody knows one yet
;;   acp-session-titled the agent wrote a name for the conversation
;;   acp-session-over   ... and the conversation it named is gone: the client is
;;                      between sessions (a new one, a load, a dead agent)
;;   acp-replay-started a session/load is about to replay a conversation; every
;;                      event until acp-replay-ended is history, not news
;;   acp-replay-ended   ... and it is all in
;;   acp-gone           the subprocess ended and nothing asked it to
;;   acp-trouble        something failed where no caller was waiting (a boot, a
;;                      refused mode). Already logged: the message is for a
;;                      person, and the caller decides where a person sees it
;;
;; A turn's END is not an event: `acp-prompt!` returns its stop reason, or
;; raises. The caller that asked is the one waiting.

(struct acp-event () #:transparent)
(struct acp-said acp-event (text) #:transparent)
(struct acp-user-said acp-event (text) #:transparent)
(struct acp-tool acp-event (id title status) #:transparent)
(struct acp-tool-moved acp-event (id title status) #:transparent)
(struct acp-config-model acp-event (name labels) #:transparent)
(struct acp-live-model acp-event (id) #:transparent)
(struct acp-commands acp-event (commands) #:transparent)
(struct acp-session acp-event (id title) #:transparent)
(struct acp-session-titled acp-event (title) #:transparent)
(struct acp-session-over acp-event () #:transparent)
(struct acp-replay-started acp-event () #:transparent)
(struct acp-replay-ended acp-event () #:transparent)
(struct acp-gone acp-event (why) #:transparent)
(struct acp-trouble acp-event (message) #:transparent)

;; ---- the handshake ----------------------------------------------------------

;; The client half. fs is false in both directions: this is not an editor and
;; will not serve file reads over the protocol — the agent has the outline on
;; disk and a shell.
(define client-capabilities
  (hash 'fs (hash 'readTextFile #f 'writeTextFile #f)))

(define protocol-version 1)

;; What `session/new` asks the Claude Code adapter to forward, and the
;; notification it forwards it under.
;;
;; The adapter wraps the Claude Code CLI, and a `/model` slash command is
;; handled INSIDE that CLI: the adapter never sees it as a config change, so
;; nothing is resent as a `config_option_update` and its `configOptions` keep
;; naming the model the session started on (see "which model" below). The live
;; model is in the CLI's own `system`/`init` message, which the adapter
;; forwards verbatim — but only to a client that asked, and only for the
;; message kinds it asked for. This is the narrowest possible ask: one small
;; message, once per turn (and again after the CLI reinitializes, which is what
;; a model switch does).
;;
;; An agent that is not the Claude Code adapter ignores `_meta` and nothing
;; here changes: the config option is still read, and still enough.
(define session-meta
  (hash 'claudeCode
        (hash 'emitRawSDKMessages (list (hash 'type "system" 'subtype "init")))))

(define sdk-message-method "_claude/sdkMessage")

;; Permissions are a session MODE, asked for once per session. A refusal is
;; not fatal: request_permission is answered anyway.
(define bypass-mode "bypassPermissions")

;; Boot is a few small round trips against a process that just started; a turn
;; is a person waiting on an LLM. Only the first gets a deadline.
(define boot-timeout-seconds 30)

;; Loading a session is not small: the agent re-opens a conversation and
;; replays every message in it before it answers. Its own, longer deadline.
(define load-timeout-seconds 120)

;; How long a clean shutdown waits before it stops asking.
(define stop-timeout-seconds 2)

;; ---- the client -------------------------------------------------------------

;; command/cwd/on-event/log-port are the outside world. Everything mutable
;; below is guarded by `sema`, except the spawn/session handshake, which takes
;; `boot-sema`. out-sema serializes writes to the agent's stdin.
;;
;; `cust` is what the subprocess and this module's threads are created under.
;; It matters because a prompt arrives on an HTTP request's thread, and the web
;; server gives every connection a custodian it shuts down as soon as the
;; response is written — which would take the reader and the agent process with
;; it the moment the 204 went out. The client's own custodian lives as long as
;; the client, not as long as the request that woke it (and is itself a child
;; of the server's, so stopping still stops).
(struct acp-client (command cwd on-event log-port cust
                    sema boot-sema out-sema
                    [sp #:mutable] [stdin #:mutable] [stdout #:mutable]
                    [session #:mutable]
                    [can-list? #:mutable] [can-load? #:mutable]
                    [next-id #:mutable] [pending #:mutable]
                    [spawned? #:mutable] [stopped? #:mutable]
                    [seen-kinds #:mutable]))

;; -> #f, or the phrase that says what is wrong with this path as an agent.
;; Both the CLI (which names the environment variable in front of it) and the
;; constructor ask; "executable" is spelled once.
(define (acp-command-problem cmd)
  (define p (if (path? cmd) cmd (string->path cmd)))
  (cond
    [(not (file-exists? p)) "does not exist"]
    [(not (memq 'execute (file-or-directory-permissions p))) "is not executable"]
    [else #f]))

(define (make-acp-client #:command command
                         #:cwd cwd
                         #:on-event on-event
                         #:log-port [log-port (current-error-port)])
  (define problem (acp-command-problem command))
  (when problem
    (user-fail "acp agent ~a: ~a" problem command))
  (acp-client (simple-form-path (if (path? command) command (string->path command)))
              (simple-form-path (if (path? cwd) cwd (string->path cwd)))
              on-event log-port
              (make-custodian)
              (make-semaphore 1) (make-semaphore 1) (make-semaphore 1)
              #f #f #f
              #f
              #f #f
              0 (hash)
              #f #f
              (hash)))

(define (with-state cl proc)
  (call-with-semaphore (acp-client-sema cl) proc))

;; Anything that must outlive the call that started it — the subprocess, its
;; pipes, the reader threads, a boot — is created in here.
(define (in-custodian cl thunk)
  (parameterize ([current-custodian (acp-client-cust cl)]) (thunk)))

;; The seam. Never called with `sema` held: see the header.
(define (emit! cl ev)
  ((acp-client-on-event cl) ev))

;; ---- the log ---------------------------------------------------------------

;; The agent's stderr is a log sink, not a channel: the adapter redirects all
;; its console output there, and a pipe nobody drains eventually blocks the
;; process that is writing to it. The port is the client's because the process
;; is; a caller with something to say says it through `acp-log!`, so the "acp:"
;; prefix has one owner.
(define (log-line cl str)
  (with-handlers ([exn:fail? void])
    (displayln (string-append "acp: " str) (acp-client-log-port cl))
    (flush-output (acp-client-log-port cl))))

(define (acp-log! cl str) (log-line cl str))

;; A repeating condition is worth exactly one line of log: the agent says it
;; every turn, and a log that repeats it every turn is a log nobody reads.
(define (acp-log-once! cl key message)
  (define new?
    (with-state cl
      (λ ()
        (cond
          [(hash-ref (acp-client-seen-kinds cl) key #f) #f]
          [else (set-acp-client-seen-kinds! cl (hash-set (acp-client-seen-kinds cl) key #t))
                #t]))))
  (when new? (log-line cl message))
  (void))

;; Noise the client does not understand.
(define (log-kind-once! cl kind)
  (acp-log-once! cl kind (format "ignoring ~a" kind)))

(define (elide str [n 240])
  (if (> (string-length str) n)
      (string-append (substring str 0 n) "…")
      str))

;; Something went wrong where no caller was waiting (a boot, a refused mode):
;; the log gets the detail, the event gets the sentence a person reads.
(define (trouble! cl message)
  (log-line cl message)
  (emit! cl (acp-trouble message)))

;; ---- which model ------------------------------------------------------------
;;
;; Two sources, because one of them is not enough.
;;
;;   * the session's CONFIG OPTIONS: the entry with id "model" carries the
;;     picked model in `currentValue`, and the picker it came from in
;;     `options`. It arrives in the session/new result and again in a
;;     `config_option_update` whenever anything in that set moves. This is the
;;     agent's word for what was CHOSEN.
;;   * the LIVE model, in the CLI's own `system`/`init` message (forwarded
;;     because session/new asked for it — see `session-meta`). This is what the
;;     session is actually RUNNING.
;;
;; They disagree after a `/model` slash command: that is handled inside the
;; wrapped CLI, so the adapter never learns of it and keeps reporting the model
;; the session started on. Reading only the config option leaves a header that
;; says "Fable" while every turn runs on Opus.
;;
;; Both are read here and neither is reconciled here: which one is showing, and
;; whether it moved, is what somebody DRAWS, and it is decided where the drawing
;; is. What this owes that decision is the picker, which is why the labels ride
;; along with the config model.
;;
;; Nothing here guesses. A model is labelled from the picker when the picker
;; offers it and left raw when it does not; the raw id is truthful, and a client
;; that fuzzy-matched "claude-opus-5[1m]" onto some nearby row would be
;; inventing an answer.

(define model-config-id "model")

;; -> the model entry of a configOptions set, or #f.
(define (model-config opts)
  (and (list? opts)
       (for/or ([o (in-list opts)]
                #:when (hash? o))
         (and (equal? (hash-ref o 'id #f) model-config-id) o))))

;; The picker as value -> label ("claude-fable" -> "Fable"), which is what the
;; agent calls its own models.
(define (option-labels options)
  (for*/hash ([o (in-list options)]
              #:when (hash? o)
              [value (in-value (string-or-false (hash-ref o 'value #f)))]
              #:when value
              [name (in-value (string-or-false (hash-ref o 'name #f)))]
              #:when name)
    (values value name)))

(define (read-config-model! cl opts)
  (define o (model-config opts))
  (when o
    (define options (let ([os (hash-ref o 'options '())]) (if (list? os) os '())))
    (define labels (option-labels options))
    (define current (string-or-false (hash-ref o 'currentValue #f)))
    (emit! cl (acp-config-model (and current (or (hash-ref labels current #f) current))
                                labels))))

;; ---- the stored conversations -----------------------------------------------
;;
;; An agent that keeps its conversations keys them by the directory it was
;; started in (`serve DIR` is what makes that directory stable — docs/cli.md).
;; So there is a "last session", and a server restart that came up with an empty
;; panel was throwing it away every time.

;; What sorts the list: an ISO 8601 timestamp, which is why it can be compared
;; as a string. A session the agent gave no timestamp sorts last, not first.
(define (session-stamp s)
  (or (string-or-false (hash-ref s 'updatedAt #f)) ""))

;; The agent's stored sessions for THIS cwd, newest first. Raw entries —
;; {sessionId, cwd, title, updatedAt} — the picker's shape is minted below.
(define (list-sessions cl)
  (define r (request! cl "session/list"
                      (hash 'cwd (path->string (acp-client-cwd cl)))))
  (define raw (let ([ss (hash-ref r 'sessions '())]) (if (list? ss) ss '())))
  (sort (for/list ([s (in-list raw)]
                   #:when (and (hash? s) (string? (hash-ref s 'sessionId #f))))
          s)
        string>? #:key session-stamp))

;; The name the picker showed for a session, off the same list it drew. Worth
;; a round trip on a button press: the agent pushes a title only when it
;; CHANGES one (at turn end), so a session loaded by id would otherwise sit
;; nameless in the header until somebody talked to it. Best-effort — a load is
;; not worth failing over a list.
(define (stored-title cl sid)
  (with-handlers ([exn:fail? (λ (_e) #f)])
    (and (with-state cl (λ () (acp-client-can-list? cl)))
         (for/or ([s (in-list (list-sessions cl))])
           (and (equal? (hash-ref s 'sessionId #f) sid)
                (string-or-false (hash-ref s 'title #f)))))))

;; What a picker draws: id, title, when, and which one you are in. Fresh from
;; the agent every time — nothing is cached here, because the agent's own list
;; is the only one that is right.
(define (acp-sessions cl)
  (define current (with-state cl (λ () (acp-client-session cl))))
  (unless (with-state cl (λ () (and (alive? cl) (acp-client-can-list? cl))))
    (gone-fail "the agent is not running, or does not keep sessions"))
  (define ss
    (with-handlers ([exn:fail? (λ (e) (gone-fail (exn-message e)))])
      (list-sessions cl)))
  (for/list ([s (in-list ss)])
    (define id (hash-ref s 'sessionId))
    (hash 'id id
          'title (or (string-or-false (hash-ref s 'title #f)) (json-null))
          'updatedAt (or (string-or-false (hash-ref s 'updatedAt #f)) (json-null))
          'current (equal? id current))))

;; ---- which slash commands ----------------------------------------------------
;;
;; The agent's own command list, pushed as an `available_commands_update`: once
;; just after session/new, and again whenever the set moves under a live
;; session (a skill discovered while the agent works somewhere new). It is the
;; WHOLE list every time — a replacement, not a delta.
;;
;; An entry on the wire is {name, description, input}. `input` is an argument
;; HINT for a command that takes one ("[low|medium|high]"), and it is dropped
;; here: a panel completes a NAME and the agent parses the rest of the line.
;; Nothing about invoking changes — a command is ordinary prompt text that
;; starts with "/name".

;; Only the two strings there are to draw, and only for entries that have a name.
(define (available-commands cmds)
  (if (list? cmds)
      (for*/list ([c (in-list cmds)]
                  #:when (hash? c)
                  [name (in-value (string-or-false (hash-ref c 'name #f)))]
                  #:when name)
        (hash 'name name
              'description (or (string-or-false (hash-ref c 'description #f)) "")))
      '()))

;; ---- the wire --------------------------------------------------------------

(define (send-line! cl js)
  (define line (jsexpr->string js))
  (call-with-semaphore
   (acp-client-out-sema cl)
   (λ ()
     (define out (acp-client-stdin cl))
     (unless out (user-fail "the agent is not running"))
     (write-string line out)
     (write-string "\n" out)
     (flush-output out))))

(define (next-id! cl)
  (with-state cl
    (λ ()
      (define id (add1 (acp-client-next-id cl)))
      (set-acp-client-next-id! cl id)
      id)))

;; Every outstanding request owns a channel; the reader puts the answer there,
;; and a subprocess that died puts a failure into all of them at once. Nobody
;; waits on a process that is gone.
(define (register-pending! cl id ch)
  (with-state cl
    (λ () (set-acp-client-pending! cl (hash-set (acp-client-pending cl) id ch)))))

(define (forget-pending! cl id)
  (with-state cl
    (λ () (set-acp-client-pending! cl (hash-remove (acp-client-pending cl) id)))))

(define (fail-all-pending! cl message)
  (define pending
    (with-state cl
      (λ ()
        (define p (acp-client-pending cl))
        (set-acp-client-pending! cl (hash))
        p)))
  (for ([(_id ch) (in-hash pending)])
    (async-channel-put ch (cons 'error message))))

;; -> the result jsexpr. Raises when the agent answered with an error, said
;; nothing before the deadline, or died with the question outstanding.
;;
;; `after-send` runs once the request is on the wire and before the wait —
;; the only moment from which a follow-up notification about THIS request is
;; meaningful to the agent (see the pending cancel).
(define (request! cl method params
                  #:timeout [timeout boot-timeout-seconds]
                  #:after-send [after-send void])
  (define id (next-id! cl))
  (define ch (make-async-channel))
  (register-pending! cl id ch)
  (define answer
    (with-handlers ([exn:fail? (λ (e) (forget-pending! cl id) (raise e))])
      (send-line! cl (hash 'jsonrpc "2.0" 'id id 'method method 'params params))
      (after-send)
      (if timeout (sync/timeout timeout ch) (sync ch))))
  (forget-pending! cl id)
  (cond
    [(not answer) (user-fail "~a: no answer from the agent in ~as" method timeout)]
    [(eq? (car answer) 'error) (user-fail "~a: ~a" method (cdr answer))]
    [else (cdr answer)]))

(define (notify! cl method params)
  (send-line! cl (hash 'jsonrpc "2.0" 'method method 'params params)))

;; ---- reading the agent -----------------------------------------------------

(define (reader-loop cl in)
  (let loop ()
    (define line
      (with-handlers ([exn:fail? (λ (_e) eof)])
        (read-line in 'any)))
    (cond
      [(eof-object? line) (handle-eof! cl)]
      [(string=? (string-trim line) "") (loop)]
      [else
       (define js (with-handlers ([exn:fail? (λ (_e) #f)]) (string->jsexpr line)))
       ;; A line that is not a JSON-RPC object is the agent's problem, not the
       ;; stream's: say so and keep reading.
       (if (hash? js)
           (dispatch! cl js)
           (log-line cl (format "dropped a line that is not JSON-RPC: ~a" (elide line))))
       (loop)])))

(define (dispatch! cl js)
  (define method (hash-ref js 'method #f))
  (define id (hash-ref js 'id #f))
  (with-handlers ([exn:fail? (λ (e) (log-line cl (format "dispatch failed: ~a" (exn-message e))))])
    (cond
      [(and method id) (handle-request! cl id method (hash-ref js 'params (hash)))]
      [method (handle-notification! cl method (hash-ref js 'params (hash)))]
      [id (handle-response! cl id js)]
      [else (log-line cl "dropped a JSON-RPC object with no id and no method")])))

;; JSON-RPC says a reply carries `result` or `error`; some implementations
;; carry both, with one of them null. The object is the one that decides.
(define (handle-response! cl id js)
  (define ch (hash-ref (with-state cl (λ () (acp-client-pending cl))) id #f))
  (define err (hash-ref js 'error #f))
  (define answer
    (if (hash? err)
        (cons 'error (let ([m (hash-ref err 'message #f)])
                       (if (string? m) m (jsexpr->string err))))
        (cons 'ok (hash-ref js 'result (hash)))))
  (if ch
      (async-channel-put ch answer)
      (log-line cl (format "answer to a question nobody asked (id ~a)" id))))

;; ---- incoming requests -----------------------------------------------------

;; The agent asks the client for things. Only one of them matters here, and it
;; matters because NOT answering hangs the turn.
(define (handle-request! cl id method params)
  (cond
    [(equal? method "session/request_permission")
     (define picked (allow-option (hash-ref params 'options '())))
     (send-line! cl (hash 'jsonrpc "2.0" 'id id
                          'result (hash 'outcome
                                        (if picked
                                            (hash 'outcome "selected" 'optionId picked)
                                            (hash 'outcome "cancelled")))))]
    [else
     (send-line! cl (hash 'jsonrpc "2.0" 'id id
                          'error (hash 'code -32601
                                       'message (format "method not found: ~a" method))))]))

;; The first option whose kind says yes (allow_once / allow_always), in the
;; order the agent offered them. Never a rejection: a chat panel with no
;; permission UI that denies is a chat panel that fails every tool call.
(define (allow-option options)
  (and (list? options)
       (for/or ([o (in-list options)]
                #:when (hash? o))
         (define kind (hash-ref o 'kind ""))
         (and (string? kind)
              (string-prefix? kind "allow")
              (let ([oid (hash-ref o 'optionId #f)])
                (and (string? oid) oid))))))

;; ---- incoming notifications ------------------------------------------------

(define (handle-notification! cl method params)
  (cond
    [(equal? method "session/update") (handle-update! cl params)]
    [(equal? method sdk-message-method) (handle-sdk-message! cl params)]
    [else (log-kind-once! cl method)]))

;; A CLI message the adapter forwarded verbatim because session/new asked for
;; it. Only one kind was asked for, and only one field of it is read: `model`,
;; the model this session is running right now. Everything else `init` carries
;; — the tool list, the MCP servers, the permission mode, the slash commands,
;; the CLI version — is deliberately unused; it is learned from the protocol or
;; not at all.
(define (handle-sdk-message! cl params)
  (define m (hash-ref params 'message (hash)))
  (when (and (hash? m)
             (equal? (hash-ref m 'type #f) "system")
             (equal? (hash-ref m 'subtype #f) "init"))
    (define id (string-or-false (hash-ref m 'model #f)))
    (when id (emit! cl (acp-live-model id)))))

;; Update kinds this version consumes. Thoughts, plans and the rest of ACP's
;; running commentary are deliberately dropped — a chat panel that renders
;; everything an agent thinks is a log viewer.
(define ignored-update-kinds
  '("agent_thought_chunk" "plan"))

(define (handle-update! cl params)
  (define u (hash-ref params 'update (hash)))
  (define kind (and (hash? u) (hash-ref u 'sessionUpdate #f)))
  (cond
    [(equal? kind "agent_message_chunk")
     (define text (content-text (hash-ref u 'content (hash))))
     (when (non-empty-string? text) (emit! cl (acp-said text)))]
    ;; What you said. Live, it is an echo of the prompt the caller just sent;
    ;; during a REPLAY it is the only thing that says where one turn ends and
    ;; the next begins. Which of those this is, the caller knows.
    [(equal? kind "user_message_chunk")
     (define text (content-text (hash-ref u 'content (hash))))
     (when (non-empty-string? text) (emit! cl (acp-user-said text)))]
    ;; the conversation's own name, written by the agent in the background
    [(equal? kind "session_info_update")
     (define title (string-or-false (hash-ref u 'title #f)))
     ;; `updatedAt` rides along and is dropped: it is the picker's sort key,
     ;; and the picker asks for a fresh list every time it is drawn.
     (when title (emit! cl (acp-session-titled title)))]
    [(equal? kind "tool_call")
     (define id (hash-ref u 'toolCallId #f))
     (when (string? id)
       (emit! cl (acp-tool id
                           (or (string-or-false (hash-ref u 'title #f))
                               (string-or-false (hash-ref u 'kind #f))
                               "tool")
                           (or (string-or-false (hash-ref u 'status #f)) "pending"))))]
    [(equal? kind "tool_call_update")
     (define id (hash-ref u 'toolCallId #f))
     (when (string? id)
       (emit! cl (acp-tool-moved id
                                 (string-or-false (hash-ref u 'title #f))
                                 (string-or-false (hash-ref u 'status #f)))))]
    ;; the whole config set, resent: only the model is read out of it
    [(equal? kind "config_option_update")
     (read-config-model! cl (hash-ref u 'configOptions '()))]
    ;; the whole slash-command list, resent
    [(equal? kind "available_commands_update")
     (emit! cl (acp-commands (available-commands (hash-ref u 'availableCommands '()))))]
    [(member kind ignored-update-kinds) (void)]
    [else (log-kind-once! cl (format "session/update ~a" kind))]))

(define (string-or-false v) (and (string? v) v))

;; A content block, as much of it as a chat line can show.
(define (content-text c)
  (cond
    [(and (hash? c) (equal? (hash-ref c 'type #f) "text"))
     (define t (hash-ref c 'text ""))
     (if (string? t) t "")]
    [else ""]))

;; ---- the subprocess --------------------------------------------------------

(define (alive? cl)
  (define sp (acp-client-sp cl))
  (and sp (eq? (subprocess-status sp) 'running)))

;; Spawned with the environment as it stands: HOME is where the adapter's
;; credentials live, and the nix wrapper has already set the rest.
(define (spawn-process! cl)
  (define-values (sp out in err)
    (in-custodian cl
      (λ ()
        (parameterize ([current-directory (acp-client-cwd cl)])
          (subprocess #f #f #f (acp-client-command cl))))))
  (define restart?
    (with-state cl
      (λ ()
        (set-acp-client-sp! cl sp)
        (set-acp-client-stdin! cl in)
        (set-acp-client-stdout! cl out)
        (set-acp-client-session! cl #f)
        (begin0 (acp-client-spawned? cl)
          (set-acp-client-spawned?! cl #t)))))
  (when restart? (log-line cl "restarted the agent"))
  (in-custodian cl (λ () (thread (λ () (reader-loop cl out)))))
  (in-custodian cl (λ () (thread (λ () (drain-log cl err)))))
  (handshake! cl)
  (void))

;; A process AND a conversation. Callers hold `boot-sema`.
(define (spawn! cl)
  (spawn-process! cl)
  (adopt-or-create! cl))

(define (drain-log cl err)
  (let loop ()
    (define line (with-handlers ([exn:fail? (λ (_e) eof)]) (read-line err 'any)))
    (unless (eof-object? line)
      (log-line cl line)
      (loop))))

;; What the agent says it can do. Two of them matter: whether it keeps
;; sessions at all (`loadSession`), and whether it will list them. An agent
;; that says neither gets a new session every boot, which is what every agent
;; got before this.
(define (handshake! cl)
  (define r (request! cl "initialize"
                      (hash 'protocolVersion protocol-version
                            'clientCapabilities client-capabilities)))
  (define caps (let ([c (hash-ref r 'agentCapabilities (hash))]) (if (hash? c) c (hash))))
  (define scaps (let ([c (hash-ref caps 'sessionCapabilities (hash))]) (if (hash? c) c (hash))))
  (with-state cl
    (λ ()
      (set-acp-client-can-load?! cl (eq? (hash-ref caps 'loadSession #f) #t))
      (set-acp-client-can-list?! cl (and (hash-ref scaps 'list #f) #t))))
  (void))

;; Boot's second half: the conversation this client comes up in. Callers hold
;; `boot-sema`.
(define (adopt-or-create! cl)
  (define latest
    (and (with-state cl (λ () (and (acp-client-can-list? cl) (acp-client-can-load? cl))))
         ;; a list the agent will not give is not a reason to fail to boot
         (with-handlers ([exn:fail? (λ (e)
                                      (log-line cl (format "session/list failed: ~a"
                                                           (exn-message e)))
                                      #f)])
           (let ([ss (list-sessions cl)]) (and (pair? ss) (car ss))))))
  (cond
    [latest (load-session! cl
                           (hash-ref latest 'sessionId)
                           (string-or-false (hash-ref latest 'title #f)))]
    [else (new-session! cl)]))

;; The conversation that was is over — said before the request that replaces
;; it, not after: a title that arrives while a new session is being made
;; belongs to the new one.
(define (forget-session! cl)
  (with-state cl (λ () (set-acp-client-session! cl #f)))
  (emit! cl (acp-session-over)))

;; A session is a conversation's memory. Callers hold `boot-sema`.
(define (new-session! cl)
  (forget-session! cl)
  (define r (request! cl "session/new"
                      (hash 'cwd (path->string (acp-client-cwd cl))
                            'mcpServers '()
                            '_meta session-meta)))
  (define sid (hash-ref r 'sessionId #f))
  (unless (string? sid) (user-fail "session/new returned no sessionId"))
  (establish-session! cl sid #f (hash-ref r 'configOptions '()))
  sid)

;; Adopt a stored conversation: the panel comes back up in the one you were
;; last in. Callers hold `boot-sema`.
;;
;; The load REPLACES the conversation — a transcript of a session that is no
;; longer the session would be a lie — and the agent says so by REPLAYING: every
;; message in it arrives as an ordinary session/update notification, in order,
;; before the response comes back. The brackets are what let a caller tell that
;; history from news. Order on the wire: the old session ends, the replay, then
;; the session itself.
;;
;; `_meta` rides along for the same reason session/new carries it: the raw
;; init message is how the LIVE model becomes knowable, and a loaded session
;; that did not ask would go on naming whatever the picker said.
(define (load-session! cl sid [title #f])
  (forget-session! cl)
  (emit! cl (acp-replay-started))
  (define r
    (with-handlers ([exn:fail? (λ (e) (emit! cl (acp-replay-ended)) (raise e))])
      (request! cl "session/load"
                (hash 'sessionId sid
                      'cwd (path->string (acp-client-cwd cl))
                      'mcpServers '()
                      '_meta session-meta)
                #:timeout load-timeout-seconds)))
  (emit! cl (acp-replay-ended))
  (establish-session! cl sid title
                      (if (hash? r) (hash-ref r 'configOptions '()) '()))
  sid)

;; The last three things every session needs, whichever way it was got: say
;; which one it is, read the model off it, ask for the permission mode.
(define (establish-session! cl sid title opts)
  (with-state cl (λ () (set-acp-client-session! cl sid)))
  (emit! cl (acp-session sid title))
  ;; the session says what it runs; a client that asked would be guessing
  (read-config-model! cl opts)
  (set-session-mode! cl sid))

;; Permissions are asked for, not required: the request is refused when the
;; server runs as root, and the permission auto-answer covers that case.
(define (set-session-mode! cl sid)
  (with-handlers ([exn:fail?
                   (λ (e)
                     (log-line cl (format "set_mode ~a refused: ~a" bypass-mode (exn-message e)))
                     (emit! cl (acp-trouble (format "permission mode ~a refused; \
tool calls are allowed one at a time instead"
                                                    bypass-mode))))])
    (request! cl "session/set_mode" (hash 'sessionId sid 'modeId bypass-mode)))
  (void))

;; Spawn on demand, and only once: callers hold nothing while this runs. A
;; process that is alive but has no session lost one (a reset that could not
;; start its replacement) — that is a NEW chat asking to be finished, not an
;; invitation to adopt yesterday's.
(define (ensure-session! cl)
  (call-with-semaphore
   (acp-client-boot-sema cl)
   (λ ()
     (cond
       [(not (with-state cl (λ () (alive? cl)))) (spawn! cl)]
       [(not (with-state cl (λ () (acp-client-session cl)))) (new-session! cl)]
       [else (void)])
     (with-state cl (λ () (acp-client-session cl))))))

;; Boot now rather than at the first prompt: a panel that is supposed to come
;; up showing your last conversation needs one before anybody types. Its own
;; thread — a server that waited for a node process to start and a transcript
;; to replay would not answer a page for seconds — and its own failure: a
;; trouble event and a log line, after which the next prompt tries again exactly
;; as it does after a crash.
(define (acp-boot! cl)
  (in-custodian cl
    (λ ()
      (thread
       (λ ()
         (with-handlers ([exn:fail?
                          (λ (e)
                            ;; a server shutting down takes the agent's stdin
                            ;; with it; that is not news about the boot
                            (unless (acp-stopped? cl)
                              (trouble! cl (format "the agent did not start: ~a"
                                                   (exn-message e)))))])
           (ensure-session! cl))))))
  (void))

;; New chat, agent-side: the context goes away and a fresh session replaces it.
;; A failure is not raised — there is nothing left to hand back, and the next
;; prompt spawns one.
(define (acp-new-session! cl)
  (with-handlers ([exn:fail?
                   (λ (e)
                     (log-line cl (format "reset could not start a session: ~a" (exn-message e)))
                     (with-state cl (λ () (set-acp-client-session! cl #f))))])
    (call-with-semaphore
     (acp-client-boot-sema cl)
     (λ () (when (with-state cl (λ () (alive? cl))) (new-session! cl)))))
  (void))

;; Move to a stored conversation. Blocking and exactly as slow as the
;; conversation is long: the caller runs it wherever it can afford to wait.
(define (acp-load-session! cl sid)
  (call-with-semaphore
   (acp-client-boot-sema cl)
   (λ ()
     ;; a session can be loaded into an agent that has died since; the process
     ;; comes back first, and the handshake with it
     (unless (with-state cl (λ () (alive? cl))) (spawn-process! cl))
     (load-session! cl sid (stored-title cl sid))))
  (void))

;; The agent's stdout ended: it exited, or it is about to. Whoever was waiting
;; on an answer gets a failure instead, and the NEXT prompt spawns a fresh one.
;; No respawn loop: nothing here starts a process nobody asked for.
(define (handle-eof! cl)
  (define sp (with-state cl (λ () (acp-client-sp cl))))
  (when sp (sync/timeout stop-timeout-seconds sp))
  (define status (and sp (subprocess-status sp)))
  (define stopped? (acp-stopped? cl))
  (define why
    (if (integer? status)
        (format "the agent exited (code ~a)" status)
        "the agent closed its connection"))
  (with-state cl
    (λ ()
      (set-acp-client-sp! cl #f)
      (set-acp-client-stdin! cl #f)
      (set-acp-client-stdout! cl #f)
      (set-acp-client-session! cl #f)))
  (emit! cl (acp-session-over))
  ;; a shutdown asked for this; only a death is news
  (unless stopped? (emit! cl (acp-gone why)))
  (fail-all-pending! cl why))

;; ---- prompting -------------------------------------------------------------

;; Nothing to ask, because there is nothing there to ask. The op kinds are the
;; write ops' vocabulary (a route maps them to statuses, the CLI to exit codes).
(define (gone-fail message)
  (raise (exn:fail:op message (current-continuation-marks) 'validation #f #f #f)))

;; One turn, start to finish: spawn and shake hands if that has not happened,
;; then wait for the agent as long as it takes. -> the stop reason. Raises what
;; went wrong instead.
;;
;; `on-send` runs the moment the prompt is on the wire, which is the first
;; moment a session/cancel means anything (see `acp-cancel!`).
(define (acp-prompt! cl text #:on-send [on-send void])
  (define sid (ensure-session! cl))
  (define r (request! cl "session/prompt"
                      (hash 'sessionId sid
                            'prompt (list (hash 'type "text" 'text text)))
                      #:timeout #f
                      #:after-send on-send))
  (define s (hash-ref r 'stopReason "end_turn"))
  (if (string? s) s "end_turn"))

;; A notification, not a request: the turn does not end here, it ends when the
;; session/prompt response comes back saying "cancelled". A cancel the agent
;; cannot hear is not worth failing a caller over — the turn is ending
;; regardless (the reader will see the prompt fail, or EOF).
;;
;; Only meaningful once a prompt is on the wire: a session/cancel that arrives
;; before one names a turn the agent has never heard of. The caller is the one
;; that knows whether it has sent anything, which is what `on-send` is for.
(define (acp-cancel! cl)
  (define sid (with-state cl (λ () (acp-client-session cl))))
  (when sid
    (with-handlers ([exn:fail? (λ (e) (log-line cl (format "cancel failed: ~a" (exn-message e))))])
      (notify! cl "session/cancel" (hash 'sessionId sid))))
  (void))

;; ---- stopping ---------------------------------------------------------------

;; Take the subprocess away from whatever is wedged in it. The turn waiting on
;; a response ends the way any dead agent's does: EOF, and a failure.
(define (acp-kill! cl)
  (define sp (with-state cl (λ () (acp-client-sp cl))))
  (when sp
    (with-handlers ([exn:fail? void]) (subprocess-kill sp #t))
    (sync/timeout stop-timeout-seconds sp))
  (void))

(define (acp-stopped? cl)
  (with-state cl (λ () (and (acp-client-stopped? cl) #t))))

;; Closing its stdin is the documented way out: the adapter exits 0 on EOF.
;; Idempotent — the server's stop procedure may run more than once, and a
;; process that already left needs nothing.
(define (acp-stop! cl)
  (define sp
    (with-state cl
      (λ ()
        (set-acp-client-stopped?! cl #t)
        (acp-client-sp cl))))
  (when sp
    (define in (with-state cl (λ () (acp-client-stdin cl))))
    (when in (with-handlers ([exn:fail? void]) (close-output-port in)))
    (unless (sync/timeout stop-timeout-seconds sp)
      (with-handlers ([exn:fail? void]) (subprocess-kill sp #t))
      (sync/timeout stop-timeout-seconds sp))
    (with-state cl
      (λ ()
        (set-acp-client-sp! cl #f)
        (set-acp-client-stdin! cl #f)
        (set-acp-client-session! cl #f))))
  (void))
