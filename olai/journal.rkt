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
         ;; one owner for what a file is CALLED (core, not web)
         (only-in olai/paths file-label))

(provide (contract-out
          ;; flat checks: a name, a predicate over one field, and two strings
          ;; built from a number. Nothing here walks a tree or reads a file.
          [daily-file-name string?]
          [daily-file? (-> any/c boolean?)]
          [month-name (-> (integer-in 1 12) string?)]
          [month-fragment-rel (-> exact-integer? (integer-in 1 12) string?)]))

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
