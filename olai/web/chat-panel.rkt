#lang racket/base

;; The agent panel, drawn: the dock, the conversation, the input row, and
;; every rule that paints them.
;;
;; PRESENTATION ONLY. What a turn IS, what a frame means, when the agent is
;; busy — that is web/chat.rkt over olai/acp, and this module has never heard
;; of it. It is handed a transcript (plain JSON hashes) and a handful of URLs,
;; and it gives back an xexpr. The route layer is what puts the two together.
;;
;; The panel is replayed from that transcript on every page load (frames are
;; ephemeral: a browser that connects late, or reloads, missed them). From
;; there static/chat.js keeps it live off the page's ONE SSE connection, and
;; several classes below exist only for that script to build — style with no
;; markup on this side, which is exactly why they are still defined here.
;;
;; The URLs are the route layer's, and so is the SSE event name — a renderer
;; that spelled "chat" here would be a second owner of the wire format.
;;
;; What is Markdown and what is not: a FINISHED turn's agent text gets the
;; same treatment a note gets. A running or failed turn's text is a fragment,
;; so it stays verbatim (chat.js accumulates chunks as text and swaps in the
;; server's HTML when the `done` frame lands). User text and tool titles are
;; never Markdown — they are strings in an xexpr, which is what escapes them.
;;
;; Requiring render.rkt is not only for the two names below: the panel is an
;; overlay on the outline, so its rules have to land after the outline's, and
;; a require is how this skin spells "after" (see style.rkt on ordering).

(require racket/contract
         (only-in json jsexpr->string)
         olai/web/style
         ;; the page's own class — the panel is positioned against the document
         (only-in olai/web/theme sf-body)
         ;; the pane the panel makes room in, and the note renderer a finished
         ;; turn is run through
         (only-in olai/web/render sf-main note->xexprs))

(provide (contract-out
          [render-chat-panel
           (->* ((listof hash?)
                 #:send-href string? #:new-href string? #:cancel-href string?
                 #:sessions-href string? #:load-href string?
                 #:event string?)
                (#:model (or/c string? #f)
                 #:session-title (or/c string? #f)
                 #:commands (listof hash?))
                list?)]))

;; ---- states ---------------------------------------------------------------
;;
;; The panel's states. chat.js toggles all of them; the server sets is-busy
;; and has-commands on the first draw so a reloaded page comes up in the state
;; the conversation is actually in.

(define-modifier is-open is-busy has-commands is-picked
                 is-user is-agent is-error)

;; ---- the dock -------------------------------------------------------------

;; The outline stays the star. The panel is fixed to the right edge, closed
;; until asked for, and the main pane makes room rather than being covered.
;; The dock itself is not a box: its two children place themselves.
(define-style sf-chat-dock #:display contents)

(define-style sf-chat-open
  #:position fixed
  #:right 1rem
  #:bottom 1rem
  #:z-index 20
  #:padding (0.3125rem 0.75rem)
  #:border (1px solid (apply var --line))
  #:border-radius 9999px
  #:background (apply var --paper-2)
  #:color (apply var --dim)
  #:font-family (apply var --mono)
  #:font-size 0.75rem
  #:cursor pointer
  [(: & hover) #:color (apply var --ink) #:border-color (apply var --dim)]
  ;; an open panel is on top of where the toggle sits — it would land on the
  ;; send button. It steps aside, and the header's × takes over.
  [(,(sel sf-chat-dock is-open) &) #:display none]
  ;; a turn is running behind a closed panel: the toggle breathes so working is
  ;; visible without opening it. The ring is the accent color at low alpha,
  ;; expanding and fading — no bounce, no color change on the button itself.
  [(,(sel sf-chat-dock is-busy) &)
   #:border-color (apply var --green)
   #:animation (sf-chat-glow 1.8s ease-in-out infinite)
   ;; the border still marks busy; only the motion drops out
   [@ media (#:prefers-reduced-motion reduce) #:animation none]])

(register-fragment!
 (css-expr
  [@ keyframes sf-chat-glow
     [0% 100% #:box-shadow (0 0 0 0 (apply color-mix (in srgb)
                                           ((apply var --green) 45%) transparent))]
     [50% #:box-shadow (0 0 0 6px (apply color-mix (in srgb)
                                         ((apply var --green) 0%) transparent))]]))

;; ---- the panel ------------------------------------------------------------

(define-style sf-chat
  #:position fixed
  #:top 0
  #:right 0
  #:bottom 0
  #:z-index 19
  #:width (apply var --chat-w)
  #:display none
  #:flex-direction column
  #:border-left (1px solid (apply var --line))
  ;; its own surface, one step up the paper ramp (paper -> paper-2 -> panel):
  ;; the panel is a layer over the outline, not more of the same sheet
  #:background (apply var --panel)
  [,(sel '& is-open) #:display flex]
  ;; a phone has no room beside the outline: the panel is a sheet over it
  [@ media (#:max-width 48rem) #:width 100% #:left 0 #:border-left 0])

;; The panel is not an overlay: the reading column gives up the width it takes.
;; Its subject is the OUTLINE's pane, so it is written out rather than nested.
(register-fragment!
 (css-expr
  [((: ,(sel 'body sf-body) (apply has ,(sel sf-chat is-open))) ,(sel sf-main))
   #:padding-right (apply calc (+ (apply var --chat-w) 1.5rem))
   ;; on a phone the sheet covers it anyway, so there is nothing to make room for
   [@ media (#:max-width 48rem) #:padding-right 1rem]]))

(define-style sf-chat-head
  #:display flex
  #:align-items center
  #:justify-content space-between
  #:gap 0.5rem
  #:padding (0.625rem 0.75rem)
  #:border-bottom (1px solid (apply var --line))
  ;; the chrome rows sit a shade back from the conversation, so the panel's
  ;; structure reads without a second border
  #:background (apply color-mix (in srgb) ((apply var --panel) 85%) (apply var --paper))
  ;; the header is what the sessions popover hangs off
  #:position relative)

(define-style sf-chat-title
  #:min-width 0
  #:font-family (apply var --mono)
  #:font-size 0.75rem
  #:letter-spacing 0.04em
  #:color (apply var --dim))

;; the model, when the agent named one. Empty means unknown, and unknown says
;; nothing at all — separator included.
(define-style sf-chat-model
  #:opacity 0.8
  [(:: (: & (apply not (: empty))) before) #:content " · "])

;; which conversation, when the agent has named one. Quieter than the model —
;; it is context, not state — and one line down, where a long title has room
;; to be cut off instead of pushing the buttons around.
(define-style sf-chat-session
  #:display block
  #:max-width 100%
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap
  #:opacity 0.65
  #:font-size 0.6875rem
  #:letter-spacing 0)

;; a turn running behind an OPEN panel: the toggle that breathes is hidden
;; under it, so the header says it instead — one dot, the same accent and the
;; same rhythm as the toggle's ring
(define-style sf-chat-working
  #:display none
  #:width 0.4375rem
  #:height 0.4375rem
  #:margin-left 0.5rem
  #:border-radius 50%
  #:background (apply var --green)
  #:vertical-align middle
  [(,(sel sf-chat is-busy) &)
   #:display inline-block
   #:animation (sf-chat-glow 1.8s ease-in-out infinite)
   ;; likewise the dot: it stays, it just stops breathing
   [@ media (#:prefers-reduced-motion reduce) #:animation none]])

(define-style sf-chat-actions #:display flex #:align-items center #:gap 0.375rem)

;; One control with three jobs — the shared block is a single rule with three
;; subjects, and the stop's alarm color has to land after it.
(define-modifier sf-chat-btn sf-chat-send sf-chat-stop)

(register-fragment!
 (css-expr
  [,(sel sf-chat-btn) ,(sel sf-chat-send) ,(sel sf-chat-stop)
   #:padding (0.1875rem 0.5rem)
   #:border (1px solid (apply var --line))
   #:border-radius (apply var --radius)
   #:background (apply var --paper-2)
   #:color (apply var --dim)
   #:font-family (apply var --mono)
   #:font-size 0.6875rem
   #:cursor pointer]
  [(: ,(sel sf-chat-btn) hover) (: ,(sel sf-chat-send) hover) #:color (apply var --ink)]
  [,(sel sf-chat-stop) #:color (apply var --rose-fg) #:border-color (apply var --rose-fg)]))

;; ---- the conversation -----------------------------------------------------

(define-style sf-chat-body
  #:flex (1 1 auto)
  #:overflow-y auto
  #:overscroll-behavior contain
  #:padding 0.75rem
  #:display flex
  #:flex-direction column
  #:gap 0.625rem
  #:font-size 0.875rem)

(define-style sf-chat-turn #:display flex #:flex-direction column #:gap 0.375rem)

;; what you said: a bubble on the right. What it said: plain text, left.
(define-style sf-chat-msg
  [,(sel '& is-user)
   #:align-self flex-end
   #:max-width 85%
   #:padding (0.1875rem 0.5rem)
   #:border (1px solid (apply var --line))
   #:border-radius (apply var --radius)
   #:background (apply var --pill-bg)]
  [& #:white-space pre-wrap #:overflow-wrap anywhere]
  ;; nothing said yet: no empty line waiting for it
  [(: ,(sel '& is-agent) empty) #:display none]
  ;; the agent's text is Markdown, and its blocks must not push the turn apart
  [(,(sel '& is-agent) (: p first-child)) #:margin-top 0]
  [(,(sel '& is-agent) (: p last-child)) #:margin-bottom 0]
  [(,(sel '& is-agent) ul) (,(sel '& is-agent) ol)
   #:margin (0.25rem 0)
   #:padding-left 1.25rem]
  [,(sel '& is-error)
   #:color (apply var --rose-fg)
   #:font-family (apply var --mono)
   #:font-size 0.75rem])

(define-style sf-chat-note
  #:color (apply var --dim)
  #:font-family (apply var --mono)
  #:font-size 0.6875rem)

;; one line per tool call, updated in place by id
(define-style sf-chat-tool
  #:display flex
  #:align-items baseline
  #:gap 0.375rem
  #:font-family (apply var --mono)
  #:font-size 0.75rem
  #:color (apply var --dim)
  [(attribute & (= data-status "failed")) #:color (apply var --rose-fg)])

(define-style sf-chat-tool-title #:overflow-wrap anywhere)

(define-style sf-chat-tool-glyph
  [((attribute ,(sel sf-chat-tool) (= data-status "completed")) &) #:color (apply var --green)]
  ;; a call still in flight spins; a finished one is a mark
  [((attribute ,(sel sf-chat-tool) (= data-status "pending")) &)
   ((attribute ,(sel sf-chat-tool) (= data-status "in_progress")) &)
   #:display inline-block
   #:animation (sf-spin 2s linear infinite)]
  [@ media (#:prefers-reduced-motion reduce)
     [(,(sel sf-chat-tool) &) #:animation none]])

(register-fragment!
 (css-expr [@ keyframes sf-spin [to #:transform (apply rotate 360deg)]]))

;; a break in the conversation: new chat, or an agent that was replaced
(define-style sf-chat-sep
  #:display flex
  #:align-items center
  #:gap 0.5rem
  #:color (apply var --dim)
  #:font-family (apply var --mono)
  #:font-size 0.6875rem
  [(:: & before) (:: & after) #:content "" #:flex (1 1 auto)
   #:border-top (1px solid (apply var --line))])

;; Frames land here: a hook for the SSE extension, nothing to look at.
(define-modifier sf-chat-sink)

;; ---- the input row --------------------------------------------------------

(define-style sf-chat-form
  #:display flex
  #:gap 0.375rem
  #:padding (0.625rem 0.75rem)
  #:border-top (1px solid (apply var --line))
  #:background (apply color-mix (in srgb) ((apply var --panel) 85%) (apply var --paper))
  ;; the input row is what the command popover hangs off
  #:position relative)

;; Opens upward, over the conversation: the input row is the last line of the
;; panel, and a menu below it would be off the screen. Its own surface, one
;; step up from the row it belongs to.
(define-style sf-chat-pop
  #:position absolute
  #:left 0.75rem
  #:right 0.75rem
  #:bottom 100%
  #:z-index 1
  #:max-height 14rem
  #:overflow-y auto
  #:overscroll-behavior contain
  #:border (1px solid (apply var --line))
  #:border-radius (apply var --radius)
  #:background (apply var --panel)
  #:box-shadow (0 -4px 12px (apply color-mix (in srgb) ((apply var --ink) 12%) transparent))
  [(attribute & hidden) #:display none])

(define-style sf-chat-cmd
  #:display flex
  #:align-items baseline
  #:gap 0.5rem
  #:padding (0.25rem 0.5rem)
  #:cursor pointer
  ;; the keyboard's highlight and the mouse's are the same mark
  [,(sel '& is-picked) (: & hover) #:background (apply var --pill-bg)]
  ;; the one you are in already: marked, and not worth clicking
  [(attribute & data-current) #:cursor default])

(define-style sf-chat-cmd-name
  #:flex none
  #:font-family (apply var --mono)
  #:font-size 0.75rem
  #:color (apply var --green)
  [(:: ((attribute ,(sel sf-chat-cmd) data-current) &) before)
   #:content "● "
   #:color (apply var --green)])

;; one line per command: the description is context, not the thing being read
(define-style sf-chat-cmd-desc
  #:flex (1 1 auto)
  #:min-width 0
  #:font-size 0.75rem
  #:color (apply var --dim)
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap)

;; The same popover at the other end of the panel: the past conversations hang
;; off the header, so this one opens DOWNWARD from it. A second class on the
;; same element, so every rule here has to land after .sf-chat-pop's.
(define-style sf-chat-spop
  #:top 100%
  #:bottom auto
  #:left 0.75rem
  #:right 0.75rem
  #:padding (0.25rem 0)
  #:box-shadow (0 4px 12px (apply color-mix (in srgb) ((apply var --ink) 12%) transparent))
  ;; here the TITLE is the thing being read and the timestamp is the context,
  ;; so the two swap roles: the title takes the room and gets cut off, not the
  ;; date
  [(& ,(sel sf-chat-cmd-name))
   #:flex (1 1 auto)
   #:min-width 0
   #:overflow hidden
   #:text-overflow ellipsis
   #:white-space nowrap
   #:font-family (apply var --sans)
   #:color (apply var --ink)]
  [(& ,(sel sf-chat-cmd-desc)) #:flex none #:font-family (apply var --mono)]
  [(& ,(sel sf-chat-cmd)) #:gap 0.75rem])

;; The button that opens the same popover, for someone who has not learned the
;; slash. It appears only once there is a list to show — and while a turn runs
;; there is still just the one thing to do, and it is stop.
(define-style sf-chat-cmds
  #:display none
  [(,(sel sf-chat has-commands) &) #:display inline-block]
  [(,(sel sf-chat is-busy) &) #:display none])

(define-style sf-chat-input
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (0.25rem 0.5rem)
  #:border (1px solid (apply var --line))
  #:border-radius (apply var --radius)
  #:background (apply var --paper)
  #:color (apply var --ink)
  #:font-family (apply var --sans)
  #:font-size 0.875rem
  [(: & disabled) #:opacity 0.6])

;; while a turn runs there is one thing to do, and it is stop
(register-fragment!
 (css-expr
  [,(sel sf-chat-stop) (,(sel sf-chat is-busy) ,(sel sf-chat-send)) #:display none]
  [(,(sel sf-chat is-busy) ,(sel sf-chat-stop)) #:display inline-block]))

;; ---- the markup -----------------------------------------------------------

(define tool-glyphs #hash(("completed" . "✓") ("failed" . "✗")))

(define (chat-tool-xexpr t)
  (define status (chat-string t 'status "pending"))
  `(div ((class ,sf-chat-tool)
         (data-tool-id ,(chat-string t 'id ""))
         (data-status ,status))
        (span ((class ,sf-chat-tool-glyph)) ,(hash-ref tool-glyphs status "⚙"))
        (span ((class ,sf-chat-tool-title)) ,(chat-string t 'title ""))))

;; A transcript field is JSON: a missing one and an explicit null are the
;; same nothing, and neither may reach xexpr->string.
(define (chat-string h k [default #f])
  (define v (hash-ref h k #f))
  (if (string? v) v default))

(define (chat-turn-xexpr e)
  (define status (chat-string e 'status "done"))
  (define text (chat-string e 'agent ""))
  (define stop (chat-string e 'stopReason))
  (define err (chat-string e 'error))
  `(div ((class ,sf-chat-turn))
        (div ((class ,(classes sf-chat-msg is-user))) ,(chat-string e 'text ""))
        (div ((class ,(classes sf-chat-msg is-agent)))
             ,@(if (equal? status "done")
                   (note->xexprs text)
                   (list text)))
        ,@(for/list ([t (in-list (hash-ref e 'tools '()))]
                     #:when (hash? t))
            (chat-tool-xexpr t))
        ,@(if err
              (list `(div ((class ,(classes sf-chat-msg is-error))) ,err))
              '())
        ,@(if (and stop (not (equal? stop "end_turn")))
              (list `(div ((class ,sf-chat-note)) ,stop))
              '())))

;; Not a turn: the conversation moved. A live `reset` clears the panel; a
;; replayed one is a line across it, because the turns above it happened.
(define (chat-marker-xexpr e)
  (define type (chat-string e 'type ""))
  `(div ((class ,sf-chat-sep))
        ,(or (chat-string e 'message) (if (equal? type "reset") "new chat" type))))

(define (chat-entry-xexpr e)
  (if (equal? (chat-string e 'type "") "turn")
      (chat-turn-xexpr e)
      (chat-marker-xexpr e)))

(define (render-chat-panel transcript
                           #:send-href send-href
                           #:new-href new-href
                           #:cancel-href cancel-href
                           #:sessions-href sessions-href
                           #:load-href load-href
                           #:event event
                           #:model [model #f]
                           #:session-title [session-title #f]
                           #:commands [commands '()])
  ;; A turn was still running when this page was rendered: the panel comes up
  ;; in that state (input disabled, stop showing) rather than idle.
  (define busy?
    (for/or ([e (in-list transcript)]) (equal? (chat-string e 'status) "running")))
  `(div ((class ,sf-chat-dock))
        (button ((type "button") (class ,sf-chat-open) (data-chat-toggle "")
                 (aria-label "open the agent panel"))
                ">_ agent")
        ;; The agent's slash commands, replayed onto the panel: chat.js reads
        ;; them at init so a reloaded page completes immediately, and a
        ;; `commands` frame replaces them from there. JSON in an attribute —
        ;; the xexpr layer is what escapes it, same as any other string here.
        (aside ((class ,(classes sf-chat (and busy? is-busy)
                                 ;; nothing to offer, nothing to press: the
                                 ;; commands button is one class away, so a
                                 ;; `commands` frame can bring it back
                                 (and (pair? commands) has-commands)))
                (id "sf-chat")
                (data-commands ,(jsexpr->string commands)))
               (div ((class ,sf-chat-head))
                    ;; Which model, when the bridge has heard one — never a
                    ;; placeholder. Its own span, and the separator is the
                    ;; span's, so a `model` frame sets one string.
                    (span ((class ,sf-chat-title)) "agent · claude code"
                          (span ((class ,sf-chat-model) (id "sf-chat-model"))
                                ,(or model ""))
                          ;; A running turn is visible on the floating toggle,
                          ;; which an OPEN panel hides — so the header carries
                          ;; the same signal. Always drawn, shown by is-busy,
                          ;; which the server sets for a turn in flight and
                          ;; chat.js moves from there.
                          (span ((class ,sf-chat-working) (title "working")))
                          ;; Which conversation, when it has a name. Same
                          ;; pattern as the model, one line down: a `session`
                          ;; frame sets one string, and an empty one takes the
                          ;; line away with it.
                          (span ((class ,sf-chat-session) (id "sf-chat-session"))
                                ,(or session-title "")))
                    (div ((class ,sf-chat-actions))
                         ;; The conversations the agent has stored for this
                         ;; directory. The popover it opens is drawn by
                         ;; chat.js from what the route answers — the list is
                         ;; the agent's, and a copy rendered into the page
                         ;; would be stale before it was read.
                         (button ((type "button") (class ,sf-chat-btn)
                                  (data-chat-sessions ,sessions-href)
                                  (data-chat-load ,load-href)
                                  (title "past chats"))
                                 "chats")
                         (button ((type "button") (class ,sf-chat-btn)
                                  (data-post ,new-href) (title "new chat"))
                                 "+ new")
                         ;; An open panel sits on top of the floating toggle,
                         ;; so the way out is in here — and on a phone, where
                         ;; the panel is a full-width sheet, it is the only one.
                         (button ((type "button") (class ,sf-chat-btn)
                                  (data-chat-toggle "")
                                  (title "close the agent panel")
                                  (aria-label "close the agent panel"))
                                 "×")))
               ;; Frames land here: the htmx sse extension would swap the raw
               ;; JSON in, and chat.js cancels that and keeps the data. One
               ;; connection, two consumers.
               (div ((class ,sf-chat-sink) (id "sf-chat-sink")
                     (sse-swap ,event) (hidden "hidden")))
               (div ((class ,sf-chat-body) (id "sf-chat-body"))
                    ,@(for/list ([e (in-list transcript)]) (chat-entry-xexpr e)))
               (form ((class ,sf-chat-form) (id "sf-chat-form")
                      (action ,send-href) (method "post"))
                     ;; The same popover a typed "/" opens, unfiltered: the
                     ;; commands are a thing to SEE, not only to guess at.
                     (button ((type "button") (class ,(classes sf-chat-btn sf-chat-cmds))
                              (data-chat-commands "") (title "commands")
                              (aria-label "show the agent's commands"))
                             "/")
                     (input ((class ,sf-chat-input) (name "text") (type "text")
                             (autocomplete "off") (placeholder "message the agent")
                             ,@(if busy? '((disabled "disabled")) '())))
                     (button ((type "submit") (class ,sf-chat-send)) "send")
                     (button ((type "button") (class ,sf-chat-stop)
                              (data-post ,cancel-href))
                             "stop")))))
