#lang racket/base

;; The conversation with the agent: one turn at a time, one transcript, one
;; stream of chat frames.
;;
;; olai/acp speaks the protocol and says what it heard (typed events, one
;; handler); this module is the only thing that listens, and what it makes of
;; them is a CHAT: what a browser is shown, in what order, and what a browser
;; that arrives late is shown instead. No JSON-RPC method name appears below.
;;
;; What this owns, and why:
;;
;;   * one turn at a time. ACP would queue; a chat panel does not want a queue,
;;     and a second prompt while the agent is talking is a conflict the caller
;;     has to see — exn:fail:op with kind 'busy, the same vocabulary the write
;;     ops use (the CLI maps kinds to exit codes, a route maps them to statuses).
;;   * the transcript. Frames are ephemeral — a browser that connects late
;;     missed them — so a turn is also accumulated here, and that is what a
;;     connection is caught up with (`chat-catch-up`).
;;   * what a header SAYS: which model, which slash commands, which
;;     conversation. Each of those is learned from the agent and pushed only
;;     when it actually moved, so a session that re-announces the same model on
;;     every turn says nothing.
;;   * reassembling a replayed conversation into turns, which the wire does not
;;     hand over as turns.
;;
;; Threads: the caller's (prompt / cancel / reset / load / stop), the client's
;; (every event arrives on one of its), one per TURN waiting for the prompt to
;; come back, one per LOAD. Every state change takes `sema`, and a frame is
;; broadcast while it is held, so the order a browser sees is the order the
;; transcript records. Nothing here holds `sema` around a blocking call into the
;; client, and the client never delivers an event holding a lock of its own:
;; between the two, neither can wait on the other.
;;
;; Chat frames and transcript entries are append-only, same discipline as
;; json/reply: new keys may appear, existing ones keep their meaning and type.

(require json
         racket/contract
         racket/list
         olai/acp
         (only-in olai/ops exn:fail:op)
         ;; render-time Markdown has one owner; this module only asks it for
         ;; the finished turn's HTML
         (only-in olai/web/markdown note->html-string))

;; The surface the server sees. `make-chat` is told how to reach the agent (a
;; command, a directory) and where to put frames, and nothing else; every other
;; export is a verb or a read.
(provide (contract-out
          [acp-event-name string?]
          ;; the words a transcript is written in (see "the vocabulary")
          [tool-pending string?]
          [tool-in-progress string?]
          [tool-completed string?]
          [tool-failed string?]
          [make-chat (->* (#:command (or/c path? string?)
                           #:cwd (or/c path? string?)
                           #:broadcast (-> string? string? any))
                          (#:log-port output-port?)
                          chat?)]
          [chat? (-> any/c boolean?)]
          [chat-boot! (-> chat? void?)]
          [chat-prompt! (-> chat? string? void?)]
          [chat-cancel! (-> chat? void?)]
          [chat-reset! (-> chat? void?)]
          [chat-load! (-> chat? string? void?)]
          [chat-stop! (-> chat? void?)]
          [chat-busy? (-> chat? boolean?)]
          [chat-model (-> chat? (or/c string? #f))]
          [chat-commands (-> chat? (listof hash?))]
          [chat-sessions (-> chat? (listof hash?))]
          [chat-session-id (-> chat? (or/c string? #f))]
          [chat-session-title (-> chat? (or/c string? #f))]
          [chat-transcript (-> chat? (listof hash?))]
          [chat-catch-up (-> chat? (-> any) (listof (cons/c string? string?)))]
          [chat-handle-event! (-> chat? acp-event? void?)]))

;; The SSE event name chat frames ride under. One owner: the page that
;; subscribes and the module that broadcasts agree by requiring it.
(define acp-event-name "chat")

;; A wedged turn must not make "new chat" hang: cancel, wait this long, then
;; take the subprocess away from it.
(define reset-timeout-seconds 5)

;; ---- the vocabulary ---------------------------------------------------------
;;
;; The words a transcript is written in. What a tool call's status MEANS is
;; this module's business — so the panel that draws one and the selector that
;; reacts to it spell a binding, not a string that happens to match. The tool
;; statuses are the agent's, passed through olai/acp unchanged.
;;
;; A turn's status is a symbol in the struct below, and `symbol->string` of the
;; same word on the wire.

(define tool-pending "pending")
(define tool-in-progress "in_progress")
(define tool-completed "completed")
(define tool-failed "failed")

;; ---- what a transcript remembers -------------------------------------------

;; One turn: what was asked, the agent text as it accumulated, the tool lines
;; with their latest status (newest first until serialized), and how it ended.
;; status: 'running | 'done | 'error.
;;
;; `sent?` is whether the prompt is on the wire yet. A turn is accepted long
;; before that (the subprocess may not even exist), and a cancel that arrives in
;; between has nothing the agent could match it against.
;;
;; `html` is what the finished text came out as, rendered once when the turn
;; ended — every connection told about that turn afterwards is owed the same
;; frame, and Markdown is not a thing to render twice. #f until it ends; the
;; transcript and the JSON keep the text verbatim, as they do everywhere else.
(struct turn (text [agent #:mutable] [tools #:mutable]
                   [status #:mutable] [stop #:mutable] [err #:mutable]
                   [sent? #:mutable] [html #:mutable]))

(struct tool (id [title #:mutable] [status #:mutable]))

;; Not a turn: the conversation itself moved (a reset, or a dead agent whose
;; successor starts with no memory of any of this).
(struct marker (type message))

;; ---- the conversation ------------------------------------------------------

;; `client` is the agent, and the only thing here that knows about ACP. It is
;; mutable for one reason: it is constructed with a handler that names the
;; conversation the events land in, so one of the two has to exist first.
;;
;; `session`/`title` are what the PANEL is showing, which is not quite the
;; client's idea of which session the next prompt names: the client forgets one
;; the instant it starts making the next, and what a header says catches up when
;; there is something true to say.
;;
;; `cust` is what the turn and load threads are created under: a prompt arrives
;; on an HTTP request's thread, and the web server shuts that connection's
;; custodian down as soon as the response is written — which would take the turn
;; with it the moment the 204 went out.
(struct conversation ([client #:mutable] broadcast cust sema
                      [model #:mutable] [labels #:mutable]
                      [config-model #:mutable] [live-model #:mutable]
                      [commands #:mutable]
                      [session #:mutable] [title #:mutable]
                      [busy? #:mutable] [live-turn #:mutable]
                      [cancel-pending? #:mutable] [loading? #:mutable]
                      [replaying? #:mutable] [replay-turn #:mutable] [replay-user #:mutable]
                      [entries #:mutable]))          ; reversed

(define chat? conversation?)

(define (make-chat #:command command
                   #:cwd cwd
                   #:broadcast broadcast
                   #:log-port [log-port (current-error-port)])
  (define ch (conversation #f broadcast (make-custodian) (make-semaphore 1)
                           #f (hash)
                           #f #f
                           '()
                           #f #f
                           #f #f
                           #f #f
                           #f #f #f
                           '()))
  (set-conversation-client!
   ch
   (make-acp-client #:command command
                    #:cwd cwd
                    #:on-event (λ (ev) (chat-handle-event! ch ev))
                    #:log-port log-port))
  ch)

(define (client ch) (conversation-client ch))

(define (with-state ch proc)
  (call-with-semaphore (conversation-sema ch) proc))

(define (in-custodian ch thunk)
  (parameterize ([current-custodian (conversation-cust ch)]) (thunk)))

;; ---- frames ----------------------------------------------------------------
;;
;; A frame is one line of JSON under `acp-event-name`. Callers hold `sema`:
;; broadcasting inside the lock is what keeps the stream and the transcript
;; telling the same story in the same order.
;;
;; The vocabulary, append-only:
;;
;;   {"type":"user","text"}                   the prompt, echoed to every tab
;;   {"type":"chunk","text"}                  agent text, as it arrives
;;   {"type":"tool","id","title","status"}    same id = the same line, updated
;;   {"type":"done","stopReason","html"}      the turn ended; `html` is the
;;                                            turn's agent text rendered as
;;                                            Markdown (web/markdown), which
;;                                            is what a panel swaps in for the
;;                                            plain text the chunks built
;;   {"type":"error","message"}               the turn ended badly
;;   {"type":"reset"}                         new chat: panels clear
;;   {"type":"mark","mark","message"}         a break that already happened,
;;                                            replayed: the turns above it are
;;                                            still there, so it is a line
;;                                            across the conversation rather
;;                                            than the clearing a live `reset`
;;                                            is. `message` is null when the
;;                                            break speaks for itself
;;   {"type":"model","name"}                  which model the session runs,
;;                                            the moment the agent says so —
;;                                            with the session, and again
;;                                            whenever it moves under one, by
;;                                            whatever means (see "which
;;                                            model")
;;   {"type":"commands","commands":[...]}     the slash commands the agent
;;                                            offers, the WHOLE list each
;;                                            time (a panel replaces what it
;;                                            had); each one {name,description}
;;   {"type":"session","id","title"}          which stored conversation this
;;                                            is: pushed when a session is
;;                                            established (new, or adopted at
;;                                            boot, or picked) and again when
;;                                            its title moves. `title` is null
;;                                            until the agent has one — it
;;                                            writes one for you, a turn or so
;;                                            in
;;
;; One constructor each, below, and every one of them has two callers: the
;; thing happening, and a connection being caught up on it after the fact. A
;; frame that grew a key on one of those paths and not the other would be two
;; browsers in different conversations, depending on when they arrived.

(define (reset-jsexpr) (hash 'type "reset"))

(define (mark-jsexpr type message)
  (hash 'type "mark" 'mark type 'message (or message (json-null))))

(define (user-jsexpr text) (hash 'type "user" 'text text))

(define (chunk-jsexpr text) (hash 'type "chunk" 'text text))

(define (tool-jsexpr id title status)
  (hash 'type "tool" 'id id 'title title 'status status))

(define (error-jsexpr message) (hash 'type "error" 'message message))

(define (model-jsexpr name) (hash 'type "model" 'name name))

(define (commands-jsexpr commands) (hash 'type "commands" 'commands commands))

;; Append-only, like every other frame: a title the agent has not written yet
;; is null, never a placeholder.
(define (session-jsexpr sid title)
  (hash 'type "session" 'id (or sid (json-null)) 'title (or title (json-null))))

;; How a turn ended. The Markdown is rendered the first time this is asked for
;; — which is when the turn ends — and kept, because every connection told
;; about the turn afterwards is owed the same frame. Callers hold `sema`.
(define (done-jsexpr tn)
  (unless (turn-html tn)
    (set-turn-html! tn (note->html-string (turn-agent tn))))
  (hash 'type "done"
        'stopReason (or (turn-stop tn) (json-null))
        'html (turn-html tn)))

(define (broadcast! ch js)
  (with-handlers ([exn:fail? (λ (e) (log! ch (format "broadcast failed: ~a" (exn-message e))))])
    ((conversation-broadcast ch) acp-event-name (jsexpr->string js))))

;; The agent's log is the server's log: one sink, one prefix, and the client
;; owns both because it owns the process filling them.
(define (log! ch str) (acp-log! (client ch) str))

(define (push-entry! ch e)
  (set-conversation-entries! ch (cons e (conversation-entries ch))))

;; Something went wrong outside a turn (a boot, a load): the panel is where it
;; is said, because there is no request left to answer.
(define (error-frame! ch message)
  (with-state ch (λ () (broadcast! ch (error-jsexpr message)))))

;; ---- transcript ------------------------------------------------------------

(define (tool->jsexpr t)
  (hash 'id (tool-id t) 'title (tool-title t) 'status (tool-status t)))

(define (turn->jsexpr tn)
  (hash 'type "turn"
        'text (turn-text tn)
        'agent (turn-agent tn)
        'tools (map tool->jsexpr (reverse (turn-tools tn)))
        'status (symbol->string (turn-status tn))
        'stopReason (or (turn-stop tn) (json-null))
        'error (or (turn-err tn) (json-null))))

(define (marker->jsexpr m)
  (hash 'type (marker-type m)
        'message (or (marker-message m) (json-null))))

;; A consistent copy, safe to read while a turn is streaming: the structs stay
;; behind the lock and what leaves is plain JSON values.
(define (chat-transcript ch)
  (with-state ch (λ () (transcript-jsexprs ch))))

;; Callers hold `sema`.
(define (transcript-jsexprs ch)
  (for/list ([e (in-list (reverse (conversation-entries ch)))])
    (if (turn? e) (turn->jsexpr e) (marker->jsexpr e))))

(define (chat-busy? ch)
  (with-state ch (λ () (and (conversation-busy? ch) #t))))

;; ---- catching up -------------------------------------------------------------
;;
;; A browser is born mid-conversation. It opens a page while the agent is still
;; waking up, it reloads, its EventSource drops and comes back — and every
;; frame it was not there for is gone, because frames are ephemeral and this is
;; the only thing that remembers.
;;
;; So a connection is told the conversation on the way in, as the frames that
;; built it, to that connection alone. This is the ONE path: the page renders
;; the panel's chrome and nothing about the conversation, because a panel drawn
;; from state read at render time is only as current as that instant — and the
;; agent boots in its own thread, so the instant a page is served may be before
;; the conversation has a name, a model or a command list. What is drawn from
;; here cannot be early: it is read when the connection exists.
;;
;; The subscription is made INSIDE the lock, which is what makes it exact
;; rather than nearly right: a frame broadcast after it is queued for this
;; connection, a frame broadcast before it is in what is read here, and no
;; frame can be both or neither. Nothing under that lock renders anything — a
;; finished turn's Markdown was rendered when the turn ended (`done-jsexpr`),
;; and this hands out the same HTML the browsers that were here got.

(define (chat-catch-up ch subscribe!)
  (define frames
    (with-state ch
      (λ ()
        (subscribe!)
        (append
         ;; a clean slate first: what this connection has drawn (a reload's
         ;; markup, a reconnect's) is not the conversation, and what follows is
         (list (reset-jsexpr))
         (header-frames ch)
         (append* (map entry-frames (reverse (conversation-entries ch))))))))
  (for/list ([js (in-list frames)])
    (cons acp-event-name (jsexpr->string js))))

;; What the header says, for a header that has heard none of it said. Each of
;; these is a fact or it is nothing: an unknown model, an unnamed conversation
;; and an empty command list are the state a panel comes up in. Callers hold
;; `sema`.
(define (header-frames ch)
  (append
   (if (conversation-session ch)
       (list (session-jsexpr (conversation-session ch) (conversation-title ch)))
       '())
   (if (conversation-model ch)
       (list (model-jsexpr (conversation-model ch)))
       '())
   (if (pair? (conversation-commands ch))
       (list (commands-jsexpr (conversation-commands ch)))
       '())))

;; One transcript entry, as the frames it was assembled from. A turn that is
;; still RUNNING ends in no frame at all — a turn is open until something ends
;; it, which is exactly the state the conversation is in. Callers hold `sema`.
(define (entry-frames e)
  (cond
    [(marker? e) (list (mark-jsexpr (marker-type e) (marker-message e)))]
    [else
     (append
      (list (user-jsexpr (turn-text e)))
      ;; the whole of what was said, as one chunk: a panel that accumulated it
      ;; letter by letter ends up with the same string
      (if (string=? (turn-agent e) "") '() (list (chunk-jsexpr (turn-agent e))))
      (for/list ([t (in-list (reverse (turn-tools e)))])
        (tool-jsexpr (tool-id t) (tool-title t) (tool-status t)))
      (case (turn-status e)
        [(done) (list (done-jsexpr e))]
        [(error) (list (error-jsexpr (or (turn-err e) "")))]
        [else '()]))]))

;; ---- the seam ---------------------------------------------------------------
;;
;; Everything the agent has to say arrives here, as one of olai/acp's
;; events, on whichever of the client's threads heard it. Each case does the
;; same two things in the same order and under the same lock: move the
;; conversation, then say so.
;;
;; It is public because it is the seam: a conversation can be driven by hand,
;; which is how a replay or a model switch is tested without a subprocess.

(define (chat-handle-event! ch ev)
  (cond
    [(acp-said? ev) (chunk! ch (acp-said-text ev))]
    [(acp-user-said? ev) (replay-user-chunk! ch (acp-user-said-text ev))]
    [(acp-tool? ev) (tool-call! ch (acp-tool-id ev) (acp-tool-title ev) (acp-tool-status ev))]
    [(acp-tool-moved? ev) (tool-update! ch (acp-tool-moved-id ev)
                                        (acp-tool-moved-title ev)
                                        (acp-tool-moved-status ev))]
    [(acp-config-model? ev) (learn-config-model! ch
                                                 (acp-config-model-name ev)
                                                 (acp-config-model-labels ev))]
    [(acp-live-model? ev) (learn-live-model! ch (acp-live-model-id ev))]
    [(acp-commands? ev) (learn-commands! ch (acp-commands-commands ev))]
    [(acp-session? ev) (establish-session! ch (acp-session-id ev) (acp-session-title ev))]
    [(acp-session-titled? ev) (learn-session-title! ch (acp-session-titled-title ev))]
    [(acp-session-over? ev) (with-state ch (λ () (forget-session! ch)))]
    [(acp-replay-started? ev) (start-replay! ch)]
    [(acp-replay-ended? ev) (end-replay! ch)]
    [(acp-gone? ev) (agent-gone! ch (acp-gone-why ev))]
    ;; already logged, by the half that knows what actually failed
    [(acp-trouble? ev) (error-frame! ch (acp-trouble-message ev))]
    [else (void)])
  (void))

;; ---- which model ------------------------------------------------------------
;;
;; The agent says it two ways and neither alone is enough: the session's config
;; option is what was PICKED, the CLI's own init message is what is RUNNING, and
;; they part company at a `/model` slash command (see olai/acp).
;;
;; Whichever source moved last wins, and each is debounced against its OWN
;; previous value: the picker resends its whole set whenever anything in it
;; moves (an effort change, a fast-mode toggle), and the live id repeats on
;; every turn. The first live id is a BASELINE — it agrees with the config
;; option by construction, and a session announcing itself twice would say the
;; same thing in two spellings.

(define (chat-model ch)
  (with-state ch (λ () (conversation-model ch))))

;; The one place the header's model changes. Callers hold `sema`.
(define (show-model! ch name)
  (unless (equal? name (conversation-model ch))
    (set-conversation-model! ch name)
    (broadcast! ch (model-jsexpr name))))

;; The picked model, and the picker to label the live one with.
(define (learn-config-model! ch name labels)
  (with-state ch
    (λ ()
      (set-conversation-labels! ch labels)
      (when (and name (not (equal? name (conversation-config-model ch))))
        (set-conversation-config-model! ch name)
        (show-model! ch name)))))

;; The model a turn actually ran on.
(define (learn-live-model! ch id)
  (define unknown?
    (with-state ch
      (λ ()
        (cond
          [(equal? id (conversation-live-model ch)) #f]
          [else
           (define baseline? (not (conversation-live-model ch)))
           (set-conversation-live-model! ch id)
           (define name (hash-ref (conversation-labels ch) id #f))
           (unless baseline? (show-model! ch (or name id)))
           (not name)]))))
  ;; Worth one line each: an id the picker does not offer is the case where a
  ;; header shows a raw model string, and the log is where the spelling the
  ;; agent actually uses becomes visible.
  (when unknown?
    (acp-log-once! (client ch) (format "live-model ~a" id)
                   (format "the agent is running \"~a\", which its model picker does not offer" id))))

;; ---- which conversation -----------------------------------------------------
;;
;; The id and the title are the panel's, not a browser's: the header names the
;; conversation, and the picker marks which row is the one you are in.

(define (chat-session-id ch)
  (with-state ch (λ () (conversation-session ch))))

(define (chat-session-title ch)
  (with-state ch (λ () (conversation-title ch))))

;; Callers hold `sema`.
(define (broadcast-session! ch)
  (broadcast! ch (session-jsexpr (conversation-session ch) (conversation-title ch))))

;; A session, however it was got. The title is only ever SET here, never
;; cleared (that happened when the last one ended): a name that landed while the
;; session was being made named this session, and would be thrown away by a #f.
(define (establish-session! ch sid title)
  (with-state ch
    (λ ()
      (set-conversation-session! ch sid)
      (when title (set-conversation-title! ch title))
      (broadcast-session! ch))))

;; The conversation that was is over. Silent: what replaces it is what a panel
;; is told about, and a header that blanked in between would be flicker.
;; Callers hold `sema`.
(define (forget-session! ch)
  (set-conversation-session! ch #f)
  (set-conversation-title! ch #f))

;; The agent writes a name for the conversation in the background (the Claude
;; Code adapter pulls it at turn end), and says so when it changes.
(define (learn-session-title! ch title)
  (with-state ch
    (λ ()
      (unless (equal? title (conversation-title ch))
        (set-conversation-title! ch title)
        (broadcast-session! ch)))))

;; What a picker draws — the agent's own list, asked for every time. Nothing is
;; kept here, because a copy would be wrong the moment another client wrote a
;; session.
(define (chat-sessions ch)
  (acp-sessions (client ch)))

;; ---- which slash commands ----------------------------------------------------

(define (chat-commands ch)
  (with-state ch (λ () (conversation-commands ch))))

;; Learned, never configured — same discipline as the model: the frame goes out
;; only when the list actually moved, so a session that re-announces the same
;; commands on every reset says nothing.
(define (learn-commands! ch commands)
  (with-state ch
    (λ ()
      (unless (equal? commands (conversation-commands ch))
        (set-conversation-commands! ch commands)
        (broadcast! ch (commands-jsexpr commands))))))

;; ---- turn bookkeeping ------------------------------------------------------

;; The turn an update belongs to. A REPLAY assembles into its own, so a prompt
;; accepted while a session is loading (the panel is up, the boot is not
;; finished) cannot be handed somebody else's history. Callers hold `sema`.
(define (current-turn ch)
  (if (conversation-replaying? ch)
      (or (conversation-replay-turn ch) (open-replay-turn! ch))
      (conversation-live-turn ch)))

(define (chunk! ch text)
  (with-state ch
    (λ ()
      (define tn (current-turn ch))
      (cond
        [tn
         (set-turn-agent! tn (string-append (turn-agent tn) text))
         (broadcast! ch (chunk-jsexpr text))]
        [else (log! ch "text arrived outside a turn; dropped")]))))

(define (tool-call! ch id title status)
  (with-state ch
    (λ ()
      (define tn (current-turn ch))
      (when tn
        (define t (or (find-tool tn id)
                      (let ([t (tool id title status)])
                        (set-turn-tools! tn (cons t (turn-tools tn)))
                        t)))
        (set-tool-title! t title)
        (set-tool-status! t status)
        (broadcast! ch (tool-jsexpr id title status))))))

;; An update carries only what changed; the line keeps whatever it had.
(define (tool-update! ch id title status)
  (with-state ch
    (λ ()
      (define tn (current-turn ch))
      (define t (and tn (find-tool tn id)))
      (cond
        [t
         (when title (set-tool-title! t title))
         (when status (set-tool-status! t status))
         (broadcast! ch (tool-jsexpr id (tool-title t) (tool-status t)))]
        [tn
         ;; an update for a call we never saw: still a line worth showing
         (define t2 (tool id (or title "tool") (or status tool-in-progress)))
         (set-turn-tools! tn (cons t2 (turn-tools tn)))
         (broadcast! ch (tool-jsexpr id (tool-title t2) (tool-status t2)))]
        [else (void)]))))

(define (find-tool tn id)
  (for/or ([t (in-list (turn-tools tn))])
    (and (equal? (tool-id t) id) t)))

;; ---- replaying a loaded session ---------------------------------------------
;;
;; A loaded conversation arrives as the same events a lived one does, between
;; a start and an end, and nothing in them says where one turn ended — so the
;; turns are reconstructed here, from the only boundary the replay has: a user
;; message.
;;
;; The rule is one line long. A user chunk is BUFFERED (a prompt can arrive as
;; several content blocks); the first agent chunk or tool call after it opens
;; the turn with what was buffered, and the next user chunk closes it. The last
;; turn is closed when the replay ends.
;;
;; What comes out is a turn of the same shape a lived one has, so the panel,
;; the page and the transcript need to know nothing about any of this — with
;; one honest difference: `stopReason` is null. The replay does not carry how a
;; turn ended, and "end_turn" would be this module's word, not the agent's.

;; The transcript of a conversation that is no longer the conversation would be
;; a lie, and the panels showing it have to be cleared before the replay starts
;; filling them again.
(define (start-replay! ch)
  (with-state ch
    (λ ()
      (set-conversation-entries! ch '())
      (set-conversation-replay-turn! ch #f)
      (set-conversation-replay-user! ch #f)
      (set-conversation-replaying?! ch #t)
      (broadcast! ch (reset-jsexpr)))))

;; Callers hold `sema`.
(define (open-replay-turn! ch)
  (define text (or (conversation-replay-user ch) ""))
  (define tn (turn text "" '() 'running #f #f #t #f))
  (set-conversation-replay-user! ch #f)
  (set-conversation-replay-turn! ch tn)
  (push-entry! ch tn)
  (broadcast! ch (user-jsexpr text))
  tn)

;; Callers hold `sema`.
(define (close-replay-turn! ch)
  (define tn (conversation-replay-turn ch))
  (when tn
    (set-turn-status! tn 'done)
    (set-conversation-replay-turn! ch #f)
    (broadcast! ch (done-jsexpr tn))))

(define (replay-user-chunk! ch text)
  (with-state ch
    (λ ()
      (cond
        [(conversation-replaying? ch)
         ;; a user message after agent content is the next turn
         (when (conversation-replay-turn ch) (close-replay-turn! ch))
         (set-conversation-replay-user!
          ch (string-append (or (conversation-replay-user ch) "") text))]
        ;; live: the echo of a prompt the panel drew when it was accepted
        [else (void)]))))

;; Everything the agent has to say about this conversation is in. Whatever is
;; still open becomes a turn — including a prompt with no answer after it,
;; which is what a conversation interrupted mid-turn looks like.
(define (end-replay! ch)
  (with-state ch
    (λ ()
      (when (and (not (conversation-replay-turn ch)) (conversation-replay-user ch))
        (open-replay-turn! ch))
      (close-replay-turn! ch)
      (set-conversation-replay-user! ch #f)
      (set-conversation-replaying?! ch #f))))

;; ---- the agent dies ---------------------------------------------------------

;; Nobody asked for this. The turn in flight ends in the thread that owns it
;; (its prompt fails); what is recorded here is the break in the conversation,
;; because the successor starts with no memory of any of it. A replay the agent
;; died in the middle of is over, however it ended.
(define (agent-gone! ch why)
  (with-state ch
    (λ ()
      (set-conversation-replaying?! ch #f)
      (set-conversation-replay-turn! ch #f)
      (set-conversation-replay-user! ch #f)
      (push-entry! ch (marker "restart"
                              (string-append why "; the next prompt starts a new session"))))))

;; ---- prompting -------------------------------------------------------------

(define (busy-fail)
  (raise (exn:fail:op "the agent is busy with another turn"
                      (current-continuation-marks)
                      'busy #f #f #f)))

(define (stopped-fail)
  (raise (exn:fail:op "the agent has been stopped"
                      (current-continuation-marks)
                      'validation #f #f #f)))

;; Boot now rather than at the first prompt: a panel that is supposed to come
;; up showing your last conversation needs one before anybody types. A failure
;; is a frame, not a caller's problem.
(define (chat-boot! ch)
  (acp-boot! (client ch)))

;; Non-blocking: the turn is accepted (or refused) here and runs in its own
;; thread. The echoed `user` frame is what makes a second browser tab show the
;; message this one typed.
(define (chat-prompt! ch text)
  (define tn
    (with-state ch
      (λ ()
        (when (acp-stopped? (client ch)) (stopped-fail))
        (when (conversation-busy? ch) (busy-fail))
        (define tn (turn text "" '() 'running #f #f #f #f))
        ;; a cancel left over from a turn that died before it could be sent
        ;; belongs to that turn, not this one
        (set-conversation-cancel-pending?! ch #f)
        (set-conversation-busy?! ch #t)
        (set-conversation-live-turn! ch tn)
        (push-entry! ch tn)
        (broadcast! ch (user-jsexpr text))
        tn)))
  (in-custodian ch (λ () (thread (λ () (run-turn ch tn)))))
  (void))

(define (run-turn ch tn)
  (define outcome
    (with-handlers ([exn:fail? (λ (e) (cons 'error (exn-message e)))])
      (cons 'ok (acp-prompt! (client ch) (turn-text tn)
                             #:on-send (λ () (flush-cancel! ch tn))))))
  (with-state ch
    (λ ()
      (cond
        [(eq? (car outcome) 'ok)
         (set-turn-status! tn 'done)
         (set-turn-stop! tn (cdr outcome))
         ;; Markdown is render-time only: the turn keeps the raw text, and the
         ;; frame carries a rendered COPY so a panel that accumulated plain
         ;; chunks can swap in the real thing without parsing anything.
         (broadcast! ch (done-jsexpr tn))]
        [else
         (set-turn-status! tn 'error)
         (set-turn-err! tn (cdr outcome))
         (broadcast! ch (error-jsexpr (cdr outcome)))])
      (set-conversation-live-turn! ch #f)
      (set-conversation-busy?! ch #f))))

;; ---- picking a conversation --------------------------------------------------

;; Load a stored session. Non-blocking, like a prompt: the caller gets a status,
;; and the replay arrives as frames — a load is exactly as slow as the
;; conversation is long, and no browser should hold a POST open for it.
;;
;; Refused while a turn is running or another load is in flight ('busy, the
;; same 409 a second prompt gets). A prompt during a load is NOT refused: it
;; waits on the agent like any prompt typed into a booting one.
(define (chat-load! ch sid)
  (with-state ch
    (λ ()
      (when (acp-stopped? (client ch)) (stopped-fail))
      (when (or (conversation-busy? ch) (conversation-loading? ch)) (busy-fail))
      (set-conversation-loading?! ch #t)))
  (in-custodian ch (λ () (thread (λ () (run-load ch sid)))))
  (void))

(define (run-load ch sid)
  (with-handlers ([exn:fail?
                   (λ (e)
                     (define message (format "could not load that session: ~a" (exn-message e)))
                     (log! ch message)
                     (error-frame! ch message))])
    (acp-load-session! (client ch) sid))
  (with-state ch (λ () (set-conversation-loading?! ch #f))))

;; ---- cancelling -------------------------------------------------------------

;; A turn is accepted before it is sent — spawning the agent and shaking hands
;; takes seconds, and a person who types and immediately hits stop is inside
;; that window. There is nothing for the agent to match a cancel against yet, so
;; it is REMEMBERED and sent the moment the prompt is on the wire. Either way
;; the turn ends the one way it can: a `done` frame with stopReason cancelled.
(define (chat-cancel! ch)
  (define send?
    (with-state ch
      (λ ()
        (define tn (conversation-live-turn ch))
        (cond
          [(not (and (conversation-busy? ch) tn)) #f]
          [(turn-sent? tn) #t]
          [else (set-conversation-cancel-pending?! ch #t) #f]))))
  (when send? (acp-cancel! (client ch)))
  (void))

;; The prompt is on the wire. Mark it, and take any cancel that was waiting
;; for exactly this moment.
(define (flush-cancel! ch tn)
  (define pending
    (with-state ch
      (λ ()
        (set-turn-sent?! tn #t)
        (begin0 (conversation-cancel-pending? ch)
          (set-conversation-cancel-pending?! ch #f)))))
  (when pending (acp-cancel! (client ch))))

;; ---- new chat ---------------------------------------------------------------

;; Wait for the live turn to settle. -> #t when it did.
(define (wait-idle ch seconds)
  (define deadline (+ (current-inexact-milliseconds) (* 1000.0 seconds)))
  (let loop ()
    (cond
      [(not (chat-busy? ch)) #t]
      [(>= (current-inexact-milliseconds) deadline) #f]
      [else (sleep 0.02) (loop)])))

;; New chat: the agent-side context goes away, the transcript keeps its
;; history and says where the break is. A turn in flight is cancelled first —
;; and if it will not settle, the subprocess is taken away from it, which ends
;; it with an error frame rather than leaving the panel wedged.
(define (chat-reset! ch)
  (when (chat-busy? ch)
    (chat-cancel! ch)
    (unless (wait-idle ch reset-timeout-seconds)
      (log! ch "a turn would not settle; taking the subprocess away from it")
      (acp-kill! (client ch))
      (wait-idle ch reset-timeout-seconds)))
  (acp-new-session! (client ch))
  (with-state ch
    (λ ()
      (push-entry! ch (marker "reset" #f))
      (broadcast! ch (reset-jsexpr))))
  (void))

(define (chat-stop! ch)
  (acp-stop! (client ch)))
