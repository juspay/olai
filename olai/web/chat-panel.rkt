#lang racket/base

;; The agent panel, drawn: the dock, the header, the room the conversation
;; goes in, the input row, and every rule that paints them.
;;
;; PRESENTATION ONLY, and CHROME only. What a turn IS, what a frame means,
;; whether the agent is busy — that is web/chat.rkt over olai/acp. This module
;; is handed a handful of URLs and gives back an xexpr. The one thing it takes
;; from web/chat is the WORDS: a status is that module's vocabulary, and a
;; selector that spelled one by hand would be a second owner of it.
;;
;; Nothing about the conversation is drawn here. A page is served while the
;; agent may still be waking up, so anything this rendered about the
;; conversation would be as old as the request; what a panel shows arrives on
;; the page's ONE SSE connection, which web/chat catches up the moment it
;; exists (`chat-catch-up`) and keeps live from there. So the dock, the header,
;; the empty conversation and the input row are markup, and every class inside
;; the conversation is style with no markup on this side — static/chat.js
;; builds them, which is exactly why they are still defined here.
;;
;; The URLs are the route layer's, and so is the SSE event name — a renderer
;; that spelled "chat" here would be a second owner of the wire format.
;;
;; The panel is an overlay on the outline, so its rules land after the
;; outline's: the require below is what puts them there, and the one rule whose
;; subject is the outline's own says so out loud with #:layer 'overlay (see
;; style.rkt on ordering).

(require racket/contract
         olai/web/style
         ;; the skin's tokens and constants, and the page's own class — the
         ;; panel is positioned against the document
         olai/web/theme
         ;; the words a transcript is written in: what a status MEANS is
         ;; web/chat's, and a selector here spells the same binding
         (only-in olai/web/chat
                  tool-pending tool-in-progress tool-completed tool-failed)
         ;; the pane the panel makes room in
         (only-in olai/web/render ol-main))

(provide (contract-out
          [render-chat-panel
           (-> #:send-href string? #:new-href string? #:cancel-href string?
               #:sessions-href string? #:load-href string?
               #:event string?
               list?)]))

;; ---- states ---------------------------------------------------------------
;;
;; The panel's states. chat.js owns every one of them: the panel is drawn in
;; none of them and put into the ones the stream says it is in.

(define-modifier is-open is-busy has-commands is-picked
                 is-user is-agent is-error)

;; ---- the dock -------------------------------------------------------------

;; The outline stays the star. The panel is fixed to the right edge, closed
;; until asked for, and the main pane makes room rather than being covered —
;; until the screen is too narrow for two columns, where it is a sheet over the
;; outline instead (sheet mode, at the end of the rules below).
;; The dock itself is not a box: its two children place themselves.
(define-style ol-chat-dock #:display contents)

(define-style ol-chat-open
  #:position fixed
  ;; clear the home indicator / notch on phones (viewport-fit=cover)
  #:right (apply max 1rem (apply env safe-area-inset-right))
  #:bottom (apply max 1rem (apply env safe-area-inset-bottom))
  #:z-index 20
  #:padding (0.5rem 0.875rem)
  ;; a thing a thumb aims at, whatever the label says (theme.rkt, touch-min)
  #:min-height ,touch-min
  #:border (1px solid ,line)
  #:border-radius 9999px
  #:background ,paper-2
  #:color ,dim
  #:font-family ,mono
  #:font-size 0.75rem
  #:cursor pointer
  [(: & hover) #:color ,ink #:border-color ,dim]
  ;; an open panel is on top of where the toggle sits — it would land on the
  ;; send button. It steps aside, and the header's × takes over.
  [(,(sel ol-chat-dock is-open) &) #:display none]
  ;; a turn is running behind a closed panel: the toggle breathes so working is
  ;; visible without opening it. The ring is the accent color at low alpha,
  ;; expanding and fading — no bounce, no color change on the button itself.
  [(,(sel ol-chat-dock is-busy) &)
   #:border-color ,green
   #:animation (ol-chat-glow ,busy-beat ease-in-out infinite)
   ;; the border still marks busy; only the motion drops out
   [@ media (#:prefers-reduced-motion reduce) #:animation none]])

(register-fragment!
 (css-expr
  [@ keyframes ol-chat-glow
     [0% 100% #:box-shadow (0 0 0 0 (apply color-mix (in srgb)
                                           (,green 45%) transparent))]
     [50% #:box-shadow (0 0 0 6px (apply color-mix (in srgb)
                                         (,green 0%) transparent))]]))

;; ---- the panel ------------------------------------------------------------

;; What the browser is SHOWING, which on a phone is not what it laid out. The
;; panel is fixed, so it is placed against the LAYOUT viewport — and an
;; on-screen keyboard covers the bottom of that without shrinking it. A panel
;; at `top: 0; bottom: 0` therefore spent the whole time you were typing with
;; its input row behind the keyboard, which is the one thing you are looking
;; at. --visible-h is the height of the strip that is actually on screen and
;; --visible-bottom is how far below it the layout viewport's bottom edge sits,
;; which is what a fixed box has to be lifted by.
;;
;; The panel's own vocabulary, not the theme's: nothing else reads them, and
;; they are not a design choice but a reading of one browser. static/chat.js
;; takes that reading (visualViewport) and keeps them in step; the values here
;; are what a page whose scripts have not run gets, and where a desktop browser
;; stays — the whole viewport, flush with the bottom, which is what the side
;; panel always was.
(define-tokens chat-viewport-tokens visible-h visible-bottom)

(register-fragment!
 #:layer 'base
 (css-expr [(: root) #:--visible-h 100dvh #:--visible-bottom 0px]))

(define-style ol-chat
  #:position fixed
  #:right 0
  #:z-index 19
  #:width ,chat-w
  #:bottom ,visible-bottom
  #:height ,visible-h
  #:display none
  #:flex-direction column
  #:border-left (1px solid ,line)
  ;; its own surface, one step up the paper ramp (paper -> paper-2 -> panel):
  ;; the panel is a layer over the outline, not more of the same sheet
  #:background ,panel
  ;; fixed, so body padding does not protect it: pad for the notch / home bar
  #:padding-top (apply env safe-area-inset-top)
  #:padding-right (apply env safe-area-inset-right)
  ;; the home-bar inset, minus whatever a keyboard is already covering: pad for
  ;; it twice and the input row floats a thumb's width above the keyboard
  #:padding-bottom (apply max 0px (apply calc (- (apply env safe-area-inset-bottom)
                                                 ,visible-bottom)))
  [,(sel '& is-open) #:display flex])

;; The panel does not cover the outline: the reading column gives up the width
;; it takes. The SUBJECT here is another module's — the document and the
;; outline's pane — which is what 'overlay says, and what puts this after
;; everything web/render registered.
;;
;; MARGIN, not padding. .ol-main is border-box with `max-width: 56rem`, so a
;; padding gutter is taken out of that cap rather than out of the free space
;; beside it: --chat-w is max(21rem, 33vw), so on a 1920px screen the gutter ate
;; 41rem of the 56rem and the text wrapped into what was left, three words to a
;; line, with the gutter sitting empty next to it. A margin is outside the
;; border box, so the cap still measures the reading column and the flex box
;; gives up the width the panel takes.
(register-fragment!
 #:layer 'overlay
 (css-expr
  [((: ,(sel 'body ol-body) (apply has ,(sel ol-chat is-open))) ,(sel ol-main))
   #:margin-right (apply calc (+ ,chat-w 1.5rem))
   ;; The other half of sheet mode (see the block at the end of this module):
   ;; below phone-max the panel covers the outline instead of sitting beside it,
   ;; so there is nothing to make room for — and a gutter the width of the
   ;; panel would leave the reading column with nothing.
   [@ media (#:max-width ,phone-max) #:margin-right 0]]))

(define-style ol-chat-head
  #:display flex
  #:align-items center
  #:justify-content space-between
  #:gap 0.5rem
  #:padding (0.625rem 0.75rem)
  #:border-bottom (1px solid ,line)
  ;; the chrome rows sit a shade back from the conversation, so the panel's
  ;; structure reads without a second border
  #:background (apply color-mix (in srgb) (,panel 85%) ,paper)
  ;; the header is what the sessions popover hangs off
  #:position relative)

(define-style ol-chat-title
  #:min-width 0
  #:font-family ,mono
  #:font-size 0.75rem
  #:letter-spacing 0.04em
  #:color ,dim)

;; the model, when the agent named one. Empty means unknown, and unknown says
;; nothing at all — separator included.
(define-style ol-chat-model
  #:opacity 0.8
  [(:: (: & (apply not (: empty))) before) #:content " · "])

;; which conversation, when the agent has named one. Quieter than the model —
;; it is context, not state — and one line down, where a long title has room
;; to be cut off instead of pushing the buttons around.
(define-style ol-chat-session
  #:display block
  #:max-width 100%
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap
  #:opacity 0.65
  #:font-size ,micro-size
  #:letter-spacing 0)

;; a turn running behind an OPEN panel: the toggle that breathes is hidden
;; under it, so the header says it instead — one dot, the same accent and the
;; same rhythm as the toggle's ring
(define-style ol-chat-working
  #:display none
  #:width 0.4375rem
  #:height 0.4375rem
  #:margin-left 0.5rem
  #:border-radius 50%
  #:background ,green
  #:vertical-align middle
  [(,(sel ol-chat is-busy) &)
   #:display inline-block
   #:animation (ol-chat-glow ,busy-beat ease-in-out infinite)
   ;; likewise the dot: it stays, it just stops breathing
   [@ media (#:prefers-reduced-motion reduce) #:animation none]])

(define-style ol-chat-actions #:display flex #:align-items center #:gap 0.375rem)

;; One control with three jobs: one block, three subjects.
(define-style (ol-chat-btn ol-chat-send ol-chat-stop)
  #:padding (0.1875rem 0.5rem)
  #:border (1px solid ,line)
  #:border-radius ,radius
  #:background ,paper-2
  #:color ,dim
  #:font-family ,mono
  #:font-size ,micro-size
  #:cursor pointer)

;; What is true of only some of them, after it: two answer a hover, and the
;; stop wears the alarm color.
(register-fragment!
 (css-expr
  [(: ,(sel ol-chat-btn) hover) (: ,(sel ol-chat-send) hover) #:color ,ink]
  [,(sel ol-chat-stop) #:color ,rose-fg #:border-color ,rose-fg]))

;; ---- the conversation -----------------------------------------------------

(define-style ol-chat-body
  #:flex (1 1 auto)
  #:overflow-y auto
  #:overscroll-behavior contain
  #:padding 0.75rem
  #:display flex
  #:flex-direction column
  #:gap 0.625rem
  #:font-size 0.875rem)

(define-style ol-chat-turn #:display flex #:flex-direction column #:gap 0.375rem)

;; what you said: a bubble on the right. What it said: plain text, left.
(define-style ol-chat-msg
  [,(sel '& is-user)
   #:align-self flex-end
   #:max-width 85%
   #:padding (0.1875rem 0.5rem)
   #:border (1px solid ,line)
   #:border-radius ,radius
   #:background ,pill-bg]
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
   #:color ,rose-fg
   #:font-family ,mono
   #:font-size 0.75rem])

(define-style ol-chat-note
  #:color ,dim
  #:font-family ,mono
  #:font-size ,micro-size)

;; one line per tool call, updated in place by id
(define-style ol-chat-tool
  #:display flex
  #:align-items baseline
  #:gap 0.375rem
  #:font-family ,mono
  #:font-size 0.75rem
  #:color ,dim
  [(attribute & (= data-status ,tool-failed)) #:color ,rose-fg])

(define-style ol-chat-tool-title #:overflow-wrap anywhere)

(define-style ol-chat-tool-glyph
  [((attribute ,(sel ol-chat-tool) (= data-status ,tool-completed)) &) #:color ,green]
  ;; a call still in flight spins; a finished one is a mark
  [((attribute ,(sel ol-chat-tool) (= data-status ,tool-pending)) &)
   ((attribute ,(sel ol-chat-tool) (= data-status ,tool-in-progress)) &)
   #:display inline-block
   #:animation (ol-spin 2s linear infinite)]
  [@ media (#:prefers-reduced-motion reduce)
     [(,(sel ol-chat-tool) &) #:animation none]])

(register-fragment!
 (css-expr [@ keyframes ol-spin [to #:transform (apply rotate 360deg)]]))

;; a break in the conversation: new chat, or an agent that was replaced
(define-style ol-chat-sep
  #:display flex
  #:align-items center
  #:gap 0.5rem
  #:color ,dim
  #:font-family ,mono
  #:font-size ,micro-size
  [(:: & before) (:: & after) #:content "" #:flex (1 1 auto)
   #:border-top (1px solid ,line)])

;; Frames land here: a hook for the SSE extension, nothing to look at.
(define-modifier ol-chat-sink)

;; ---- the input row --------------------------------------------------------

(define-style ol-chat-form
  #:display flex
  #:gap 0.375rem
  #:padding (0.625rem 0.75rem)
  #:border-top (1px solid ,line)
  #:background (apply color-mix (in srgb) (,panel 85%) ,paper)
  ;; the input row is what the command popover hangs off
  #:position relative)

;; Opens upward, over the conversation: the input row is the last line of the
;; panel, and a menu below it would be off the screen. Its own surface, one
;; step up from the row it belongs to.
(define-style ol-chat-pop
  #:position absolute
  #:left 0.75rem
  #:right 0.75rem
  #:bottom 100%
  #:z-index 1
  #:max-height 14rem
  #:overflow-y auto
  #:overscroll-behavior contain
  #:border (1px solid ,line)
  #:border-radius ,radius
  #:background ,panel
  #:box-shadow (0 -4px 12px (apply color-mix (in srgb) (,ink 12%) transparent))
  [(attribute & hidden) #:display none])

(define-style ol-chat-cmd
  #:display flex
  #:align-items baseline
  #:gap 0.5rem
  #:padding (0.25rem 0.5rem)
  #:cursor pointer
  ;; the keyboard's highlight and the mouse's are the same mark
  [,(sel '& is-picked) (: & hover) #:background ,pill-bg]
  ;; the one you are in already: marked, and not worth clicking
  [(attribute & data-current) #:cursor default])

(define-style ol-chat-cmd-name
  #:flex none
  #:font-family ,mono
  #:font-size 0.75rem
  #:color ,green
  [(:: ((attribute ,(sel ol-chat-cmd) data-current) &) before)
   #:content "● "
   #:color ,green])

;; one line per command: the description is context, not the thing being read
(define-style ol-chat-cmd-desc
  #:flex (1 1 auto)
  #:min-width 0
  #:font-size 0.75rem
  #:color ,dim
  #:overflow hidden
  #:text-overflow ellipsis
  #:white-space nowrap)

;; The same popover at the other end of the panel: the past conversations hang
;; off the header, so this one opens DOWNWARD from it. A second class on the
;; same element, so every rule here has to land after .ol-chat-pop's.
(define-style ol-chat-spop
  #:top 100%
  #:bottom auto
  #:left 0.75rem
  #:right 0.75rem
  #:padding (0.25rem 0)
  #:box-shadow (0 4px 12px (apply color-mix (in srgb) (,ink 12%) transparent))
  ;; here the TITLE is the thing being read and the timestamp is the context,
  ;; so the two swap roles: the title takes the room and gets cut off, not the
  ;; date
  [(& ,(sel ol-chat-cmd-name))
   #:flex (1 1 auto)
   #:min-width 0
   #:overflow hidden
   #:text-overflow ellipsis
   #:white-space nowrap
   #:font-family ,sans
   #:color ,ink]
  [(& ,(sel ol-chat-cmd-desc)) #:flex none #:font-family ,mono]
  [(& ,(sel ol-chat-cmd)) #:gap 0.75rem])

;; The button that opens the same popover, for someone who has not learned the
;; slash. It appears only once there is a list to show — and while a turn runs
;; there is still just the one thing to do, and it is stop.
(define-style ol-chat-cmds
  #:display none
  [(,(sel ol-chat has-commands) &) #:display inline-block]
  [(,(sel ol-chat is-busy) &) #:display none])

(define-style ol-chat-input
  #:flex (1 1 auto)
  #:min-width 0
  #:padding (0.25rem 0.5rem)
  #:border (1px solid ,line)
  #:border-radius ,radius
  #:background ,paper
  #:color ,ink
  #:font-family ,sans
  #:font-size 0.875rem
  [(: & disabled) #:opacity 0.6])

;; while a turn runs there is one thing to do, and it is stop
(register-fragment!
 (css-expr
  [,(sel ol-chat-stop) (,(sel ol-chat is-busy) ,(sel ol-chat-send)) #:display none]
  [(,(sel ol-chat is-busy) ,(sel ol-chat-stop)) #:display inline-block]))

;; ---- sheet mode -----------------------------------------------------------
;;
;; A phone has no room beside the outline: below phone-max the panel stops
;; being a side panel and becomes a SHEET over it. That is ONE decision, so it
;; is one block — everything that is different about the narrow panel is here,
;; and nothing anywhere else has a phone-width opinion about it. (The one rule
;; it cannot hold is the outline's gutter, whose subject is another module's
;; class and which therefore has to live in the 'overlay fragment above; it
;; says there that it is the same mode.)
;;
;; Last in the module, because every rule here repaints one stated above it,
;; and a media query adds no specificity to win with.
;;
;; What it does NOT touch is `display`: the panel's own states hang off that
;; (a stop button that hides while idle, a commands button that hides with
;; nothing to offer), and a phone-width rule landing after them would show
;; both.
(register-fragment!
 (css-expr
  [@ media (#:max-width ,phone-max)
     ;; full bleed, and no border against a column that is not beside it
     [,(sel ol-chat) #:width 100% #:border-left 0]
     ;; The same target the floating toggle keeps, for the same reason: at the
     ;; panel's own scale these were 20px boxes around 11px glyphs, and on a
     ;; phone the header's × is the ONLY way out of the sheet — the toggle it
     ;; would otherwise be is underneath it. A button centres its own label, so
     ;; a minimum is all this takes.
     [,(sel ol-chat-btn) ,(sel ol-chat-send) ,(sel ol-chat-stop)
      #:min-height ,touch-min
      #:padding (0.25rem 0.75rem)
      #:font-size 0.8125rem
      ;; a two-word label in a box this size wraps, and a wrapped label makes
      ;; the row it sits in taller than the finger it was widened for
      #:white-space nowrap]
     ;; 16px is a threshold, not a taste: iOS Safari zooms the page in when you
     ;; focus an input whose type is smaller and does not zoom back out, so the
     ;; sheet ends up wider than the screen with the send button off the edge.
     [,(sel ol-chat-input) #:min-height ,touch-min #:font-size 1rem]]))

;; ---- the markup -----------------------------------------------------------

(define (render-chat-panel #:send-href send-href
                           #:new-href new-href
                           #:cancel-href cancel-href
                           #:sessions-href sessions-href
                           #:load-href load-href
                           #:event event)
  `(div ((class ,ol-chat-dock))
        (button ((type "button") (class ,ol-chat-open) (data-chat-toggle "")
                 (aria-label "open the agent panel"))
                ">_ agent")
        ;; In none of its states: closed, idle, and with nothing to offer. Each
        ;; of them is one class away, and the frames this connection is caught
        ;; up with are what put it in the right ones.
        (aside ((class ,ol-chat) (id "ol-chat"))
               (div ((class ,ol-chat-head))
                    ;; Which model — never a placeholder: an empty span for a
                    ;; `model` frame to fill, and the separator is the span's
                    ;; own, so filling it is setting one string.
                    (span ((class ,ol-chat-title)) "agent · claude code"
                          (span ((class ,ol-chat-model) (id "ol-chat-model")))
                          ;; A running turn is visible on the floating toggle,
                          ;; which an OPEN panel hides — so the header carries
                          ;; the same signal. Always drawn, shown by is-busy.
                          (span ((class ,ol-chat-working) (title "working")))
                          ;; Which conversation. Same pattern as the model, one
                          ;; line down: a `session` frame sets one string, and
                          ;; an empty one takes the line away with it.
                          (span ((class ,ol-chat-session) (id "ol-chat-session"))))
                    (div ((class ,ol-chat-actions))
                         ;; The conversations the agent has stored for this
                         ;; directory. The popover it opens is drawn by
                         ;; chat.js from what the route answers — the list is
                         ;; the agent's, and a copy rendered into the page
                         ;; would be stale before it was read.
                         (button ((type "button") (class ,ol-chat-btn)
                                  (data-chat-sessions ,sessions-href)
                                  (data-chat-load ,load-href)
                                  (title "past chats"))
                                 "chats")
                         (button ((type "button") (class ,ol-chat-btn)
                                  (data-post ,new-href) (title "new chat"))
                                 "+ new")
                         ;; An open panel sits on top of the floating toggle,
                         ;; so the way out is in here — and on a phone, where
                         ;; the panel is a full-width sheet, it is the only one.
                         (button ((type "button") (class ,ol-chat-btn)
                                  (data-chat-toggle "")
                                  (title "close the agent panel")
                                  (aria-label "close the agent panel"))
                                 "×")))
               ;; Frames land here: the htmx sse extension would swap the raw
               ;; JSON in, and chat.js cancels that and keeps the data. One
               ;; connection, two consumers.
               (div ((class ,ol-chat-sink) (id "ol-chat-sink")
                     (sse-swap ,event) (hidden "hidden")))
               ;; Empty, always: the conversation is what the stream says it
               ;; is, from the frames it catches this connection up with.
               (div ((class ,ol-chat-body) (id "ol-chat-body")))
               (form ((class ,ol-chat-form) (id "ol-chat-form")
                      (action ,send-href) (method "post"))
                     ;; The same popover a typed "/" opens, unfiltered: the
                     ;; commands are a thing to SEE, not only to guess at.
                     (button ((type "button") (class ,(classes ol-chat-btn ol-chat-cmds))
                              (data-chat-commands "") (title "commands")
                              (aria-label "show the agent's commands"))
                             "/")
                     (input ((class ,ol-chat-input) (name "text") (type "text")
                             (autocomplete "off") (placeholder "message the agent")))
                     (button ((type "submit") (class ,ol-chat-send)) "send")
                     (button ((type "button") (class ,ol-chat-stop)
                              (data-post ,cancel-href))
                             "stop")))))
