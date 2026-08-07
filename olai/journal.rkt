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
         ;; where the days of a month land, which is arithmetic and has one
         ;; owner whoever draws it (olai/dates, month-layout)
         (only-in olai/dates month-grid-dates)
         ;; one owner for what a file is CALLED (core, not web)
         (only-in olai/paths file-label)
         ;; where the day nodes are: one walk, in the query layer
         (only-in olai/query collect-day-sites day-site-key day-site-parent))

(provide (contract-out
          ;; flat checks: a name, a predicate over one field, and two strings
          ;; built from a number. Nothing here reads a file.
          [daily-file-name string?]
          [daily-file-names (listof string?)]
          [daily-file? (-> any/c boolean?)]
          [month-name (-> (integer-in 1 12) string?)]
          [month-fragment-rel (->* (exact-integer? (integer-in 1 12))
                                   (#:ext string?)
                                   string?)]
          ;; one month of the journal's own days, on that grid
          [struct day-month ([key (or/c string? #f)] [cells list?])]
          [day-month-for (-> list? string? string? day-month?)]))

;; Preferred spelling after the flat-record migration. Daily.rkt still counts
;; as the journal for a home that has not renamed yet.
(define daily-file-name "Daily.jsonl")
(define daily-file-names '("Daily.jsonl" "Daily.rkt"))

;; A path — or a label a renderer has already reduced to one — that names it.
(define (daily-file? f)
  (and f (member (file-label f) daily-file-names) #t))

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
;; `#:ext` matches the journal root's surface (`.jsonl` or `.rkt`).
(define (month-fragment-rel year month #:ext [ext ".jsonl"])
  (format "Daily/~a-~a~a"
          year
          (~r month #:min-width 2 #:pad-string "0")
          ext))

;; ---- a month of it -----------------------------------------------------------
;;
;; A journal is READ a month at a time — that is what a calendar is. WHERE the
;; days land on the grid is not this module's: that is arithmetic over a
;; year-month, it has one answer whoever draws it, and olai/dates owns it
;; (month-layout). What is here is one month of THIS journal's days.

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
