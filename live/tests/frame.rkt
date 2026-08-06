#lang racket/base

;; The wire format, in isolation. Every case here is a sentence from the SSE
;; spec that a naive implementation gets wrong.

(require rackunit
         live/frame)

(module+ test
  (test-case "one event is name, payload, blank line"
    (check-equal? (frame->string (make-frame "outline" "7"))
                  "event: outline\ndata: 7\n\n")
    (check-equal? (frame->string (make-frame "chat" ""))
                  "event: chat\ndata: \n\n"))

  (test-case "every line of a multi-line payload gets its own data:"
    ;; the naive one-liner splices the tail into a second, nameless event
    (check-equal? (frame->string (make-frame "chat" "one\ntwo\nthree"))
                  "event: chat\ndata: one\ndata: two\ndata: three\n\n")
    ;; CRLF and a bare CR are line breaks too, and none of them survive
    (check-equal? (frame->string (make-frame "chat" "one\r\ntwo\rthree"))
                  "event: chat\ndata: one\ndata: two\ndata: three\n\n"))

  (test-case "an id is the stream cursor, and it comes before the event"
    (check-equal? (frame->string (make-frame "outline" "7" #:id "7"))
                  "id: 7\nevent: outline\ndata: 7\n\n")
    ;; and it is optional: a frame that is not a checkpoint sends no id, which
    ;; is what leaves the client's cursor where it was
    (check-false (frame-id (make-frame "chat" "hi"))))

  ;; A name or an id with a line break in it would frame a DIFFERENT event than
  ;; the caller meant — silently, and only for that payload. Refuse it where it
  ;; is constructed rather than where it is read.
  (test-case "a name or an id may not contain a line break"
    (check-exn exn:fail:contract? (λ () (make-frame "out\nline" "7")))
    (check-exn exn:fail:contract? (λ () (make-frame "outline" "7" #:id "7\n8")))
    (check-false (valid-field-value? "a\rb"))
    (check-true (valid-field-value? "a:b")))

  (test-case "several frames are one string, in order"
    (check-equal? (frames->string (list (make-frame "a" "1") (make-frame "b" "2")))
                  "event: a\ndata: 1\n\nevent: b\ndata: 2\n\n")
    (check-equal? (frames->string '()) ""))

  (test-case "a comment is bytes on the wire and not an event"
    (check-equal? (sse-comment "hb") ":hb\n\n")
    ;; a comment with a newline in it would end the comment and start data
    (check-equal? (sse-comment "one\ntwo") ":one two\n\n"))

  (test-case "retry is a field of its own"
    (check-equal? (sse-retry 1000) "retry: 1000\n\n")))
