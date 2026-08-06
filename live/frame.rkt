#lang racket/base

;; SSE framing: the wire vocabulary, and nothing that knows who is listening.
;;
;; Everything both ENDS have to agree on is here — the framing, the cursor's
;; query parameter, the beat's cadence, and the identity of the process itself
;; (`live-boot-id` and the stream address it rides in). live/hub reads those;
;; live/client writes them; neither requires the other, and this is why.
;;
;; A frame is (name, data, id). The name is what a client subscribes to, the
;; data is a string this module never reads, and the id is the STREAM CURSOR —
;; the last id a client saw is what its browser sends back as `Last-Event-ID`
;; when the connection comes back, and what a host app compares against to
;; decide what that client missed.
;;
;; The id is deliberately a string with no shape: a revision counter, a log
;; offset, a ULID — WHAT it means belongs to the consumer, and a transport that
;; parsed it would have opinions it has no business having. Frames with no id
;; leave the cursor where it was, which is the correct behaviour for a frame
;; that is not a checkpoint (a chat message, a notification): a client that
;; reconnects should be told about the last state it can be BEHIND, not the
;; last thing that happened.

(require racket/contract)

(provide (contract-out
          [struct frame ([name string?] [data string?] [id (or/c string? #f)])]
          ;; the constructor a consumer uses: id is the exception, not the rule
          [make-frame (->* (string? string?) (#:id (or/c string? #f)) frame?)]
          [frame->string (-> frame? string?)]
          [frames->string (-> (listof frame?) string?)]
          ;; how long a client should wait before reconnecting, as a frame's
          ;; worth of wire — a field, not an event
          [sse-retry (-> exact-positive-integer? string?)]
          [valid-field-value? (-> string? boolean?)]
          ;; The other place a client can report its cursor. The header below
          ;; is the browser's and only exists on a RECONNECT; a page's first
          ;; connection has to say where it came in some other way, and a query
          ;; parameter is the only channel a page has to its own EventSource.
          ;; Spelled here, with the rest of the wire's vocabulary, so the end
          ;; that writes it (live/client) and the end that reads it (live/hub)
          ;; share a binding and not a coincidence.
          [live-cursor-param string?]
          ;; how often the stream beats when nobody says otherwise. Both ends
          ;; hold this number — the server sends it, the browser sizes its
          ;; watchdog by it — so it is one binding here rather than two
          ;; literals that agree today
          [live-default-heartbeat-seconds (>/c 0)]
          ;; WHICH SERVER this is, and where its stream lives. See below.
          [live-boot-id string?]
          [live-stream-path string?]
          [live-boot-current? (-> string? boolean?)]
          [live-reload-event string?]))

;; ---- what a field may hold --------------------------------------------------

;; Field values are terminated by a newline and separated from the field name
;; by a colon: a name or an id containing either would frame a DIFFERENT event
;; than the one the caller meant. Data is exempt — it is split across as many
;; `data:` lines as it has lines, which is what makes multi-line payloads work.
(define (valid-field-value? s)
  (not (regexp-match? #px"[\r\n]" s)))

;; ---- frames -----------------------------------------------------------------

(struct frame (name data id) #:transparent
  #:guard (λ (name data id _who)
            (unless (valid-field-value? name)
              (raise-argument-error 'frame "a name without a line break" name))
            (when (and id (not (valid-field-value? id)))
              (raise-argument-error 'frame "an id without a line break" id))
            (values name data id)))

(define (make-frame name data #:id [id #f]) (frame name data id))

;; One event, WHATWG framing: a blank line ends it, and EVERY line of the
;; payload needs its own `data:`. The naive "data: ~a\n\n" is wrong the first
;; time a payload contains a newline — the tail becomes a second, nameless
;; event — so the split is not optional.
;;
;; `id:` comes first, before the event it checkpoints: a client applies the
;; fields of a block in order and the block is dispatched at the blank line, so
;; within one frame the order is cosmetic — but a human reading `curl` output
;; wants the cursor above the thing it is a cursor for.
(define (frame->string f)
  (apply string-append
         (append (if (frame-id f) (list "id: " (frame-id f) "\n") '())
                 (list "event: " (frame-name f) "\n")
                 (for/list ([line (in-list (regexp-split #px"\r\n|\r|\n" (frame-data f)))])
                   (string-append "data: " line "\n"))
                 (list "\n"))))

;; Several frames as one write. A flush apiece would be a chunk apiece on the
;; wire, and everything owed to a connection is in hand at once.
(define (frames->string fs)
  (apply string-append (map frame->string fs)))

;; ---- the fields that are not events -----------------------------------------

;; The client's reconnect delay, in milliseconds, set by the server. A stream
;; that says nothing gets the browser's default (three seconds in most), which
;; is a long time to look stale for.
(define (sse-retry ms)
  (string-append "retry: " (number->string ms) "\n\n"))

;; Named for the header it stands in for: it is the same question ("what did
;; you last see"), asked of a connection that has not seen anything yet.
(define live-cursor-param "last-event-id")

;; The beat says how often to expect the next one, so this number is the
;; stream's rather than the watchdog's. It lives here because BOTH ends read
;; it: live/hub writes it into every beat, and static/live.js starts its
;; watchdog on it before the first beat lands.
(define live-default-heartbeat-seconds 15)

;; ---- which server this is ---------------------------------------------------

;; Catch-up rests on one property of an id: two different states must never be
;; called the same thing. A host whose state is a COUNTER breaks that without
;; noticing, because a counter restarts with the process — so `3` names one
;; thing before a restart and another after it, and every client that
;; reconnects across one is told it is up to date when it is not.
;;
;; That hazard is the framework's to fix, not each host's to remember: a
;; process can identify itself, and this is that string. Combine it with
;; whatever counts (`(string-append live-boot-id "." n)`) and the property
;; holds. A host whose state is already globally unique — a commit hash, a
;; ULID, a log offset — has no use for it.
;;
;; Reading a clock is not interpreting an id: this hands one out, and still
;; never looks at one.
(define live-boot-id
  (number->string (inexact->exact (round (current-inexact-milliseconds)))))

;; And the same string again, in the one place a browser cannot help but send
;; it back: the address it connects to.
;;
;; The cursor heals a client that is BEHIND. It cannot heal a client that is
;; from another BUILD — a deploy that renames an event leaves yesterday's tab
;; holding an EventSource that is open, beating, healthy-looking and subscribed
;; to a name nothing sends any more. Nothing about that state is visible from
;; either end, because both ends are behaving.
;;
;; So the server's identity rides the URL. A tab that connects to a boot id
;; this process does not answer to is, by construction, a tab drawn by another
;; process, whatever it thinks it knows — and the answer to it is one frame
;; saying reload (live/hub's `live-reload-response`), never an HTTP error:
;; `EventSource` hides status codes from the page and retries forever, so a 404
;; is a stale tab hammering a server that has no way to tell it so.
;;
;; The cost is honest and accepted: a restart of the SAME code is a new boot id
;; too, so every open tab reloads. Keying on a hash of the build instead would
;; spare those — and would put a build system in the middle of a transport.
(define live-stream-path (string-append "/live/" live-boot-id "/events"))

(define (live-boot-current? boot) (equal? boot live-boot-id))

;; Namespaced away from a host's event names, like the heartbeat: the transport
;; must not be able to collide with an app's vocabulary. The payload is the
;; boot id this server DOES answer to, so a human reading the stream by hand
;; can see which two processes disagreed.
(define live-reload-event "live:reload")
