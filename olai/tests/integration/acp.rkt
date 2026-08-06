#lang racket/base

;; The ACP client, against a scripted agent
;; (tests/integration/fake-acp-agent.rkt): real subprocess, real ndjson, no
;; LLM. What is being checked here is the PROTOCOL — what goes on the wire,
;; what comes back, and the events the client makes of it. What a browser then
;; sees is tests/integration/chat.rkt's business.
;;
;; Events are compared by name and payload, never by print form: they are
;; structs, and a test that matched their printing would be testing racket.

(require racket/async-channel
         racket/string
         olai/acp
         olai/ops)

(module+ test
  (require rackunit))

(module+ test
  (define fake-agent
    (path->string
     (collection-file-path "fake-acp-agent.rkt" "olai" "tests" "integration")))

  ;; A file that exists and is not an executable: the other way to get the
  ;; agent's path wrong.
  (define example
    (build-path (simplify-path (build-path (collection-file-path "info.rkt" "olai")
                                           'up 'up))
                "examples" "Example.rkt"))

  ;; -> (values client event-channel log-port). The subprocess is stopped on the
  ;; way out whether the body finished or not.
  (define (with-client proc)
    (define events (make-async-channel))
    (define log (open-output-string))
    (define cl (make-acp-client #:command fake-agent
                                #:cwd (find-system-path 'temp-dir)
                                #:on-event (λ (ev) (async-channel-put events ev))
                                #:log-port log))
    (dynamic-wind void (λ () (proc cl events log)) (λ () (acp-stop! cl))))

  ;; What an event IS, in one word, so a sequence can be asserted as one value.
  (define (event-name ev)
    (cond
      [(acp-said? ev) 'said]
      [(acp-user-said? ev) 'user-said]
      [(acp-tool? ev) 'tool]
      [(acp-tool-moved? ev) 'tool-moved]
      [(acp-config-model? ev) 'config-model]
      [(acp-live-model? ev) 'live-model]
      [(acp-commands? ev) 'commands]
      [(acp-session? ev) 'session]
      [(acp-session-titled? ev) 'session-titled]
      [(acp-session-over? ev) 'session-over]
      [(acp-replay-started? ev) 'replay-started]
      [(acp-replay-ended? ev) 'replay-ended]
      [(acp-gone? ev) 'gone]
      [(acp-trouble? ev) 'trouble]
      [else 'unknown]))

  (define (next-event events [timeout 30])
    (sync/timeout timeout events))

  ;; Every event up to and including the first one named `name` — the whole boot
  ;; (or turn) as one value, so a test can assert the SEQUENCE rather than poll
  ;; for parts.
  (define (events-through events name [timeout 30])
    (let loop ([acc '()] [n 0])
      (cond
        [(> n 20) (reverse acc)]
        [else
         (define ev (next-event events timeout))
         (cond
           [(not ev) (reverse acc)]
           [(eq? (event-name ev) name) (reverse (cons ev acc))]
           [else (loop (cons ev acc) (add1 n))])])))

  (define (event-names evs) (map event-name evs))

  (define (event-of evs name)
    (for/or ([ev (in-list evs)]) (and (eq? (event-name ev) name) ev)))

  ;; The fake agent keeps stored sessions only when it is told to, and `mode`
  ;; says whose (see its header): the environment is what the subprocess
  ;; inherits, so this is set around the whole of a test, agent and all.
  (define (with-stored-sessions thunk [mode #"1"])
    (define env (current-environment-variables))
    (dynamic-wind
     (λ () (environment-variables-set! env #"OLAI_FAKE_ACP_STORED" mode))
     thunk
     (λ () (environment-variables-set! env #"OLAI_FAKE_ACP_STORED" #f))))

  ;; What a boot says, once there is a session: which conversation, what it runs,
  ;; what it offers, and the name the agent wrote for it.
  (define boot-events '(session-over session config-model commands session-titled)))

(module+ test
  ;; ---- coming up -----------------------------------------------------------

  (test-case "a boot with nothing stored makes a session and reads it out"
    (with-client
     (λ (cl events _log)
       (acp-boot! cl)
       (define evs (events-through events 'session-titled))
       (check-equal? (event-names evs) boot-events)
       (define s (event-of evs 'session))
       (check-equal? (acp-session-id s) "fake-session-1")
       ;; nobody has named it yet; the name is its own event, later
       (check-false (acp-session-title s))
       (check-equal? (acp-session-titled-title (event-of evs 'session-titled))
                     "a fake conversation")
       ;; the model comes off the session's own config options, labelled the
       ;; way its picker labels it
       (define m (event-of evs 'config-model))
       (check-equal? (acp-config-model-name m) "fake-model-1")
       (check-equal? (hash-ref (acp-config-model-labels m) "fake-model-3" #f)
                     "Fake Model Three")
       ;; name and description, and nothing else: the argument hint the adapter
       ;; sends is not something anybody draws
       (check-equal? (acp-commands-commands (event-of evs 'commands))
                     (list (hash 'name "fake-init" 'description "start something")
                           (hash 'name "fake-review" 'description "look it over"))))))

  ;; An agent that keeps its conversations has a LAST one, and a client whose
  ;; agent works in a stable directory can come back up in it: list, adopt the
  ;; most recently updated one, load it. The load REPLAYS — every message
  ;; arrives as an ordinary notification before the answer does — and the
  ;; brackets are the only thing that says that is history, not news.
  (test-case "a boot with sessions stored adopts the newest and replays it"
    (with-stored-sessions
     (λ ()
       (with-client
        (λ (cl events _log)
          (acp-boot! cl)
          (define evs (events-through events 'session-titled))
          (check-equal? (event-names evs)
                        '(session-over replay-started
                          user-said said said tool tool-moved
                          replay-ended session config-model commands session-titled))
          (check-equal? (acp-user-said-text (event-of evs 'user-said)) "what did we do")
          ;; The newer of this client's two, and it comes with the name it was
          ;; listed under. Not the first one listed, and not the newest thing
          ;; the agent knows about: session/list is scoped by PREFIX, so the
          ;; fake answers with a session from a directory UNDERNEATH this one
          ;; (another checkout's agent) that is newer than either. Adopting
          ;; that is the bug. `fake-stored-new` also spells its cwd with a
          ;; trailing slash — the same directory, said differently.
          (define s (event-of evs 'session))
          (check-equal? (acp-session-id s) "fake-stored-new")
          (check-equal? (acp-session-title s) "the last conversation"))))))

  ;; The picker draws this list, so the foreign session must not be in it
  ;; either: these are the ids, whole, and there are two of them.
  (test-case "the stored sessions are listed, newest first, with the current one marked"
    (with-stored-sessions
     (λ ()
       (with-client
        (λ (cl events _log)
          (acp-boot! cl)
          (events-through events 'session)
          (define ss (acp-sessions cl))
          (check-equal? (for/list ([s (in-list ss)]) (hash-ref s 'id))
                        '("fake-stored-new" "fake-stored-old"))
          (check-equal? (for/list ([s (in-list ss)]) (hash-ref s 'current))
                        '(#t #f))
          (check-equal? (hash-ref (car ss) 'title) "the last conversation")
          (check-true (string? (hash-ref (car ss) 'updatedAt))))))))

  ;; With NOTHING but somebody else's stored, there is nothing to adopt: a
  ;; fresh session, exactly as on a machine that has none at all.
  (test-case "a boot that finds only other directories' sessions starts a new one"
    (with-stored-sessions
     (λ ()
       (with-client
        (λ (cl events log)
          (acp-boot! cl)
          (define evs (events-through events 'session-titled))
          (check-equal? (event-names evs) boot-events)
          (check-equal? (acp-session-id (event-of evs 'session)) "fake-session-1")
          (check-equal? (acp-sessions cl) '())
          ;; and the log says which of the two this was: a list emptied by the
          ;; filter looks exactly like a machine with nothing stored
          (check-true (string-contains? (get-output-string log) "none of them in")
                      (get-output-string log)))))
     #"foreign"))

  ;; An agent that is not running is not a list that is empty.
  (test-case "asking a dead agent for its sessions is a validation failure"
    (with-client
     (λ (cl _events _log)
       (define e (with-handlers ([exn:fail:op? values]) (acp-sessions cl) #f))
       (check-pred exn:fail:op? e)
       (check-equal? (exn:fail:op-kind e) 'validation))))

  ;; ---- a turn --------------------------------------------------------------

  (test-case "a turn is what the agent said, and its stop reason comes back"
    (with-client
     (λ (cl events _log)
       (check-equal? (acp-prompt! cl "hello there") "end_turn")
       ;; the boot happened inside the prompt (nothing booted it first), so the
       ;; session announcing itself is in here too
       (define evs (events-through events 'tool-moved))
       (check-equal? (event-names evs)
                     (append boot-events '(live-model said said tool tool-moved)))
       (check-equal? (map acp-said-text
                          (for/list ([ev (in-list evs)] #:when (acp-said? ev)) ev))
                     '("hello " "world"))
       (define t (event-of evs 'tool))
       (check-equal? (acp-tool-id t) "call-1")
       (check-equal? (acp-tool-title t) "read Tasks.rkt")
       (check-equal? (acp-tool-status t) "pending")
       ;; an update carries only what moved
       (define u (event-of evs 'tool-moved))
       (check-false (acp-tool-moved-title u))
       (check-equal? (acp-tool-moved-status u) "completed")
       ;; the model a turn RAN on, which is not the same fact as the one the
       ;; session was configured with
       (check-equal? (acp-live-model-id (event-of evs 'live-model)) "fake-model-1"))))

  ;; An unanswered session/request_permission hangs the turn forever. It is
  ;; answered here, without asking anybody, because a hung wire is a protocol
  ;; problem and not a question a panel could have shown.
  (test-case "a permission request is answered, and the turn completes"
    (with-client
     (λ (cl _events _log)
       (check-equal? (acp-prompt! cl "read a file PERMISSION please") "end_turn"))))

  ;; A cancel means nothing until a prompt is on the wire: it names a turn the
  ;; agent has never heard of. `on-send` is that moment, and the only one.
  (test-case "a cancel sent the moment the prompt lands ends the turn"
    (with-client
     (λ (cl _events _log)
       ;; nothing is running: there is no turn to name, and no failure either
       (acp-cancel! cl)
       (check-equal? (acp-prompt! cl "SLOW down" #:on-send (λ () (acp-cancel! cl)))
                     "cancelled"))))

  ;; ---- the agent dies ------------------------------------------------------

  (test-case "a crash fails the question in flight and says the agent is gone"
    (with-client
     (λ (cl events _log)
       (define e (with-handlers ([exn:fail? values]) (acp-prompt! cl "CRASH now") #f))
       (check-pred exn:fail? e)
       (check-true (string-contains? (exn-message e) "exited") (exn-message e))
       ;; and it is said as an event too, because nobody else was waiting: the
       ;; session is over, and the death is news
       (define evs (events-through events 'gone))
       (check-equal? (event-names evs)
                     (append boot-events '(live-model said session-over gone)))
       (check-true (string-contains? (acp-gone-why (event-of evs 'gone)) "exited")
                   (acp-gone-why (event-of evs 'gone)))
       ;; no respawn loop: nothing started a process nobody asked for, and the
       ;; next prompt is what brings one back
       (check-equal? (acp-prompt! cl "are you back") "end_turn"))))

  ;; A stop is not a death: nothing is announced, because the caller asked.
  (test-case "a stopped agent says so, and says nothing about being gone"
    (with-client
     (λ (cl events _log)
       (check-false (acp-stopped? cl))
       (acp-prompt! cl "hello there")
       (events-through events 'tool-moved)
       (acp-stop! cl)
       (check-true (acp-stopped? cl))
       (let loop ([n 0])
         (define ev (next-event events 2))
         (check-false (and ev (eq? (event-name ev) 'gone)) "a stop was announced as a death")
         (when (and ev (< n 10)) (loop (add1 n)))))))

  ;; ---- the log sink --------------------------------------------------------

  ;; The adapter logs to stderr, and a pipe nobody drains eventually blocks the
  ;; process writing into it. Draining it must also never be confused with the
  ;; protocol, which is stdout only.
  (test-case "the agent's stderr lands in the log and not in the events"
    (with-client
     (λ (cl events log)
       (acp-prompt! cl "hello there")
       (define noise
         (let loop ([n 0])
           (define s (get-output-string log))
           (cond
             [(string-contains? s "fake-acp-agent") s]
             [(> n 100) s]
             [else (sleep 0.05) (loop (add1 n))])))
       (check-true (string-contains? noise "acp: fake-acp-agent: turn for") noise)
       (check-equal? (for/list ([ev (in-list (events-through events 'tool-moved))]
                                #:when (acp-said? ev))
                       (acp-said-text ev))
                     '("hello " "world")))))

  ;; A repeating condition is worth one line: a caller with something to say
  ;; says it through the client, so the log has one owner and one prefix.
  (test-case "the log says a repeating thing once"
    (with-client
     (λ (cl _events log)
       (acp-log! cl "plain")
       (acp-log-once! cl "k" "only once")
       (acp-log-once! cl "k" "only once")
       (check-equal? (length (regexp-match* #rx"only once" (get-output-string log))) 1)
       (check-true (string-contains? (get-output-string log) "acp: plain")))))

  ;; ---- the seam ------------------------------------------------------------

  ;; An event is never delivered with the client's own lock held: a handler
  ;; that reads the client back would otherwise be half of a deadlock, and the
  ;; conversation on the other side of this seam does exactly that on every
  ;; prompt. A boot that finishes is the whole assertion.
  (test-case "an event handler can call back into the client"
    (define cell (box #f))
    (define asked (box 0))
    (define events (make-async-channel))
    (define cl (make-acp-client
                #:command fake-agent
                #:cwd (find-system-path 'temp-dir)
                #:on-event (λ (ev)
                             (acp-stopped? (unbox cell))
                             (set-box! asked (add1 (unbox asked)))
                             (async-channel-put events ev))
                #:log-port (open-output-string)))
    (set-box! cell cl)
    (dynamic-wind
     void
     (λ ()
       (acp-boot! cl)
       (check-equal? (event-names (events-through events 'session-titled)) boot-events)
       (check-true (> (unbox asked) 0)))
     (λ () (acp-stop! cl))))

  ;; ---- a command that is not an agent --------------------------------------

  (test-case "the client refuses a command it cannot run"
    (check-equal? (acp-command-problem fake-agent) #f)
    (check-equal? (acp-command-problem "/nonexistent/acp-agent") "does not exist")
    (check-equal? (acp-command-problem (path->string example)) "is not executable")
    (check-exn exn:fail?
               (λ () (make-acp-client #:command "/nonexistent/acp-agent"
                                      #:cwd (find-system-path 'temp-dir)
                                      #:on-event void)))))
