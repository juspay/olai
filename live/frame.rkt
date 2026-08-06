#lang racket/base

;; SSE framing: the wire vocabulary, and nothing that knows who is listening.
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

(require racket/contract
         racket/list
         racket/string)

(provide (contract-out
          [struct frame ([name string?] [data string?] [id (or/c string? #f)])]
          ;; the constructor a consumer uses: id is the exception, not the rule
          [make-frame (->* (string? string?) (#:id (or/c string? #f)) frame?)]
          [frame->string (-> frame? string?)]
          [frames->string (-> (listof frame?) string?)]
          ;; a comment line: bytes on the wire that are not an event
          [sse-comment (-> string? string?)]
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
          [live-cursor-param string?]))

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

;; Syntactically an event with no fields, so a client ignores it — but it is
;; bytes on the wire, which is the whole point.
(define (sse-comment text)
  (string-append ":" (string-replace text "\n" " ") "\n\n"))

;; The client's reconnect delay, in milliseconds, set by the server. A stream
;; that says nothing gets the browser's default (three seconds in most), which
;; is a long time to look stale for.
(define (sse-retry ms)
  (string-append "retry: " (number->string ms) "\n\n"))

;; Named for the header it stands in for: it is the same question ("what did
;; you last see"), asked of a connection that has not seen anything yet.
(define live-cursor-param "last-event-id")
