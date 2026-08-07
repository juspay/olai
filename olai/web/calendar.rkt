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
         ;; the days this outline HAS, laid out as a month, and the order this
         ;; grid's columns come in — the same grid the CLI's calendar is laid
         ;; out on (olai/calendar)
         (only-in olai/calendar
                  day-month-for day-month-key day-month-cells
                  week-days parse-year-month)
         ;; what a month is called; the module that owns the journal owns that
         (only-in olai/journal month-name)
         ;; and what a weekday is called, which is gregor's to say (olai/dates)
         (only-in olai/dates weekday-abbrev)
         olai/web/theme
         olai/web/style
         (only-in olai/web/states is-today)
         ;; what a link to a node wears; one owner for that, web/address
         (only-in olai/web/address node-link-attributes))

(provide (contract-out
          ;; the Daily root's top-level tasks -> the month around `today`
          [render-month-calendar
           (-> list? #:today string? #:node-href (-> string? string?) list?)]))

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

;; One day. The same box whether or not it leads anywhere, so the month does
;; not jump about: what differs is the ink and whether it is a link.
(define-style ol-cal-day
  #:display flex
  #:align-items center
  #:justify-content center
  #:min-height 1.5rem
  #:border-radius ,radius
  #:border (1px solid transparent)
  #:font-size 0.75rem
  #:font-variant-numeric tabular-nums
  #:text-decoration none
  ;; a day with something in it: full ink, and it is a link
  #:color ,ink
  #:font-weight 500
  ;; today, wherever it falls: the accent the date pill wears, so the two read
  ;; as one idea (web/pills)
  [,(sel '& is-today)
   #:border-color ,green
   #:color ,green
   #:font-weight 600]
  ;; a finger, on the one screen where the sidebar is the header
  [@ media (#:max-width ,phone-max) #:min-height ,touch-min])

;; A day the journal has nothing for: dim.
(define-style ol-cal-empty #:color ,dim #:font-weight 400)

;; And the hover is the LINK's, not the box's, so only a cell that goes
;; somewhere lights up under the pointer.
(register-fragment!
 (css-expr [(: ,(sel 'a ol-cal-day) hover) #:background ,pill-bg]))

;; The blank cells at either end: the days of the month's first and last week
;; that belong to another month.
(define-style ol-cal-pad #:min-height 1.5rem)

(define (month-label ym)
  (define-values (y m) (parse-year-month ym))
  (format "~a ~a" (month-name m) y))

(define (day-xexpr cell node-href)
  (cond
    [(not cell) `(span ((class ,ol-cal-pad) (aria-hidden "true")))]
    [else
     (define key (hash-ref cell 'key))
     (define label (number->string (hash-ref cell 'day_num)))
     (define cls (classes ol-cal-day
                          (and (hash-ref cell 'is_today) is-today)
                          (and (not key) ol-cal-empty)))
     (if key
         `(a ((class ,cls)
              (title ,(hash-ref cell 'date))
              ,@(node-link-attributes node-href key))
             ,label)
         `(span ((class ,cls)) ,label))]))

(define (render-month-calendar tasks #:today today #:node-href node-href)
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
                 (day-xexpr c node-href)))))
