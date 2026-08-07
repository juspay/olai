#lang racket/base

;; WHAT THE DAY JOURNAL IS CALLED — and nothing about writing one.
;;
;; The same split `olai/archive` makes, for the same reason: recognising a root
;; is a question every layer asks (the sidebar draws the journal as a month,
;; the write path fills it in), while WRITING one is a question one command
;; asks. Kept in `olai/daily` the names came with that command's world — the
;; filesystem, git, the editor's line arithmetic — so a renderer that only
;; wanted to know whether this root is the diary would drag the write path onto
;; the page. It knows nothing here, and neither does anybody who asks it.
;;
;; The recognition itself is a BASENAME, and that is the whole rule. Nothing in
;; the language says "this root is the journal": `serve DIR` globs a directory
;; and gets a set of outlines, so the one thing everybody has to agree on is
;; the name — which is exactly the shape of the archive's answer.

(require racket/contract
         racket/format
         racket/list
         (except-in olai/lang/expander #%module-begin)
         ;; what a month and a day are called in a string, from the module
         ;; that owns every other date form (olai/dates)
         (only-in olai/dates parse-year-month iso-day-string)
         ;; one owner for what a file is CALLED (core, not web)
         (only-in olai/paths file-label)
         ;; where the day nodes are: one walk, in the query layer
         (only-in olai/query collect-day-sites day-site-key day-site-parent)
         (only-in gregor date days-in-month ->wday))

(provide (contract-out
          ;; flat checks: a name, a predicate over one field, and two strings
          ;; built from a number. Nothing here reads a file.
          [daily-file-name string?]
          [daily-file? (-> any/c boolean?)]
          [month-name (-> (integer-in 1 12) string?)]
          [month-fragment-rel (-> exact-integer? (integer-in 1 12) string?)]
          ;; the week's columns, and a month laid out on them
          [week-days (listof (integer-in 0 6))]
          [month-grid-dates (-> string? string? list?)]
          [struct day-month ([key (or/c string? #f)] [cells list?])]
          [day-month-for (-> list? string? string? day-month?)]))

;; The one spelling. Capitalised like the other roots an outline home holds
;; (Tasks.rkt, Archive.rkt): it IS one of them.
(define daily-file-name "Daily.rkt")

;; A path — or a label a renderer has already reduced to one — that names it.
(define (daily-file? f)
  (and f (equal? (file-label f) daily-file-name)))

;; The month names the journal's own nodes are titled with. English, and the
;; outline's rather than the locale's: these are TITLES in a file somebody
;; edits by hand, so they are the words `olai daily` writes and the words a
;; month header reads back, not something that moves with a machine's settings.
(define month-names
  #("January" "February" "March" "April" "May" "June"
    "July" "August" "September" "October" "November" "December"))

(define (month-name m)
  (vector-ref month-names (sub1 m)))

;; Where a month's day nodes live, relative to the root that includes them.
(define (month-fragment-rel year month)
  (format "Daily/~a-~a.rkt"
          year
          (~r month #:min-width 2 #:pad-string "0")))

;; ---- a month of it -----------------------------------------------------------
;;
;; A journal is READ a month at a time — that is what a calendar is — so the
;; month's shape lives here with the rest of what the journal is, not in
;; whichever surface draws it and not in the dated-task queries next door,
;; which are about `@date`s and not about days.

;; THE WEEK, as this grid lays it out: gregor weekdays (0=Sun … 6=Sat), Monday
;; first. The column order and the lead padding are one fact, so they are read
;; off one list — and a surface that draws headings over the columns reads the
;; same one rather than remembering which day this module starts on.
(define week-days '(1 2 3 4 5 6 0))

;; WHERE THE DAYS LAND: one month as whole weeks, #f for the padding at either
;; end (the days of the first and last week that belong to another month).
;; Cell: hash of date/day_num/is_today.
;;
;; The layout and nothing else — which column the 1st is in, how many days the
;; month has, how far the last week has to be padded. What a cell then SAYS
;; about its day is the caller's.
(define (month-grid-dates ym today)
  (define-values (y m) (parse-year-month ym))
  (unless y (error 'month-grid-dates "bad year-month: ~s" ym))
  (define lead (index-of week-days (->wday (date y m 1))))
  (define cells
    (append
     (make-list lead #f)
     (for/list ([dom (in-range 1 (add1 (days-in-month y m)))])
       (define date-str (iso-day-string y m dom))
       (hash 'date date-str
             'day_num dom
             'is_today (equal? date-str today)))))
  (define week (length week-days))
  (define rem (remainder (length cells) week))
  (if (zero? rem)
      cells
      (append cells (make-list (- week rem) #f))))

;; ONE MONTH OF THE JOURNAL, whole:
;;
;;   key   what the month AS A WHOLE is reached at — the node its days hang
;;         under (the month node in a Daily.rkt, the year in the monolithic
;;         shape), else the outline's first node, else #f for an outline with
;;         nothing in it. A month nobody has written in yet still has to be a
;;         way into the journal, which is what the fallback is for.
;;   cells the grid above, each cell carrying the `key` of the day node it
;;         stands for — #f for a day the outline has none for, which is the
;;         whole of "an empty day is inert": there is nothing to address.
;;
;; One value and not a list the caller picks a month key out of: the month's
;; own address is a fact about the month, and a drawer scanning cells for it
;; would be rebuilding a whole out of its parts.
;;
;; Day NODES and not dated tasks: a cell is a way into a day's own page, and a
;; `@date` on a task somewhere is not one.
(struct day-month (key cells) #:transparent)

(define (day-month-for tasks ym today)
  (define sites (collect-day-sites tasks))
  (define cells
    (for/list ([cell (in-list (month-grid-dates ym today))])
      (and cell
           (let ([site (hash-ref sites (hash-ref cell 'date) #f)])
             (hash-set cell 'key (and site (day-site-key site)))))))
  (day-month (month-holder-key tasks sites cells) cells))

;; What this month hangs under, taken from its FIRST day: the node a reader
;; zooms to see the whole of it. Off the cells, which are already in date
;; order, so the answer is the same on every render.
(define (month-holder-key tasks sites cells)
  (or (for/or ([cell (in-list cells)])
        (define key (and cell (hash-ref cell 'key)))
        (and key (day-site-parent (hash-ref sites (hash-ref cell 'date)))))
      (let ([tk (findf task? tasks)]) (and tk (task-key tk)))))
