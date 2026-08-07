#lang racket/base

;; THE MONTH: the day journal, drawn as a calendar.
;;
;; What the sidebar shows where a file called Daily.rkt used to be a line of
;; text. A file name is not a way into anything — the days under it are, and a
;; month is how a person already knows to look at days — so the calendar IS the
;; entry rather than an ornament beside it.
;;
;; READ-ONLY, and pure: no state is stored and nothing is written. A cell is a
;; link when the outline HAS a node for that day, and a dead number when it does
;; not. An empty day offers nothing to press, because pressing it could only
;; mean "write a file", and this pane writes nothing.
;;
;; Which month: today's, and only today's. The sidebar is a REGION that
;; re-fetches whatever page drew it (web/sidebar), so a month you could page
;; through would have to be part of that page's address — every address, on
;; every route — or client state morph has to be taught to keep. Neither is a
;; month's worth of machinery, and the header is the way out: it zooms to the
;; node the month hangs under, which is the whole journal, browsable as an
;; outline like everything else.
;;
;; DATA IN — the Daily root's tasks, `today` as a string, and the address of a
;; node. It reads no clock and mints no URL (web/routes does that); which of the
;; loaded outlines is the journal is olai/daily's answer, not this module's.

(require racket/contract
         ;; the journal, as a month: its days laid out on the week this grid
         ;; lays out, and what a month is called. One module owns all of it
         (only-in olai/journal
                  day-month-for day-month-key day-month-cells
                  week-days month-name)
         ;; what a weekday is called, and reading a month back out of a string:
         ;; the module that owns every date form (olai/dates)
         (only-in olai/dates weekday-abbrev parse-year-month)
         olai/web/theme
         olai/web/style
         (only-in olai/web/states is-today is-current)
         ;; what a link to a node wears; one owner for that, web/address
         (only-in olai/web/address node-link-attributes))

(provide (contract-out
          ;; the Daily root's top-level tasks -> the month around `today`.
          ;; `current-key` is the node the PAGE is about, or #f — the calendar
          ;; is chrome on every page, and on a day's page it is also where you
          ;; are
          [render-month-calendar
           (-> list? #:today string? #:current-key (or/c string? #f)
               #:node-href (-> string? string?)
               list?)]))

(define-style ol-cal #:margin-bottom 0.25rem)

;; The header reads like the file label it replaced — mono, micro, quiet, at
;; the same indent — and is a link where that one was inert text: it is the way
;; back out to the whole journal.
(define-style ol-cal-title
  #:display inline-block
  #:margin (0 0 0.25rem 0.5rem)
  #:font-family ,mono
  #:font-size ,micro-size
  #:text-decoration none
  #:color ,dim
  [(: & hover) #:color ,ink])

;; As many columns as the week has days, read off the same list the headings
;; are: a seven written here is a seven to keep in step with one over there.
(define-style ol-cal-grid
  #:display grid
  #:grid-template-columns (apply repeat ,(length week-days) (apply minmax 0 1fr))
  #:gap 0.0625rem)

(define-style ol-cal-dow
  #:text-align center
  #:font-size ,micro-size
  #:color ,dim)

;; ONE DAY, and the three things a reader has to be able to tell apart at a
;; glance in a 15rem column. They are three different marks on purpose — the
;; first draft said all of them with ink and weight, and in a real browser you
;; could not see any of them:
;;
;;   has something   full ink, and a dot under the number, the way every
;;                   calendar marks a day that has entries
;;   today           a green ring, the accent this app spends on today
;;                   everywhere else (web/pills)
;;   you are here    FILLED — ink ground, paper number. The page you are
;;                   reading is not a shade of a day, it is the day
;;
;; The box itself is the same size in every one of them, so the month does not
;; jump about as you move through it.
(define-style ol-cal-day
  #:position relative
  #:display flex
  #:align-items center
  #:justify-content center
  #:min-height 1.75rem
  #:border-radius ,radius
  #:border (1px solid transparent)
  #:font-size 0.75rem
  #:font-variant-numeric tabular-nums
  #:text-decoration none
  ;; the day you are reading. Ink on paper, inverted: the one pair every theme
  ;; guarantees is legible, which a tinted fill is not (matcha and moon put a
  ;; mid-green and a lilac against their own paper)
  [,(sel '& is-current)
   #:background ,ink
   #:color ,paper
   #:border-color ,ink
   #:font-weight 600]
  ;; today, wherever it falls, and whatever else it is
  [,(sel '& is-today)
   #:border-color ,green
   #:color ,green
   #:font-weight 600]
  ;; today AND open: the ring says which day it is, the fill says you are on it
  [,(sel '& is-today is-current) #:color ,paper]
  ;; a finger, on the one screen where the sidebar is the header
  [@ media (#:max-width ,phone-max) #:min-height ,touch-min])

;; A day the journal has nothing for: dim, and that is the whole of it.
(define-style ol-cal-empty #:color ,dim #:font-weight 400)

;; A day it HAS something for: ink, a dot, and a hover — the only kind of cell
;; that goes anywhere, so the only kind that answers the pointer. The dot is
;; currentColor, so it follows the cell into every state above rather than
;; carrying a colour of its own to keep in step.
(register-fragment!
 (css-expr
  [,(sel 'a ol-cal-day) #:color ,ink #:font-weight 600]
  [(: ,(sel 'a ol-cal-day) hover) #:background ,pill-bg]
  ;; …and the day you are ON outranks its own hover. The pointer is still over
  ;; the cell you just clicked, so a fill a hover can replace is a fill that
  ;; disappears at exactly the moment it is supposed to appear — which is what
  ;; the report was about, and what only a CLICK finds (a page loaded straight
  ;; at the address has no pointer on anything).
  [,(sel 'a ol-cal-day is-current) #:background ,ink #:color ,paper]
  [(:: ,(sel 'a ol-cal-day) after)
   #:content ""
   #:position absolute
   #:bottom 0.1875rem
   #:width 4px
   #:height 4px
   #:border-radius 50%
   #:background currentColor
   #:opacity 0.7]))

;; The blank cells at either end: the days of the month's first and last week
;; that belong to another month.
(define-style ol-cal-pad #:min-height 1.5rem)

(define (month-label ym)
  (define-values (y m) (parse-year-month ym))
  (format "~a ~a" (month-name m) y))

(define (day-xexpr cell current-key node-href)
  (cond
    [(not cell) `(span ((class ,ol-cal-pad) (aria-hidden "true")))]
    [else
     (define key (hash-ref cell 'key))
     (define label (number->string (hash-ref cell 'day_num)))
     (define current? (and key (equal? key current-key)))
     (define cls (classes ol-cal-day
                          (and (hash-ref cell 'is_today) is-today)
                          (and current? is-current)
                          (and (not key) ol-cal-empty)))
     (if key
         `(a ((class ,cls)
              (title ,(hash-ref cell 'date))
              ;; what the day IS, for the one thing the server cannot keep
              ;; current: a navigation swaps the outline region and leaves this
              ;; chrome alone, so static/calendar.js re-marks by key after
              ;; every swap (web/page carries the page's own)
              (data-day-key ,key)
              ;; the day you are on is where you ARE, not somewhere to go;
              ;; a screen reader is told so rather than left to read a link
              ,@(if current? '((aria-current "page")) '())
              ,@(node-link-attributes node-href key))
             ,label)
         `(span ((class ,cls)) ,label))]))

(define (render-month-calendar tasks
                               #:today today
                               #:current-key current-key
                               #:node-href node-href)
  ;; the month is today's, and today is an argument: nothing here reads a clock
  (define ym (substring today 0 7))
  (define month (day-month-for tasks ym today))
  (define key (day-month-key month))
  (define label (month-label ym))
  `(div ((class ,ol-cal))
        ,(if key
             `(a ((class ,ol-cal-title)
                  (title "the whole journal")
                  ,@(node-link-attributes node-href key))
                 ,label)
             `(div ((class ,ol-cal-title)) ,label))
        (div ((class ,ol-cal-grid))
             ;; the headings are the grid's own column order, named by the
             ;; library that names days: a week that started on Sunday would
             ;; relabel itself
             ,@(for/list ([w (in-list week-days)])
                 `(div ((class ,ol-cal-dow) (aria-hidden "true"))
                       ,(weekday-abbrev w)))
             ,@(for/list ([c (in-list (day-month-cells month))])
                 (day-xexpr c current-key node-href)))))
