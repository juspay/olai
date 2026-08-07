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
         olai/lang/line
         ;; where a section ends and which line is a given title: the same two
         ;; questions `capture` and `subtree` ask, asked of the same module
         olai/lang/section
         (except-in olai/lang/expander #%module-begin)
         (only-in olai/query count-tasks))

(provide month-name
         month-fragment-rel
         ensure-daily-day!
         migrate-monolithic-daily!)

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
  (define root (build-path home-path "Daily.rkt"))
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

  (define root-lines*
    (if (find-title-line root-lines year-title 0)
        root-lines
        (append root-lines
                (if (or (null? root-lines)
                        (blank-line? (last root-lines)))
                    (list year-title)
                    (list "" year-title)))))

  (define year-i (find-title-line root-lines* year-title 0))
  (unless year-i (error 'daily "internal: year node missing"))

  (define year-end (section-end root-lines* year-i))
  (define mon-i
    (find-title-line root-lines* mon-title 2 #:from (add1 year-i) #:to year-end))

  (define root-lines**
    (if mon-i
        root-lines*
        (append (take root-lines* year-end)
                (list (string-append "  " mon-title))
                (drop root-lines* year-end))))

  (define mon-i* (or mon-i (find-title-line root-lines** mon-title 2)))
  (unless mon-i* (error 'daily "internal: month node missing"))

  (define include-line (string-append "    @include " rel))
  (define mon-end (section-end root-lines** mon-i*))
  (define has-include?
    (for/or ([i (in-range (add1 mon-i*) mon-end)])
      (regexp-match?
       (pregexp (string-append "^\\s*@include\\s+" (regexp-quote rel) "\\s*$"))
       (list-ref root-lines** i))))

  (define added-include? (not has-include?))
  (define root-lines***
    (if has-include?
        root-lines**
        (append (take root-lines** mon-end)
                (list include-line)
                (drop root-lines** mon-end))))

  (define root-text* (lines->text root-lines*** root-text))
  (unless (equal? root-text* root-text)
    (edit! root root-text*))

  (hash 'day day
        'file (path->string (simple-form-path frag))
        'created_month (or created-month? added-include?)
        'created_day created-day?
        'line day-line))

;; Migrate monolithic Daily.rkt (year>month>days) into Daily/YYYY-MM.rkt.
;; Returns (list task-count-before task-count-after).
(define (migrate-monolithic-daily! home)
  (define home-path (simple-form-path (expand-user-path home)))
  (define root (build-path home-path "Daily.rkt"))
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
