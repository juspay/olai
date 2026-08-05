#lang racket/base

;; The conversation, against a scripted agent (tests/fake-acp-agent.rkt): real
;; subprocess, real ndjson, no LLM. What is being checked is the FRAMES — the
;; wire format WP5 renders — and the transcript it replays from. The protocol
;; underneath is tests/acp.rkt's business.
;;
;; Frames are parsed, never string-matched: they are JSON on the wire and the
;; key order is not a contract.
;;
;; Some cases skip the subprocess and hand the conversation the events a client
;; would have delivered (`chat-handle-event!`, the seam): a replay boundary, a
;; model that moved under a session, an agent that died — each of those is one
;; line of events and several of scripted agent.

(require rackunit
         json
         net/http-client
         net/uri-codec
         racket/async-channel
         racket/file
         racket/list
         racket/port
         racket/string
         selfflowy/acp
         selfflowy/ops
         selfflowy/web/chat
         selfflowy/web/markdown
         selfflowy/web/serve)

(define fake-agent
  (path->string (collection-file-path "fake-acp-agent.rkt" "selfflowy" "tests")))

;; A file that exists and is not an executable: the other way to get the
;; agent's path wrong.
(define example
  (build-path (simplify-path (build-path (collection-file-path "info.rkt" "selfflowy")
                                         'up 'up))
              "examples" "Example.rkt"))

;; -> (values chat frame-channel log-port). The agent is stopped on the way
;; out whether the body finished or not.
(define (with-agent proc)
  (define frames (make-async-channel))
  (define log (open-output-string))
  (define ag (make-chat #:command fake-agent
                             #:cwd (find-system-path 'temp-dir)
                             #:broadcast (λ (name data) (async-channel-put frames (cons name data)))
                             #:log-port log))
  (dynamic-wind void (λ () (proc ag frames log)) (λ () (chat-stop! ag))))

;; Next frame as (cons event-name jsexpr), or #f. Generous: a subprocess boot
;; is in here the first time.
(define (next-frame frames [timeout 30])
  (define f (sync/timeout timeout frames))
  (and f (cons (car f) (string->jsexpr (cdr f)))))

;; Every frame up to and including the first one of `type` — the whole turn as
;; one value, so a test can assert the SEQUENCE rather than poll for parts.
(define (frames-through frames type [timeout 30])
  (let loop ([acc '()] [n 0])
    (cond
      [(> n 20) (reverse acc)]
      [else
       (define f (next-frame frames timeout))
       (cond
         [(not f) (reverse acc)]
         [(equal? (hash-ref (cdr f) 'type #f) type) (reverse (cons f acc))]
         [else (loop (cons f acc) (add1 n))])])))

(define (frame-types fs)
  (for/list ([f (in-list fs)]) (hash-ref (cdr f) 'type #f)))

;; The frames of one type, in order — an assertion about WHAT a frame said
;; rather than about where in the sequence it landed (the sequence has its own
;; check, right above every one of these).
(define (frames-of fs type)
  (for/list ([f (in-list fs)]
             #:when (equal? (hash-ref (cdr f) 'type #f) type))
    (cdr f)))

(define (frame-of fs type)
  (define hits (frames-of fs type))
  (and (pair? hits) (car hits)))

;; What a session says about itself the moment it exists: which conversation
;; (twice — the id as soon as there is one, the name when the agent has written
;; one), which model it runs, which slash commands it offers. A bridge that
;; boots lazily says all of it inside the first turn, which is the turn that
;; booted it.
(define boot-frames '("session" "model" "commands" "session"))

;; A command list as pairs, and its key count beside it. A frame's hashes come
;; back from read-json and the bridge's are its own, so the comparison is over
;; content — and the count is how "and nothing else" is said.
(define (command-pairs cs)
  (for/list ([c (in-list cs)])
    (list (hash-ref c 'name #f) (hash-ref c 'description #f) (hash-count c))))

;; A conversation with nothing behind it: the agent is never spawned, and the
;; events a client would have delivered are handed over by hand.
;; -> (proc chat frame-channel).
(define (with-events proc)
  (define frames (make-async-channel))
  (define ch (make-chat #:command fake-agent
                        #:cwd (find-system-path 'temp-dir)
                        #:broadcast (λ (name data) (async-channel-put frames (cons name data)))
                        #:log-port (open-output-string)))
  (dynamic-wind void (λ () (proc ch frames)) (λ () (chat-stop! ch))))

(define (feed! ch . events)
  (for ([ev (in-list events)]) (chat-handle-event! ch ev)))

;; Every frame there is, in order. Synchronous by construction: the events were
;; handed over on this thread, so whatever they broadcast is already here.
(define (drain frames)
  (let loop ([acc '()])
    (define f (async-channel-try-get frames))
    (if f
        (loop (cons (cons (car f) (string->jsexpr (cdr f))) acc))
        (reverse acc))))

(define (wait-idle ag [seconds 30])
  (define deadline (+ (current-inexact-milliseconds) (* 1000.0 seconds)))
  (let loop ()
    (cond
      [(not (chat-busy? ag)) #t]
      [(>= (current-inexact-milliseconds) deadline) #f]
      [else (sleep 0.02) (loop)])))

;; ---- a server with an agent in it ------------------------------------------

(define outline
  (string-append "#lang selfflowy\n" "Inbox\n" "  Buy milk\n"))

;; Boots the real server with the fake agent wired in: (proc port agent).
;;
;; The server boots the agent itself now, in the background, so the body runs
;; only once that has finished: everything the boot says (the session, the
;; model, the commands) is already out, and what a test then asserts on the
;; stream is the turn it asked for.
(define (with-server proc)
  (define dir (make-temporary-file "sfacp~a" 'directory))
  (define f (build-path dir "Tasks.rkt"))
  (display-to-file outline f #:exists 'truncate)
  (define bound #f)
  (define agent #f)
  (define stop
    (start-server #:port 0
                  #:bind "127.0.0.1"
                  #:files (list f)
                  #:acp-command fake-agent
                  #:on-listen (λ (p) (set! bound p))
                  #:on-agent (λ (a) (set! agent a))))
  (dynamic-wind
   void
   (λ ()
     (check-true (wait-booted agent) "the agent never booted")
     (proc bound agent))
   (λ ()
     (stop)
     (delete-directory/files dir))))

;; -> #t once the bridge has a session.
(define (wait-booted ag [seconds 30])
  (define deadline (+ (current-inexact-milliseconds) (* 1000.0 seconds)))
  (let loop ()
    (cond
      [(chat-session-id ag) #t]
      [(>= (current-inexact-milliseconds) deadline) #f]
      [else (sleep 0.02) (loop)])))

;; The fake agent keeps stored sessions only when it is told to (see its
;; header): the environment is what the subprocess inherits, so this is set
;; around the whole of a test, agent and all.
(define (with-stored-sessions thunk)
  (define env (current-environment-variables))
  (dynamic-wind
   (λ () (environment-variables-set! env #"SELFFLOWY_FAKE_ACP_STORED" #"1"))
   thunk
   (λ () (environment-variables-set! env #"SELFFLOWY_FAKE_ACP_STORED" #f))))

;; /events never ends, so this keeps the port. Same shape as tests/serve.rkt.
(define (open-events port)
  (define-values (_status _headers in)
    (http-sendrecv "127.0.0.1" "/events" #:port port #:method #"GET"))
  in)

;; Next real event on the stream: -> (cons name data) | #f. Heartbeats are
;; framing, not news.
(define (next-event in #:timeout [timeout 30])
  (define deadline (+ (current-inexact-milliseconds) (* 1000.0 timeout)))
  (let loop ([name #f] [data '()])
    (define left (/ (- deadline (current-inexact-milliseconds)) 1000.0))
    (define line (and (positive? left)
                      (sync/timeout left (read-line-evt in 'linefeed))))
    (cond
      [(or (not line) (eof-object? line)) #f]
      [(string=? line "")
       (if name (cons name (string-join (reverse data) "\n")) (loop #f '()))]
      [(string-prefix? line "event: ") (loop (substring line 7) data)]
      [(string-prefix? line "data: ") (loop name (cons (substring line 6) data))]
      [else (loop name data)])))

;; -> (values status-code body-string). A form post, the way the panel sends
;; one; `fields` is an alist, url-encoded here rather than by hand.
(define (POST port path [fields '()])
  (define-values (status _headers in)
    (http-sendrecv "127.0.0.1" path #:port port #:method #"POST"
                   #:headers (list #"Content-Type: application/x-www-form-urlencoded")
                   #:data (alist->form-urlencoded fields)))
  (define body (port->string in))
  (close-input-port in)
  (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
          body))

(define (GET port path)
  (define-values (status _headers in)
    (http-sendrecv "127.0.0.1" path #:port port #:method #"GET"))
  (define body (port->string in))
  (close-input-port in)
  (values (string->number (cadr (string-split (bytes->string/utf-8 status) " ")))
          body))

;; Frames off a live /events connection, up to and including the first one of
;; `type`. Same idea as frames-through, one layer out: over HTTP.
(define (events-through in type)
  (let loop ([acc '()] [n 0])
    (cond
      [(> n 20) (reverse acc)]
      [else
       (define ev (next-event in))
       (cond
         [(not ev) (reverse acc)]
         [else
          (define js (string->jsexpr (cdr ev)))
          (if (equal? (hash-ref js 'type #f) type)
              (reverse (cons js acc))
              (loop (cons js acc) (add1 n)))])])))

;; ---- the CLI ---------------------------------------------------------------

;; `selfflowy serve ARGS` with SELFFLOWY_ACP_AGENT set to `agent` — or removed
;; from the environment entirely when it is #f. -> (values sp stdout stderr).
(define (start-serve agent args)
  (define env (environment-variables-copy (current-environment-variables)))
  (environment-variables-set! env #"SELFFLOWY_ACP_AGENT"
                              (and agent (string->bytes/utf-8 agent)))
  (define-values (sp stdout stdin stderr)
    (parameterize ([current-environment-variables env])
      (apply subprocess #f #f #f (find-executable-path "racket")
             "-l" "selfflowy/cli" "--" "serve" args)))
  (close-output-port stdin)
  (values sp stdout stderr))

;; A serve that is expected to REFUSE: -> (values exit-code stderr).
(define (run-serve agent [args (list (path->string example))])
  (define-values (sp stdout stderr) (start-serve agent args))
  (define _out (port->string stdout))
  (define err (port->string stderr))
  (close-input-port stdout)
  (close-input-port stderr)
  (subprocess-wait sp)
  (values (subprocess-status sp) err))

;; A serve that is expected to COME UP: (proc port announcement). The port is
;; read off the announcement line (--port 0 picks one), and the subprocess is
;; taken down on the way out whether the body finished or not.
(define (with-serve args proc)
  (define-values (sp stdout stderr)
    (start-serve fake-agent (append (list "--port" "0") args)))
  (dynamic-wind
   void
   (λ ()
     (define line (sync/timeout 60 (read-line-evt stdout 'any)))
     (check-true (string? line) (format "serve said nothing: ~a" line))
     (define m (regexp-match #rx"http://[^:]+:([0-9]+)" line))
     (check-true (and m #t) (format "no url in ~s" line))
     (proc (string->number (cadr m)) line))
   (λ ()
     (subprocess-kill sp #t)
     (subprocess-wait sp)
     (close-input-port stdout)
     (close-input-port stderr))))

(module+ test
  ;; ---- a whole turn --------------------------------------------------------

  (test-case "a turn is user, the agent's text, its tool lines, then done"
    (with-agent
     (λ (ag frames _log)
       (check-false (chat-busy? ag))
       (chat-prompt! ag "hello there")
       (define fs (frames-through frames "done"))
       (check-equal? (map car fs) (make-list (length fs) "chat"))
       ;; the boot frames are the session announcing itself: the subprocess is
       ;; spawned by this first prompt, so they land inside this first turn
       (check-equal? (frame-types fs)
                     (append '("user") boot-frames
                             '("chunk" "chunk" "tool" "tool" "done")))
       (check-equal? (hash-ref (frame-of fs "user") 'text) "hello there")
       (check-equal? (hash-ref (frame-of fs "model") 'name) "fake-model-1")
       (check-equal? (for/list ([f (in-list (frames-of fs "chunk"))])
                       (hash-ref f 'text))
                     '("hello " "world"))
       ;; one line, two frames: the same id, the status moving
       (define tools (frames-of fs "tool"))
       (check-equal? (hash-ref (list-ref tools 0) 'id) "call-1")
       (check-equal? (hash-ref (list-ref tools 0) 'title) "read Tasks.rkt")
       (check-equal? (hash-ref (list-ref tools 0) 'status) "pending")
       (check-equal? (hash-ref (list-ref tools 1) 'id) "call-1")
       (check-equal? (hash-ref (list-ref tools 1) 'status) "completed")
       (check-equal? (hash-ref (frame-of fs "done") 'stopReason) "end_turn")
       ;; and the transcript is that turn, accumulated
       (check-true (wait-idle ag))
       (define t (chat-transcript ag))
       (check-equal? (length t) 1)
       (check-equal? (car t)
                     (hash 'type "turn"
                           'text "hello there"
                           'agent "hello world"
                           'tools (list (hash 'id "call-1"
                                              'title "read Tasks.rkt"
                                              'status "completed"))
                           'status "done"
                           'stopReason "end_turn"
                           'error (json-null))))))

  ;; An unanswered session/request_permission hangs the turn forever. The
  ;; bridge answers it without asking anybody, so this turn simply finishes.
  (test-case "a permission request is answered, and the turn completes"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "read a file PERMISSION please")
       (define fs (frames-through frames "done"))
       (check-equal? (frame-types fs)
                     (append '("user") boot-frames
                             '("chunk" "chunk" "tool" "tool" "done")))
       (check-equal? (hash-ref (cdr (last fs)) 'stopReason) "end_turn"))))

  ;; ---- which model ---------------------------------------------------------
  ;;
  ;; The agent's word, never the bridge's guess — and it says it two ways: the
  ;; session config option (what was PICKED) and the CLI's own init message
  ;; (what is RUNNING). They part company at a `/model` slash command.

  (test-case "the model arrives with the session, sticks, and follows a switch"
    (with-agent
     (λ (ag frames _log)
       ;; nothing has been asked yet, so nothing is known
       (check-false (chat-model ag))
       (chat-prompt! ag "hello there")
       (define fs (frames-through frames "done"))
       (check-equal? (frame-types fs)
                     (append '("user") boot-frames
                             '("chunk" "chunk" "tool" "tool" "done")))
       (check-equal? (hash-ref (frame-of fs "model") 'name) "fake-model-1")
       (check-true (wait-idle ag))
       (check-equal? (chat-model ag) "fake-model-1")
       ;; a session that changes model mid-turn says so, in place
       (chat-prompt! ag "MODEL switch please")
       (define fs2 (frames-through frames "done"))
       (check-equal? (frame-types fs2)
                     '("user" "chunk" "model" "chunk" "tool" "tool" "done"))
       (check-equal? (hash-ref (cdr (list-ref fs2 2)) 'name) "fake-model-2")
       (check-true (wait-idle ag))
       (check-equal? (chat-model ag) "fake-model-2")
       ;; and a third turn on the same model is silent about it
       (chat-prompt! ag "still there")
       (check-equal? (frame-types (frames-through frames "done"))
                     '("user" "chunk" "chunk" "tool" "tool" "done")))))

  ;; A `/model` slash command never reaches the adapter as a config change —
  ;; the wrapped CLI handles it, and the config option goes on naming the model
  ;; the session started on. The live model is in the CLI's `system`/`init`
  ;; message, which the adapter forwards only because session/new asked for it.
  ;; Without both halves the header says "Fable" while every turn runs Opus.
  (test-case "a live model switch that never touches the config option lands anyway"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "hello there")
       (define fs (frames-through frames "done"))
       ;; the first init agrees with the config option, so it is a baseline and
       ;; says nothing: one `model` frame for the session, not two
       (check-equal? (frame-types fs)
                     (append '("user") boot-frames
                             '("chunk" "chunk" "tool" "tool" "done")))
       (check-true (wait-idle ag))
       (check-equal? (chat-model ag) "fake-model-1")
       ;; the slash command: a fresh init, no config_option_update
       (chat-prompt! ag "SLASH /model please")
       (define fs2 (frames-through frames "done"))
       (check-equal? (frame-types fs2)
                     '("user" "chunk" "model" "chunk" "tool" "tool" "done"))
       ;; labelled from the picker, which is what a header wants
       (check-equal? (hash-ref (cdr (list-ref fs2 2)) 'name) "Fake Model Three")
       (check-true (wait-idle ag))
       (check-equal? (chat-model ag) "Fake Model Three")
       ;; and the next turn, running the same model, is silent about it
       (chat-prompt! ag "still there")
       (check-equal? (frame-types (frames-through frames "done"))
                     '("user" "chunk" "chunk" "tool" "tool" "done"))
       (check-equal? (chat-model ag) "Fake Model Three"))))

  ;; A running model the picker never offered: the raw id is what a header
  ;; gets. Truthful, and the log says so once so the spelling is findable.
  (test-case "a live model the picker does not offer is shown raw, and logged once"
    (with-agent
     (λ (ag frames log)
       (chat-prompt! ag "hello there")
       (frames-through frames "done")
       (check-true (wait-idle ag))
       (chat-prompt! ag "UNLISTED please")
       (define fs (frames-through frames "done"))
       (check-equal? (frame-types fs)
                     '("user" "chunk" "model" "chunk" "tool" "tool" "done"))
       (check-equal? (hash-ref (cdr (list-ref fs 2)) 'name) "claude-fake-9[1m]")
       (check-true (wait-idle ag))
       (check-equal? (chat-model ag) "claude-fake-9[1m]")
       (define lines (get-output-string log))
       (check-true (string-contains? lines "claude-fake-9[1m]") lines)
       ;; every turn re-announces it; the log says it once
       (chat-prompt! ag "still there")
       (frames-through frames "done")
       (check-true (wait-idle ag))
       (define n (length (regexp-match* #rx"does not offer" (get-output-string log))))
       (check-equal? n 1 (get-output-string log)))))

  ;; ---- which slash commands ------------------------------------------------
  ;;
  ;; The agent's list, whole, every time it moves — and only when it moves. A
  ;; command is invoked as ordinary prompt text, so this is the only thing the
  ;; bridge does with one.

  (test-case "the commands arrive with the session, stick, and follow a change"
    (with-agent
     (λ (ag frames _log)
       ;; nothing has been asked yet, so nothing is offered
       (check-equal? (chat-commands ag) '())
       (chat-prompt! ag "hello there")
       (define fs (frames-through frames "done"))
       (check-equal? (frame-types fs)
                     (append '("user") boot-frames
                             '("chunk" "chunk" "tool" "tool" "done")))
       ;; name and description, and nothing else: the argument hint the
       ;; adapter sends is not something the panel draws
       (define offered '(("fake-init" "start something" 2)
                         ("fake-review" "look it over" 2)))
       (check-equal? (command-pairs (hash-ref (frame-of fs "commands") 'commands)) offered)
       (check-true (wait-idle ag))
       (check-equal? (command-pairs (chat-commands ag)) offered)
       ;; a session that learns a new set says so, in place
       (chat-prompt! ag "COMMANDS please")
       (define fs2 (frames-through frames "done"))
       (check-equal? (frame-types fs2)
                     '("user" "chunk" "commands" "chunk" "tool" "tool" "done"))
       (define later '(("fake-later" "learned along the way" 2)))
       (check-equal? (command-pairs (hash-ref (cdr (list-ref fs2 2)) 'commands)) later)
       (check-true (wait-idle ag))
       (check-equal? (command-pairs (chat-commands ag)) later)
       ;; and a third turn offering the same set is silent about it
       (chat-prompt! ag "still there")
       (check-equal? (frame-types (frames-through frames "done"))
                     '("user" "chunk" "chunk" "tool" "tool" "done")))))

  ;; ---- one turn at a time --------------------------------------------------

  (test-case "a second prompt mid-turn is a busy failure, and harms nothing"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "SLOW down")
       ;; wait for the turn to be really under way, not just accepted
       (check-equal? (for/list ([_i (in-range (add1 (length boot-frames)))])
                       (hash-ref (cdr (next-frame frames)) 'type))
                     (cons "user" boot-frames))
       (check-equal? (hash-ref (cdr (next-frame frames)) 'type) "chunk")
       (define e
         (with-handlers ([exn:fail:op? values])
           (chat-prompt! ag "and another thing")
           #f))
       (check-pred exn:fail:op? e)
       (check-equal? (exn:fail:op-kind e) 'busy)
       (check-true (chat-busy? ag))
       ;; the first turn is still the only one, and still running
       (define t (chat-transcript ag))
       (check-equal? (length t) 1)
       (check-equal? (hash-ref (car t) 'status) "running")
       (check-equal? (hash-ref (car t) 'text) "SLOW down")
       ;; and it ends by itself when told to
       (chat-cancel! ag)
       (check-true (wait-idle ag)))))

  ;; The stop button is reachable the instant the prompt is accepted, and the
  ;; agent does not exist yet at that instant — spawning it and shaking hands
  ;; takes seconds. A cancel in that window used to be a silent no-op and the
  ;; turn ran to completion.
  (test-case "a cancel before the agent has booted still ends the turn"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "SLOW down")
       ;; no session, no subprocess, no chunk: nothing but the echoed prompt
       (check-equal? (hash-ref (cdr (next-frame frames)) 'type) "user")
       (chat-cancel! ag)
       (define fs (frames-through frames "done"))
       (check-equal? (hash-ref (cdr (last fs)) 'stopReason) "cancelled")
       (check-true (wait-idle ag))
       (define t (chat-transcript ag))
       (check-equal? (length t) 1)
       (check-equal? (hash-ref (car t) 'stopReason) "cancelled"))))

  (test-case "cancel ends the turn through its own response"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "SLOW down")
       (check-equal? (for/list ([_i (in-range (add1 (length boot-frames)))])
                       (hash-ref (cdr (next-frame frames)) 'type))
                     (cons "user" boot-frames))
       (check-equal? (hash-ref (cdr (next-frame frames)) 'type) "chunk")
       (chat-cancel! ag)
       (define done (cdr (next-frame frames)))
       (check-equal? (hash-ref done 'type) "done")
       (check-equal? (hash-ref done 'stopReason) "cancelled")
       (check-true (wait-idle ag))
       (check-equal? (hash-ref (car (chat-transcript ag)) 'stopReason) "cancelled"))))

  ;; ---- the agent dies ------------------------------------------------------

  (test-case "a crash ends the turn with an error, and the next prompt respawns"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "CRASH now")
       (define fs (frames-through frames "error"))
       (check-equal? (frame-types fs)
                     (append '("user") boot-frames '("chunk" "error")))
       (check-true (string-contains? (hash-ref (cdr (last fs)) 'message) "exited")
                   (format "~a" (cdr (last fs))))
       (check-true (wait-idle ag))
       ;; no respawn loop: nothing started a process nobody asked for
       (check-equal? (length (chat-transcript ag)) 2)
       ;; the next prompt gets a fresh agent, and a fresh session with it: the
       ;; session is a different one and says so (twice — id, then name), while
       ;; the model and the commands have not moved and say nothing
       (chat-prompt! ag "are you back")
       (check-equal? (frame-types (frames-through frames "done"))
                     '("user" "session" "session" "chunk" "chunk" "tool" "tool" "done"))
       (check-true (wait-idle ag))
       (define t (chat-transcript ag))
       (check-equal? (map (λ (e) (hash-ref e 'type)) t)
                     '("turn" "restart" "turn"))
       (check-equal? (hash-ref (list-ref t 0) 'status) "error")
       (check-true (string-contains? (hash-ref (list-ref t 1) 'message) "new session")
                   (format "~a" (list-ref t 1)))
       (check-equal? (hash-ref (list-ref t 2) 'status) "done"))))

  ;; ---- the log sink --------------------------------------------------------

  ;; The adapter logs to stderr, and a pipe nobody drains eventually blocks the
  ;; process writing into it. Draining it must also never be confused with the
  ;; protocol, which is stdout only.
  (test-case "the agent's stderr lands in the log and not in the frames"
    (with-agent
     (λ (ag frames log)
       (chat-prompt! ag "hello there")
       (check-equal? (frame-types (frames-through frames "done"))
                     (append '("user") boot-frames
                             '("chunk" "chunk" "tool" "tool" "done")))
       (check-true (wait-idle ag))
       (define noise
         (let loop ([n 0])
           (define s (get-output-string log))
           (cond
             [(string-contains? s "fake-acp-agent") s]
             [(> n 100) s]
             [else (sleep 0.05) (loop (add1 n))])))
       (check-true (string-contains? noise "fake-acp-agent: turn for") noise))))

  ;; ---- new chat ------------------------------------------------------------

  (test-case "reset marks the transcript and says so on the wire"
    (with-agent
     (λ (ag frames _log)
       (chat-prompt! ag "hello there")
       (frames-through frames "done")
       (check-true (wait-idle ag))
       (chat-reset! ag)
       ;; a new chat is a new SESSION, which announces itself the way any
       ;; other does; the reset is what the panels act on. The title the agent
       ;; then writes for it may land on either side of that, so only the
       ;; identity frame is asserted here.
       (define fs (frame-types (frames-through frames "reset")))
       (check-equal? (last fs) "reset" (format "~a" fs))
       (check-true (and (member "session" fs) #t) (format "~a" fs))
       (define t (chat-transcript ag))
       (check-equal? (map (λ (e) (hash-ref e 'type)) t) '("turn" "reset")))))

  ;; ---- the conversation it comes up in -------------------------------------
  ;;
  ;; An agent that keeps its sessions has a LAST one, and a server whose agent
  ;; works in a stable directory can come back up in it. Boot is where that is
  ;; decided: list, adopt the most recently updated one, replay it — or, with
  ;; nothing stored, start a new one, which is what every boot did before.

  (test-case "boot adopts the most recent stored session and replays it"
    (with-stored-sessions
     (λ ()
       (with-agent
        (λ (ag frames _log)
          (chat-boot! ag)
          ;; the replay is a conversation with no live turn behind it, and it
          ;; arrives as the frames a panel already knows how to draw
          (define fs (frames-through frames "commands"))
          (check-equal? (frame-types fs)
                        '("reset" "user" "chunk" "chunk" "tool" "tool" "done"
                          "session" "model" "commands"))
          (check-equal? (hash-ref (frame-of fs "user") 'text) "what did we do")
          ;; no stopReason: a replay does not say how a turn ended, and the
          ;; bridge does not invent one
          (define done (frame-of fs "done"))
          (check-equal? (hash-ref done 'stopReason) (json-null))
          (check-equal? (hash-ref done 'html) (note->html-string "we shipped it"))
          ;; the newer of the two stored sessions, not the first one listed
          (check-equal? (chat-session-id ag) "fake-stored-new")
          (define session (frame-of fs "session"))
          (check-equal? (hash-ref session 'id) "fake-stored-new")
          (check-equal? (hash-ref session 'title) "the last conversation")
          (check-equal? (chat-session-title ag) "the last conversation")
          ;; and the transcript is that turn, in the shape a lived one has
          (define t (chat-transcript ag))
          (check-equal? (length t) 1)
          (check-equal? (car t)
                        (hash 'type "turn"
                              'text "what did we do"
                              'agent "we shipped it"
                              'tools (list (hash 'id "call-replay"
                                                 'title "read Roadmap.rkt"
                                                 'status "completed"))
                              'status "done"
                              'stopReason (json-null)
                              'error (json-null)))
          ;; a prompt lands on the session that was adopted, not a new one
          (chat-prompt! ag "and now")
          (check-equal? (frame-types (frames-through frames "done"))
                        '("user" "chunk" "chunk" "tool" "tool" "done"))
          (check-true (wait-idle ag))
          (check-equal? (chat-session-id ag) "fake-stored-new")
          ;; the raw-init opt-in was asked for on the LOAD too, so the live
          ;; model is knowable in an adopted session as much as in a new one
          (check-equal? (chat-model ag) "fake-model-1"))))))

  (test-case "boot with nothing stored starts a new session"
    (with-agent
     (λ (ag frames _log)
       (chat-boot! ag)
       (define fs (frames-through frames "commands"))
       (check-equal? (frame-types fs) '("session" "model" "commands"))
       (check-equal? (hash-ref (frame-of fs "session") 'id) "fake-session-1")
       (check-equal? (hash-ref (frame-of fs "session") 'title) (json-null))
       ;; a boot is not a turn: nothing is busy, and there is nothing to replay
       (check-false (chat-busy? ag))
       (check-equal? (chat-transcript ag) '()))))

  ;; The picker's two verbs, at the bridge: what is stored, and moving to one
  ;; of them. A turn in flight owns the agent, so a load waits for another day.
  (test-case "the stored sessions are listed, newest first, with the current one marked"
    (with-stored-sessions
     (λ ()
       (with-agent
        (λ (ag frames _log)
          (chat-boot! ag)
          (frames-through frames "session")
          (define ss (chat-sessions ag))
          (check-equal? (for/list ([s (in-list ss)]) (hash-ref s 'id))
                        '("fake-stored-new" "fake-stored-old"))
          (check-equal? (for/list ([s (in-list ss)]) (hash-ref s 'current))
                        '(#t #f))
          (check-equal? (hash-ref (car ss) 'title) "the last conversation")
          (check-true (string? (hash-ref (car ss) 'updatedAt))))))))

  (test-case "a load while a turn is running is a busy failure"
    (with-stored-sessions
     (λ ()
       (with-agent
        (λ (ag frames _log)
          (chat-prompt! ag "SLOW down")
          (check-equal? (hash-ref (cdr (next-frame frames)) 'type) "user")
          (define e
            (with-handlers ([exn:fail:op? values])
              (chat-load! ag "fake-stored-old")
              #f))
          (check-pred exn:fail:op? e)
          (check-equal? (exn:fail:op-kind e) 'busy)
          (chat-cancel! ag)
          (check-true (wait-idle ag)))))))

  ;; ---- driven by hand ------------------------------------------------------
  ;;
  ;; The seam, without a subprocess: these are the events a client delivers,
  ;; handed over one at a time. Everything a panel sees is downstream of them,
  ;; so this is where the assembly rules are said plainly.

  ;; A replay carries no turn boundaries — only user messages, which is what a
  ;; turn starts with. Two of them is two turns, and the second one having no
  ;; answer yet is a conversation that was interrupted mid-turn.
  (test-case "a replay is cut into turns at its user messages"
    (with-events
     (λ (ch frames)
       (feed! ch (acp-session-over)
              (acp-replay-started)
              (acp-user-said "what did ")
              (acp-user-said "we do")
              (acp-said "we shipped it")
              (acp-tool "call-1" "read Roadmap.rkt" "pending")
              (acp-tool-moved "call-1" #f "completed")
              (acp-user-said "and then")
              (acp-replay-ended))
       (check-equal? (frame-types (drain frames))
                     '("reset" "user" "chunk" "tool" "tool" "done" "user" "done"))
       (define t (chat-transcript ch))
       (check-equal? (length t) 2)
       ;; the buffered blocks are one prompt, and the tool line kept the title
       ;; the update did not carry
       (check-equal? (hash-ref (car t) 'text) "what did we do")
       (check-equal? (hash-ref (car t) 'tools)
                     (list (hash 'id "call-1" 'title "read Roadmap.rkt" 'status "completed")))
       ;; a replay does not say how a turn ended, and none is invented
       (check-equal? (hash-ref (car t) 'stopReason) (json-null))
       (check-equal? (hash-ref (cadr t) 'text) "and then")
       (check-equal? (hash-ref (cadr t) 'agent) "")
       (check-equal? (hash-ref (cadr t) 'status) "done"))))

  ;; Live, a user message is the agent echoing the prompt back — the panel drew
  ;; it when it was accepted, and drawing it twice is what dropping it prevents.
  (test-case "a user message outside a replay is dropped"
    (with-events
     (λ (ch frames)
       (feed! ch (acp-user-said "hello there"))
       (check-equal? (drain frames) '())
       (check-equal? (chat-transcript ch) '()))))

  ;; Two sources for one header (see web/chat): whichever moved last wins, and
  ;; the first live id agrees with the config option by construction.
  (test-case "the live model and the picked one are one header, debounced"
    (with-events
     (λ (ch frames)
       (feed! ch (acp-config-model "fake-model-1" (hash "fake-model-1" "fake-model-1"
                                                        "fake-model-3" "Fake Model Three")))
       (check-equal? (frame-types (drain frames)) '("model"))
       (check-equal? (chat-model ch) "fake-model-1")
       ;; the baseline says nothing: it is the same session saying the same
       ;; thing in another spelling
       (feed! ch (acp-live-model "fake-model-1"))
       (check-equal? (drain frames) '())
       ;; a switch the config option never hears about (a `/model` command),
       ;; labelled from the picker
       (feed! ch (acp-live-model "fake-model-3"))
       (define fs (drain frames))
       (check-equal? (frame-types fs) '("model"))
       (check-equal? (hash-ref (cdar fs) 'name) "Fake Model Three")
       ;; the same id again is not news
       (feed! ch (acp-live-model "fake-model-3"))
       (check-equal? (drain frames) '())
       ;; and one the picker does not offer is shown raw, never guessed at
       (feed! ch (acp-live-model "claude-fake-9[1m]"))
       (check-equal? (hash-ref (cdar (drain frames)) 'name) "claude-fake-9[1m]"))))

  (test-case "a command list and a title are pushed only when they moved"
    (with-events
     (λ (ch frames)
       (define cmds (list (hash 'name "fake-init" 'description "start something")))
       (feed! ch (acp-commands cmds))
       (check-equal? (frame-types (drain frames)) '("commands"))
       (feed! ch (acp-commands cmds))
       (check-equal? (drain frames) '())
       (check-equal? (chat-commands ch) cmds)
       ;; a session says which one it is; its name arrives a turn or so later,
       ;; and says so once
       (feed! ch (acp-session "s-1" #f))
       (define fs (drain frames))
       (check-equal? (frame-types fs) '("session"))
       (check-equal? (hash-ref (cdar fs) 'id) "s-1")
       (check-equal? (hash-ref (cdar fs) 'title) (json-null))
       (feed! ch (acp-session-titled "a name"))
       (check-equal? (hash-ref (cdar (drain frames)) 'title) "a name")
       (feed! ch (acp-session-titled "a name"))
       (check-equal? (drain frames) '())
       (check-equal? (chat-session-id ch) "s-1")
       (check-equal? (chat-session-title ch) "a name")
       ;; the conversation ending is silent: what replaces it is what a panel
       ;; is told about
       (feed! ch (acp-session-over))
       (check-equal? (drain frames) '())
       (check-false (chat-session-id ch))
       (check-false (chat-session-title ch)))))

  ;; An agent nobody stopped: the transcript keeps its history and says where
  ;; the break is, because the successor remembers none of it.
  (test-case "a dead agent leaves a marker, and a trouble is one error frame"
    (with-events
     (λ (ch frames)
       (feed! ch (acp-gone "the agent exited (code 1)"))
       (check-equal? (drain frames) '())
       (define t (chat-transcript ch))
       (check-equal? (map (λ (e) (hash-ref e 'type)) t) '("restart"))
       (check-true (string-contains? (hash-ref (car t) 'message) "new session")
                   (format "~a" (car t)))
       (feed! ch (acp-trouble "the agent did not start: nope"))
       (define fs (drain frames))
       (check-equal? (frame-types fs) '("error"))
       (check-equal? (hash-ref (cdar fs) 'message) "the agent did not start: nope")
       ;; a frame, not an entry: nothing was said in the conversation
       (check-equal? (length (chat-transcript ch)) 1))))

  ;; ---- wired into the server ------------------------------------------------

  ;; The acceptance test for the package: a browser sitting on /events sees the
  ;; agent talk, through the same hub the outline events use.
  (test-case "chat frames reach a real /events connection"
    (with-server
     (λ (port agent)
       (check-pred chat? agent)
       (define in (open-events port))
       (chat-prompt! agent "hello there")
       (define first-ev (next-event in))
       (check-not-false first-ev "no chat event within the timeout")
       (check-equal? (car first-ev) "chat")
       (define js (string->jsexpr (cdr first-ev)))
       (check-equal? (hash-ref js 'type) "user")
       (check-equal? (hash-ref js 'text) "hello there")
       ;; the rest of the turn arrives on the same stream
       (let loop ([n 0])
         (define ev (next-event in))
         (check-not-false ev "the turn did not finish on the stream")
         (define j (string->jsexpr (cdr ev)))
         (unless (or (equal? (hash-ref j 'type) "done") (> n 20))
           (loop (add1 n))))
       (close-input-port in))))

  ;; ---- the chat routes -----------------------------------------------------
  ;;
  ;; The panel POSTs and gets a STATUS; what it draws comes back over the
  ;; stream. So every one of these asserts the frames, not the reply body.

  (test-case "POST /chat is accepted, and the whole turn arrives on /events"
    (with-server
     (λ (port agent)
       (define in (open-events port))
       (define-values (code body) (POST port "/chat" '((text . "hello there"))))
       (check-equal? code 204 body)
       ;; 204 means 204: nothing to render, because the stream renders it
       (check-equal? body "" body)
       (define fs (events-through in "done"))
       ;; the boot frames are not in here: the server booted the agent when it
       ;; came up, which is before this connection existed
       (check-equal? (for/list ([f (in-list fs)]) (hash-ref f 'type))
                     '("user" "chunk" "chunk" "tool" "tool" "done"))
       (check-equal? (hash-ref (car fs) 'text) "hello there")
       (define done (last fs))
       (check-equal? (hash-ref done 'stopReason) "end_turn")
       ;; the done frame carries the finished text as Markdown, and it is the
       ;; markdown module's own output — not a second renderer
       (check-equal? (hash-ref done 'html) (note->html-string "hello world"))
       (close-input-port in))))

  (test-case "an empty message is a 400, and the agent never hears about it"
    (with-server
     (λ (port agent)
       (define-values (code body) (POST port "/chat" '((text . "   "))))
       (check-equal? code 400 body)
       (check-true (string-contains? body "message") body)
       (define-values (code2 body2) (POST port "/chat" '()))
       (check-equal? code2 400 body2)
       (check-equal? (chat-transcript agent) '()))))

  (test-case "a message during a turn is a 409; cancel ends the turn"
    (with-server
     (λ (port agent)
       (define in (open-events port))
       (define-values (code _b) (POST port "/chat" '((text . "SLOW one"))))
       (check-equal? code 204)
       ;; Under way, not merely accepted: the `user` frame goes out before the
       ;; subprocess even exists. The first chunk is the agent actually
       ;; talking, which is the state this 409 is about.
       (check-equal? (for/list ([f (in-list (events-through in "chunk"))])
                       (hash-ref f 'type))
                     '("user" "chunk"))
       (define-values (busy body) (POST port "/chat" '((text . "and another"))))
       (check-equal? busy 409 body)
       (check-true (string-contains? body "busy") body)
       (define-values (cancelled cbody) (POST port "/chat/cancel"))
       (check-equal? cancelled 204 cbody)
       (define done (last (events-through in "done")))
       (check-equal? (hash-ref done 'stopReason) "cancelled")
       (check-true (wait-idle agent))
       (close-input-port in))))

  (test-case "POST /chat/new pushes a reset, which is what clears the panels"
    (with-server
     (λ (port agent)
       (define in (open-events port))
       (define-values (_c _b) (POST port "/chat" '((text . "hello there"))))
       (events-through in "done")
       (check-true (wait-idle agent))
       (define-values (code body) (POST port "/chat/new"))
       (check-equal? code 204 body)
       ;; the new session says which one it is on the way past; the reset is
       ;; the frame the panels act on
       (define fs (for/list ([f (in-list (events-through in "reset"))])
                    (hash-ref f 'type)))
       (check-equal? (last fs) "reset" (format "~a" fs))
       (check-true (and (member "session" fs) #t) (format "~a" fs))
       (close-input-port in))))

  ;; ---- the picker's routes -------------------------------------------------
  ;;
  ;; What is stored is JSON (a thing to draw); moving to one of them is a
  ;; status and a stream, like every other chat verb.

  (test-case "GET /chat/sessions is the agent's list, with the current one marked"
    (with-stored-sessions
     (λ ()
       (with-server
        (λ (port agent)
          (define-values (code body) (GET port "/chat/sessions"))
          (check-equal? code 200 body)
          (define j (read-json (open-input-string body)))
          (define ss (hash-ref j 'sessions))
          (check-equal? (for/list ([s (in-list ss)]) (hash-ref s 'id))
                        '("fake-stored-new" "fake-stored-old"))
          ;; the server adopted the newest at boot, so that is the one you are in
          (check-equal? (for/list ([s (in-list ss)]) (hash-ref s 'current))
                        '(#t #f))
          (check-equal? (hash-ref (car ss) 'title) "the last conversation"))))))

  (test-case "POST /chat/load repopulates every tab: reset, the turns, the session"
    (with-stored-sessions
     (λ ()
       (with-server
        (λ (port agent)
          ;; booted into the newest; move to the other one
          (check-equal? (chat-session-id agent) "fake-stored-new")
          (define in (open-events port))
          (define-values (code body) (POST port "/chat/load" '((id . "fake-stored-old"))))
          (check-equal? code 204 body)
          (check-equal? body "" body)
          (define fs (events-through in "session"))
          (check-equal? (for/list ([f (in-list fs)]) (hash-ref f 'type))
                        '("reset" "user" "chunk" "chunk" "tool" "tool" "done" "session"))
          (check-equal? (hash-ref (car fs) 'type) "reset")
          (check-equal? (hash-ref (last fs) 'id) "fake-stored-old")
          (check-equal? (hash-ref (last fs) 'title) "an older conversation")
          ;; and the transcript is the one that was loaded, not both of them
          (check-equal? (length (chat-transcript agent)) 1)
          (close-input-port in))))))

  (test-case "POST /chat/load with no id is a 400, and one the agent refuses is a frame"
    (with-stored-sessions
     (λ ()
       (with-server
        (λ (port agent)
          (define-values (code body) (POST port "/chat/load" '()))
          (check-equal? code 400 body)
          (define in (open-events port))
          ;; accepted (there is nothing to know yet), and the failure is where
          ;; everything else about the conversation is: on the stream
          (define-values (c2 b2) (POST port "/chat/load" '((id . "nope"))))
          (check-equal? c2 204 b2)
          (define err (last (events-through in "error")))
          (check-true (string-contains? (hash-ref err 'message) "nope")
                      (format "~a" err))
          (close-input-port in))))))

  ;; A browser that reloads (or connects late) missed the frames. The page is
  ;; where the conversation comes back, and everything the agent or the user
  ;; wrote is TEXT in it — an xexpr is what escapes it.
  (test-case "the page replays the transcript, escaped"
    (with-server
     (λ (port agent)
       (define in (open-events port))
       (define-values (_c _b)
         (POST port "/chat" '((text . "run <script>alert(1)</script> please"))))
       (events-through in "done")
       (check-true (wait-idle agent))
       (close-input-port in)
       (define-values (code body) (GET port "/"))
       (check-equal? code 200)
       (check-true (string-contains? body "&lt;script&gt;alert(1)&lt;/script&gt;") body)
       (check-false (string-contains? body "<script>alert(1)") body)
       ;; the agent's finished text is Markdown; the tool line is one line
       (check-true (string-contains? body "<p>hello world</p>") body)
       (check-true (string-contains? body "data-tool-id=\"call-1\"") body)
       (check-true (string-contains? body "data-status=\"completed\"") body)
       ;; the header is replayed too: the model frame was ephemeral, the model
       ;; the bridge learned from it is not
       (check-true (string-contains? body "id=\"sf-chat-model\">fake-model-1<") body)
       ;; and so are the commands, so a reloaded panel completes without
       ;; waiting for the agent to say anything again
       (check-true (string-contains? body "fake-init") body)
       (check-true (string-contains? body "fake-review") body))))

  (test-case "the page carries the panel, its script, and ONE sse connection"
    (with-server
     (λ (port agent)
       (define-values (code body) (GET port "/"))
       (check-equal? code 200)
       (check-true (string-contains? body "id=\"sf-chat\"") body)
       (check-true (string-contains? body "src=\"/static/chat.js\"") body)
       (check-true (string-contains? body "action=\"/chat\"") body)
       (check-true (string-contains? body "data-post=\"/chat/new\"") body)
       (check-true (string-contains? body "data-post=\"/chat/cancel\"") body)
       ;; the server booted the agent when it came up, so the panel is drawn
       ;; knowing what it offers — no turn has been taken to learn it
       (check-true (string-contains? body "fake-init") body)
       ;; and the picker's button, with the routes it drives
       (check-true (string-contains? body "data-chat-sessions=\"/chat/sessions\"") body)
       (check-true (string-contains? body "data-chat-load=\"/chat/load\"") body)
       ;; the panel borrows the page's connection: it subscribes to the chat
       ;; event on the body's stream, and opens nothing of its own
       (check-true (string-contains? body "sse-swap=\"chat\"") body)
       (check-equal? (length (regexp-match* #rx"sse-connect=" body)) 1 body)
       ;; and the script it does that with is a file, not an inline blob
       (define-values (jcode js) (GET port "/static/chat.js"))
       (check-equal? jcode 200)
       (check-false (string-contains? js "new EventSource") js))))

  ;; ---- the CLI contract ----------------------------------------------------

  (test-case "serve with no SELFFLOWY_ACP_AGENT is a usage error naming it"
    (define-values (code err) (run-serve #f))
    (check-equal? code 1 err)
    (check-true (string-contains? err "SELFFLOWY_ACP_AGENT") err)
    (check-true (string-contains? err "not set") err))

  (test-case "serve with a SELFFLOWY_ACP_AGENT that is not there says which"
    (define-values (code err) (run-serve "/nonexistent/acp-agent"))
    (check-equal? code 1 err)
    (check-true (string-contains? err "SELFFLOWY_ACP_AGENT") err)
    (check-true (string-contains? err "/nonexistent/acp-agent") err))

  (test-case "serve with a SELFFLOWY_ACP_AGENT that is not executable says so"
    (define-values (code err) (run-serve (path->string example)))
    (check-equal? code 1 err)
    (check-true (string-contains? err "is not executable") err))

  ;; ---- serve DIR -----------------------------------------------------------
  ;;
  ;; The front door: a directory, globbed once at boot, top level only — and
  ;; the directory itself is where the agent works, which is what the stored
  ;; sessions hang off.

  (test-case "serve DIR serves the directory's top-level outlines"
    (define dir (make-temporary-file "sfdir~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang selfflowy\nBuy milk\n" (build-path dir "Tasks.rkt"))
       (display-to-file "#lang selfflowy\nShip it\n" (build-path dir "Roadmap.rkt"))
       ;; a fragment lives one level down, and is not a root
       (make-directory (build-path dir "Daily"))
       (display-to-file "#lang selfflowy\nNot a root\n"
                        (build-path dir "Daily" "2026-08.rkt"))
       (with-serve
        (list (path->string dir))
        (λ (port line)
          ;; the announcement names the directory the agent works in, and the
          ;; roots it globbed — sorted, and only the top level
          (check-true (string-contains? line (path->string dir)) line)
          (check-true (< (caar (regexp-match-positions #rx"Roadmap[.]rkt" line))
                         (caar (regexp-match-positions #rx"Tasks[.]rkt" line)))
                      line)
          (check-false (string-contains? line "Daily/2026-08.rkt") line)
          (define-values (code body) (GET port "/"))
          (check-equal? code 200 body)
          (check-true (string-contains? body "Buy milk") body)
          (check-true (string-contains? body "Ship it") body)
          (check-false (string-contains? body "Not a root") body))))
     (λ () (delete-directory/files dir))))

  (test-case "serve with no arguments serves the working directory"
    (define dir (make-temporary-file "sfcwd~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       (display-to-file "#lang selfflowy\nFrom the cwd\n" (build-path dir "Tasks.rkt"))
       (parameterize ([current-directory dir])
         (with-serve '()
                     (λ (port _line)
                       (define-values (code body) (GET port "/"))
                       (check-equal? code 200 body)
                       (check-true (string-contains? body "From the cwd") body)))))
     (λ () (delete-directory/files dir))))

  (test-case "a directory with no outlines in it is refused, and names itself"
    (define dir (make-temporary-file "sfempty~a" 'directory))
    (dynamic-wind
     void
     (λ ()
       ;; a fragment in a subdirectory is not a root, so this is still empty
       (make-directory (build-path dir "Daily"))
       (display-to-file "#lang selfflowy\nDeeper\n" (build-path dir "Daily" "2026-08.rkt"))
       (define-values (code err) (run-serve fake-agent (list (path->string dir))))
       (check-equal? code 3 err)
       (check-true (string-contains? err (path->string dir)) err)
       (check-true (string-contains? err "rkt") err))
     (λ () (delete-directory/files dir)))))
