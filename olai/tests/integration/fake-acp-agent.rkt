#! /usr/bin/env racket
#lang racket/base

;; A scripted ACP agent, for testing the bridge without an LLM.
;;
;; It speaks just enough of the protocol to be indistinguishable from a real
;; agent as far as olai/acp is concerned: line-delimited JSON-RPC on
;; stdio, initialize / session/new / session/load / session/list /
;; session/set_mode, one turn per session/prompt, session/cancel as a
;; notification, and session/update notifications on the way.
;;
;; STORED SESSIONS are an environment variable, because which boot path runs is
;; a property of the machine the agent woke up on, not of anything a client
;; says:
;;
;;   OLAI_FAKE_ACP_STORED   non-empty -> session/list answers with two
;;                               conversations and session/load replays the
;;                               one that is asked for; unset (the default) ->
;;                               nothing is stored, so a client boots the way
;;                               it always did, with session/new
;;
;; Behaviour is keyed on the prompt text, so a test asks for what it needs:
;;
;;   CRASH        exit 1 mid-turn, after the first chunk
;;   SLOW         dawdle between chunks, long enough to cancel
;;   PERMISSION   ask session/request_permission and wait for the answer
;;   MODEL        switch models mid-turn (a config_option_update)
;;   SLASH        switch the LIVE model mid-turn without touching the config
;;                option, the way a `/model` slash command does — the change
;;                shows up only in a re-issued `system`/`init`
;;   UNLISTED     the same, to a model the picker does not offer
;;   COMMANDS     offer a different command list mid-turn
;;
;; Every turn also writes one line to stderr: the bridge drains that pipe into
;; the server's log, and a bridge that did not would eventually block here.
;;
;; Dumb and deterministic on purpose. This is test infrastructure, not a
;; simulator: no LLM, no state beyond the session id, no concurrency beyond
;; the one turn thread (the main loop keeps reading, which is what makes
;; cancel and permission answers arrive DURING a turn).
;;
;; Self-contained: racket/base + json, no olai collection. Run it as
;; `racket fake-acp-agent.rkt`, or directly — it is committed executable.
;;
;; Nothing runs on require (raco test would otherwise sit here reading stdin
;; forever); the driver is in `main`.

(require json
         racket/string)

(define out-sema (make-semaphore 1))

(define (emit! js)
  (call-with-semaphore
   out-sema
   (λ ()
     (write-json js (current-output-port))
     (newline (current-output-port))
     (flush-output (current-output-port)))))

(define (respond! id result)
  (emit! (hash 'jsonrpc "2.0" 'id id 'result result)))

(define (notify! method params)
  (emit! (hash 'jsonrpc "2.0" 'method method 'params params)))

(define (noise! str)
  (displayln str (current-error-port))
  (flush-output (current-error-port)))

;; ---- state -----------------------------------------------------------------

;; Which session this process is in. A load moves it: the updates a replay
;; sends carry the loaded id, the way a real one's do.
(define session-id (box "fake-session-1"))

;; What this machine has stored, newest LAST on purpose — a client that takes
;; the first entry instead of the most recently updated one gets the wrong
;; conversation, and a test says so.
(define stored-sessions
  (list (hash 'sessionId "fake-stored-old"
              'cwd "/tmp"
              'title "an older conversation"
              'updatedAt "2026-07-01T09:00:00.000Z")
        (hash 'sessionId "fake-stored-new"
              'cwd "/tmp"
              'title "the last conversation"
              'updatedAt "2026-08-01T17:30:00.000Z")))

(define (stored?)
  (define v (getenv "OLAI_FAKE_ACP_STORED"))
  (and v (not (string=? v ""))))

;; Set by a session/cancel notification, cleared when a prompt is accepted —
;; both in the reading loop, so the two stay in the order they arrived.
(define cancelled? (box #f))

;; Which model this session PICKED. Reported the way a Claude Code adapter
;; reports it: a session CONFIG OPTION, in the session/new result and again in
;; a config_option_update when it moves.
(define model (box "fake-model-1"))

(define (config-options)
  (list (hash 'id "model"
              'name "Model"
              'description "AI model to use"
              'category "model"
              'type "select"
              'currentValue (unbox model)
              'options (list (hash 'value "fake-model-1" 'name "fake-model-1")
                             (hash 'value "fake-model-2" 'name "fake-model-2")
                             (hash 'value "fake-model-3" 'name "Fake Model Three")))))

;; Which model this session is actually RUNNING. A `/model` slash command is
;; handled inside the wrapped CLI, so it moves this and NOT the config option
;; above — exactly the split that let a chat header go stale. It surfaces only
;; in the CLI's own `system`/`init` message, which the adapter forwards
;; verbatim to a client that asked for it.
(define live-model (box "fake-model-1"))

;; Whether session/new asked for raw CLI messages, and for which kinds. The
;; real adapter takes `_meta.claudeCode.emitRawSDKMessages` as either #t or a
;; list of {type, subtype?} filters; nothing is forwarded to a client that did
;; not ask, which is what makes the opt-in itself testable.
(define raw-filter (box #f))

(define (raw-init-wanted?)
  (define f (unbox raw-filter))
  (cond
    [(eq? f #t) #t]
    [(list? f)
     (for/or ([e (in-list f)])
       (and (hash? e)
            (equal? (hash-ref e 'type #f) "system")
            (member (hash-ref e 'subtype #f) (list #f (json-null) "init"))
            #t))]
    [else #f]))

;; The CLI announces itself at the start of every turn, and again whenever it
;; reinitializes — which is what changing the model does. Only `model` is
;; interesting here; the rest is the shape the real message has.
(define (init!)
  (when (raw-init-wanted?)
    (notify! "_claude/sdkMessage"
             (hash 'sessionId (unbox session-id)
                   'message (hash 'type "system"
                                  'subtype "init"
                                  'session_id (unbox session-id)
                                  'model (unbox live-model)
                                  'permissionMode "bypassPermissions"
                                  'slash_commands (list "model"))))))

;; The slash commands this session offers, in the adapter's shape: `input` is
;; an argument hint, and is null for a command that takes none.
(define commands
  (box (list (hash 'name "fake-init"
                   'description "start something"
                   'input (json-null))
             (hash 'name "fake-review"
                   'description "look it over"
                   'input (hash 'hint "[deep]")))))

;; The permission answer the turn is waiting for, posted by the main loop.
(define permission-ch (make-channel))

;; Ids for the requests THIS side sends (session/request_permission).
(define next-id (box 1000))

(define (take-id!)
  (define id (unbox next-id))
  (set-box! next-id (add1 id))
  id)

;; ---- the turn --------------------------------------------------------------

(define (update! u)
  (notify! "session/update" (hash 'sessionId (unbox session-id) 'update u)))

(define (chunk! text)
  (update! (hash 'sessionUpdate "agent_message_chunk"
                 'content (hash 'type "text" 'text text))))

(define (commands!)
  (update! (hash 'sessionUpdate "available_commands_update"
                 'availableCommands (unbox commands))))

;; The conversation's own name — a stored one keeps the name it was listed
;; under. The real adapter pulls this from the session file at turn end and
;; pushes it when it moved; this one says it once, as soon as there is a
;; session to say it about, so the frame it becomes is where a test can find it.
(define (session-info!)
  (define stored
    (for/or ([s (in-list stored-sessions)])
      (and (equal? (hash-ref s 'sessionId) (unbox session-id))
           (hash-ref s 'title))))
  (update! (hash 'sessionUpdate "session_info_update"
                 'title (or stored "a fake conversation")
                 'updatedAt "2026-08-05T12:00:00.000Z")))

;; ---- replaying a stored session ---------------------------------------------
;;
;; What `session/load` does before it answers: every message of the
;; conversation, in order, as ordinary session/update notifications. One turn
;; here — a prompt, an answer, a tool call — which is the shape a client has to
;; reassemble with no live turn to hang it on.
(define (replay!)
  (update! (hash 'sessionUpdate "user_message_chunk"
                 'content (hash 'type "text" 'text "what did we do")))
  (update! (hash 'sessionUpdate "agent_message_chunk"
                 'content (hash 'type "text" 'text "we ")))
  (update! (hash 'sessionUpdate "agent_message_chunk"
                 'content (hash 'type "text" 'text "shipped it")))
  (update! (hash 'sessionUpdate "tool_call"
                 'toolCallId "call-replay"
                 'title "read Roadmap.rkt"
                 'kind "read"
                 'status "pending"))
  (update! (hash 'sessionUpdate "tool_call_update"
                 'toolCallId "call-replay"
                 'status "completed")))

;; Sleep in slices so a cancel lands promptly. -> #t if it ran to the end.
(define (dawdle seconds)
  (let loop ([left seconds])
    (cond
      [(unbox cancelled?) #f]
      [(<= left 0) #t]
      [else (sleep 0.05) (loop (- left 0.05))])))

(define (ask-permission!)
  (define id (take-id!))
  (emit! (hash 'jsonrpc "2.0" 'id id 'method "session/request_permission"
               'params (hash 'sessionId (unbox session-id)
                             'toolCall (hash 'toolCallId "call-1" 'title "read Tasks.rkt")
                             'options (list (hash 'optionId "reject"
                                                  'name "Reject"
                                                  'kind "reject_once")
                                            (hash 'optionId "allow"
                                                  'name "Allow"
                                                  'kind "allow_once")))))
  (sync/timeout 30 permission-ch))

;; The whole script, in one thread. Answers the request itself at the end.
;; The cancelled? box is cleared by the ACCEPTING loop, not here: clearing it
;; in this thread races a session/cancel that follows the prompt immediately,
;; and would swallow it.
(define (run-turn! id text)
  (noise! (format "fake-acp-agent: turn for ~s" text))
  (init!)
  (chunk! "hello ")
  (when (string-contains? text "CRASH")
    (flush-output (current-output-port))
    (exit 1))
  (when (string-contains? text "MODEL")
    (set-box! model "fake-model-2")
    (update! (hash 'sessionUpdate "config_option_update"
                   'configOptions (config-options))))
  (when (string-contains? text "SLASH")
    ;; the CLI switched under the adapter: no config_option_update, just a
    ;; fresh init on the way back out of the reinitialize
    (set-box! live-model "fake-model-3")
    (init!))
  (when (string-contains? text "UNLISTED")
    (set-box! live-model "claude-fake-9[1m]")
    (init!))
  (when (string-contains? text "COMMANDS")
    (set-box! commands (list (hash 'name "fake-later"
                                   'description "learned along the way"
                                   'input (json-null))))
    (commands!))
  (when (string-contains? text "PERMISSION")
    (define answer (ask-permission!))
    (unless answer
      (noise! "fake-acp-agent: nobody answered the permission request")))
  (when (string-contains? text "SLOW")
    (dawdle 10))
  (cond
    [(unbox cancelled?)
     (respond! id (hash 'stopReason "cancelled"))]
    [else
     (chunk! "world")
     (update! (hash 'sessionUpdate "tool_call"
                    'toolCallId "call-1"
                    'title "read Tasks.rkt"
                    'kind "read"
                    'status "pending"))
     (update! (hash 'sessionUpdate "tool_call_update"
                    'toolCallId "call-1"
                    'status "completed"))
     ;; one kind the bridge is expected to ignore, to prove it does
     (update! (hash 'sessionUpdate "agent_thought_chunk"
                    'content (hash 'type "text" 'text "thinking")))
     (respond! id (hash 'stopReason "end_turn"))]))

;; ---- the loop --------------------------------------------------------------

(define (prompt-text params)
  (define blocks (hash-ref params 'prompt '()))
  (string-join
   (for/list ([b (in-list (if (list? blocks) blocks '()))]
              #:when (and (hash? b) (equal? (hash-ref b 'type #f) "text")))
     (hash-ref b 'text ""))
   ""))

;; Whether this client wants the CLI's raw messages, off a session/new or
;; session/load `_meta`.
(define (remember-raw-filter! params)
  (define meta (hash-ref params '_meta (hash)))
  (define claude (if (hash? meta) (hash-ref meta 'claudeCode (hash)) (hash)))
  (set-box! raw-filter (if (hash? claude) (hash-ref claude 'emitRawSDKMessages #f) #f)))

(define (handle! js)
  (define method (hash-ref js 'method #f))
  (define id (hash-ref js 'id #f))
  (define params (hash-ref js 'params (hash)))
  (cond
    ;; the client answering session/request_permission
    [(and id (not method)) (channel-put permission-ch js)]
    [(equal? method "initialize")
     ;; A machine with nothing stored says so the honest way: it keeps
     ;; sessions, there are just none of them. Same code path either way.
     (respond! id (hash 'protocolVersion 1
                        'agentCapabilities (hash 'loadSession #t
                                                 'sessionCapabilities (hash 'list (hash)))
                        'agentInfo (hash 'name "fake-acp-agent" 'version "1")))]
    [(equal? method "session/list")
     (respond! id (hash 'sessions (if (stored?) stored-sessions '())))]
    [(equal? method "session/new")
     (remember-raw-filter! params)
     (respond! id (hash 'sessionId (unbox session-id) 'configOptions (config-options)))]
    ;; The whole conversation, replayed as notifications, and only THEN the
    ;; answer — which is the ordering the assembler on the other side is built
    ;; around. `_meta` is honored here exactly as on session/new: a loaded
    ;; session that asked for raw CLI messages gets them too.
    [(equal? method "session/load")
     (define sid (hash-ref params 'sessionId #f))
     (cond
       [(and (stored?) (for/or ([s (in-list stored-sessions)])
                         (equal? (hash-ref s 'sessionId) sid)))
        (remember-raw-filter! params)
        (set-box! session-id sid)
        (replay!)
        (respond! id (hash 'configOptions (config-options)))]
       [else
        (emit! (hash 'jsonrpc "2.0" 'id id
                     'error (hash 'code -32602
                                  'message (format "no such session: ~a" sid))))])]
    [(equal? method "session/set_mode")
     (respond! id (hash))
     ;; The commands go out once the session exists — the adapter sends them
     ;; from a timer right after session/new returns, which is somewhere in
     ;; here. Pinned to set_mode so the order a test sees is the same every
     ;; run: the model (read off the session/new result) first, then these,
     ;; and both before the first prompt can be answered.
     (commands!)
     ;; and the conversation's name, which the agent is the one that knows
     (session-info!)]
    [(equal? method "session/cancel") (set-box! cancelled? #t)]
    [(equal? method "session/prompt")
     (define text (prompt-text params))
     (set-box! cancelled? #f)
     (thread (λ () (run-turn! id text)))
     (void)]
    [id
     (emit! (hash 'jsonrpc "2.0" 'id id
                  'error (hash 'code -32601 'message (format "method not found: ~a" method))))]
    [else (void)]))

(define (main)
  (let loop ()
    (define line (read-line (current-input-port) 'any))
    (unless (eof-object? line)
      (unless (string=? (string-trim line) "")
        (define js (with-handlers ([exn:fail? (λ (_e) #f)]) (string->jsexpr line)))
        (when (hash? js) (handle! js)))
      (loop)))
  (exit 0))

(module+ main
  (main))
