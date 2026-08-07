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
;; a reader. Nothing else spells it — the whole `chat-` surface, so a name this
;; module has not got yet is covered before anybody writes it.
;;
;; Getting to say `chat-*` cost two renames: the skin's layout token was
;; `chat-w` and the panel's viewport list was `chat-viewport-tokens`, and
;; neither is a conversation — one is a width and one is a browser's reading of
;; the screen. Enumerating the conversation's verbs instead would have left
;; every export added after today outside its own concept, which is the same
;; rot in a different place.
(override "chat.rkt"
          (owns clock threads)
          (concept chat-conversation "chat-*" "make-chat"))
