#lang racket/base

;; Monthly Daily.rkt rollover: flat Daily/YYYY-MM.rkt fragments + @include.

(require racket/file
         racket/list
         racket/match
         racket/path
         racket/string
         racket/format
         olai/dates
         olai/edit
         ;; what an @include path names, and whether a starred one names this
         ;; fragment: the one question "is it already covered" is, asked of
         ;; the module that answers it for the language too
         (only-in olai/glob include-glob? include-absolute glob-match?)
         olai/lang/line
         ;; where a section ends and which line is a given title: the same two
         ;; questions `capture` and `subtree` ask, asked of the same module
         olai/lang/section
         (except-in olai/lang/expander #%module-begin)
         ;; one owner for what a file is CALLED (core, not web)
         (only-in olai/paths file-label)
         (only-in olai/query count-tasks))

(provide daily-file-name
         daily-file?
         month-name
         month-fragment-rel
         ensure-daily-day!
         migrate-monolithic-daily!)

;; THE DAY JOURNAL, recognised the way the archive is (olai/archive): by its
;; BASENAME, and by nothing else. Nothing in the language says "this root is
;; the diary" — `serve DIR` globs a directory and gets a set of outlines — so
;; the one thing everybody has to agree on is the name, and it is agreed on
;; here, where the command that writes the file lives.
(define daily-file-name "Daily.rkt")

;; A path (or a label a renderer already reduced to one) that names it.
(define (daily-file? f)
  (and f (equal? (file-label f) daily-file-name)))

(define month-names
  #("January" "February" "March" "April" "May" "June"
    "July" "August" "September" "October" "November" "December"))

(define (month-name m) ; 1..12
  (vector-ref month-names (sub1 m)))

(define (month-fragment-rel year month)
  (format "Daily/~a-~a.rkt"
          year
          (~r month #:min-width 2 #:pad-string "0")))

(define (parse-iso-day day)
  (unless (bare-iso-date-title? day)
    (error 'daily "expected YYYY-MM-DD, got ~s" day))
  (define y (string->number (substring day 0 4)))
  (define m (string->number (substring day 5 7)))
  (values y m))

;; -> (list indent title) for a title line, #f for anything else. What a title
;; line SAYS is lang/section's answer; the migration below wants it paired with
;; the level, which is the only reason this exists.
(define (scan-title-line s)
  (define text (title-line-text s))
  (and text (list (indent-of s) text)))

;; The year node of a monolithic Daily.rkt: a top-level 4-digit title.
;; Takes a scan-title-line answer, gives back the year string or #f.
(define (year-node-title info)
  (match info
    [(list 0 (and year (regexp #px"^[0-9]{4}$"))) year]
    [_ #f]))

(define (make-parent-directory* path)
  (define-values (base name dir?) (split-path path))
  (when (path? base)
    (make-directory* base)))

(define (ensure-file-lang path)
  (unless (file-exists? path)
    (make-parent-directory* path)
    (display-to-file "#lang olai\n" path #:exists 'error)))

;; Ensure day node exists. Returns hash of result fields (no version/ok).
;; #:on-applied is called with every file actually rewritten (0, 1 or 2 of
;; them: the month fragment and the root that includes it).
;;
;; Those two are ONE change, so they are one write: both texts are computed,
;; then validated and renamed together (olai/edit). Written one at a time, a
;; fragment could land while the root that includes it was rejected — a day
;; node nothing points at.
(define (ensure-daily-day! home day #:on-applied [on-applied void])
  (define edits (box '()))
  (define result (ensure-daily-day!* home day edits))
  (unless (null? (unbox edits))
    (apply-outline-edits! (reverse (unbox edits)) #:on-applied on-applied))
  result)

(define (ensure-daily-day!* home day edits)
  (define (edit! path text) (set-box! edits (cons (cons path text) (unbox edits))))
  (define-values (y m) (parse-iso-day day))
  (define home-path (simple-form-path (expand-user-path home)))
  (define root (build-path home-path daily-file-name))
  (define rel (month-fragment-rel y m))
  (define frag (build-path home-path rel))
  (define year-title (number->string y))
  (define mon-title (month-name m))

  (ensure-file-lang root)
  (define created-month? #f)
  (define created-day? #f)

  (unless (file-exists? frag)
    (set! created-month? #t)
    (make-parent-directory* frag)
    (display-to-file "#lang olai\n" frag #:exists 'error))

  (define frag-text (file->string frag))
  (define frag-lines (text-lines frag-text))
  (define day-idx (find-title-line frag-lines day 0))
  (define day-line
    (cond
      [day-idx (add1 day-idx)]
      [else
       (set! created-day? #t)
       (define after-lang
         (for/or ([i (in-range (length frag-lines))])
           (and (regexp-match? #px"^#lang\\s" (list-ref frag-lines i))
                (add1 i))))
       (define at (or after-lang (length frag-lines)))
       (define new-lines
         (append (take frag-lines at)
                 (list day)
                 (drop frag-lines at)))
       (define new-text (lines->text new-lines frag-text))
       (edit! frag new-text)
       (add1 at)]))

  (define root-text (file->string root))
  (unless (regexp-match? #px"(?m:^#lang olai)" root-text)
    (error 'daily "Daily.rkt must be #lang olai"))
  (define root-lines (text-lines root-text))

  ;; A pattern the root already wrote may NAME this fragment, and then there
  ;; is nothing to write into the root at all — not the @include line, and not
  ;; the year and month nodes it would hang under. The shape above a glob is
  ;; the outline's own; what this command owns is the fragment.
  (define covered-by (covering-glob root-lines home-path rel))

  (define root-text*
    (if covered-by
        root-text
        (lines->text
         (root-lines-with-include root-lines year-title mon-title rel)
         root-text)))
  (define wrote-root? (not (equal? root-text* root-text)))
  (when wrote-root?
    (edit! root root-text*))

  (hash 'day day
        'file (path->string (simple-form-path frag))
        ;; The root gains the line and the nodes above it exactly when the
        ;; month is new to it, so what was written IS the answer.
        'created_month (or created-month? wrote-root?)
        'created_day created-day?
        'covered_by_glob covered-by
        'line day-line))

;; The root's lines with `year > Month > @include rel` in them, adding only
;; what is missing — and nothing at all when the line is already there. Pure:
;; the caller decides whether the answer is worth writing, and never asks when
;; a glob already covers the fragment.
(define (root-lines-with-include lines year-title mon-title rel)
  (define lines*
    (if (find-title-line lines year-title 0)
        lines
        (append lines
                (if (or (null? lines)
                        (blank-line? (last lines)))
                    (list year-title)
                    (list "" year-title)))))

  (define year-i (find-title-line lines* year-title 0))
  (unless year-i (error 'daily "internal: year node missing"))

  (define year-end (section-end lines* year-i))
  (define mon-i
    (find-title-line lines* mon-title 2 #:from (add1 year-i) #:to year-end))

  (define lines**
    (if mon-i
        lines*
        (append (take lines* year-end)
                (list (string-append "  " mon-title))
                (drop lines* year-end))))

  (define mon-i* (or mon-i (find-title-line lines** mon-title 2)))
  (unless mon-i* (error 'daily "internal: month node missing"))

  (define mon-end (section-end lines** mon-i*))
  (cond
    [(member rel (include-paths lines** (add1 mon-i*) mon-end)) lines**]
    [else (append (take lines** mon-end)
                  (list (string-append "    @include " rel))
                  (drop lines** mon-end))]))

;; The @include pattern the root ALREADY wrote that names this fragment, or
;; #f. Verbatim, as the source wrote it: it is what the reply reports.
;;
;; A literal @include is a claim about one file; a glob is a query over one
;; directory (olai/glob), and a fragment that lands in that directory is
;; spliced by it the moment it exists. Adding the literal line as well would
;; splice the fragment TWICE — every day node in the month duplicated in the
;; tree — which is the bug this answers.
;;
;; The WHOLE root is asked, not the month's section: a glob's answer is about
;; the directory it reads, and where the line was written says nothing about
;; it.
;;
;; A pattern that is not relative to the root is one the include form cannot
;; resolve either, so it names nothing here and covers nothing.
(define (covering-glob lines dir rel)
  (define target (include-absolute rel dir))
  (for/or ([p (in-list (include-paths lines 0 (length lines)))])
    (and (include-glob? p)
         (relative-path? p)
         (glob-match? (include-absolute p dir) target)
         p)))

;; The paths the @include lines in [from, to) name, in order. What a line SAYS
;; is the line grammar's answer (olai/lang/line), never a regexp of our own.
(define (include-paths lines from to)
  (for*/list ([i (in-range from to)]
              [s (in-value (list-ref lines i))]
              [k (in-value (classify-line (line-content s)))]
              #:when (line-include? k))
    (include-path k)))

(define (line-content s)
  (define-values (_indent content) (line-indent+content s))
  content)

;; Migrate monolithic Daily.rkt (year>month>days) into Daily/YYYY-MM.rkt.
;; Returns (list task-count-before task-count-after).
(define (migrate-monolithic-daily! home)
  (define home-path (simple-form-path (expand-user-path home)))
  (define root (build-path home-path daily-file-name))
  (unless (file-exists? root)
    (error 'migrate "no Daily.rkt at ~a" root))
  (define n-before
    (count-tasks (dynamic-require `(file ,(path->string root)) 'tasks)))

  (define text (file->string root))
  (define lines (text-lines text))

  (define result (make-hash)) ; key -> list of day line-groups
  (define current-year #f)
  (define current-month #f)
  (define current-day #f)
  (define day-buf '())

  (define (flush-day!)
    (when (and current-year current-month current-day (pair? day-buf))
      (define key
        (format "~a-~a" current-year
                (~r current-month #:min-width 2 #:pad-string "0")))
      (hash-update! result key
                    (λ (xs) (append xs (list (reverse day-buf))))
                    '()))
    (set! day-buf '())
    (set! current-day #f))

  ;; A line under a day node moves up two levels when the day becomes the
  ;; fragment's top node.
  (define (dedented s)
    (define-values (ind content) (line-indent+content s))
    (string-append (make-string (max 0 (- ind 4)) #\space) content))

  (for ([s (in-list lines)])
    (define info (scan-title-line s))
    (match info
      [(app year-node-title (? string? year))
       (flush-day!)
       (set! current-year (string->number year))
       (set! current-month #f)]
      [(list 2 month)
       #:when current-year
       (flush-day!)
       (set! current-month
             (for/or ([i (in-range 1 13)])
               (and (equal? (month-name i) month) i)))]
      [(list 4 (? bare-iso-date-title? day))
       #:when (and current-year current-month)
       (flush-day!)
       (set! current-day day)
       (set! day-buf (list day))]
      [_
       (cond
         [(and current-day (or info (not (blank-line? s))))
          (set! day-buf (cons (dedented s) day-buf))]
         [(and current-day (blank-line? s))
          (set! day-buf (cons "" day-buf))]
         [else (void)])]))
  (flush-day!)

  (when (hash-empty? result)
    (error 'migrate "no year/month/day structure found to migrate"))

  (for ([(key day-groups) (in-hash result)])
    (define rel (string-append "Daily/" key ".rkt"))
    (define frag (build-path home-path rel))
    (make-parent-directory* frag)
    (define body
      (string-append
       "#lang olai\n\n"
       (string-join
        (for/list ([g (in-list day-groups)])
          (string-join g "\n"))
        "\n\n")
       "\n"))
    (display-to-file body frag #:exists 'truncate/replace)
    (dynamic-require `(file ,(path->string frag)) 'tasks))

  ;; Everything above the first year node stays at the root, verbatim.
  (define header-lines
    (for/list ([s (in-list lines)]
               #:break (year-node-title (scan-title-line s)))
      s))

  (define years
    (sort (remove-duplicates
           (for/list ([k (in-hash-keys result)])
             (substring k 0 4)))
          string<?))

  (define body-lines
    (append*
     (for/list ([y (in-list years)])
       (define months
         (sort
          (for/list ([k (in-hash-keys result)]
                     #:when (string-prefix? k (string-append y "-")))
            (string->number (substring k 5 7)))
          <))
       (cons y
             (append*
              (for/list ([m (in-list months)])
                (list (string-append "  " (month-name m))
                      (string-append "    @include "
                                     (month-fragment-rel (string->number y) m)))))))))

  (define hdr
    (if (and (pair? header-lines) (blank-line? (last header-lines)))
        header-lines
        (append header-lines (list ""))))
  (define new-root
    (string-append (string-join hdr "\n")
                   (string-join body-lines "\n")
                   "\n"))
  (apply-outline-edit! root new-root)

  (define n-after
    (count-tasks (dynamic-require `(file ,(path->string root)) 'tasks)))
  (list n-before n-after))
