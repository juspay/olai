#lang arch

;; Drawing. Every feature lands here, and the two busiest files in the repo are
;; in this directory — so volatile is not an insult, it is the measurement.
;;
;; Volatile may depend on anything: that is what makes this the place the store,
;; the watcher and the SSE hub are allowed to meet. Nothing declared stable or
;; settling may depend on anything here, which is "core must build without
;; web/" with a check under it.
(clock volatile)

;; Drawing is pure. The three exceptions declare themselves.
(owns)

;; When the outline changed, and when the day rolls over. Its own thread, its
;; own filesystem watch, and a clock read for midnight — it knows WHEN and
;; nothing about what or how.
(override "watch.rkt"
          (owns clock filesystem-events threads)
          (concept outline-watching "start-watcher" "seconds-until-midnight"))

;; The one place a socket is bound and a request is answered. It reads today's
;; date, serves static files off the disk, and mounts everything else.
(override "serve.rkt" (owns clock filesystem network))

;; A conversation, one turn at a time: what the agent's typed events become for
;; a reader. Nothing else spells it, and the patterns are what "it" is — the
;; verbs that move a turn, the questions you ask a conversation, the session it
;; is in, the transcript it leaves. `chat-w` is a layout token in theme.rkt and
;; not a conversation, which is why the patterns are these and not `chat-*`.
(override "chat.rkt"
          (owns clock threads)
          (concept chat-conversation
                   "chat-*!" "chat-*?" "chat?" "chat-session*" "chat-transcript" "make-chat"))
