#lang racket/base

;; PILLS: what a node's date and its in-progress state read like.
;;
;; The shape is the skin's (web/theme, .ol-pill) because web/markdown draws a
;; pill too; what a DATE looks like is here. .ol-pill comes first in the
;; cascade, so these repaint it.
;;
;; Display only. The ISO date stays in the file and in the struct — this is the
;; one place that decides a human reads "Tue 15 Jan" instead.

(require racket/contract
         racket/string
         (except-in olai/lang/expander #%module-begin)
         olai/dates
         olai/web/theme
         olai/web/style
         ;; what a link to a node wears; one owner for that, web/address
         (only-in olai/web/address node-link-attributes)
         (only-in olai/web/states is-done is-today))

(provide (contract-out
          ;; a bare-ISO day title, drawn as the day it names
          [day-pill-xexpr (-> string? string? boolean? list?)]
          ;; a node's @date, with its time beside it when it has one
          [date-pill-xexpr (-> string? string? boolean? list?)]
          [doing-pill-xexpr (-> list?)]
          ;; the nodes an unfinished @after points at, and the address of one.
          ;; `list?`, not `(listof task?)`: the contracts at this boundary are
          ;; flat and cheap by rule (CLAUDE.md), and every other renderer here
          ;; takes its nodes the same way
          [blocked-pill-xexpr (-> list? (-> string? string?) list?)]))

(define-style ol-date
  #:background ,blue-bg
  #:color ,blue-fg
  #:font-variant-numeric tabular-nums
  ;; today is the accent, and the only pill that carries a border
  [,(sel '& is-today)
   #:background ,pill-bg
   #:color ,green
   #:border-color ,green
   #:font-weight 600]
  ;; a done date is history: it keeps its place and stops shouting
  [,(sel '& is-done)
   #:background ,pill-bg
   #:color ,dim
   #:border-color transparent
   #:text-decoration line-through])

(define-style ol-day #:font-weight 500)

(define-style ol-date-time
  #:opacity 0.75
  #:font-family ,mono
  #:font-size ,micro-size)

;; DOING has no date to hang off and no strikethrough to read it from, so it
;; says itself: italic and pulsing, and the pulse drops out under
;; prefers-reduced-motion, which is why the slant is there too. Amber like a
;; #tag — the palette's attention colour — but bordered, uppercase and micro,
;; which no tag is.
(define-component (doing-pill-xexpr)
  #:class ol-doing
  #:css (#:background ,amber-bg
         #:color ,amber-fg
         #:border-color ,amber-fg
         #:font-style italic
         #:font-size ,micro-size
         #:letter-spacing 0.06em
         #:text-transform uppercase
         #:animation (ol-doing-pulse ,busy-beat ease-in-out infinite)
         ;; the pill still says doing; only the breathing drops out
         [@ media (#:prefers-reduced-motion reduce) #:animation none])
  `(span ((class ,(classes ol-pill ol-doing)) (title "in progress")) "doing"))

(register-fragment!
 (css-expr
  [@ keyframes ol-doing-pulse
     [0% 100% #:opacity 1]
     [50% #:opacity 0.55]]))

;; BLOCKED is the opposite reading of doing, and it is drawn as one: a node
;; waiting on something unfinished is on the page, in its place in the tree,
;; and greyed out of the running. No pulse and no colour — a thing you cannot
;; start is the one thing on the row that should not ask for attention — and
;; the same micro uppercase the doing pill wears, so the two read as the same
;; kind of fact about a node.
;;
;; What it is waiting ON is its title: `@after ^order` is in the file, and the
;; pill is what makes it visible without opening one. It links to the FIRST
;; blocker, because the next thing a reader wants is that node — at the address
;; the route table minted (web/routes), like every other link to a node.
;; Nothing here assembles one.
(define-component (blocked-pill-xexpr waiting node-href)
  #:class ol-blocked
  #:css (#:background ,pill-bg
         #:color ,dim
         #:border-color ,line
         #:font-size ,micro-size
         #:letter-spacing 0.06em
         #:text-transform uppercase
         #:text-decoration none
         [(: & hover) #:color ,ink])
  `(a ((class ,(classes ol-pill ol-blocked))
       (title ,(string-append "after " (waiting-label waiting)))
       ,@(node-link-attributes node-href (task-key (car waiting))))
      "blocked"))

;; "^order" / "^order, clear the driveway" — a blocker as the outline names it:
;; its anchor when it has one, else the line it is written on. An unanchored
;; node can block another (`clear the driveway @blocks ^order`), and a key is
;; not a name a person wrote.
(define (waiting-label waiting)
  (string-join
   (for/list ([tk (in-list waiting)])
     (if (task-id tk)
         (string-append "^" (task-id tk))
         (task-title tk)))
   ", "))

;; Bare ISO day title -> friendly pill (display-only). ISO stays in the file.
(define (day-pill-xexpr iso-day today done?)
  `(span ((class ,(classes ol-pill ol-date ol-day
                           (and (equal? iso-day today) is-today)
                           (and done? is-done)))
          (title ,iso-day)
          ,@(if (equal? iso-day today) '((data-today "true")) '()))
         ,(friendly-date-label iso-day)))

(define (date-pill-xexpr date today done?)
  (define day (date-day-prefix date))
  `(span ((class ,(classes ol-pill ol-date
                           (and (equal? day today) is-today)
                           (and done? is-done)))
          (title ,date))
         ,(if (bare-iso-date-title? day) (friendly-date-label day) date)
         ,@(if (> (string-length date) 10)
               (list `(span ((class ,ol-date-time)) ,(substring date 11)))
               '())))
